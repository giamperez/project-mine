/**
 * Conversion de coordenadas geograficas (WGS84 lat/lon) a UTM (Easting/Northing), para poder
 * ubicar puntos GPS de campo (KML/KMZ) en el mismo tipo de coordenadas metricas planas que usa el
 * resto de la suite (x=Este, y=Norte, en metros).
 *
 * Formula de Mercator Transversa elipsoidal por expansion en serie de Snyder (1987) "Map
 * Projections: A Working Manual", USGS Professional Paper 1395, pp. 61-64 — la misma base que usan
 * la mayoria de las librerias UTM abiertas (p.ej. el conversor de Chuck Taylor, o el paquete
 * Turbo87/utm de Python).
 *
 * IMPORTANTE: esto da Easting/Northing UTM reales (metros), NO necesariamente alineados con el
 * origen local arbitrario que ya tenga la malla/topografia de una mina en particular — solo
 * coincide si esa malla local YA esta referenciada en UTM. Sirve para ubicar puntos de campo con
 * GPS de forma consistente entre si (y con cualquier otro dato que tambien este en UTM).
 */

export interface ParametrosElipsoide {
  /** Semieje mayor (a), metros. */
  a: number;
  /** Achatamiento (f = (a-b)/a). */
  f: number;
}

/** WGS84: a=6378137.0 m, f=1/298.257223563 (estandar GPS/GNSS). */
export const WGS84: ParametrosElipsoide = { a: 6378137.0, f: 1 / 298.257223563 };

const K0 = 0.9996; // factor de escala estandar UTM
const FALSO_ESTE_M = 500000;
const FALSO_NORTE_SUR_M = 10000000;

export interface CoordenadaUTM {
  zona: number;
  hemisferioNorte: boolean;
  este_m: number;
  norte_m: number;
}

/** Numero de zona UTM (1-60) para una longitud dada, grados. Sin las excepciones de Noruega/Svalbard. */
export function zonaUTM(lon_grados: number): number {
  return Math.floor((lon_grados + 180) / 6) + 1;
}

/**
 * Convierte (lat, lon) en grados decimales WGS84 a UTM (Easting/Northing), metros.
 * `zonaForzada` permite fijar la zona (p.ej. para que todos los puntos de un mismo levantamiento
 * caigan en la misma zona aunque alguno este cerca del limite de 6°); si se omite se calcula sola.
 */
export function wgs84AUtm(lat_grados: number, lon_grados: number, elipsoide: ParametrosElipsoide = WGS84, zonaForzada?: number): CoordenadaUTM {
  const zona = zonaForzada ?? zonaUTM(lon_grados);
  const lonCentral_grados = zona * 6 - 183; // meridiano central de la zona
  const phi = (lat_grados * Math.PI) / 180;
  const lambda = (lon_grados * Math.PI) / 180;
  const lambda0 = (lonCentral_grados * Math.PI) / 180;

  const { a, f } = elipsoide;
  const e2 = f * (2 - f);
  const ePrima2 = e2 / (1 - e2);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ePrima2 * cosPhi * cosPhi;
  const A = (lambda - lambda0) * cosPhi;

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * phi));

  const este =
    K0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ePrima2) * A ** 5) / 120) + FALSO_ESTE_M;

  let norte =
    K0 *
    (M +
      N *
        tanPhi *
        (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ePrima2) * A ** 6) / 720));

  const hemisferioNorte = lat_grados >= 0;
  if (!hemisferioNorte) norte += FALSO_NORTE_SUR_M;

  return { zona, hemisferioNorte, este_m: este, norte_m: norte };
}
