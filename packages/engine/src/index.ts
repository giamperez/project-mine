export { SceneManager, type OpcionesSceneManager } from "./scene/SceneManager.js";
export { LayerManager, type DefinicionCapa, type EstadoCapa } from "./layers/LayerManager.js";
export { EscritorDXF, type CapaDxf, type PuntoDxf } from "./io/dxfWriter.js";
export { leerPrimeraPolilinea, listarCapasDxf } from "./io/dxfReader.js";
export { generarCSV } from "./io/csv.js";
export { viridis, type ColorRGB } from "./color/colormap.js";
export { wgs84AUtm, zonaUTM, WGS84, type ParametrosElipsoide, type CoordenadaUTM } from "./io/wgs84Utm.js";
export { leerPuntosKML, type PuntoKML } from "./io/kmlReader.js";
export { leerPuntosLAS, type OpcionesLecturaLAS, type ResultadoLecturaLAS } from "./io/lasReader.js";
// leerPuntosLAZ (io/lazReader.js) NO se exporta desde este barrel a proposito: arrastra laz-perf
// (WASM, ~90kB de glue JS) y el consumidor (EspacioTopografia.tsx) lo importa dinamicamente desde
// la ruta directa para que quede en un chunk aparte — exportarlo aca lo volveria a meter en el
// bundle principal para TODA la app (el barrel se importa estaticamente en todos lados).
