/**
 * Mapa de color "viridis" (matplotlib) — perceptualmente uniforme y apto para daltonismo
 * (deuteranopia/protanopia), a diferencia de la rampa azul-rojo tipo "jet" que se usaba antes en
 * los visores 3D (ley, varianza de kriging, secuencia de voladura): esa rampa pasa por rojo-verde,
 * el par de colores que menos se distingue en las formas mas comunes de daltonismo — un problema
 * real en una herramienta de campo que va a usar gente distinta.
 *
 * 17 puntos de control muestreados uniformemente de la tabla oficial de 256 colores de matplotlib
 * (github.com/BIDS/colormap/blob/master/colormaps.py, `_viridis_data`), interpolados linealmente
 * en RGB — suficiente para una rampa de color visual, no para reproducir la curva exacta.
 */
const PARADAS_VIRIDIS: Array<[number, number, number]> = [
  [0.267004, 0.004874, 0.329415],
  [0.282656, 0.100196, 0.42216],
  [0.277134, 0.185228, 0.489898],
  [0.253935, 0.265254, 0.529983],
  [0.221989, 0.339161, 0.548752],
  [0.190631, 0.407061, 0.556089],
  [0.163625, 0.471133, 0.558148],
  [0.139147, 0.533812, 0.555298],
  [0.120565, 0.596422, 0.543611],
  [0.134692, 0.658636, 0.517649],
  [0.20803, 0.718701, 0.472873],
  [0.327796, 0.77398, 0.40664],
  [0.477504, 0.821444, 0.318195],
  [0.647257, 0.8584, 0.209861],
  [0.82494, 0.88472, 0.106217],
  [0.983868, 0.904867, 0.136897],
  [0.993248, 0.906157, 0.143936],
];

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/** Color viridis para t en [0,1] (se recorta fuera de rango). r/g/b en [0,1], como espera THREE.Color. */
export function viridis(t: number): ColorRGB {
  const clamped = Math.min(Math.max(t, 0), 1);
  const escala = clamped * (PARADAS_VIRIDIS.length - 1);
  const i0 = Math.floor(escala);
  const i1 = Math.min(i0 + 1, PARADAS_VIRIDIS.length - 1);
  const frac = escala - i0;
  const [r0, g0, b0] = PARADAS_VIRIDIS[i0];
  const [r1, g1, b1] = PARADAS_VIRIDIS[i1];
  return {
    r: r0 + (r1 - r0) * frac,
    g: g0 + (g1 - g0) * frac,
    b: b0 + (b1 - b0) * frac,
  };
}
