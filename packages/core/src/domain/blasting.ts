/** Tipos de dominio del modulo mining.blasting (Voladura). */

import type { PropiedadesExplosivo, Taladro } from "./blastPattern.js";

export type PatronIniciacion = "fila_por_fila" | "echelon" | "v_corte";

export interface EntradaVoladura {
  taladros: Taladro[];
  /** Burden y espaciamiento de diseno (m) — se usan para el volumen de roca y para derivar retardos. */
  burden_m: number;
  espaciamiento_m: number;
  /** Altura de banco (m) — el powder factor se calcula sobre el volumen de banco, no sobre la
   * profundidad total del taladro (que incluye sobreperforacion). */
  alturaBanco_m: number;
  explosivo: PropiedadesExplosivo;

  patronIniciacion: PatronIniciacion;
  /** Retardo entre filas, ms por metro de burden efectivo (default 6.5; tipico 4-8 ms/m). */
  msPorMetroBurden?: number;
  /** Retardo entre taladros de una misma fila, ms por metro de espaciamiento (default 5; tipico <10 ms/m). */
  msPorMetroEspaciamiento?: number;
}

export interface CargaTaladro {
  taladroId: string;
  pesoExplosivo_kg: number;
  tiempoDetonacion_ms: number;
  fila: number;
  columna: number;
}

export interface ResultadoVoladura {
  /** Carga lineal del explosivo en el taladro, kg por metro de columna cargada. */
  cargaLineal_kgm: number;
  cargas: CargaTaladro[];
  pesoExplosivoTotal_kg: number;
  volumenRocaTotal_m3: number;
  /** Factor de carga (powder factor) global del disparo, kg/m3. Metrica comparativa, no de diseno
   * primario (Ash, 1963) — ver advertencias. */
  factorCarga_kgm3: number;
  retardoEntreFilas_ms: number;
  retardoEntreTaladros_ms: number;
  duracionTotalSecuencia_ms: number;
  advertencias: string[];
}

export const DEFAULTS_VOLADURA = {
  msPorMetroBurden: 6.5,
  msPorMetroEspaciamiento: 5,
} as const;
