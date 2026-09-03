/**
 * Lector de nubes de puntos LAZ (LASzip comprimido) via `laz-perf` (WASM, Apache-2.0,
 * github.com/hobuinc/laz-perf — la misma libreria que usan Potree/copc.js en produccion).
 *
 * LASzip usa codificacion aritmetica con contexto: no es viable re-implementarlo a mano con la
 * misma confianza que el parser binario simple de LAS sin comprimir (lasReader.ts) — de ahi la
 * dependencia WASM en vez de un parser propio.
 *
 * Patron de uso de la API de bajo nivel (malloc + HEAPU8 + LASZip.open/getPoint) verificado contra
 * el codigo fuente real de copc.js (src/las/point-data.ts, mismo mantenedor que laz-perf), no
 * inventado: `LASZip.open(puntero, longitud)` toma el archivo COMPLETO (cabecera+VLRs+datos
 * comprimidos), no solo el bloque de puntos.
 *
 * A diferencia de LAS sin comprimir, aca la decimacion/filtrado es en UNA sola pasada streaming
 * (ver filtrarYDecimarStreaming en lasCommon.ts) porque el decodificador de LASzip solo entrega
 * los puntos hacia adelante, uno a la vez — no hay acceso aleatorio.
 */

import { createLazPerf } from "laz-perf";
// @ts-expect-error -- import de asset binario via el sufijo ?url de Vite (sin tipos); en Node
// (vitest) esta ruta simplemente no se usa porque createLazPerf() ahi resuelve al build "node",
// que lee el .wasm del disco directo y no necesita locateFile.
import lazPerfWasmUrl from "laz-perf/lib/web/laz-perf.wasm?url";
import {
  extraerPuntoLAS,
  filtrarYDecimarStreaming,
  parsearCabeceraLAS,
  type OpcionesLecturaPuntos,
  type ResultadoLecturaPuntos,
} from "./lasCommon.js";

export type { OpcionesLecturaPuntos as OpcionesLecturaLAZ, ResultadoLecturaPuntos as ResultadoLecturaLAZ };

export async function leerPuntosLAZ(buffer: ArrayBuffer, opciones: OpcionesLecturaPuntos = {}): Promise<ResultadoLecturaPuntos> {
  const vistaCabecera = new DataView(buffer);
  const cabecera = parsearCabeceraLAS(vistaCabecera, buffer.byteLength);
  if (!cabecera.comprimido) {
    throw new Error('Este archivo .laz no esta marcado como comprimido en su cabecera — probalo con leerPuntosLAS en su lugar.');
  }

  // El build "node" (usado por vitest) resuelve su .wasm del disco solo si NO se le pasa
  // locateFile — pasarle la URL del build "web" ahi rompe esa resolucion. Solo hace falta en
  // el navegador, donde el build "web" no puede ubicar el .wasm por si solo una vez empaquetado.
  const opcionesInit = typeof window !== "undefined" ? { locateFile: () => lazPerfWasmUrl } : {};
  const modulo = await createLazPerf(opcionesInit);
  const datosArchivo = new Uint8Array(buffer);
  const punteroArchivo = modulo._malloc(datosArchivo.byteLength);
  modulo.HEAPU8.set(datosArchivo, punteroArchivo);

  const zip = new modulo.LASZip();
  let punteroPunto = 0;
  try {
    zip.open(punteroArchivo, datosArchivo.byteLength);
    const numeroPuntos = zip.getCount();
    const longitudRegistro = zip.getPointLength();
    punteroPunto = modulo._malloc(longitudRegistro);

    const resultado = filtrarYDecimarStreaming(
      numeroPuntos,
      () => {
        zip.getPoint(punteroPunto);
        // se re-envuelve HEAPU8.buffer en cada llamada: el heap de Emscripten puede crecer/re-asignarse
        const vistaPunto = new DataView(modulo.HEAPU8.buffer, punteroPunto, longitudRegistro);
        return extraerPuntoLAS(vistaPunto, 0, cabecera);
      },
      opciones
    );
    return resultado;
  } finally {
    zip.delete();
    modulo._free(punteroArchivo);
    if (punteroPunto) modulo._free(punteroPunto);
  }
}
