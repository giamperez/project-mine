/** Etiquetas estables del modulo (convencion definida en la arquitectura, seccion 7). */
export const MODULO_ID = "mining.geomechanics" as const;

export const CAPAS = {
  terreno: "layer.mining.geomechanics.ground",
  cuna: "layer.mining.geomechanics.wedge",
  planoFalla: "layer.mining.geomechanics.failure-plane",
} as const;
