export { MODULO_ID } from "./etiquetas.js";
export { importarDiscontinuidadesDesdeCSV, exportarDiscontinuidadesCSV } from "./io.js";

export const METADATA_MODULO = {
  id: "mining.stereonet",
  nombre: "Estereografía",
  vertical: "mining",
  version: "0.1.0",
  icono: "compass",
} as const;
