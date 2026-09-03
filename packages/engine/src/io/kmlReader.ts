import { wgs84AUtm } from "./wgs84Utm.js";

export interface PuntoKML {
  nombre: string | null;
  lat_grados: number;
  lon_grados: number;
  elevacion_m: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Extrae los puntos de un KML (Placemark con Point/LineString/Polygon) y los proyecta a UTM.
 * Usa la zona del PRIMER punto para todos los siguientes, para que un levantamiento de campo
 * completo caiga en una unica zona/grilla aunque algun punto quede cerca del limite de 6°.
 *
 * No usa un parser XML completo (DOMParser no esta disponible fuera del navegador, y KML de campo
 * es simple): busca cada <Placemark> con una expresion regular y, dentro, el primer bloque
 * <coordinates>...</coordinates>, que segun la especificacion KML es "lon,lat[,alt] lon,lat[,alt] ..."
 * separado por espacios/saltos de linea. Toma el PRIMER triple de cada Placemark (para un Point es
 * el unico; para una LineString/Polygon se conservan solo los vertices, no toda la geometria).
 */
export function leerPuntosKML(textoKml: string): PuntoKML[] {
  const puntos: PuntoKML[] = [];
  let zonaLevantamiento: number | undefined;

  const rePlacemark = /<Placemark[\s\S]*?<\/Placemark>/g;
  const bloquesPlacemark = textoKml.match(rePlacemark) ?? [];

  for (const bloque of bloquesPlacemark) {
    const nombreMatch = bloque.match(/<name>([\s\S]*?)<\/name>/);
    const coordsMatch = bloque.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordsMatch) continue;

    const tuplas = coordsMatch[1].trim().split(/\s+/).filter((t) => t.length > 0);
    if (tuplas.length === 0) continue;

    const [lonStr, latStr, altStr] = tuplas[0].split(",");
    const lon = Number(lonStr);
    const lat = Number(latStr);
    const alt = altStr !== undefined ? Number(altStr) : 0;
    if (Number.isNaN(lon) || Number.isNaN(lat)) continue;

    const utm = wgs84AUtm(lat, lon, undefined, zonaLevantamiento);
    if (zonaLevantamiento === undefined) zonaLevantamiento = utm.zona;

    puntos.push({
      nombre: nombreMatch ? nombreMatch[1].trim() : null,
      lat_grados: lat,
      lon_grados: lon,
      elevacion_m: Number.isNaN(alt) ? 0 : alt,
      x: utm.este_m,
      y: utm.norte_m,
      z: Number.isNaN(alt) ? 0 : alt,
    });
  }

  return puntos;
}
