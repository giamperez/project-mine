/**
 * Lector de nubes de puntos LAS sin comprimir (ASPRS LAS 1.2-1.4, formatos de punto 0-3) — para
 * importar levantamientos de dron/LiDAR como superficie de referencia en Topografia.
 *
 * Para archivos comprimidos (.laz), ver lazReader.ts. Ver lasCommon.ts para la cabecera, el
 * formato de registro de punto y las dos estrategias de filtrado+decimacion.
 */

import {
  extraerPuntoLAS,
  filtrarYDecimarConAccesoAleatorio,
  parsearCabeceraLAS,
  type OpcionesLecturaPuntos,
  type ResultadoLecturaPuntos,
} from "./lasCommon.js";

export type { OpcionesLecturaPuntos as OpcionesLecturaLAS, ResultadoLecturaPuntos as ResultadoLecturaLAS };

export function leerPuntosLAS(buffer: ArrayBuffer, opciones: OpcionesLecturaPuntos = {}): ResultadoLecturaPuntos {
  const vista = new DataView(buffer);
  const cabecera = parsearCabeceraLAS(vista, buffer.byteLength);

  if (cabecera.comprimido || cabecera.formatoRegistro > 3) {
    throw new Error(
      `Formato de punto LAS ${cabecera.formatoRegistro}${cabecera.comprimido ? " (comprimido, .laz)" : ""} no soportado por este lector — para .laz usa leerPuntosLAZ. Por ahora se leen los formatos 0-3 sin comprimir.`
    );
  }

  // Defensivo: si la cabecera miente sobre el numero de puntos (archivo truncado/corrupto), no leer
  // mas alla de lo que realmente cabe en el buffer.
  const maxPorTamanoBuffer = Math.floor((buffer.byteLength - cabecera.offsetDatos) / cabecera.longitudRegistro);
  const numeroPuntosOriginal = Math.max(0, Math.min(cabecera.numeroPuntos, maxPorTamanoBuffer));

  return filtrarYDecimarConAccesoAleatorio(
    numeroPuntosOriginal,
    (indice) => extraerPuntoLAS(vista, cabecera.offsetDatos + indice * cabecera.longitudRegistro, cabecera),
    opciones
  );
}
