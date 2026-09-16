/**
 * gpsTopografico.ts
 * Utilidades geodésicas para topografía de campo:
 * - Conversión WGS84 (Latitud / Longitud elipsoidal) a Coordenadas Planas UTM (Este, Norte, Zona)
 * - Conversión inversa UTM a WGS84
 * - Captura de posición GPS mediante navigator.geolocation
 * - Cálculo de navegación y replanteo de precisión en campo
 */

// Parámetros del Elipsoide WGS84
const WGS84_A = 6378137.0; // Semieje mayor en metros
const WGS84_F = 1 / 298.257223563; // Aplanamiento
const WGS84_B = WGS84_A * (1 - WGS84_F); // Semieje menor
const WGS84_E2 = (WGS84_A ** 2 - WGS84_B ** 2) / (WGS84_A ** 2); // Primera excentricidad al cuadrado
const WGS84_EP2 = (WGS84_A ** 2 - WGS84_B ** 2) / (WGS84_B ** 2); // Segunda excentricidad al cuadrado
const K0 = 0.9996; // Factor de escala en el meridiano central

export interface CoordenadaUtm {
  este: number;
  norte: number;
  zona: number;
  hemisferio: "N" | "S";
  zonaStr: string; // ej. "18S"
}

export interface CoordenadaGeodesica {
  lat: number;
  lon: number;
  alt?: number;
}

export interface LecturaGpsActual extends CoordenadaUtm {
  lat: number;
  lon: number;
  alt: number;
  precisionM: number;
  timestamp: number;
}

export interface GuiaReplanteo {
  distanciaHorizontalM: number;
  deltaEsteM: number;
  deltaNorteM: number;
  azimutHaciaPuntoDeg: number;
  rumboStr: string;
  enTolerancia: boolean;
}

/**
 * Convierte coordenadas geográficas WGS84 (Lat/Lon) a coordenadas planas UTM.
 */
export function wgs84ToUtm(lat: number, lon: number, zonaForzada?: number): CoordenadaUtm {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  // Determinar zona UTM (1 a 60)
  const zona = zonaForzada ?? Math.floor((lon + 180) / 6) + 1;
  const hemisferio: "N" | "S" = lat >= 0 ? "N" : "S";
  const zonaStr = `${zona}${hemisferio}`;

  // Longitud del meridiano central
  const lonCentralDeg = (zona - 1) * 6 - 180 + 3;
  const lonCentralRad = (lonCentralDeg * Math.PI) / 180;
  const deltaLon = lonRad - lonCentralRad;

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = WGS84_EP2 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * deltaLon;

  // Arco meridiano M
  const M =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256) * latRad -
      ((3 * WGS84_E2) / 8 + (3 * WGS84_E2 ** 2) / 32 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * WGS84_E2 ** 2) / 256 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * WGS84_E2 ** 3) / 3072) * Math.sin(6 * latRad));

  // Coordenada Este (X)
  const este =
    500000 +
    K0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * WGS84_EP2) * A ** 5) / 120);

  // Coordenada Norte (Y)
  let norte =
    K0 *
    (M +
      N *
        Math.tan(latRad) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * WGS84_EP2) * A ** 6) / 720));

  if (hemisferio === "S") {
    norte += 10000000; // Falso Norte de 10,000,000 m para el hemisferio sur
  }

  return {
    este: Math.round(este * 1000) / 1000,
    norte: Math.round(norte * 1000) / 1000,
    zona,
    hemisferio,
    zonaStr,
  };
}

/**
 * Convierte coordenadas UTM a Geodésicas WGS84 (Lat/Lon).
 */
export function utmToWgs84(este: number, norte: number, zona: number, hemisferio: "N" | "S"): CoordenadaGeodesica {
  const x = este - 500000;
  const y = hemisferio === "S" ? norte - 10000000 : norte;

  const M = y / K0;
  const mu =
    M /
    (WGS84_A *
      (1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256));

  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const N1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(phi1Rad) ** 2);
  const T1 = Math.tan(phi1Rad) ** 2;
  const C1 = WGS84_EP2 * Math.cos(phi1Rad) ** 2;
  const R1 =
    (WGS84_A * (1 - WGS84_E2)) /
    Math.pow(1 - WGS84_E2 * Math.sin(phi1Rad) ** 2, 1.5);
  const D = x / (N1 * K0);

  const latRad =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * WGS84_EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * WGS84_EP2 - 3 * C1 ** 2) * D ** 6) / 720);

  const lonCentralDeg = (zona - 1) * 6 - 180 + 3;
  const lonRad =
    (lonCentralDeg * Math.PI) / 180 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * WGS84_EP2 + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1Rad);

  return {
    lat: Math.round(((latRad * 180) / Math.PI) * 10000000) / 10000000,
    lon: Math.round(((lonRad * 180) / Math.PI) * 10000000) / 10000000,
  };
}

/**
 * Captura la posición GPS actual del dispositivo móvil con máxima precisión.
 */
export function capturarPosicionGps(zonaForzada?: number): Promise<LecturaGpsActual> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización GPS no soportada en este dispositivo o navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const alt = pos.coords.altitude || 0;
        const precisionM = pos.coords.accuracy || 5;

        const utm = wgs84ToUtm(lat, lon, zonaForzada);

        resolve({
          lat,
          lon,
          alt,
          precisionM,
          timestamp: pos.timestamp,
          ...utm,
        });
      },
      (err) => {
        let msg = "Error al obtener GPS.";
        if (err.code === err.PERMISSION_DENIED) msg = "Permiso de GPS denegado por el usuario.";
        else if (err.code === err.POSITION_UNAVAILABLE) msg = "Señal GPS no disponible actualmente.";
        else if (err.code === err.TIMEOUT) msg = "Tiempo de espera agotado al buscar señal GPS.";
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Inicia el seguimiento continuo del GPS para replanteo dinámico.
 */
export function seguirGpsContinuo(
  onActualizacion: (pos: LecturaGpsActual) => void,
  onError: (err: Error) => void,
  zonaForzada?: number
): number {
  if (!navigator.geolocation) {
    onError(new Error("Geolocalización no soportada."));
    return 0;
  }

  return navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const alt = pos.coords.altitude || 0;
      const precisionM = pos.coords.accuracy || 5;
      const utm = wgs84ToUtm(lat, lon, zonaForzada);
      onActualizacion({
        lat,
        lon,
        alt,
        precisionM,
        timestamp: pos.timestamp,
        ...utm,
      });
    },
    (err) => {
      onError(new Error(err.message));
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    }
  );
}

/**
 * Detiene el seguimiento continuo.
 */
export function detenerGpsContinuo(watchId: number): void {
  if (navigator.geolocation && watchId) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calcula la guía de replanteo dinámico desde la posición GPS actual hacia un punto objetivo.
 */
export function calcularGuiaReplanteo(
  posicionActual: { este: number; norte: number },
  puntoObjetivo: { este: number; norte: number },
  toleranciaM = 0.2
): GuiaReplanteo {
  const de = puntoObjetivo.este - posicionActual.este;
  const dn = puntoObjetivo.norte - posicionActual.norte;
  const dist = Math.hypot(de, dn);

  let azRad = Math.atan2(de, dn);
  if (azRad < 0) azRad += 2 * Math.PI;
  const azDeg = (azRad * 180) / Math.PI;

  const enTolerancia = dist <= toleranciaM;

  return {
    distanciaHorizontalM: Math.round(dist * 1000) / 1000,
    deltaEsteM: Math.round(de * 1000) / 1000,
    deltaNorteM: Math.round(dn * 1000) / 1000,
    azimutHaciaPuntoDeg: Math.round(azDeg * 100) / 100,
    rumboStr: `Az ${azDeg.toFixed(1)}°`,
    enTolerancia,
  };
}
