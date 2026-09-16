/** Tipos de dominio del modulo mining.stereonet (Proyección Estereográfica). */

export interface Discontinuidad {
  id: string;
  nombre: string;
  /** Buzamiento (dip), grados, 0-90. */
  dip_grados: number;
  /** Dirección de buzamiento (dip direction / azimut), grados, 0-360 medido desde el norte. */
  dipDirection_grados: number;
}

export interface TaludEstereografia {
  /** Ángulo de la cara del talud desde la horizontal, grados. */
  dip_grados: number;
  /** Dirección de buzamiento de la cara del talud (hacia donde "mira" el talud), grados. */
  dipDirection_grados: number;
}

/** Punto proyectado (trend/plunge de una línea) en coordenadas normalizadas de la red (-1..1). */
export interface PuntoProyectado {
  x: number;
  y: number;
}

export type ModoFalla = "planar" | "cuña" | "vuelco";

export interface AnalisisPlanarVuelco {
  discontinuidadId: string;
  planarFactible: boolean;
  vuelcoFactible: boolean;
  /** Diferencia angular entre la dirección de buzamiento de la discontinuidad y la del talud. */
  diferenciaDireccion_grados: number;
}

export interface AnalisisCuna {
  idA: string;
  idB: string;
  trendInterseccion_grados: number;
  plungeInterseccion_grados: number;
  factible: boolean;
}

export interface EntradaEstereografia {
  discontinuidades: Discontinuidad[];
  talud: TaludEstereografia;
  anguloFriccion_grados: number;
  /** Tolerancia angular para considerar que una discontinuidad "mira" hacia el talud (default 20°). */
  toleranciaDireccion_grados?: number;
}

export interface ResultadoEstereografia {
  analisisPlanoVuelco: AnalisisPlanarVuelco[];
  analisisCunas: AnalisisCuna[];
  resumen: {
    totalDiscontinuidades: number;
    riesgoPlanar: number;
    riesgoVuelco: number;
    cunasFactibles: number;
  };
}

// ---------------------------------------------------------------------------------------------
// Vista de la red: proyeccion, hemisferio, elementos mostrados y densidad de polos
// ---------------------------------------------------------------------------------------------

/** Proyeccion equiareal (Schmidt/Lambert, preserva area — estandar en geologia estructural para
 * densidad de polos) o equiangular (Wulff/estereografica, preserva angulos — util para construcciones
 * angulares clasicas, menos usada para conteo de densidad porque distorsiona el area cerca del borde). */
export type TipoProyeccion = "schmidt" | "wulff";

/** Hemisferio de proyeccion. La convencion universal en mecanica de rocas/taludes (Priest 1985;
 * Goodman) es el hemisferio inferior; el superior se ofrece solo por compatibilidad con software que
 * lo permite (p.ej. algunas convenciones de geologia estructural clasica para lineacion/paleocorrientes). */
export type Hemisferio = "inferior" | "superior";

export type ModoElementos = "polos" | "planos" | "polos_y_planos";

export type ModoDensidad = "ninguna" | "mapa" | "contornos";

export interface CeldaDensidad {
  x: number;
  y: number;
  densidad_pct: number;
}

export interface ResultadoDensidad {
  /** Grilla de celdas dentro del circulo primitivo con su densidad (% del total de polos). */
  grid: CeldaDensidad[];
  /** Lado de la grilla cuadrada (N x N) usada para el calculo, para reconstruir el paso entre celdas. */
  resolucion: number;
  /** Densidad maxima encontrada (grilla + polos de datos), %. */
  densidadMaxima_pct: number;
  /** Radio angular del circulo de conteo usado, grados. */
  radioConteo_grados: number;
}

/** Lineas de contorno (polilineas en coordenadas normalizadas -1..1) para un nivel de densidad dado. */
export interface ContornoDensidad {
  nivel_pct: number;
  polilineas: Array<Array<{ x: number; y: number }>>;
}

// ---------------------------------------------------------------------------------------------
// Agrupamiento automatico en familias estructurales (k-means esferico sobre los polos)
// ---------------------------------------------------------------------------------------------

export interface FamiliaEstructural {
  id: number;
  /** Ids de las discontinuidades asignadas a esta familia. */
  miembrosIds: string[];
  /** Plano medio de la familia (a partir de la direccion resultante media de Fisher de sus polos). */
  planoMedio: { dip_grados: number; dipDirection_grados: number };
  participacion_pct: number;
  /** Parametro de concentracion de Fisher, kappa — estimador (N-1)/(N-R) (Fisher 1953; Allmendinger,
   * Cardozo & Fisher, 2012, "Structural Geology Algorithms"). 0 si la familia tiene <2 miembros
   * (dispersion indefinida con un solo dato). Mayor kappa = familia mas concentrada/consistente. */
  fisherK: number;
}

export interface ResultadoAgrupamiento {
  familias: FamiliaEstructural[];
  /** Numero de iteraciones que tardo en converger el k-means esferico. */
  iteraciones: number;
}

// ---------------------------------------------------------------------------------------------
// Analisis cinematico de los 4 mecanismos de falla (Markland/Goodman-Bray/Hudson-Harrison)
// ---------------------------------------------------------------------------------------------

export type MecanismoCinematico = "planar" | "cuna" | "volcamiento_flexural" | "volcamiento_directo";

export const NOMBRE_MECANISMO: Record<MecanismoCinematico, string> = {
  planar: "Deslizamiento planar",
  cuna: "Deslizamiento por cuñas",
  volcamiento_flexural: "Volcamiento flexural",
  volcamiento_directo: "Volcamiento directo",
};

export interface ParametrosCinematicos {
  talud: TaludEstereografia;
  anguloFriccion_grados: number;
  /** Limite lateral (±) respecto a la direccion critica, grados. Default 20° (Norrish & Wyllie, 1996;
   * tambien el default de Rocscience Dips), dentro del rango 10-30° citado en la literatura
   * (Goodman & Bray 1976 usaron ±10°; Goodman 1980 sugirio hasta ±30°). */
  limiteLateral_grados: number;
}

export interface DetalleCinematicoPlanar {
  discontinuidadId: string;
  factible: boolean;
  /** |dipdir_junta - dipdir_talud|, grados — criterio de paralelismo (A de Romana/Markland). */
  diferenciaDireccion_grados: number;
  cumpleDireccion: boolean;
  cumpleAfloramiento: boolean; // dip_junta < dip_talud
  cumpleFriccion: boolean; // dip_junta > phi
}

export interface DetalleCinematicoVolcamiento {
  discontinuidadId: string;
  factible: boolean;
  diferenciaDireccion_grados: number; // respecto a dipdir_talud + 180
  cumpleDireccion: boolean;
  /** Goodman & Bray (1976): dip_junta > 90 - dip_talud + phi (condicion de deslizamiento entre capas). */
  cumpleDipMinimo: boolean;
  dipMinimoRequerido_grados: number;
}

export interface DetalleCinematicoCuna {
  idA: string;
  idB: string;
  trendInterseccion_grados: number;
  plungeInterseccion_grados: number;
  factible: boolean;
  cumpleDireccion: boolean;
  cumpleAfloramiento: boolean; // plunge interseccion < dip talud
  cumpleFriccion: boolean; // plunge interseccion > phi
}

export interface DetalleCinematicoVolcamientoDirecto {
  idA: string;
  idB: string;
  trendInterseccion_grados: number;
  plungeInterseccion_grados: number;
  factible: boolean;
  cumpleDireccion: boolean;
  /** Interseccion casi vertical: plunge > 90 - dip_talud (Rocscience Dips, "Direct Toppling", tras
   * Hudson & Harrison 1997 — circulo limite de angulo de cono = angulo del talud). */
  cumpleVerticalidad: boolean;
}

export interface ResultadoMecanismo<TDetalle> {
  mecanismo: MecanismoCinematico;
  detalle: TDetalle[];
  criticos: number;
  total: number;
  porcentajeAdmisible: number;
}

export interface ResultadoCinematicoCompleto {
  planar: ResultadoMecanismo<DetalleCinematicoPlanar>;
  cuna: ResultadoMecanismo<DetalleCinematicoCuna>;
  volcamientoFlexural: ResultadoMecanismo<DetalleCinematicoVolcamiento>;
  volcamientoDirecto: ResultadoMecanismo<DetalleCinematicoVolcamientoDirecto>;
}

// ---------------------------------------------------------------------------------------------
// SMR — Slope Mass Rating (Romana, 1985; revision Romana, Tomas & Seron, 2015)
// ---------------------------------------------------------------------------------------------

export type TipoFallaSMR = "planar" | "volcamiento";

export type MetodoExcavacionSMR = "presplitting" | "voladura_suave" | "voladura_o_mecanico" | "talud_natural";

export const F4_POR_METODO: Record<MetodoExcavacionSMR, number> = {
  presplitting: 10,
  voladura_suave: 8,
  voladura_o_mecanico: 0,
  talud_natural: 15,
};

export interface EntradaSMR {
  rmrBasico: number;
  discontinuidad: Discontinuidad;
  talud: TaludEstereografia;
  tipoFalla: TipoFallaSMR;
  metodoExcavacion: MetodoExcavacionSMR;
}

export interface ResultadoSMR {
  rmrBasico: number;
  a_grados: number;
  b_grados: number;
  c_grados: number;
  f1: number;
  f2: number;
  f3: number;
  f4: number;
  smr: number;
  clase: "I" | "II" | "III" | "IV" | "V";
  descripcion: string;
  estabilidad: string;
  probabilidadFalla: number;
}
