import { leerPuntosKML } from "@suite/engine";

/**
 * Lee un archivo y devuelve SIEMPRE texto CSV "x,y,z" (o el formato tabular que espere el
 * importador del modulo, para CSV/Excel tal cual vienen), para que los importadores de cada
 * modulo (importarColaresDesdeCSV, importarPuntosDesdeCSV, etc.) no necesiten saber nada de
 * Excel/KML — mucho intercambio de datos real en mina llega en planillas Excel (no CSV) o puntos
 * GPS de campo en KML/KMZ. LAS (nube de puntos) se maneja aparte (ver leerArchivo.ts:leerPuntosLASDeArchivo)
 * porque decima/filtra y esa informacion conviene mostrarsela al usuario, no perderla en el camino.
 *
 * `xlsx` y `jszip` pesan varios cientos de kB minificados: se importan dinamicamente (code-split
 * aparte) para no inflar el bundle principal de una app mobile-first para quien nunca los usa.
 */
export async function leerArchivoTabularComoTexto(archivo: File): Promise<string> {
  const nombre = archivo.name.toLowerCase();

  if (/\.xlsx?$/.test(nombre)) {
    const XLSX = await import("xlsx");
    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });
    const primeraHoja = libro.Sheets[libro.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(primeraHoja);
  }

  if (nombre.endsWith(".kml")) {
    return puntosATextoCSV(leerPuntosKML(await archivo.text()));
  }

  if (nombre.endsWith(".kmz")) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await archivo.arrayBuffer());
    const entradaKml = Object.values(zip.files).find((f) => !f.dir && /\.kml$/i.test(f.name));
    if (!entradaKml) throw new Error("El KMZ no contiene ningun archivo .kml adentro.");
    return puntosATextoCSV(leerPuntosKML(await entradaKml.async("text")));
  }

  return archivo.text();
}

function puntosATextoCSV(puntos: Array<{ x: number; y: number; z: number }>): string {
  return puntos.map((p) => `${p.x},${p.y},${p.z}`).join("\n");
}

/** true si el archivo es una nube de puntos LAS sin comprimir (se maneja aparte, ver arriba). */
export function esArchivoLAS(archivo: File): boolean {
  return archivo.name.toLowerCase().endsWith(".las");
}

/** true si el archivo es una nube de puntos LAZ (LASzip comprimido; se maneja aparte, ver arriba). */
export function esArchivoLAZ(archivo: File): boolean {
  return archivo.name.toLowerCase().endsWith(".laz");
}
