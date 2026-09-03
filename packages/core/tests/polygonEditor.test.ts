import { describe, expect, it } from "vitest";
import {
  agregarVertice,
  aristaMasCercana,
  eliminarVertice,
  insertarVerticeEnArista,
  longitudPoligono_m,
  moverVertice,
  snapAGrilla,
  verticeMasCercano,
} from "../src/geometry2d/polygonEditor.js";
import type { Punto2D } from "../src/formulas/mining/geometry.js";

describe("agregarVertice", () => {
  it("agrega al final sin mutar el arreglo original", () => {
    const original: Punto2D[] = [{ x: 0, y: 0 }];
    const nuevo = agregarVertice(original, { x: 1, y: 2 });
    expect(nuevo).toEqual([{ x: 0, y: 0 }, { x: 1, y: 2 }]);
    expect(original).toEqual([{ x: 0, y: 0 }]); // sin mutar
  });
});

describe("moverVertice", () => {
  it("reemplaza solo el vertice indicado", () => {
    const poligono: Punto2D[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(moverVertice(poligono, 1, { x: 5, y: 5 })).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
  });
});

describe("eliminarVertice", () => {
  it("quita el vertice indicado", () => {
    const poligono: Punto2D[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
    expect(eliminarVertice(poligono, 1)).toEqual([{ x: 0, y: 0 }, { x: 2, y: 2 }]);
  });
});

describe("insertarVerticeEnArista", () => {
  it("inserta justo despues del indice de arista dado", () => {
    const poligono: Punto2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(insertarVerticeEnArista(poligono, 0, { x: 5, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });
});

describe("snapAGrilla", () => {
  it("redondea al punto de grilla mas cercano", () => {
    expect(snapAGrilla({ x: 7.3, y: 12.8 }, 5)).toEqual({ x: 5, y: 15 });
  });

  it("con tamano de grilla 0 no cambia el punto", () => {
    expect(snapAGrilla({ x: 7.3, y: 12.8 }, 0)).toEqual({ x: 7.3, y: 12.8 });
  });
});

describe("verticeMasCercano", () => {
  const poligono: Punto2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  it("encuentra el vertice dentro de la tolerancia", () => {
    expect(verticeMasCercano(poligono, { x: 0.5, y: 0.5 }, 2)).toBe(0);
  });

  it("devuelve null si ningun vertice esta dentro de la tolerancia", () => {
    expect(verticeMasCercano(poligono, { x: 0.5, y: 0.5 }, 0.5)).toBeNull();
  });
});

describe("aristaMasCercana", () => {
  it("encuentra la arista mas cercana a un punto cercano a un borde", () => {
    const cuadrado: Punto2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(aristaMasCercana(cuadrado, { x: 5, y: 0.1 }, 1)).toBe(0);
  });

  it("devuelve null fuera de tolerancia", () => {
    const cuadrado: Punto2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(aristaMasCercana(cuadrado, { x: 5, y: 5 }, 1)).toBeNull();
  });
});

describe("longitudPoligono_m", () => {
  const cuadrado: Punto2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it("perimetro cerrado de un cuadrado de lado 10", () => {
    expect(longitudPoligono_m(cuadrado, true)).toBeCloseTo(40, 6);
  });

  it("longitud abierta (sin la arista de cierre)", () => {
    expect(longitudPoligono_m(cuadrado, false)).toBeCloseTo(30, 6);
  });
});

describe("agregarVertice/moverVertice/eliminarVertice con tipos enriquecidos (T extends Punto2D)", () => {
  interface Marcador extends Punto2D {
    id: string;
    profundidad: number;
  }

  it("moverVertice preserva los campos extra, solo cambia x/y", () => {
    const marcadores: Marcador[] = [{ id: "A", x: 0, y: 0, profundidad: 40 }, { id: "B", x: 5, y: 5, profundidad: 60 }];
    const movidos = moverVertice(marcadores, 0, { ...marcadores[0], x: 99, y: 99 });
    expect(movidos[0]).toEqual({ id: "A", x: 99, y: 99, profundidad: 40 });
    expect(movidos[1]).toEqual(marcadores[1]); // el otro marcador queda intacto
  });

  it("eliminarVertice en el medio no mezcla los campos extra de otro elemento", () => {
    const marcadores: Marcador[] = [
      { id: "A", x: 0, y: 0, profundidad: 10 },
      { id: "B", x: 1, y: 1, profundidad: 20 },
      { id: "C", x: 2, y: 2, profundidad: 30 },
    ];
    const restantes = eliminarVertice(marcadores, 1); // quita B (el del medio)
    expect(restantes).toEqual([
      { id: "A", x: 0, y: 0, profundidad: 10 },
      { id: "C", x: 2, y: 2, profundidad: 30 },
    ]);
  });

  it("agregarVertice conserva el tipo enriquecido del nuevo punto", () => {
    const marcadores: Marcador[] = [{ id: "A", x: 0, y: 0, profundidad: 10 }];
    const nuevos = agregarVertice(marcadores, { id: "B", x: 5, y: 5, profundidad: 25 });
    expect(nuevos).toEqual([
      { id: "A", x: 0, y: 0, profundidad: 10 },
      { id: "B", x: 5, y: 5, profundidad: 25 },
    ]);
  });
});
