/**
 * Motor de calculo del modulo `mining.blasting` (Voladura). Toma los taladros ya disenados por
 * `mining.blast-pattern` o `mining.tunnel-round` y calcula carga explosiva, factor de carga y
 * secuencia de iniciacion (para tajo abierto / bancos y labores subterraneas de tunel).
 *
 * Fuentes:
 * - Carga lineal: Mc = (pi/4) * d^2 * rho_e (seccion del taladro x densidad del explosivo cargado).
 *   Equivalente metrico de la formula de "loading density" de OSMRE, 2016 (Blast Design Rules of
 *   Thumb: LD = 0.3405 * densidad(g/cc) * d^2(in), en unidades imperiales).
 * - Factor de carga (Powder Factor) PF = peso de explosivo / volumen de roca (B*S*H o Area*Avance).
 * - Retardos en banco (Ash, 1963; AusIMM): retardo entre filas de 4-8 ms/m de burden efectivo y
 *   retardo entre taladros <10 ms/m de espaciamiento.
 * - Secuencia de iniciacion subterranea en tuneles (Holmberg, Langefors, EXSA/FAMESA Peru):
 *   1. Alivios (vacio sin carga): 0 ms.
 *   2. Arranque / Cuadrante 1: 25 ms (MS 1) — creacion de la primera cavidad libre.
 *   3. Cuadrante 2 (Ayudas 1): 50 ms (MS 2) — ensanche del hueco central.
 *   4. Cuadrante 3 (Ayudas 2): 75-100 ms (MS 3 - MS 4).
 *   5. Produccion / Destroza: 150-350 ms (MS 6 - MS 10) — fracturamiento de la masa principal hacia el centro libre.
 *   6. Arrastres / Zapateras: 500-650 ms (LP 1 - LP 2) — levantamiento del piso antes del contorno.
 *   7. Cuadradores / Hastiales: 750-850 ms (LP 3 - LP 4) — perfilado de hastiales laterales.
 *   8. Corona / Techo: 950-1100 ms (LP 5) — smooth blasting / recorte desacoplado para estabilidad del arco.
 */

import type {
  CargaTaladro,
  EntradaVoladura,
  PatronIniciacion,
  ResultadoVoladura,
} from "../../domain/blasting.js";
import { DEFAULTS_VOLADURA } from "../../domain/blasting.js";
import type { Taladro } from "../../domain/blastPattern.js";

/** Carga lineal del explosivo: Mc(kg/m) = (pi/4) * diametro(m)^2 * densidad(kg/m3). */
export function cargaLineal_kgm(diametroMm: number, densidadExplosivoGcm3: number): number {
  const diametroM = diametroMm / 1000;
  const densidadKgm3 = densidadExplosivoGcm3 * 1000;
  return (Math.PI / 4) * diametroM * diametroM * densidadKgm3;
}

/** Peso de explosivo cargado en un taladro, kg. */
export function pesoExplosivoPorTaladro_kg(longitudCarga_m: number, cargaLineal_kgm: number): number {
  return Math.max(longitudCarga_m, 0) * cargaLineal_kgm;
}

/** Factor de carga (powder factor) sobre el volumen de banco de un taladro, kg/m3. */
export function factorCargaTaladro_kgm3(
  pesoExplosivo_kg: number,
  burden_m: number,
  espaciamiento_m: number,
  alturaBanco_m: number
): number {
  const volumen = burden_m * espaciamiento_m * alturaBanco_m;
  return volumen > 0 ? pesoExplosivo_kg / volumen : 0;
}

function columnaDeInicio(patron: PatronIniciacion, columnaMax: number): number {
  if (patron === "v_corte") return columnaMax / 2;
  return 0; // "echelon" y "fila_por_fila" inician desde la columna 0
}

/**
 * Asigna un tiempo de detonacion (ms) a cada taladro en bancos de tajo abierto:
 * - fila_por_fila: todos los taladros de una fila detonan juntos.
 * - echelon: el retardo avanza en diagonal desde una esquina (columna 0).
 * - v_corte: el retardo avanza en diagonal desde el centro hacia ambos extremos.
 */
export function calcularSecuenciaIniciacion(
  taladros: Taladro[],
  patron: PatronIniciacion,
  retardoEntreFilas_ms: number,
  retardoEntreTaladros_ms: number
): Array<{
  taladroId: string;
  tiempoDetonacion_ms: number;
  fila: number;
  columna: number;
  zona?: string;
  serieDetonador?: string;
  periodo?: number;
}> {
  if (taladros.length === 0) return [];

  // Si se pide un patrón subterráneo o los taladros tienen zonas de túnel, derivar a secuencia de túnel
  if (
    patron === "tunel_concentrico" ||
    patron === "tunel_secuencial_cuadrantes" ||
    patron === "tunel_espiral" ||
    taladros.some((t) => t.zona && t.zona !== "banco")
  ) {
    return calcularSecuenciaIniciacionTunel(taladros, patron);
  }

  const columnaMax = Math.max(...taladros.map((t) => t.columna));
  const retardoColumnas = patron === "fila_por_fila" ? 0 : retardoEntreTaladros_ms;
  const inicioColumna = columnaDeInicio(patron, columnaMax);

  return taladros.map((t) => {
    const tiempo = t.fila * retardoEntreFilas_ms + Math.abs(t.columna - inicioColumna) * retardoColumnas;
    const periodo = Math.floor(tiempo / Math.max(retardoEntreFilas_ms, 1)) + 1;
    return {
      taladroId: t.id,
      fila: t.fila,
      columna: t.columna,
      tiempoDetonacion_ms: tiempo,
      zona: "banco",
      serieDetonador: `MS ${periodo}`,
      periodo,
    };
  });
}

export type ZonaMineriaTunelNormalizada =
  | "alivio"
  | "cuadrante1"
  | "cuadrante2"
  | "cuadrante3"
  | "cuadrante4"
  | "produccion"
  | "arrastre"
  | "cuadrador"
  | "corona";

/** Normaliza diferentes nomenclaturas de zonas mineras subterráneas */
export function normalizarZonaTunel(
  zonaRaw?: string,
  pos?: { x: number; y: number },
  centro?: { x: number; y: number },
  limites?: { minX: number; maxX: number; minY: number; maxY: number }
): ZonaMineriaTunelNormalizada {
  if (zonaRaw) {
    const z = zonaRaw.toLowerCase().trim();
    if (z.includes("aliv")) return "alivio";
    if (z.includes("arranque") || z.includes("c1") || z.includes("cuadrante1") || z.includes("cuele")) return "cuadrante1";
    if (z.includes("c2") || z.includes("cuadrante2") || z.includes("ayuda1")) return "cuadrante2";
    if (z.includes("c3") || z.includes("cuadrante3") || z.includes("ayuda2")) return "cuadrante3";
    if (z.includes("c4") || z.includes("cuadrante4") || z.includes("ayuda3")) return "cuadrante4";
    if (z.includes("arrastre") || z.includes("zapater") || z.includes("piso") || z === "ar" || z === "arrs") return "arrastre";
    if (z.includes("cuadrad") || z.includes("hastial") || z === "cd" || z === "has") return "cuadrador";
    if (z.includes("coron") || z.includes("techo") || z.includes("recorte") || z.includes("contorno") || z === "co" || z === "rec") return "corona";
    if (z.includes("prod") || z.includes("destroz") || z.includes("ayud") || z === "pr") return "produccion";
  }

  // Inferencia geométrica por posición en la sección del túnel
  if (pos && centro && limites) {
    const spanX = Math.max(limites.maxX - limites.minX, 1);
    const spanY = Math.max(limites.maxY - limites.minY, 1);
    const maxRadio = Math.max(spanX, spanY) / 2;
    const dx = pos.x - centro.x;
    const dy = pos.y - centro.y;
    const r = Math.hypot(dx, dy);

    if (pos.y <= limites.minY + spanY * 0.18) return "arrastre";
    if (pos.y >= limites.maxY - spanY * 0.22) return "corona";
    if (pos.x <= limites.minX + spanX * 0.18 || pos.x >= limites.maxX - spanX * 0.18) return "cuadrador";

    if (r <= maxRadio * 0.15) return "cuadrante1";
    if (r <= maxRadio * 0.30) return "cuadrante2";
    if (r <= maxRadio * 0.45) return "cuadrante3";
    if (r <= maxRadio * 0.60) return "cuadrante4";
    return "produccion";
  }

  return "produccion";
}

/**
 * Calcula la secuencia de iniciación y retardos reales para una labor subterránea (Túnel / Galería),
 * implementando la secuencia concéntrica por zonas geomecánicas:
 * 1. Alivios (0 ms, sin carga)
 * 2. Cuele / Cuadrante 1 (25 ms, MS 1)
 * 3. Cuadrante 2 (50 ms, MS 2)
 * 4. Cuadrante 3 (75 ms, MS 3)
 * 5. Cuadrante 4 (100 ms, MS 4)
 * 6. Producción / Destroza (150-350 ms, MS 6 - MS 10)
 * 7. Arrastres / Zapateras (500-650 ms, LP 1 - LP 2)
 * 8. Cuadradores / Hastiales (750-850 ms, LP 3 - LP 4)
 * 9. Corona / Recorte (950-1100 ms, LP 5, smooth blasting)
 */
export function calcularSecuenciaIniciacionTunel(
  taladros: Taladro[],
  patron: PatronIniciacion = "tunel_concentrico"
): Array<{
  taladroId: string;
  tiempoDetonacion_ms: number;
  fila: number;
  columna: number;
  zona: ZonaMineriaTunelNormalizada;
  serieDetonador: string;
  periodo: number;
}> {
  if (taladros.length === 0) return [];

  // Calcular centro y límites geométricos del frente
  const xs = taladros.map((t) => t.collar.x);
  const ys = taladros.map((t) => t.collar.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centro = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const limites = { minX, maxX, minY, maxY };

  // Asignar zona normalizada y propiedades polares a cada taladro
  const taladrosConZona = taladros.map((t) => {
    const posX = t.collar.x;
    const posY = t.collar.y;
    const zona = normalizarZonaTunel(t.zona, { x: posX, y: posY }, centro, limites);
    const dx = posX - centro.x;
    const dy = posY - centro.y;
    const distancia = Math.hypot(dx, dy);
    // Ángulo polar [0, 2pi) empezando desde el eje horizontal
    let angulo = Math.atan2(dy, dx);
    if (angulo < 0) angulo += Math.PI * 2;

    return {
      taladro: t,
      zona,
      posX,
      posY,
      distancia,
      angulo,
    };
  });

  const resultados: Array<{
    taladroId: string;
    tiempoDetonacion_ms: number;
    fila: number;
    columna: number;
    zona: ZonaMineriaTunelNormalizada;
    serieDetonador: string;
    periodo: number;
  }> = [];

  if (patron === "tunel_espiral") {
    // 1. ESPIRAL RADIAL: Cada taladro detona secuencialmente en barrido rotacional continuo (sentido horario)
    const alivios = taladrosConZona.filter((t) => t.zona === "alivio");
    for (const a of alivios) {
      resultados.push({
        taladroId: a.taladro.id,
        tiempoDetonacion_ms: 0,
        fila: a.taladro.fila,
        columna: a.taladro.columna,
        zona: "alivio",
        serieDetonador: "0 ms (Alivio)",
        periodo: 0,
      });
    }

    const cargados = taladrosConZona.filter((t) => t.zona !== "alivio");
    const basesTiempo: Record<ZonaMineriaTunelNormalizada, { base: number; step: number; seriePrefijo: string; periodoBase: number }> = {
      alivio: { base: 0, step: 0, seriePrefijo: "0 ms", periodoBase: 0 },
      cuadrante1: { base: 25, step: 8, seriePrefijo: "MS 1", periodoBase: 1 },
      cuadrante2: { base: 60, step: 8, seriePrefijo: "MS 2", periodoBase: 2 },
      cuadrante3: { base: 95, step: 8, seriePrefijo: "MS 3", periodoBase: 3 },
      cuadrante4: { base: 130, step: 10, seriePrefijo: "MS 4", periodoBase: 4 },
      produccion: { base: 180, step: 22, seriePrefijo: "MS 6", periodoBase: 6 },
      arrastre: { base: 500, step: 30, seriePrefijo: "LP 1", periodoBase: 9 },
      cuadrador: { base: 750, step: 25, seriePrefijo: "LP 3", periodoBase: 10 },
      corona: { base: 950, step: 20, seriePrefijo: "LP 5", periodoBase: 11 },
    };

    const ordenZonasEspiral: ZonaMineriaTunelNormalizada[] = [
      "cuadrante1",
      "cuadrante2",
      "cuadrante3",
      "cuadrante4",
      "produccion",
      "arrastre",
      "cuadrador",
      "corona",
    ];

    for (const z of ordenZonasEspiral) {
      const items = cargados.filter((c) => c.zona === z);
      if (items.length === 0) continue;
      // Ordenar por ángulo polar en sentido horario
      items.sort((a, b) => a.angulo - b.angulo);
      const cfg = basesTiempo[z];
      items.forEach((item, idx) => {
        const tiempo = cfg.base + idx * cfg.step;
        resultados.push({
          taladroId: item.taladro.id,
          tiempoDetonacion_ms: tiempo,
          fila: item.taladro.fila,
          columna: item.taladro.columna,
          zona: item.zona,
          serieDetonador: items.length > 1 ? `${cfg.seriePrefijo} (+${idx * cfg.step}ms)` : cfg.seriePrefijo,
          periodo: cfg.periodoBase,
        });
      });
    }
  } else if (patron === "tunel_secuencial_cuadrantes") {
    // 2. CUADRANTES MS/LP ESCALONADO: Cuadrantes 1..4 disparan en pares escalonados
    for (const item of taladrosConZona) {
      let tiempo = 0;
      let serie = "0 ms";
      let periodo = 0;

      // Determinar si es primer o segundo par según cuadrante angular
      const esPrimerPar = item.angulo < Math.PI / 2 || (item.angulo >= Math.PI && item.angulo < (3 * Math.PI) / 2);

      switch (item.zona) {
        case "alivio":
          tiempo = 0;
          serie = "0 ms (Alivio)";
          periodo = 0;
          break;
        case "cuadrante1":
          tiempo = esPrimerPar ? 25 : 38;
          serie = esPrimerPar ? "MS 1 (25ms)" : "MS 1b (38ms)";
          periodo = 1;
          break;
        case "cuadrante2":
          tiempo = esPrimerPar ? 50 : 65;
          serie = esPrimerPar ? "MS 2 (50ms)" : "MS 2b (65ms)";
          periodo = 2;
          break;
        case "cuadrante3":
          tiempo = esPrimerPar ? 75 : 90;
          serie = esPrimerPar ? "MS 3 (75ms)" : "MS 3b (90ms)";
          periodo = 3;
          break;
        case "cuadrante4":
          tiempo = esPrimerPar ? 100 : 120;
          serie = esPrimerPar ? "MS 4 (100ms)" : "MS 4b (120ms)";
          periodo = 4;
          break;
        case "produccion": {
          const distRel = item.distancia / (Math.max(limites.maxX - limites.minX, 1) / 2);
          if (distRel <= 0.65) {
            tiempo = 150;
            serie = "MS 6 (150ms)";
            periodo = 6;
          } else {
            tiempo = 250;
            serie = "MS 8 (250ms)";
            periodo = 8;
          }
          break;
        }
        case "arrastre": {
          const distCentroX = Math.abs(item.posX - centro.x);
          if (distCentroX < (limites.maxX - limites.minX) * 0.25) {
            tiempo = 500;
            serie = "LP 1 (500ms)";
            periodo = 9;
          } else {
            tiempo = 600;
            serie = "LP 2 (600ms)";
            periodo = 10;
          }
          break;
        }
        case "cuadrador": {
          if (item.posY < centro.y) {
            tiempo = 750;
            serie = "LP 3 (750ms)";
            periodo = 11;
          } else {
            tiempo = 850;
            serie = "LP 4 (850ms)";
            periodo = 12;
          }
          break;
        }
        case "corona": {
          const distCentroX = Math.abs(item.posX - centro.x);
          if (distCentroX < (limites.maxX - limites.minX) * 0.25) {
            tiempo = 950;
            serie = "LP 5 (950ms)";
            periodo = 13;
          } else {
            tiempo = 1050;
            serie = "LP 6 (1050ms)";
            periodo = 14;
          }
          break;
        }
      }

      resultados.push({
        taladroId: item.taladro.id,
        tiempoDetonacion_ms: tiempo,
        fila: item.taladro.fila,
        columna: item.taladro.columna,
        zona: item.zona,
        serieDetonador: serie,
        periodo,
      });
    }
  } else {
    // 3. CONCÉNTRICO ESTÁNDAR: Todos los taladros del mismo anillo detonan juntos simultáneamente
    for (const item of taladrosConZona) {
      let tiempo = 0;
      let serie = "0 ms";
      let periodo = 0;

      switch (item.zona) {
        case "alivio":
          tiempo = 0;
          serie = "0 ms (Alivio)";
          periodo = 0;
          break;
        case "cuadrante1":
          tiempo = 25;
          serie = "MS 1 (25ms)";
          periodo = 1;
          break;
        case "cuadrante2":
          tiempo = 50;
          serie = "MS 2 (50ms)";
          periodo = 2;
          break;
        case "cuadrante3":
          tiempo = 75;
          serie = "MS 3 (75ms)";
          periodo = 3;
          break;
        case "cuadrante4":
          tiempo = 100;
          serie = "MS 4 (100ms)";
          periodo = 4;
          break;
        case "produccion":
          tiempo = 200;
          serie = "MS 7 (200ms)";
          periodo = 7;
          break;
        case "arrastre":
          tiempo = 550;
          serie = "LP 1 (550ms)";
          periodo = 9;
          break;
        case "cuadrador":
          tiempo = 800;
          serie = "LP 3 (800ms)";
          periodo = 11;
          break;
        case "corona":
          tiempo = 1000;
          serie = "LP 5 (1000ms)";
          periodo = 13;
          break;
      }

      resultados.push({
        taladroId: item.taladro.id,
        tiempoDetonacion_ms: tiempo,
        fila: item.taladro.fila,
        columna: item.taladro.columna,
        zona: item.zona,
        serieDetonador: serie,
        periodo,
      });
    }
  }

  return resultados;
}

/** Orquesta el diseno de voladura completo para bancos y tuneles subterraneos. */
export function disenarVoladura(entrada: EntradaVoladura): ResultadoVoladura {
  const advertencias: string[] = [];
  const esTunel =
    entrada.esTunel === true ||
    entrada.patronIniciacion.startsWith("tunel_") ||
    entrada.taladros.some((t) => t.zona && t.zona !== "banco");

  const msBurden = entrada.msPorMetroBurden ?? DEFAULTS_VOLADURA.msPorMetroBurden;
  const msEspaciamiento = entrada.msPorMetroEspaciamiento ?? DEFAULTS_VOLADURA.msPorMetroEspaciamiento;

  if (!esTunel) {
    if (msBurden < 4 || msBurden > 8) {
      advertencias.push(
        `Retardo entre filas (${msBurden.toFixed(1)} ms/m de burden) fuera del rango tipico 4-8 ms/m: revisa riesgo de corte prematuro o vibracion.`
      );
    }
    if (entrada.patronIniciacion !== "fila_por_fila" && msEspaciamiento > 10) {
      advertencias.push(
        `Retardo entre taladros (${msEspaciamiento.toFixed(1)} ms/m de espaciamiento) supera el maximo tipico de 10 ms/m.`
      );
    }
  }

  const retardoEntreFilas_ms = msBurden * entrada.burden_m;
  const retardoEntreTaladros_ms = entrada.patronIniciacion === "fila_por_fila" ? 0 : msEspaciamiento * entrada.espaciamiento_m;

  const diametroBase = entrada.taladros.find((t) => t.zona !== "alivio")?.diametroMm ?? entrada.taladros[0]?.diametroMm ?? 45;
  const mc = cargaLineal_kgm(diametroBase, entrada.explosivo.densidadGcm3);

  const secuencia = esTunel
    ? calcularSecuenciaIniciacionTunel(entrada.taladros, entrada.patronIniciacion)
    : calcularSecuenciaIniciacion(
        entrada.taladros,
        entrada.patronIniciacion,
        retardoEntreFilas_ms,
        retardoEntreTaladros_ms
      );

  const mapaSecuencia = new Map(secuencia.map((s) => [s.taladroId, s]));

  const cargas: CargaTaladro[] = entrada.taladros.map((t) => {
    const infoSec = mapaSecuencia.get(t.id);
    const esAlivio = t.zona === "alivio" || infoSec?.zona === "alivio";
    const pesoExplosivo = esAlivio ? 0 : pesoExplosivoPorTaladro_kg(t.longitudCarga_m, mc);

    return {
      taladroId: t.id,
      pesoExplosivo_kg: pesoExplosivo,
      tiempoDetonacion_ms: infoSec?.tiempoDetonacion_ms ?? 0,
      fila: t.fila,
      columna: t.columna,
      zona: infoSec?.zona ?? t.zona,
      serieDetonador: infoSec?.serieDetonador,
      periodo: infoSec?.periodo,
    };
  });

  const pesoExplosivoTotal_kg = cargas.reduce((acc, c) => acc + c.pesoExplosivo_kg, 0);
  const taladrosCargadosCount = cargas.filter((c) => c.pesoExplosivo_kg > 0).length;

  const volumenRocaTotal_m3 =
    entrada.burden_m * entrada.espaciamiento_m * entrada.alturaBanco_m * Math.max(taladrosCargadosCount, 1);
  const factorCarga_kgm3 = volumenRocaTotal_m3 > 0 ? pesoExplosivoTotal_kg / volumenRocaTotal_m3 : 0;

  if (esTunel) {
    if (factorCarga_kgm3 > 0 && (factorCarga_kgm3 < 0.4 || factorCarga_kgm3 > 3.5)) {
      advertencias.push(
        `Factor de carga de galería ${factorCarga_kgm3.toFixed(2)} kg/m³ fuera del rango subterráneo típico (0.8-2.5 kg/m³).`
      );
    }
  } else {
    if (factorCarga_kgm3 > 0 && (factorCarga_kgm3 < 0.15 || factorCarga_kgm3 > 1.5)) {
      advertencias.push(
        `Factor de carga global ${factorCarga_kgm3.toFixed(2)} kg/m³ fuera del rango típico de banco (0.15-1.5 kg/m³).`
      );
    }
  }

  const duracionTotalSecuencia_ms = cargas.reduce((max, c) => Math.max(max, c.tiempoDetonacion_ms), 0);

  return {
    cargaLineal_kgm: mc,
    cargas,
    pesoExplosivoTotal_kg,
    volumenRocaTotal_m3,
    factorCarga_kgm3,
    retardoEntreFilas_ms,
    retardoEntreTaladros_ms,
    duracionTotalSecuencia_ms,
    advertencias,
    esTunel,
  };
}
