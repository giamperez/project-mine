/** Tipos de dominio del modulo mining.topography (Topografía). */

export interface PuntoTopografico {
  x: number;
  y: number;
  z: number;
}

/** Superficie triangulada (TIN — Triangulated Irregular Network). */
export interface SuperficieTIN {
  puntos: PuntoTopografico[];
  /** Triangulos: cada 3 valores consecutivos son indices en `puntos` (sentido antihorario en XY). */
  indices: number[];
}

export interface EntradaVolumenCorteRelleno {
  /** Superficie de referencia/diseño (p.ej. el banco proyectado). */
  superficieDiseno: SuperficieTIN;
  /** Superficie actual levantada en campo. */
  superficieActual: SuperficieTIN;
  /** Tamano de celda de la grilla de muestreo, metros (default 2). Menor = mas preciso y mas lento. */
  resolucionGrilla_m?: number;
}

export interface ResultadoVolumenCorteRelleno {
  /** Material a remover: donde la superficie actual esta por encima del diseno, m3. */
  volumenCorte_m3: number;
  /** Material a agregar: donde la superficie actual esta por debajo del diseno, m3. */
  volumenRelleno_m3: number;
  volumenNeto_m3: number;
  areaComun_m2: number;
  resolucionGrilla_m: number;
  celdasMuestreadas: number;
  advertencias: string[];
}

export interface EntradaCurvasNivel {
  superficie: SuperficieTIN;
  /** Equidistancia entre curvas, metros. */
  intervalo_m: number;
}

export interface SegmentoCurvaNivel {
  cota: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
}

export const DEFAULTS_TOPOGRAFIA = {
  resolucionGrilla_m: 2,
  intervalo_m: 5,
} as const;
