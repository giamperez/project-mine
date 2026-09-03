/** Etiquetas estables del modulo (convencion definida en la arquitectura, seccion 7). */
export const MODULO_ID = "mining.topography" as const;

export const CAPAS = {
  superficie: "layer.mining.topography.surface",
  curvasNivel: "layer.mining.topography.contours",
  superficieReferencia: "layer.mining.topography.reference-surface",
} as const;
