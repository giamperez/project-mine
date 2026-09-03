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
