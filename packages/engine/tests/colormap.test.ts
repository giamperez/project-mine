import { describe, expect, it } from "vitest";
import { viridis } from "../src/color/colormap.js";

describe("viridis", () => {
  it("t=0 es el morado oscuro inicial y t=1 es el amarillo final de la tabla oficial de matplotlib", () => {
    const inicio = viridis(0);
    expect(inicio.r).toBeCloseTo(0.267004, 5);
    expect(inicio.g).toBeCloseTo(0.004874, 5);
    expect(inicio.b).toBeCloseTo(0.329415, 5);

    const fin = viridis(1);
    expect(fin.r).toBeCloseTo(0.993248, 5);
    expect(fin.g).toBeCloseTo(0.906157, 5);
    expect(fin.b).toBeCloseTo(0.143936, 5);
  });

  it("recorta valores fuera de [0,1] en vez de extrapolar", () => {
    expect(viridis(-5)).toEqual(viridis(0));
    expect(viridis(5)).toEqual(viridis(1));
  });

  it("la luminancia percibida crece de forma aproximadamente monotona (viridis es perceptualmente uniforme)", () => {
    const luminancia = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const muestras = Array.from({ length: 11 }, (_, i) => luminancia(viridis(i / 10)));
    for (let i = 1; i < muestras.length; i++) {
      expect(muestras[i]).toBeGreaterThanOrEqual(muestras[i - 1] - 1e-6);
    }
  });

  it("es continuo: valores de t muy cercanos dan colores muy cercanos (sin saltos por errores de indexado)", () => {
    const a = viridis(0.5);
    const b = viridis(0.5001);
    expect(Math.abs(a.r - b.r)).toBeLessThan(0.01);
    expect(Math.abs(a.g - b.g)).toBeLessThan(0.01);
    expect(Math.abs(a.b - b.b)).toBeLessThan(0.01);
  });
});
