import type { PuntoTopografico } from "@suite/core";

/** Terreno sintetico (deterministico) para que la vista 3D no arranque vacia antes de importar datos reales. */
export function generarTerrenoDemo(): PuntoTopografico[] {
  const puntos: PuntoTopografico[] = [];
  for (let x = 0; x <= 60; x += 5) {
    for (let y = 0; y <= 40; y += 5) {
      const z = 100 + 12 * Math.sin(x / 15) + 8 * Math.cos(y / 12) + 4 * Math.sin((x + y) / 20);
      puntos.push({ x, y, z });
    }
  }
  return puntos;
}

/** Superficie de referencia demo (un plano de diseño a cota fija) para probar corte/relleno sin subir archivos. */
export function generarReferenciaDemo(cota = 108): PuntoTopografico[] {
  return [
    { x: 0, y: 0, z: cota },
    { x: 60, y: 0, z: cota },
    { x: 60, y: 40, z: cota },
    { x: 0, y: 40, z: cota },
  ];
}
