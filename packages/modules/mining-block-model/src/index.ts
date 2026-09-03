export { MODULO_ID, CAPAS } from "./etiquetas.js";
export { construirEscenaSondajes, construirEscenaBloques, type RangoLey, type ModoColorBloques } from "./escena.js";
export { importarColaresDesdeCSV, importarEnsayosDesdeCSV, exportarCurvaLeyTonelajeCSV } from "./io.js";

export const METADATA_MODULO = {
  id: "mining.block-model",
  nombre: "Modelo de Bloques",
  vertical: "mining",
  version: "0.1.0",
  icono: "boxes",
} as const;
