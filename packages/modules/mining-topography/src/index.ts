export { MODULO_ID, CAPAS } from "./etiquetas.js";
export { construirEscenaSuperficie, construirEscenaCurvasNivel, type OpcionesEscenaSuperficie } from "./escena.js";
export { importarPuntosDesdeCSV, exportarCurvasNivelDXF, exportarSuperficieDXF } from "./io.js";

export const METADATA_MODULO = {
  id: "mining.topography",
  nombre: "Topografía",
  vertical: "mining",
  version: "0.1.0",
  icono: "mountain",
} as const;
