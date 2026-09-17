import {
  CATALOGO_EXPLOSIVOS_PERU,
  DEFAULTS_VOLADURA,
  type ConfigCarguio,
  type PatronIniciacion,
  type Taladro,
} from "@suite/core";

export interface SnapshotMallaVoladura {
  mallaId: string;
  mallaNombre: string;
  esTunel: boolean;
  poligonoCresta: Array<{ x: number; y: number }>;
  cotaCresta: number;
  alturaBanco_m: number;
  diametroMm: number;
  densidadRocaGcm3: number;
  burden_m: number;
  espaciamiento_m: number;
  taladros: Taladro[];
}

export interface ProyectoVoladura {
  id: string;
  nombre: string;
  snapshot: SnapshotMallaVoladura;
  config: ConfigCarguio;
  patronIniciacion: PatronIniciacion;
  msPorMetroBurden: number;
  msPorMetroEspaciamiento: number;
  densidadRoca_tm3: number;
  fechaCreacion: string;
  fechaModificacion: string;
}

const EXPLOSIVO_GRUESO = CATALOGO_EXPLOSIVOS_PERU.find((e) => e.id === "semexsa-80") ?? CATALOGO_EXPLOSIVOS_PERU[0];
const EXPLOSIVO_FINO = CATALOGO_EXPLOSIVOS_PERU.find((e) => e.id === "semexsa-65") ?? CATALOGO_EXPLOSIVOS_PERU[0];

export function crearConfigCarguioDefecto(): ConfigCarguio {
  return {
    arranque: { explosivo: EXPLOSIVO_GRUESO, taco_m: 0.2, llenado: 0.95, cebosPorTaladro: 1, cargar: true },
    produccion: { explosivo: EXPLOSIVO_FINO, taco_m: 0.35, llenado: 0.85, cebosPorTaladro: 1, cargar: true },
    contorno: { explosivo: EXPLOSIVO_FINO, taco_m: 0.45, llenado: 0.45, cebosPorTaladro: 1, cargar: true },
    recorte: { explosivo: EXPLOSIVO_FINO, taco_m: 0.45, llenado: 0.4, cebosPorTaladro: 1, cargar: false },
    arrastres: { explosivo: EXPLOSIVO_GRUESO, taco_m: 0.2, llenado: 0.95, cebosPorTaladro: 1, cargar: true },
  };
}

export function crearProyectoVoladura(nombre: string, snapshot: SnapshotMallaVoladura): ProyectoVoladura {
  const ahora = new Date().toISOString();
  return {
    id: "vol-" + Math.random().toString(36).substr(2, 9),
    nombre,
    snapshot,
    config: crearConfigCarguioDefecto(),
    patronIniciacion: snapshot.esTunel ? "tunel_concentrico" : "echelon",
    msPorMetroBurden: DEFAULTS_VOLADURA.msPorMetroBurden,
    msPorMetroEspaciamiento: DEFAULTS_VOLADURA.msPorMetroEspaciamiento,
    densidadRoca_tm3: snapshot.densidadRocaGcm3,
    fechaCreacion: ahora,
    fechaModificacion: ahora,
  };
}

export const PROYECTOS_VOLADURA_INICIALES: ProyectoVoladura[] = [];
