/** Etiquetas estables del modulo (convencion definida en la arquitectura, seccion 7). */
export const MODULO_ID = "mining.blast-pattern" as const;

export const CAPAS = {
  banco: "layer.mining.blast-pattern.bench",
  taladros: "layer.mining.blast-pattern.holes",
  cargas: "layer.mining.blast-pattern.charges",
} as const;
