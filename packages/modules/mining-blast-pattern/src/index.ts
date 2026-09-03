export { MODULO_ID, CAPAS } from "./etiquetas.js";
export { construirEscenaMalla, type OpcionesEscenaMalla } from "./escena.js";
export { exportarTaladrosDXF, exportarTaladrosCSV, importarCrestaBancoDesdeDXF } from "./io.js";

export const METADATA_MODULO = {
  id: "mining.blast-pattern",
  nombre: "Diseño de Malla",
  vertical: "mining",
  version: "0.1.0",
  icono: "grid-3x3",
} as const;
