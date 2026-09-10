export interface MetadataFotoDron {
  lat: number | null;
  lon: number | null;
  alt: number | null;
  relativeAlt: number | null;
  gimbalYaw: number | null;
  flightYaw: number | null;
  ancho: number;
  alto: number;
}

/**
 * Extrae coordenadas GPS y telemetría DJI (XMP + EXIF) directamente del ArrayBuffer de una imagen.
 */
export async function extraerMetadataFoto(file: File | Blob): Promise<MetadataFotoDron> {
  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);

  let lat: number | null = null;
  let lon: number | null = null;
  let alt: number | null = null;
  let relativeAlt: number | null = null;
  let gimbalYaw: number | null = null;
  let flightYaw: number | null = null;
  let ancho = 4000;
  let alto = 3000;

  // 1. Extraer telemetría DJI desde cabecera XMP (primeros 130 KB)
  try {
    const headerBytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 131072)));
    let str = "";
    for (let i = 0; i < headerBytes.length; i++) {
      str += String.fromCharCode(headerBytes[i]);
    }

    const matchRelAlt = str.match(/RelativeAltitude="([^"]+)"/i) || str.match(/<RelativeAltitude>([^<]+)</i);
    if (matchRelAlt) relativeAlt = parseFloat(matchRelAlt[1]);

    const matchYaw = str.match(/GimbalYawDegree="([^"]+)"/i) || str.match(/<GimbalYawDegree>([^<]+)</i);
    if (matchYaw) gimbalYaw = parseFloat(matchYaw[1]);

    const matchFlightYaw = str.match(/FlightYawDegree="([^"]+)"/i) || str.match(/<FlightYawDegree>([^<]+)</i);
    if (matchFlightYaw) flightYaw = parseFloat(matchFlightYaw[1]);
  } catch (err) {
    console.warn("No se pudo leer XMP DJI:", err);
  }

  // 2. Extraer EXIF GPS (WGS84 lat, lon, alt)
  try {
    if (dataView.getUint16(0) === 0xffd8) {
      let offset = 2;
      const length = dataView.byteLength;

      while (offset < length) {
        if (dataView.getUint8(offset) !== 0xff) break;
        const marker = dataView.getUint8(offset + 1);

        if (marker === 0xe1) {
          // APP1
          const exifLength = dataView.getUint16(offset + 2);
          const exifHeader =
            String.fromCharCode(dataView.getUint8(offset + 4)) +
            String.fromCharCode(dataView.getUint8(offset + 5)) +
            String.fromCharCode(dataView.getUint8(offset + 6)) +
            String.fromCharCode(dataView.getUint8(offset + 7));

          if (exifHeader === "Exif") {
            const tiffOffset = offset + 10;
            const isLittleEndian = dataView.getUint16(tiffOffset) === 0x4949;

            const firstIFDOffset = dataView.getUint32(tiffOffset + 4, isLittleEndian);
            const ifdOffset = tiffOffset + firstIFDOffset;
            const numEntries = dataView.getUint16(ifdOffset, isLittleEndian);
            let gpsIFDOffset = 0;

            for (let i = 0; i < numEntries; i++) {
              const entryOffset = ifdOffset + 2 + i * 12;
              const tag = dataView.getUint16(entryOffset, isLittleEndian);
              if (tag === 0x8825) {
                // GPSInfo IFD pointer
                gpsIFDOffset = tiffOffset + dataView.getUint32(entryOffset + 8, isLittleEndian);
                break;
              }
            }

            if (gpsIFDOffset > 0 && gpsIFDOffset < length) {
              const numGpsEntries = dataView.getUint16(gpsIFDOffset, isLittleEndian);
              let latRef = "N";
              let lonRef = "E";

              for (let i = 0; i < numGpsEntries; i++) {
                const entryOffset = gpsIFDOffset + 2 + i * 12;
                const tag = dataView.getUint16(entryOffset, isLittleEndian);

                if (tag === 1) {
                  // LatRef
                  latRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
                } else if (tag === 2) {
                  // Latitude (grados, minutos, segundos)
                  const valOffset = tiffOffset + dataView.getUint32(entryOffset + 8, isLittleEndian);
                  const d = dataView.getUint32(valOffset, isLittleEndian) / dataView.getUint32(valOffset + 4, isLittleEndian);
                  const m = dataView.getUint32(valOffset + 8, isLittleEndian) / dataView.getUint32(valOffset + 12, isLittleEndian);
                  const s = dataView.getUint32(valOffset + 16, isLittleEndian) / dataView.getUint32(valOffset + 20, isLittleEndian);
                  lat = d + m / 60 + s / 3600;
                } else if (tag === 3) {
                  // LonRef
                  lonRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
                } else if (tag === 4) {
                  // Longitude
                  const valOffset = tiffOffset + dataView.getUint32(entryOffset + 8, isLittleEndian);
                  const d = dataView.getUint32(valOffset, isLittleEndian) / dataView.getUint32(valOffset + 4, isLittleEndian);
                  const m = dataView.getUint32(valOffset + 8, isLittleEndian) / dataView.getUint32(valOffset + 12, isLittleEndian);
                  const s = dataView.getUint32(valOffset + 16, isLittleEndian) / dataView.getUint32(valOffset + 20, isLittleEndian);
                  lon = d + m / 60 + s / 3600;
                } else if (tag === 6) {
                  // Altitude
                  const valOffset = tiffOffset + dataView.getUint32(entryOffset + 8, isLittleEndian);
                  alt = dataView.getUint32(valOffset, isLittleEndian) / dataView.getUint32(valOffset + 4, isLittleEndian);
                }
              }

              if (lat !== null && latRef === "S") lat = -lat;
              if (lon !== null && lonRef === "W") lon = -lon;
            }
          }
          offset += 2 + exifLength;
        } else {
          offset += 2 + dataView.getUint16(offset + 2);
        }
      }
    }
  } catch (err) {
    console.warn("Error leyendo EXIF GPS:", err);
  }

  return {
    lat,
    lon,
    alt,
    relativeAlt,
    gimbalYaw,
    flightYaw,
    ancho,
    alto,
  };
}

/**
 * Proyecta una lista de fotos con coordenadas geodésicas (lat, lon, alt)
 * a coordenadas métricas locales (x, y, z) para Three.js con origen en el centroide del vuelo.
 */
export function proyectarFotosDron<T extends { lat?: number | null; lon?: number | null; alt?: number | null; relativeAlt?: number | null }>(
  items: T[]
): { x: number; y: number; z: number }[] {
  const conGps = items.filter((it) => it.lat !== null && it.lon !== null && it.lat !== undefined && it.lon !== undefined);

  if (conGps.length === 0) {
    // Si ninguna tiene GPS, distribuir secuencialmente
    return items.map((_, i) => ({
      x: (i - items.length / 2) * 2.2,
      y: (items.length / 2 - i) * 3.8,
      z: 0,
    }));
  }

  // Centroide
  const lat0 = conGps.reduce((acc, it) => acc + (it.lat || 0), 0) / conGps.length;
  const lon0 = conGps.reduce((acc, it) => acc + (it.lon || 0), 0) / conGps.length;
  const alt0 = conGps.reduce((acc, it) => acc + (it.alt || 0), 0) / conGps.length;

  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
  const R = 6378137; // Radio medio de la Tierra en metros

  return items.map((it, i) => {
    if (it.lat == null || it.lon == null) {
      return {
        x: (i - items.length / 2) * 2.2,
        y: (items.length / 2 - i) * 3.8,
        z: 0,
      };
    }

    const x = (it.lon - lon0) * ((Math.PI / 180) * R * cosLat0);
    const y = (it.lat - lat0) * ((Math.PI / 180) * R);
    const z = it.relativeAlt ?? (it.alt != null ? it.alt - alt0 : 0);

    return {
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      z: Number(z.toFixed(3)),
    };
  });
}
