/** Tipos de dominio del modulo mining.haulage (Acarreo). */

export type CondicionVia = "buena" | "regular" | "pobre";

export interface EntradaAcarreo {
  distanciaUnidireccional_m: number;
  /** Pendiente promedio del tramo cargado (%), positiva = subida cargado / bajada vacio. */
  pendientePromedio_pct: number;
  condicionVia: CondicionVia;

  capacidadCamion_ton: number;
  pesoVacioCamion_kg: number;
  potenciaCamion_kW: number;
  /** Eficiencia de transmision (perdidas mecanicas), 0-1. Default 0.85. */
  eficienciaTransmision?: number;
  /** Velocidad maxima mecanica del camion, km/h. Default 60. */
  velocidadMaxima_kmh?: number;

  capacidadBalde_ton: number;
  tiempoCicloCargador_s: number;

  tiempoDescarga_s: number;
  tiempoColas_s?: number;
  /** Eficiencia operativa (disponibilidad x utilizacion), 0-1. Default 0.83 (~50 min/h). */
  eficienciaOperativa?: number;

  numeroCargadores: number;
  /** Si se omite, se usa el numero de camiones "optimo" (MF=1) para el calculo de flota. */
  numeroCamiones?: number;
}

export interface ResultadoAcarreo {
  numeroBaldesPorCamion: number;
  tiempoCarga_s: number;

  resistenciaRodadura_pct: number;
  resistenciaTotalCargado_pct: number;
  resistenciaTotalVacio_pct: number;
  velocidadCargado_kmh: number;
  velocidadVacio_kmh: number;

  tiempoAcarreoCargado_s: number;
  tiempoRetornoVacio_s: number;
  tiempoCicloCamion_s: number;

  productividadCamion_tph: number;

  numeroCamionesOptimo: number;
  numeroCamionesUsado: number;
  matchFactor: number;
  produccionFlota_tph: number;

  advertencias: string[];
}

export const DEFAULTS_ACARREO = {
  eficienciaTransmision: 0.85,
  velocidadMaxima_kmh: 60,
  eficienciaOperativa: 0.83,
  tiempoColas_s: 60,
} as const;
