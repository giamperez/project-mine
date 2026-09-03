/** Etiquetas estables del modulo (convencion definida en la arquitectura, seccion 7). */
export const MODULO_ID = "mining.block-model" as const;

export const CAPAS = {
  sondajes: "layer.mining.block-model.drillholes",
  bloques: "layer.mining.block-model.blocks",
} as const;
