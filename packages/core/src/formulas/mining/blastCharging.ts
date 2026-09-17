/**
 * Motor de calculo del carguio de voladura por rol (mining.blast-design). A partir de una malla de
 * perforacion ya disenada (mining.blast-pattern), asigna un rol tecnico a cada taladro (arranque,
 * produccion, contorno, recorte, arrastres) y calcula el explosivo real cargado segun la
 * configuracion de esa rol (explosivo, taco, llenado, cebos).
 *
 * Fuentes:
 * - Carga lineal: Mc = (pi/4) * d^2 * rho_e (misma formula que mining.blasting).
 * - Fragmentacion P80 (Kuz-Ram, Cunningham 1983): X50 = A*(V/Qe)^0.8 * Qe^(1/6) * (115/RWS)^(19/30);
 *   X80 se deriva de la distribucion de Rosin-Rammler con indice de uniformidad n.
 * - Estos indicadores son un modelo heuristico de apoyo/visualizacion, no reemplazan pruebas de
 *   campo, control de desviacion ni la evaluacion del responsable de voladura.
 */

import type { Taladro } from "../../domain/blastPattern.js";
import type {
  CargaTaladroDetallada,
  ConfigCarguio,
  ConfigRolCarguio,
  EntradaEvaluacionVoladura,
  ResultadoCarguioVoladura,
  ResultadoEvaluacionVoladura,
  RolCarguio,
} from "../../domain/blastCharging.js";

const LONGITUD_CARTUCHO_TIPICA_M = 0.2;
const FACTOR_CARGA_IDEAL_MIN_KGM3 = 0.3;
const FACTOR_CARGA_IDEAL_MAX_KGM3 = 0.6;

/** Asigna un rol tecnico de carguio a un taladro segun su zona (si viene de tunel) o su posicion
 * relativa dentro del contorno de la malla (si es un banco a cielo abierto). */
export function asignarRolTaladro(
  t: Taladro,
  contexto: { minX: number; maxX: number; minY: number; maxY: number }
): RolCarguio {
  if (t.zona && t.zona !== "banco") {
    const z = t.zona.toLowerCase();
    if (z.includes("aliv") || z.includes("arranque") || z.includes("cuele") || z.includes("cuadrante1")) return "arranque";
    if (z.includes("arrastre") || z.includes("zapater") || z.includes("piso")) return "arrastres";
    if (z.includes("coron") || z.includes("recorte") || z.includes("contorno")) return "contorno";
    if (z.includes("cuadrad") || z.includes("hastial")) return "contorno";
    return "produccion";
  }

  const spanX = Math.max(contexto.maxX - contexto.minX, 1);
  const spanY = Math.max(contexto.maxY - contexto.minY, 1);
  const cx = (contexto.minX + contexto.maxX) / 2;
  const cy = (contexto.minY + contexto.maxY) / 2;
  const rx = Math.abs(t.collar.x - cx) / (spanX / 2);
  const ry = Math.abs(t.collar.y - cy) / (spanY / 2);
  const r = Math.max(rx, ry);

  if (t.collar.y <= contexto.minY + spanY * 0.12) return "arrastres";
  if (r >= 0.85) return "contorno";
  if (r <= 0.35) return "arranque";
  return "produccion";
}

/** Calcula el explosivo real cargado en un taladro segun la configuracion de su rol. */
export function calcularCargaTaladro(t: Taladro, rol: RolCarguio, config: ConfigRolCarguio): CargaTaladroDetallada {
  const longitudDisponible_m = Math.max(t.profundidad_m - config.taco_m, 0);

  if (!config.cargar || longitudDisponible_m <= 0) {
    return {
      taladroId: t.id,
      rol,
      fila: t.fila,
      columna: t.columna,
      longitudDisponible_m,
      longitudCargada_m: 0,
      pesoExplosivo_kg: 0,
      cartuchosEstimados: 0,
      cebos: 0,
      cargado: false,
    };
  }

  const llenado = Math.min(Math.max(config.llenado, 0), 1);
  const longitudCargada_m = longitudDisponible_m * llenado;
  const diametroM = t.diametroMm / 1000;
  const densidadKgm3 = config.explosivo.densidadGcm3 * 1000;
  const cargaLineal_kgm = (Math.PI / 4) * diametroM * diametroM * densidadKgm3;
  const pesoExplosivo_kg = longitudCargada_m * cargaLineal_kgm;
  const cartuchosEstimados = longitudCargada_m > 0 ? Math.max(1, Math.round(longitudCargada_m / LONGITUD_CARTUCHO_TIPICA_M)) : 0;

  return {
    taladroId: t.id,
    rol,
    fila: t.fila,
    columna: t.columna,
    longitudDisponible_m,
    longitudCargada_m,
    pesoExplosivo_kg,
    cartuchosEstimados,
    cebos: config.cebosPorTaladro,
    cargado: true,
  };
}

/** Orquesta el carguio de la voladura completa: asigna rol y explosivo real a cada taladro. */
export function disenarCarguioVoladura(taladros: Taladro[], config: ConfigCarguio): ResultadoCarguioVoladura {
  if (taladros.length === 0) {
    return {
      cargas: [],
      pesoExplosivoTotal_kg: 0,
      cartuchosTotal: 0,
      cebosTotal: 0,
      taladrosCargados: 0,
      taladrosVacios: 0,
      cargaLinealPromedio_kgm: 0,
    };
  }

  const xs = taladros.map((t) => t.collar.x);
  const ys = taladros.map((t) => t.collar.y);
  const contexto = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };

  const cargas = taladros.map((t) => {
    const rol = asignarRolTaladro(t, contexto);
    return calcularCargaTaladro(t, rol, config[rol]);
  });

  const cargadas = cargas.filter((c) => c.cargado);
  const pesoExplosivoTotal_kg = cargas.reduce((acc, c) => acc + c.pesoExplosivo_kg, 0);
  const cartuchosTotal = cargas.reduce((acc, c) => acc + c.cartuchosEstimados, 0);
  const cebosTotal = cargadas.reduce((acc, c) => acc + c.cebos, 0);
  const longitudTotal_m = cargadas.reduce((acc, c) => acc + c.longitudCargada_m, 0);

  return {
    cargas,
    pesoExplosivoTotal_kg,
    cartuchosTotal,
    cebosTotal,
    taladrosCargados: cargadas.length,
    taladrosVacios: cargas.length - cargadas.length,
    cargaLinealPromedio_kgm: longitudTotal_m > 0 ? pesoExplosivoTotal_kg / longitudTotal_m : 0,
  };
}

/** Evalua el desempeno estimado del disparo (consumo, avance, fragmentacion, riesgo) a partir del
 * carguio ya calculado. Indicadores heuristicos de apoyo — no sustituyen evaluacion tecnica de campo. */
export function evaluarResultadoVoladura(e: EntradaEvaluacionVoladura): ResultadoEvaluacionVoladura {
  const advertencias: string[] = [];
  const taladrosCargados = Math.max(e.carguio.taladrosCargados, 1);
  const volumenRoca_m3 = e.burden_m * e.espaciamiento_m * e.alturaBanco_m * taladrosCargados;
  const tonelaje_t = volumenRoca_m3 * e.densidadRoca_tm3;
  const factorCarga_kgm3 = volumenRoca_m3 > 0 ? e.carguio.pesoExplosivoTotal_kg / volumenRoca_m3 : 0;
  const factorPotencia_kgt = tonelaje_t > 0 ? e.carguio.pesoExplosivoTotal_kg / tonelaje_t : 0;

  let eficiencia_pct = 92;
  if (factorCarga_kgm3 < FACTOR_CARGA_IDEAL_MIN_KGM3) {
    eficiencia_pct = 92 - (FACTOR_CARGA_IDEAL_MIN_KGM3 - factorCarga_kgm3) * 120;
    advertencias.push(
      `El factor de carga (${factorCarga_kgm3.toFixed(2)} kg/m³) está por debajo del rango heurístico ideal — riesgo de pata y bajo desplazamiento.`
    );
  } else if (factorCarga_kgm3 > FACTOR_CARGA_IDEAL_MAX_KGM3) {
    const exceso_pct = ((factorCarga_kgm3 - FACTOR_CARGA_IDEAL_MAX_KGM3) / FACTOR_CARGA_IDEAL_MAX_KGM3) * 100;
    eficiencia_pct = 92 - exceso_pct * 0.25;
    if (exceso_pct > 35) {
      advertencias.push(
        `El factor de carga supera en más de ${exceso_pct.toFixed(0)}% el objetivo heurístico; revise confinamiento, contorno y riesgo de sobre-rotura.`
      );
    }
  }
  eficiencia_pct = Math.min(98, Math.max(45, eficiencia_pct));

  const avanceDiseno_m = e.alturaBanco_m;
  const avanceEstimado_m = avanceDiseno_m * (eficiencia_pct / 100);

  // Kuz-Ram simplificado (Cunningham, 1983)
  const FACTOR_ROCA_A = 7; // roca de dureza media, heurístico (mina real: calibrar por RMR/UCS)
  const volumenPorTaladro_m3 = e.burden_m * e.espaciamiento_m * e.alturaBanco_m;
  const cargaMediaPorTaladro_kg = e.carguio.taladrosCargados > 0 ? e.carguio.pesoExplosivoTotal_kg / e.carguio.taladrosCargados : 0;
  const rws = e.rwsPromedio > 0 ? e.rwsPromedio : 100;
  const x50_cm =
    cargaMediaPorTaladro_kg > 0
      ? FACTOR_ROCA_A *
        Math.pow(volumenPorTaladro_m3 / cargaMediaPorTaladro_kg, 0.8) *
        Math.pow(cargaMediaPorTaladro_kg, 1 / 6) *
        Math.pow(115 / rws, 19 / 30)
      : 0;
  const INDICE_UNIFORMIDAD_N = 1.7;
  const p80_mm = x50_cm > 0 ? x50_cm * Math.pow(-Math.log(1 - 0.8), 1 / INDICE_UNIFORMIDAD_N) * 10 : 0;

  const contornoCargas = e.carguio.cargas.filter((c) => c.rol === "contorno" && c.cargado);
  const cargaLinealContorno_kgm =
    contornoCargas.length > 0
      ? contornoCargas.reduce((acc, c) => acc + (c.longitudCargada_m > 0 ? c.pesoExplosivo_kg / c.longitudCargada_m : 0), 0) / contornoCargas.length
      : 0;
  const sobrerotura_cm = Math.min(40, Math.max(2, cargaLinealContorno_kgm * e.burden_m * 35));
  const sobreroturaEquivalente_pct = e.burden_m > 0 ? (sobrerotura_cm / 100 / e.burden_m) * 100 : 0;

  let riesgo: "Bajo" | "Moderado" | "Alto" = "Bajo";
  if (sobreroturaEquivalente_pct > 25 || factorCarga_kgm3 > FACTOR_CARGA_IDEAL_MAX_KGM3 * 1.35) riesgo = "Alto";
  else if (sobreroturaEquivalente_pct > 12 || factorCarga_kgm3 > FACTOR_CARGA_IDEAL_MAX_KGM3 * 1.1) riesgo = "Moderado";

  if (e.carguio.taladrosVacios > 0) {
    advertencias.push(`${e.carguio.taladrosVacios} taladro(s) quedaron vacíos según la configuración de carguío actual.`);
  }

  let puntaje = 100;
  puntaje -= Math.abs(eficiencia_pct - 92) * 1.2;
  puntaje -= riesgo === "Alto" ? 25 : riesgo === "Moderado" ? 10 : 0;
  puntaje = Math.round(Math.min(100, Math.max(0, puntaje)));

  const estado: "Apto" | "Revisar" | "No apto" = puntaje >= 55 ? (riesgo === "Alto" ? "Revisar" : "Apto") : "No apto";

  return {
    volumenRoca_m3,
    tonelaje_t,
    factorCarga_kgm3,
    factorPotencia_kgt,
    avanceDiseno_m,
    avanceEstimado_m,
    eficiencia_pct,
    p80_mm,
    sobrerotura_cm,
    riesgo,
    puntaje,
    estado,
    advertencias,
  };
}
