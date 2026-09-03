/**
 * Motor de calculo del modulo `mining.blast-pattern` (Diseno de Malla de perforacion y voladura).
 *
 * Fuentes (ver tambien Caveats en el plan del proyecto — formulas empiricas, calibrar en sitio):
 * - OSMRE, "Blast Design Rules of Thumb" (2016) — reglas practicas burden/espaciamiento/taco/carga/PF.
 *   https://www.osmre.gov/sites/default/files/inline-files/5rulesofThumb2016_0.pdf
 * - Ash, R.L. (1963/1968) — razon de burden KB = B(ft)/d(in); KB=20 subterraneo, KB=25 superficie
 *   (ANFO, roca ~2.5 g/cc); ajuste por densidad de roca y por raiz cuadrada de la fuerza del explosivo
 *   relativa al ANFO: KBx = KB * sqrt(fuerza relativa).
 * - Konya, C.J. & Walter, E.J., "Surface Blast Design" (Prentice Hall, 1990) — espaciamiento en
 *   funcion de la razon de rigidez SR = H/B: S = B si SR<1 (evitar); S = B*(SR+7)/8 si 1<=SR<4;
 *   S = 1.4*B si SR>=4.
 * - Langefors, U. & Kihlstrom, B., "The Modern Technique of Rock Blasting" (Wiley, 1978) —
 *   burden maximo Bmax(m) = (db(mm)/33) * sqrt( (P*s) / (c*f*(E/V)) ), con P = grado de
 *   empaquetado (kg/dm3), s = fuerza en peso relativa al explosivo de referencia, c = constante
 *   de roca, f = factor de fijacion, E/V = razon espaciamiento/burden. Burden practico
 *   Bpr = Bmax - (e0 + ea*H) corrige por error de emboquille (e0) y desviacion de perforacion (ea).
 *
 * Todas las funciones son puras: mismos argumentos -> mismo resultado, sin efectos secundarios.
 */

import { feetToMeters, mmToInches } from "../../units/index.js";
import {
  CONSTANTE_ROCA_POR_TIPO,
  DEFAULTS,
  type EntradaMallaPerforacion,
  type ResultadoMallaPerforacion,
  type Taladro,
} from "../../domain/blastPattern.js";
import { marcoLocalDesdeCaraLibre, puntoEnPoligono, aMundoXY, type Punto2D } from "./geometry.js";

/** Reglas practicas OSMRE (2 a 3 x diametro; tipico 2.5x). Devuelve el valor tipico en metros. */
export function burdenPracticoOSMRE_m(diametroMm: number): { min_m: number; tipico_m: number; max_m: number } {
  const dIn = mmToInches(diametroMm);
  return {
    min_m: feetToMeters(2 * dIn),
    tipico_m: feetToMeters(2.5 * dIn),
    max_m: feetToMeters(3 * dIn),
  };
}

/**
 * Burden segun Ash: B(ft) = KB * d(in) / 12.
 * KB base por densidad de roca (interpolacion lineal entre los puntos guia de Ash:
 * roca liviana 2.2 g/cc -> KB=28; media 2.7 g/cc -> KB=25; densa 3.2 g/cc -> KB=23),
 * ajustado por la raiz cuadrada de la fuerza relativa del explosivo respecto al ANFO.
 */
export function burdenAsh_m(diametroMm: number, densidadRocaGcm3: number, fuerzaRelativaANFO: number): number {
  const puntosGuiaKb = [
    { densidad: 2.2, kb: 28 },
    { densidad: 2.7, kb: 25 },
    { densidad: 3.2, kb: 23 },
  ];
  const d = Math.min(Math.max(densidadRocaGcm3, puntosGuiaKb[0].densidad), puntosGuiaKb[2].densidad);
  let kbBase: number;
  if (d <= puntosGuiaKb[1].densidad) {
    const t = (d - puntosGuiaKb[0].densidad) / (puntosGuiaKb[1].densidad - puntosGuiaKb[0].densidad);
    kbBase = puntosGuiaKb[0].kb + t * (puntosGuiaKb[1].kb - puntosGuiaKb[0].kb);
  } else {
    const t = (d - puntosGuiaKb[1].densidad) / (puntosGuiaKb[2].densidad - puntosGuiaKb[1].densidad);
    kbBase = puntosGuiaKb[1].kb + t * (puntosGuiaKb[2].kb - puntosGuiaKb[1].kb);
  }
  const kbAjustado = kbBase * Math.sqrt(Math.max(fuerzaRelativaANFO, 0.01));
  const dIn = mmToInches(diametroMm);
  const bFt = (kbAjustado * dIn) / 12;
  return feetToMeters(bFt);
}

/** Burden maximo de Langefors-Kihlstrom, metros. */
export function burdenLangeforsMax_m(
  diametroMm: number,
  densidadCargaGcm3: number,
  fuerzaRelativaExplosivo: number,
  constanteRoca: number,
  factorFijacion: number,
  razonEspaciamientoBurden: number
): number {
  const raiz = Math.sqrt(
    (densidadCargaGcm3 * fuerzaRelativaExplosivo) / (constanteRoca * factorFijacion * razonEspaciamientoBurden)
  );
  return (diametroMm / 33) * raiz;
}

/** Burden practico de Langefors: corrige Bmax por error de emboquille y desviacion de perforacion. */
export function burdenLangeforsPractico_m(
  bMax_m: number,
  alturaBanco_m: number,
  errorPerforacionM: number,
  desviacionPerforacionMPorM: number
): number {
  const desviacionTotal = errorPerforacionM + desviacionPerforacionMPorM * alturaBanco_m;
  return Math.max(bMax_m - desviacionTotal, 0.1);
}

/**
 * Espaciamiento segun Konya en funcion de la razon de rigidez SR = H/B.
 * SR<1: banco "bajo", riesgo de toe/backbreak severo -> se limita S=B y se advierte.
 * 1<=SR<4: S = B*(SR+7)/8.
 * SR>=4: S = 1.4*B (spacing se vuelve constante; SR muy alto puede causar airblast/flyrock).
 */
export function espaciamientoKonya_m(
  burden_m: number,
  alturaBanco_m: number
): { espaciamiento_m: number; razonRigidezHB: number; advertencias: string[] } {
  const advertencias: string[] = [];
  const sr = alturaBanco_m / burden_m;
  let espaciamiento_m: number;
  if (sr < 1) {
    espaciamiento_m = burden_m;
    advertencias.push(
      `Razon de rigidez H/B=${sr.toFixed(2)} < 1: banco demasiado bajo para el burden calculado (riesgo de toe/backbreak severo). Reduce el burden o considera un banco mas alto.`
    );
  } else if (sr < 4) {
    espaciamiento_m = burden_m * ((sr + 7) / 8);
  } else {
    espaciamiento_m = 1.4 * burden_m;
    if (sr > 6) {
      advertencias.push(
        `Razon de rigidez H/B=${sr.toFixed(2)} muy alta: riesgo de airblast/flyrock excesivo. Revisa diametro/burden.`
      );
    }
  }
  return { espaciamiento_m, razonRigidezHB: sr, advertencias };
}

/** Sobreperforacion (subdrilling): J = KJ * B. KJ tipico 0.2-0.3 (Ash); default 0.3. */
export function sobreperforacion_m(burden_m: number, razonSobreperforacion: number = DEFAULTS.razonSobreperforacion): number {
  return razonSobreperforacion * burden_m;
}

/** Taco (stemming): T = KT * B. KT tipico 0.5-1.0 (OSMRE); default 0.7. */
export function taco_m(burden_m: number, razonTaco: number = DEFAULTS.razonTaco): number {
  return razonTaco * burden_m;
}

function generarGrillaTaladros(
  entrada: EntradaMallaPerforacion,
  burdenDiseno_m: number,
  espaciamiento_m: number,
  profundidadTaladro_m: number,
  tacoCalculado_m: number,
  longitudCargaCalculada_m: number
): Taladro[] {
  const poligono: Punto2D[] = entrada.poligonoCresta;
  if (poligono.length < 3) return [];

  const { origen, u, v } = marcoLocalDesdeCaraLibre(poligono);
  const proyecciones = poligono.map((p) => {
    const rel = { x: p.x - origen.x, y: p.y - origen.y };
    return { u: rel.x * u.x + rel.y * u.y, v: rel.x * v.x + rel.y * v.y };
  });
  const uMin = Math.min(...proyecciones.map((p) => p.u));
  const uMax = Math.max(...proyecciones.map((p) => p.u));
  const vMin = Math.min(...proyecciones.map((p) => p.v));
  const vMax = Math.max(...proyecciones.map((p) => p.v));

  const taladros: Taladro[] = [];
  let fila = 0;
  for (let vCoord = Math.max(vMin, burdenDiseno_m / 2); vCoord <= vMax - burdenDiseno_m / 4; vCoord += burdenDiseno_m) {
    let columna = 0;
    for (let uCoord = uMin + espaciamiento_m / 2; uCoord <= uMax - espaciamiento_m / 4; uCoord += espaciamiento_m) {
      const xy = aMundoXY(origen, u, v, uCoord, vCoord);
      if (puntoEnPoligono(xy, poligono)) {
        const collar = { x: xy.x, y: xy.y, z: entrada.cotaCresta };
        const fondo = { x: xy.x, y: xy.y, z: entrada.cotaCresta - profundidadTaladro_m };
        taladros.push({
          id: `T-${fila + 1}-${columna + 1}`,
          fila,
          columna,
          collar,
          fondo,
          profundidad_m: profundidadTaladro_m,
          diametroMm: entrada.diametroMm,
          taco_m: tacoCalculado_m,
          longitudCarga_m: longitudCargaCalculada_m,
        });
        columna++;
      }
    }
    fila++;
  }
  return taladros;
}

/** Orquesta el diseno completo de la malla de perforacion a partir de la entrada del usuario. */
export function disenarMallaPerforacion(entrada: EntradaMallaPerforacion): ResultadoMallaPerforacion {
  const advertencias: string[] = [];

  if (entrada.poligonoCresta.length < 3) {
    advertencias.push("El poligono de cresta del banco necesita al menos 3 vertices.");
  }
  if (entrada.diametroMm <= 0 || entrada.alturaBanco_m <= 0) {
    advertencias.push("Diametro de taladro y altura de banco deben ser mayores a 0.");
  }

  const razonEV = entrada.razonEspaciamientoBurden ?? DEFAULTS.razonEspaciamientoBurden;
  const f = entrada.factorFijacion ?? DEFAULTS.factorFijacion;
  const c = entrada.constanteRoca ?? CONSTANTE_ROCA_POR_TIPO[entrada.tipoRoca];
  const e0 = entrada.errorPerforacionM ?? DEFAULTS.errorPerforacionM;
  const ea = entrada.desviacionPerforacionMPorM ?? DEFAULTS.desviacionPerforacionMPorM;
  const kj = entrada.razonSobreperforacion ?? DEFAULTS.razonSobreperforacion;
  const kt = entrada.razonTaco ?? DEFAULTS.razonTaco;

  const bAsh = burdenAsh_m(entrada.diametroMm, entrada.densidadRocaGcm3, entrada.explosivo.fuerzaRelativaANFO);
  const bMax = burdenLangeforsMax_m(
    entrada.diametroMm,
    entrada.explosivo.densidadGcm3,
    entrada.explosivo.fuerzaRelativaANFO,
    c,
    f,
    razonEV
  );
  const bPractico = burdenLangeforsPractico_m(bMax, entrada.alturaBanco_m, e0, ea);

  // Burden de diseno: se adopta el de Langefors (practico) por incorporar propiedades de roca y
  // explosivo; se contrasta contra el rango practico OSMRE/Ash y se advierte si se aleja mucho.
  const burdenDiseno_m = bPractico;
  const rangoOSMRE = burdenPracticoOSMRE_m(entrada.diametroMm);
  if (burdenDiseno_m < rangoOSMRE.min_m * 0.8 || burdenDiseno_m > rangoOSMRE.max_m * 1.2) {
    advertencias.push(
      `El burden de diseno (${burdenDiseno_m.toFixed(2)} m) se aleja del rango practico OSMRE/Ash para este diametro (${rangoOSMRE.min_m.toFixed(2)}-${rangoOSMRE.max_m.toFixed(2)} m). Revisa constante de roca, densidad/fuerza del explosivo o el diametro.`
    );
  }

  const { espaciamiento_m, razonRigidezHB, advertencias: advKonya } = espaciamientoKonya_m(
    burdenDiseno_m,
    entrada.alturaBanco_m
  );
  advertencias.push(...advKonya);

  const jSobreperforacion = sobreperforacion_m(burdenDiseno_m, kj);
  const profundidadTaladro_m = entrada.alturaBanco_m + jSobreperforacion;
  const tacoCalculado_m = taco_m(burdenDiseno_m, kt);
  const longitudCargaCalculada_m = Math.max(profundidadTaladro_m - tacoCalculado_m, 0);

  const taladros = generarGrillaTaladros(
    entrada,
    burdenDiseno_m,
    espaciamiento_m,
    profundidadTaladro_m,
    tacoCalculado_m,
    longitudCargaCalculada_m
  );
  if (taladros.length === 0 && entrada.poligonoCresta.length >= 3) {
    advertencias.push("No se genero ningun taladro dentro del poligono: el banco puede ser mas pequeno que un burden x espaciamiento.");
  }

  return {
    burdenAsh_m: bAsh,
    burdenLangeforsMax_m: bMax,
    burdenLangeforsPractico_m: bPractico,
    burdenDiseno_m,
    espaciamiento_m,
    razonRigidezHB,
    sobreperforacion_m: jSobreperforacion,
    profundidadTaladro_m,
    taco_m: tacoCalculado_m,
    longitudCarga_m: longitudCargaCalculada_m,
    taladros,
    advertencias,
  };
}
