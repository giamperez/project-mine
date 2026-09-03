export { MODULO_ID, CAPAS } from "./etiquetas.js";
export { construirEscenaSecuencia, SecuenciaAnimador } from "./escena.js";
export { exportarSecuenciaCSV } from "./io.js";

export const METADATA_MODULO = {
  id: "mining.blasting",
  nombre: "Voladura",
  vertical: "mining",
  version: "0.1.0",
  icono: "flame",
} as const;
