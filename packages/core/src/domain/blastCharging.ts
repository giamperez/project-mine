/** Tipos de dominio del carguío de voladura por rol (mining.blast-design). */

import type { PropiedadesExplosivoMina } from "./tunnelRound.js";

export type RolCarguio = "arranque" | "produccion" | "contorno" | "recorte" | "arrastres";

export const ROLES_CARGUIO: RolCarguio[] = ["arranque", "produccion", "contorno", "recorte", "arrastres"];

export const ETIQUETAS_ROL_CARGUIO: Record<RolCarguio, string> = {
  arranque: "Arranque y cuadrantes",
  produccion: "Producción y cuadradores",
  contorno: "Contorno",
  recorte: "Recorte",
  arrastres: "Arrastres / piso",
};

export interface ConfigRolCarguio {
  explosivo: PropiedadesExplosivoMina;
  /** Taco (m) sin cargar desde el collar del taladro. */
  taco_m: number;
  /** Fracción (0-1) de la columna disponible que efectivamente se carga. */
  llenado: number;
  cebosPorTaladro: number;
  /** Si el rol se carga o se deja vacío (ej. recorte apagado por defecto). */
  cargar: boolean;
}

export type ConfigCarguio = Record<RolCarguio, ConfigRolCarguio>;

export interface CargaTaladroDetallada {
  taladroId: string;
  rol: RolCarguio;
  fila: number;
  columna: number;
  longitudDisponible_m: number;
  longitudCargada_m: number;
  pesoExplosivo_kg: number;
  cartuchosEstimados: number;
  cebos: number;
  cargado: boolean;
}

export interface ResultadoCarguioVoladura {
  cargas: CargaTaladroDetallada[];
  pesoExplosivoTotal_kg: number;
  cartuchosTotal: number;
  cebosTotal: number;
  taladrosCargados: number;
  taladrosVacios: number;
  cargaLinealPromedio_kgm: number;
}

export interface EntradaEvaluacionVoladura {
  carguio: ResultadoCarguioVoladura;
  burden_m: number;
  espaciamiento_m: number;
  alturaBanco_m: number;
  densidadRoca_tm3: number;
  /** Potencia relativa en peso promedio de los explosivos usados (% ANFO), para el P80 de Kuz-Ram. */
  rwsPromedio: number;
}

export interface ResultadoEvaluacionVoladura {
  volumenRoca_m3: number;
  tonelaje_t: number;
  factorCarga_kgm3: number;
  factorPotencia_kgt: number;
  avanceDiseno_m: number;
  avanceEstimado_m: number;
  eficiencia_pct: number;
  p80_mm: number;
  sobrerotura_cm: number;
  riesgo: "Bajo" | "Moderado" | "Alto";
  puntaje: number;
  estado: "Apto" | "Revisar" | "No apto";
  advertencias: string[];
}
