/** Tipos de dominio del modulo mining.blast-pattern (Diseno de Malla). */

export interface PuntoXYZ {
  x: number;
  y: number;
  z: number;
}

export type TipoRoca = "muy_blanda" | "blanda" | "media" | "dura" | "muy_dura";

/** Constante de roca (c) de Langefors por categoria — punto de partida editable por el usuario. */
export const CONSTANTE_ROCA_POR_TIPO: Record<TipoRoca, number> = {
  muy_blanda: 0.3,
  blanda: 0.35,
  media: 0.4,
  dura: 0.45,
  muy_dura: 0.5,
};

export interface PropiedadesExplosivo {
  nombre: string;
  /** Densidad de carga / grado de empaquetado (P), kg/dm3 (equivale a g/cm3). Tipico 0.8 (ANFO) a 1.6 (gelatina). */
  densidadGcm3: number;
  /** Fuerza en peso relativa al ANFO (s). ANFO = 1.0; emulsiones/gelatinas tipicamente 0.9-1.3. */
  fuerzaRelativaANFO: number;
}

export interface EntradaMallaPerforacion {
  /** Vertices del contorno de la cresta del banco, en orden (>=3), en el plano XY. */
  poligonoCresta: Array<{ x: number; y: number }>;
  /** Cota (Z) de la cresta del banco, metros. */
  cotaCresta: number;
  /** Altura de banco (H), metros. */
  alturaBanco_m: number;

  /** Diametro de taladro, mm. */
  diametroMm: number;

  /** Densidad de la roca in situ, g/cm3. */
  densidadRocaGcm3: number;
  tipoRoca: TipoRoca;
  explosivo: PropiedadesExplosivo;

  /** Razon espaciamiento/burden (E/V) de Langefors. Default 1.25. */
  razonEspaciamientoBurden?: number;
  /** Factor de fijacion (f): 1.0 taladro vertical / una cara libre (default). */
  factorFijacion?: number;
  /** Constante de roca (c). Si se omite, se toma de tipoRoca. */
  constanteRoca?: number;
  /** Error de emboquille e0, metros (default 0.05). */
  errorPerforacionM?: number;
  /** Desviacion de perforacion por metro de profundidad, ea (default 0.03 m/m). */
  desviacionPerforacionMPorM?: number;
  /** Razon de sobreperforacion respecto al burden, KJ (default 0.3). */
  razonSobreperforacion?: number;
  /** Razon de taco respecto al burden, KT (default 0.7). */
  razonTaco?: number;
}

export interface Taladro {
  id: string;
  fila: number;
  columna: number;
  collar: PuntoXYZ;
  fondo: PuntoXYZ;
  profundidad_m: number;
  diametroMm: number;
  taco_m: number;
  longitudCarga_m: number;
}

export interface ResultadoMallaPerforacion {
  /** Burden segun Ash (KB*d), metros. */
  burdenAsh_m: number;
  /** Burden maximo segun Langefors-Kihlstrom, metros. */
  burdenLangeforsMax_m: number;
  /** Burden practico de Langefors (corregido por errores de perforacion), metros. */
  burdenLangeforsPractico_m: number;
  /** Burden de diseno finalmente adoptado para generar la malla, metros. */
  burdenDiseno_m: number;
  /** Espaciamiento de diseno (Konya), metros. */
  espaciamiento_m: number;
  /** Razon de rigidez H/B usada por Konya. */
  razonRigidezHB: number;
  sobreperforacion_m: number;
  profundidadTaladro_m: number;
  taco_m: number;
  longitudCarga_m: number;
  taladros: Taladro[];
  advertencias: string[];
}

export const DEFAULTS = {
  razonEspaciamientoBurden: 1.25,
  factorFijacion: 1.0,
  errorPerforacionM: 0.05,
  desviacionPerforacionMPorM: 0.03,
  razonSobreperforacion: 0.3,
  razonTaco: 0.7,
} as const;
