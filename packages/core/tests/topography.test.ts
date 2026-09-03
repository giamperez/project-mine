import { describe, expect, it } from "vitest";
import {
  areaPoligono_m2,
  calcularVolumenCorteRelleno,
  generarCurvasNivel,
  interpolarEnSuperficie,
  triangularSuperficie,
  volumenAreaMedia_m3,
  volumenPrismoidal_m3,
} from "../src/formulas/mining/topography.js";
import type { SuperficieTIN } from "../src/domain/topography.js";

describe("areaPoligono_m2 (Shoelace)", () => {
  it("calcula el area de un cuadrado de 10x10", () => {
    expect(
      areaPoligono_m2([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ])
    ).toBeCloseTo(100, 6);
  });

  it("da el mismo resultado sin importar el sentido (siempre positivo)", () => {
    const cuadrado = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(areaPoligono_m2([...cuadrado].reverse())).toBeCloseTo(100, 6);
  });
});

describe("volumenAreaMedia_m3 y volumenPrismoidal_m3", () => {
  it("area media: V=(L/2)(A1+A2)", () => {
    expect(volumenAreaMedia_m3(10, 20, 5)).toBeCloseTo(75, 6);
  });

  it("prismoidal: V=(L/6)(A1+4Am+A2)", () => {
    expect(volumenPrismoidal_m3(10, 16, 20, 5)).toBeCloseTo(78.333333, 5);
  });
});

describe("triangularSuperficie", () => {
  it("triangula 4 puntos de un cuadrado en exactamente 2 triangulos", () => {
    const tin = triangularSuperficie([
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: 0, y: 10, z: 0 },
    ]);
    expect(tin.indices.length).toBe(6); // 2 triangulos x 3 indices
  });
});

describe("interpolarEnSuperficie", () => {
  it("una superficie plana interpola la misma cota en cualquier punto interior", () => {
    const tin = triangularSuperficie([
      { x: 0, y: 0, z: 7 },
      { x: 10, y: 0, z: 7 },
      { x: 10, y: 10, z: 7 },
      { x: 0, y: 10, z: 7 },
    ]);
    expect(interpolarEnSuperficie(tin, 5, 5)).toBeCloseTo(7, 6);
    expect(interpolarEnSuperficie(tin, 1, 9)).toBeCloseTo(7, 6);
  });

  it("un punto fuera de la envolvente devuelve null", () => {
    const tin = triangularSuperficie([
      { x: 0, y: 0, z: 7 },
      { x: 10, y: 0, z: 7 },
      { x: 10, y: 10, z: 7 },
      { x: 0, y: 10, z: 7 },
    ]);
    expect(interpolarEnSuperficie(tin, 50, 50)).toBeNull();
  });

  it("un plano inclinado z=2x+3y+1 se reproduce exactamente en cualquier triangulacion", () => {
    const esquinas = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ].map((p) => ({ ...p, z: 2 * p.x + 3 * p.y + 1 }));
    const tin = triangularSuperficie(esquinas);
    expect(interpolarEnSuperficie(tin, 5, 5)).toBeCloseTo(2 * 5 + 3 * 5 + 1, 6);
    expect(interpolarEnSuperficie(tin, 3, 7)).toBeCloseTo(2 * 3 + 3 * 7 + 1, 6);
  });
});

describe("calcularVolumenCorteRelleno", () => {
  it("dos superficies planas paralelas dan volumen = area x diferencia de cota", () => {
    const cuadrado = (z: number): SuperficieTIN =>
      triangularSuperficie([
        { x: 0, y: 0, z },
        { x: 10, y: 0, z },
        { x: 10, y: 10, z },
        { x: 0, y: 10, z },
      ]);

    const r = calcularVolumenCorteRelleno({
      superficieActual: cuadrado(15),
      superficieDiseno: cuadrado(10),
      resolucionGrilla_m: 2,
    });

    expect(r.areaComun_m2).toBeCloseTo(100, 6);
    expect(r.volumenCorte_m3).toBeCloseTo(500, 3);
    expect(r.volumenRelleno_m3).toBeCloseTo(0, 6);
    expect(r.volumenNeto_m3).toBeCloseTo(500, 3);
    expect(r.advertencias.length).toBe(0);
  });

  it("cuando el actual esta por debajo del diseno, da relleno en vez de corte", () => {
    const cuadrado = (z: number): SuperficieTIN =>
      triangularSuperficie([
        { x: 0, y: 0, z },
        { x: 10, y: 0, z },
        { x: 10, y: 10, z },
        { x: 0, y: 10, z },
      ]);

    const r = calcularVolumenCorteRelleno({
      superficieActual: cuadrado(8),
      superficieDiseno: cuadrado(10),
      resolucionGrilla_m: 2,
    });

    expect(r.volumenRelleno_m3).toBeCloseTo(200, 3);
    expect(r.volumenCorte_m3).toBeCloseTo(0, 6);
  });

  it("advierte si las superficies no se solapan en planta", () => {
    const a = triangularSuperficie([
      { x: 0, y: 0, z: 10 },
      { x: 10, y: 0, z: 10 },
      { x: 10, y: 10, z: 10 },
      { x: 0, y: 10, z: 10 },
    ]);
    const b = triangularSuperficie([
      { x: 100, y: 100, z: 10 },
      { x: 110, y: 100, z: 10 },
      { x: 110, y: 110, z: 10 },
      { x: 100, y: 110, z: 10 },
    ]);
    const r = calcularVolumenCorteRelleno({ superficieActual: a, superficieDiseno: b });
    expect(r.advertencias.length).toBeGreaterThan(0);
    expect(r.volumenNeto_m3).toBe(0);
  });
});

describe("generarCurvasNivel", () => {
  // Triangulo plano: z = x en todo el triangulo (a=(0,0,0), b=(10,0,10), c=(0,10,0))
  const superficie: SuperficieTIN = {
    puntos: [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
      { x: 0, y: 10, z: 0 },
    ],
    indices: [0, 1, 2],
  };

  it("genera el segmento correcto para la cota 4 (linea vertical x=4 entre y=0 y y=6)", () => {
    const segmentos = generarCurvasNivel({ superficie, intervalo_m: 2 });
    const seg4 = segmentos.find((s) => s.cota === 4);
    expect(seg4).toBeDefined();
    expect(seg4!.a.x).toBeCloseTo(4, 6);
    expect(seg4!.b.x).toBeCloseTo(4, 6);
    const ys = [seg4!.a.y, seg4!.b.y].sort((x, y) => x - y);
    expect(ys[0]).toBeCloseTo(0, 6);
    expect(ys[1]).toBeCloseTo(6, 6);
  });

  it("genera al menos una curva por cada nivel interior dentro del rango [0,10] con intervalo 2", () => {
    const segmentos = generarCurvasNivel({ superficie, intervalo_m: 2 });
    const niveles = new Set(segmentos.map((s) => s.cota));
    for (const nivel of [2, 4, 6, 8]) {
      expect(niveles.has(nivel)).toBe(true);
    }
  });
});
