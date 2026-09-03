import type { ColarSondaje, IntervaloEnsayo } from "@suite/core";

/** Set de sondajes sintetico (deterministico): 9 pozos verticales en grilla 3x3, ley mas alta cerca
 * del centro y alrededor de los 25-30m de profundidad — para que el modelo no arranque vacio. */
export function generarSondajesDemo(): { colares: ColarSondaje[]; intervalos: IntervaloEnsayo[] } {
  const colares: ColarSondaje[] = [];
  const intervalos: IntervaloEnsayo[] = [];
  const centro = { x: 40, y: 40 };
  let contador = 1;

  for (const x of [0, 40, 80]) {
    for (const y of [0, 40, 80]) {
      const id = `DH-${contador++}`;
      colares.push({ id, x, y, z: 100, profundidadTotal_m: 60, azimut_grados: 0, inclinacion_grados: -90 });

      const distHorizontal = Math.hypot(x - centro.x, y - centro.y);
      for (let desde = 0; desde < 60; desde += 10) {
        const hasta = desde + 10;
        const medio = (desde + hasta) / 2;
        const factorHorizontal = Math.exp(-distHorizontal / 45);
        const factorProfundidad = Math.exp(-Math.abs(medio - 30) / 35);
        const ley = Math.max(0.05, 1.8 * factorHorizontal * factorProfundidad);
        intervalos.push({ sondajeId: id, desde_m: desde, hasta_m: hasta, ley: Number(ley.toFixed(2)) });
      }
    }
  }
  return { colares, intervalos };
}
