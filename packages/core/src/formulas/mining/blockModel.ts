/**
 * Motor de calculo del modulo `mining.block-model` (Modelo de Bloques): trazas de sondaje,
 * compositacion, interpolacion de leyes (IDW o kriging ordinario) y curva ley-tonelaje.
 *
 * Fuentes:
 * - Traza de sondaje: geometria de un sondaje RECTO (sin desviacion/encuestas de desviacion —
 *   simplificacion valida para sondajes cortos o de exploracion temprana; para sondajes profundos
 *   desviados se requeriria integrar la encuesta downhole real). Usa la misma convencion
 *   trend/plunge que `mining.stereonet` (trend = azimut desde el norte, plunge positivo hacia
 *   abajo = -inclinacion de perforacion, que por convencion de sondajes es negativa hacia abajo).
 * - Compositacion: promedio ponderado por longitud de los intervalos de ensayo dentro de cada
 *   tramo de longitud fija (practica estandar en estimacion de recursos antes de interpolar).
 * - IDW (Inverso de la Distancia): ley = sum(zi/di^p) / sum(1/di^p), p tipico = 2 (ver plan del
 *   proyecto, seccion B.4). Si un punto coincide con una muestra (d=0), se usa su ley exacta.
 * - Kriging ordinario: sistema de Journel & Huijbregts (1978) / Isaaks & Srivastava (1989) —
 *   ver `variogram.ts` para el modelo de semivarianza y su ajuste.
 * - Curva ley-tonelaje: para cada ley de corte, suma el tonelaje (volumen x densidad) y la ley
 *   media de los bloques con ley >= corte.
 */

import { direccionAVector } from "./stereonet.js";
import { semivarianza } from "./variogram.js";
import type {
  Bloque,
  ColarSondaje,
  CompositoEnsayo,
  DefinicionModeloBloques,
  EntradaInterpolacionModelo,
  IntervaloEnsayo,
  ModeloBloques,
  ModeloVariograma,
  PuntoCurvaLeyTonelaje,
  ResumenTonelajeCorte,
} from "../../domain/blockModel.js";

/** Punto 3D a una profundidad dada a lo largo de un sondaje recto, desde su collar. */
export function puntoEnSondaje(
  collar: { x: number; y: number; z: number },
  azimut_grados: number,
  inclinacion_grados: number,
  profundidad_m: number
): { x: number; y: number; z: number } {
  const plunge_grados = -inclinacion_grados; // convencion de perforacion (negativo=abajo) -> plunge (positivo=abajo)
  const v = direccionAVector(azimut_grados, plunge_grados); // {n,e,d}: Norte, Este, Abajo
  return {
    x: collar.x + profundidad_m * v.e,
    y: collar.y + profundidad_m * v.n,
    z: collar.z - profundidad_m * v.d,
  };
}

/** Compositacion de un sondaje: intervalos de ensayo -> tramos de longitud fija (promedio ponderado por longitud). */
export function compositarSondaje(
  collar: ColarSondaje,
  intervalos: IntervaloEnsayo[],
  longitudComposito_m: number
): CompositoEnsayo[] {
  const intervalosSondaje = intervalos.filter((i) => i.sondajeId === collar.id).sort((a, b) => a.desde_m - b.desde_m);
  if (intervalosSondaje.length === 0 || longitudComposito_m <= 0) return [];

  const profundidadMax = Math.min(collar.profundidadTotal_m, Math.max(...intervalosSondaje.map((i) => i.hasta_m)));
  const azimut = collar.azimut_grados ?? 0;
  const inclinacion = collar.inclinacion_grados ?? -90;

  const compositos: CompositoEnsayo[] = [];
  for (let desde = 0; desde < profundidadMax - 1e-9; desde += longitudComposito_m) {
    const hasta = Math.min(desde + longitudComposito_m, profundidadMax);
    let sumaLeyLongitud = 0;
    let longitudCubierta = 0;
    for (const intervalo of intervalosSondaje) {
      const ini = Math.max(desde, intervalo.desde_m);
      const fin = Math.min(hasta, intervalo.hasta_m);
      if (fin > ini) {
        const longitud = fin - ini;
        sumaLeyLongitud += intervalo.ley * longitud;
        longitudCubierta += longitud;
      }
    }
    if (longitudCubierta > 0) {
      const medio = (desde + hasta) / 2;
      const punto = puntoEnSondaje(collar, azimut, inclinacion, medio);
      compositos.push({ sondajeId: collar.id, desde_m: desde, hasta_m: hasta, ley: sumaLeyLongitud / longitudCubierta, ...punto });
    }
  }
  return compositos;
}

/** Interpola la ley en un punto por Inverso de la Distancia (IDW) a partir de compositos cercanos. */
export function interpolarIDW(
  punto: { x: number; y: number; z: number },
  muestras: CompositoEnsayo[],
  potencia: number,
  radioBusqueda_m: number,
  numeroMinimoMuestras: number,
  numeroMaximoMuestras?: number
): { ley: number | null; numeroMuestras: number } {
  const candidatas = muestras
    .map((m) => ({ m, d: Math.hypot(m.x - punto.x, m.y - punto.y, m.z - punto.z) }))
    .filter((c) => c.d <= radioBusqueda_m)
    .sort((a, b) => a.d - b.d);

  const usadas = numeroMaximoMuestras ? candidatas.slice(0, numeroMaximoMuestras) : candidatas;
  if (usadas.length < numeroMinimoMuestras) return { ley: null, numeroMuestras: usadas.length };

  const exacta = usadas.find((c) => c.d < 1e-6);
  if (exacta) return { ley: exacta.m.ley, numeroMuestras: usadas.length };

  let sumaPesos = 0;
  let sumaPesoLey = 0;
  for (const c of usadas) {
    const peso = 1 / Math.pow(c.d, potencia);
    sumaPesos += peso;
    sumaPesoLey += peso * c.m.ley;
  }
  return { ley: sumaPesoLey / sumaPesos, numeroMuestras: usadas.length };
}

/**
 * Resuelve Ax=b por eliminacion gaussiana con pivoteo parcial. Devuelve null si el sistema es
 * singular (dentro de una tolerancia numerica) — p.ej. muestras coincidentes en el sistema de
 * kriging generan filas identicas.
 */
function resolverSistemaLineal(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);

  for (let col = 0; col < n; col++) {
    let filaPivote = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(M[f][col]) > Math.abs(M[filaPivote][col])) filaPivote = f;
    }
    if (Math.abs(M[filaPivote][col]) < 1e-10) return null;
    if (filaPivote !== col) [M[col], M[filaPivote]] = [M[filaPivote], M[col]];

    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = M[f][col] / M[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[f][c] -= factor * M[col][c];
    }
  }
  return M.map((fila, i) => fila[n] / fila[i]);
}

/**
 * Interpola la ley en un punto por kriging ordinario: resuelve el sistema
 *   sum_j lambda_j * gamma(h_ij) + mu = gamma(h_i0)   para i=1..n
 *   sum_j lambda_j = 1
 * (Journel & Huijbregts 1978; Isaaks & Srivastava 1989, cap. 12) y estima
 *   ley = sum_i lambda_i * z_i,   varianza = sum_i lambda_i * gamma(h_i0) + mu.
 * Si el sistema resulta singular (p.ej. muestras coincidentes), recae en IDW (p=2) como respaldo.
 */
export function interpolarKriging(
  punto: { x: number; y: number; z: number },
  muestras: CompositoEnsayo[],
  variograma: ModeloVariograma,
  radioBusqueda_m: number,
  numeroMinimoMuestras: number,
  numeroMaximoMuestras?: number
): { ley: number | null; numeroMuestras: number; varianza: number | null } {
  const candidatas = muestras
    .map((m) => ({ m, d: Math.hypot(m.x - punto.x, m.y - punto.y, m.z - punto.z) }))
    .filter((c) => c.d <= radioBusqueda_m)
    .sort((a, b) => a.d - b.d);

  const usadas = numeroMaximoMuestras ? candidatas.slice(0, numeroMaximoMuestras) : candidatas;
  if (usadas.length < numeroMinimoMuestras) return { ley: null, numeroMuestras: usadas.length, varianza: null };

  const exacta = usadas.find((c) => c.d < 1e-6);
  if (exacta) return { ley: exacta.m.ley, numeroMuestras: usadas.length, varianza: 0 };

  const n = usadas.length;
  if (n === 1) {
    // Con una sola muestra, el kriging ordinario degenera al peso 1 sobre esa muestra.
    return { ley: usadas[0].m.ley, numeroMuestras: 1, varianza: variograma.meseta };
  }

  const A: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  const b: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const hij = Math.hypot(usadas[i].m.x - usadas[j].m.x, usadas[i].m.y - usadas[j].m.y, usadas[i].m.z - usadas[j].m.z);
      A[i][j] = semivarianza(variograma, hij);
    }
    A[i][n] = 1;
    A[n][i] = 1;
    b[i] = semivarianza(variograma, usadas[i].d);
  }
  A[n][n] = 0;
  b[n] = 1;

  const solucion = resolverSistemaLineal(A, b);
  if (!solucion) {
    const r = interpolarIDW(punto, usadas.map((c) => c.m), 2, radioBusqueda_m, 1, numeroMaximoMuestras);
    return { ley: r.ley, numeroMuestras: r.numeroMuestras, varianza: null };
  }

  const pesos = solucion.slice(0, n);
  const mu = solucion[n];
  const ley = pesos.reduce((acc, w, i) => acc + w * usadas[i].m.ley, 0);
  const varianza = pesos.reduce((acc, w, i) => acc + w * b[i], 0) + mu;
  return { ley, numeroMuestras: n, varianza: Math.max(varianza, 0) };
}

/** Genera la grilla de bloques (centros) dentro de la definicion del modelo, sin ley aun. */
export function generarGrillaBloques(definicion: DefinicionModeloBloques): Bloque[] {
  const bloques: Bloque[] = [];
  for (let i = 0; i < definicion.numeroBloques.x; i++) {
    for (let j = 0; j < definicion.numeroBloques.y; j++) {
      for (let k = 0; k < definicion.numeroBloques.z; k++) {
        bloques.push({
          i,
          j,
          k,
          centro: {
            x: definicion.origen.x + (i + 0.5) * definicion.tamanoBloque.x,
            y: definicion.origen.y + (j + 0.5) * definicion.tamanoBloque.y,
            z: definicion.origen.z + (k + 0.5) * definicion.tamanoBloque.z,
          },
          ley: null,
          numeroMuestras: 0,
        });
      }
    }
  }
  return bloques;
}

/** Interpola la ley de cada bloque de la grilla por IDW o kriging ordinario, segun `entrada.metodo`. */
export function interpolarModeloBloques(entrada: EntradaInterpolacionModelo): ModeloBloques {
  const bloques = generarGrillaBloques(entrada.definicion);
  const nMin = entrada.numeroMinimoMuestras ?? 1;

  if (entrada.metodo === "kriging") {
    if (!entrada.variograma) throw new Error('interpolarModeloBloques: "variograma" es requerido cuando metodo="kriging".');
    const variograma = entrada.variograma;
    for (const bloque of bloques) {
      const r = interpolarKriging(bloque.centro, entrada.compositos, variograma, entrada.radioBusqueda_m, nMin, entrada.numeroMaximoMuestras);
      bloque.ley = r.ley;
      bloque.numeroMuestras = r.numeroMuestras;
      bloque.varianzaKriging = r.varianza;
    }
  } else {
    const potencia = entrada.potencia ?? 2;
    for (const bloque of bloques) {
      const r = interpolarIDW(bloque.centro, entrada.compositos, potencia, entrada.radioBusqueda_m, nMin, entrada.numeroMaximoMuestras);
      bloque.ley = r.ley;
      bloque.numeroMuestras = r.numeroMuestras;
    }
  }
  return { definicion: entrada.definicion, bloques };
}

/** Curva ley-tonelaje: para cada ley de corte, tonelaje y ley media de los bloques que la superan. */
/**
 * Recorta el modelo por una cota Z plana (por ejemplo, para simular "solo lo que queda bajo la
 * topografía" con una superficie aproximada por un plano horizontal, cuando no hay una superficie
 * triangulada real disponible en este modulo) y calcula el tonelaje/ley media del lado elegido.
 * `lado="bajo"` conserva bloques con centro.z <= cota_m (lo tipico: "material bajo el terreno
 * actual"); `lado="sobre"` conserva z >= cota_m.
 */
export function recortarPorCota(
  bloques: Bloque[],
  cota_m: number,
  lado: "bajo" | "sobre",
  volumenBloque_m3: number,
  densidad_ton_m3: number
): ResumenTonelajeCorte {
  const seleccionados = bloques.filter((b) => {
    if (b.ley === null) return false;
    return lado === "bajo" ? b.centro.z <= cota_m : b.centro.z >= cota_m;
  });
  const tonelaje_ton = seleccionados.length * volumenBloque_m3 * densidad_ton_m3;
  const leyMedia =
    seleccionados.length > 0 ? seleccionados.reduce((acc, b) => acc + (b.ley as number), 0) / seleccionados.length : 0;
  return {
    bloques: seleccionados,
    numeroBloques: seleccionados.length,
    tonelaje_ton,
    volumen_m3: seleccionados.length * volumenBloque_m3,
    leyMedia,
  };
}

export function curvaLeyTonelaje(
  bloques: Bloque[],
  volumenBloque_m3: number,
  densidad_ton_m3: number,
  leyesCorte: number[]
): PuntoCurvaLeyTonelaje[] {
  return leyesCorte.map((leyCorte) => {
    const sobreCorte = bloques.filter((b) => b.ley !== null && (b.ley as number) >= leyCorte);
    const tonelaje_ton = sobreCorte.length * volumenBloque_m3 * densidad_ton_m3;
    const leyMedia =
      sobreCorte.length > 0 ? sobreCorte.reduce((acc, b) => acc + (b.ley as number), 0) / sobreCorte.length : 0;
    return { leyCorte, tonelaje_ton, leyMedia };
  });
}
