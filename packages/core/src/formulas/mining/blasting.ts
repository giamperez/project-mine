/**
 * Motor de calculo del modulo `mining.blasting` (Voladura). Toma los taladros ya disenados por
 * `mining.blast-pattern` y calcula carga explosiva, factor de carga y secuencia de iniciacion.
 *
 * Fuentes:
 * - Carga lineal: Mc = (pi/4) * d^2 * rho_e (seccion del taladro x densidad del explosivo cargado).
 *   Equivalente metrico de la formula de "loading density" de OSMRE, 2016 (Blast Design Rules of
 *   Thumb: LD = 0.3405 * densidad(g/cc) * d^2(in), en unidades imperiales).
 * - Factor de carga (Powder Factor) PF = peso de explosivo / volumen de roca (B*S*H). Valores
 *   tipicos de produccion <=1 kg/m3, ocasionalmente hasta 1.5, raramente 2.2 en roca muy dura.
 *   Ash (1963) y Pit&Quarry: el PF es una metrica economica/comparativa, NO un parametro de
 *   diseno primario (varia mucho con la geometria y el numero de caras libres).
 * - Retardos: la practica estandar de la industria (resumida en fuentes como AusIMM "Good Delay
 *   Timing" y Quarry Magazine) recomienda un retardo entre filas (relevo/relief) de 4-8 ms por
 *   metro de burden efectivo (regla conservadora general ~2 ms/pie = ~6.5 ms/m), y un retardo
 *   entre taladros de una misma fila menor a 10 ms por metro de espaciamiento. Son valores de
 *   referencia: se calibran con datos de vibracion/fragmentacion del sitio.
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
  return 0; // "echelon" y "fila_por_fila" inician desde la columna 0 (esquina de la cara libre)
}

/**
 * Asigna un tiempo de detonacion (ms, relativo al primer taladro) a cada uno segun el patron:
 * - fila_por_fila: todos los taladros de una fila detonan juntos; solo importa el retardo entre filas.
 * - echelon: el retardo avanza en diagonal desde una esquina (columna 0), creando un frente en V.
 * - v_corte: el retardo avanza en diagonal desde el centro de cada fila hacia ambos extremos.
 */
export function calcularSecuenciaIniciacion(
  taladros: Taladro[],
  patron: PatronIniciacion,
  retardoEntreFilas_ms: number,
  retardoEntreTaladros_ms: number
): Array<{ taladroId: string; tiempoDetonacion_ms: number; fila: number; columna: number }> {
  if (taladros.length === 0) return [];
  const columnaMax = Math.max(...taladros.map((t) => t.columna));
  const retardoColumnas = patron === "fila_por_fila" ? 0 : retardoEntreTaladros_ms;
  const inicioColumna = columnaDeInicio(patron, columnaMax);

  return taladros.map((t) => ({
    taladroId: t.id,
    fila: t.fila,
    columna: t.columna,
    tiempoDetonacion_ms: t.fila * retardoEntreFilas_ms + Math.abs(t.columna - inicioColumna) * retardoColumnas,
  }));
}

/** Orquesta el diseno de voladura completo a partir de los taladros de mining.blast-pattern. */
export function disenarVoladura(entrada: EntradaVoladura): ResultadoVoladura {
  const advertencias: string[] = [];
  const msBurden = entrada.msPorMetroBurden ?? DEFAULTS_VOLADURA.msPorMetroBurden;
  const msEspaciamiento = entrada.msPorMetroEspaciamiento ?? DEFAULTS_VOLADURA.msPorMetroEspaciamiento;

  if (msBurden < 4 || msBurden > 8) {
    advertencias.push(
      `Retardo entre filas (${msBurden.toFixed(1)} ms/m de burden) fuera del rango tipico 4-8 ms/m: revisa riesgo de corte prematuro (muy bajo) o vibracion/fragmentacion pobre (muy alto).`
    );
  }
  if (entrada.patronIniciacion !== "fila_por_fila" && msEspaciamiento > 10) {
    advertencias.push(
      `Retardo entre taladros (${msEspaciamiento.toFixed(1)} ms/m de espaciamiento) supera el maximo tipico de 10 ms/m.`
    );
  }

  const retardoEntreFilas_ms = msBurden * entrada.burden_m;
  const retardoEntreTaladros_ms = entrada.patronIniciacion === "fila_por_fila" ? 0 : msEspaciamiento * entrada.espaciamiento_m;

  const mc = cargaLineal_kgm(entrada.taladros[0]?.diametroMm ?? 0, entrada.explosivo.densidadGcm3);
  const secuencia = calcularSecuenciaIniciacion(
    entrada.taladros,
    entrada.patronIniciacion,
    retardoEntreFilas_ms,
    retardoEntreTaladros_ms
  );

  const cargas: CargaTaladro[] = entrada.taladros.map((t, i) => ({
    taladroId: t.id,
    pesoExplosivo_kg: pesoExplosivoPorTaladro_kg(t.longitudCarga_m, mc),
    tiempoDetonacion_ms: secuencia[i].tiempoDetonacion_ms,
    fila: t.fila,
    columna: t.columna,
  }));

  const pesoExplosivoTotal_kg = cargas.reduce((acc, c) => acc + c.pesoExplosivo_kg, 0);
  const volumenRocaTotal_m3 = entrada.burden_m * entrada.espaciamiento_m * entrada.alturaBanco_m * entrada.taladros.length;
  const factorCarga_kgm3 = volumenRocaTotal_m3 > 0 ? pesoExplosivoTotal_kg / volumenRocaTotal_m3 : 0;

  if (factorCarga_kgm3 > 0 && (factorCarga_kgm3 < 0.15 || factorCarga_kgm3 > 1.5)) {
    advertencias.push(
      `Factor de carga global ${factorCarga_kgm3.toFixed(2)} kg/m3 fuera del rango tipico de produccion (0.15-1.5 kg/m3). Recuerda: es una metrica comparativa/economica, no un parametro de diseno primario (Ash, 1963).`
    );
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
  };
}
