import { describe, expect, it } from "vitest";
import {
  calcularArranqueHolmberg,
  calcularGeometriaFrente,
  diametroEquivalente_mm,
  generarTaladrosFrenteTunel,
} from "../src/formulas/mining/tunnelRound.js";

describe("diametroEquivalente_mm", () => {
  it("De = D_individual * sqrt(N), verificado contra Jimeno (1995) cap.22 p.219", () => {
    expect(diametroEquivalente_mm(102, 4)).toBeCloseTo(204, 6); // 102*sqrt(4)=102*2=204
  });
});

describe("calcularArranqueHolmberg", () => {
  // Caso de referencia: 4 taladros de alivio de 102mm -> De=204mm. Los 5 valores B/E que siguen
  // fueron verificados a mano contra la Tabla 22.2 de Jimeno (1995) — metodo simplificado citando
  // a Holmberg (1982)/Olofsson (1990) — y coinciden a 3 decimales con la app de referencia.
  const entrada = { diametroIndividualAlivio_mm: 102, numeroTaladrosAlivio: 4, avance_m: 100, maximoSecciones: 5 };

  it("genera las 5 secciones B1-B5/E1-E5 con los valores exactos de la fuente verificada", () => {
    const r = calcularArranqueHolmberg(entrada);
    expect(r.diametroEquivalente_mm).toBeCloseTo(204, 6);
    expect(r.secciones).toHaveLength(5);

    const esperado = [
      { burden_m: 0.306, espaciamiento_m: 0.433 },
      { burden_m: 0.433, espaciamiento_m: 0.918 },
      { burden_m: 0.918, espaciamiento_m: 1.947 },
      { burden_m: 1.947, espaciamiento_m: 4.131 },
      { burden_m: 4.131, espaciamiento_m: 8.763 },
    ];
    esperado.forEach((e, i) => {
      expect(r.secciones[i].numero).toBe(i + 1);
      expect(r.secciones[i].burden_m).toBeCloseTo(e.burden_m, 3);
      expect(r.secciones[i].espaciamiento_m).toBeCloseTo(e.espaciamiento_m, 3);
    });
  });

  it("primera seccion usa factor 1.0 (E1=B1*sqrt2 sin el 1.5 extra); las siguientes usan 1.5", () => {
    const r = calcularArranqueHolmberg(entrada);
    expect(r.secciones[0].factor).toBe(1.0);
    expect(r.secciones[0].espaciamiento_m).toBeCloseTo(r.secciones[0].burden_m * Math.SQRT2, 9);
    for (let i = 1; i < r.secciones.length; i++) {
      expect(r.secciones[i].factor).toBe(1.5);
      expect(r.secciones[i].burden_m).toBeCloseTo(r.secciones[i - 1].espaciamiento_m, 9); // Bn = E(n-1)
      expect(r.secciones[i].espaciamiento_m).toBeCloseTo(1.5 * r.secciones[i].burden_m * Math.SQRT2, 9);
    }
  });

  it("la regla de parada corta las secciones cuando el espaciamiento alcanza sqrt(avance)", () => {
    // avance=1m -> objetivo=sqrt(1)=1m. E1=0.433<1, E2=0.918<1, E3=1.947>=1 -> deberia parar en 3 secciones.
    const r = calcularArranqueHolmberg({ diametroIndividualAlivio_mm: 102, numeroTaladrosAlivio: 4, avance_m: 1 });
    expect(r.secciones).toHaveLength(3);
  });

  it("respeta el limite de seguridad maximoSecciones aunque la regla de parada no se cumpla", () => {
    const r = calcularArranqueHolmberg({
      diametroIndividualAlivio_mm: 102,
      numeroTaladrosAlivio: 4,
      avance_m: 10000, // objetivo de parada gigante, nunca se alcanza en pocas secciones
      maximoSecciones: 4,
    });
    expect(r.secciones).toHaveLength(4);
  });

  it("sin taladros de alivio (diametro equivalente 0), no genera secciones", () => {
    const r = calcularArranqueHolmberg({ diametroIndividualAlivio_mm: 102, numeroTaladrosAlivio: 0, avance_m: 3 });
    expect(r.secciones).toHaveLength(0);
  });
});

describe("calcularGeometriaFrente", () => {
  it("rectangular: area=ancho*alto, perimetro=2*(ancho+alto)", () => {
    const r = calcularGeometriaFrente({ tipo: "rectangular", ancho_m: 4, alto_m: 3 });
    expect(r.area_m2).toBeCloseTo(12, 6);
    expect(r.perimetro_m).toBeCloseTo(14, 6);
    expect(r.alturaCorona_m).toBe(0);
    expect(r.alturaHastial_m).toBeCloseTo(3, 6);
  });

  it("herradura: hastiales rectos + corona semicircular de radio ancho/2 (verificado a mano)", () => {
    // ancho=4 -> radioCorona=2. alto=4.5 -> alturaHastial=4.5-2=2.5.
    // area = 4*2.5 + (pi*2^2)/2 = 10 + 6.2832 = 16.2832
    // perimetro = 4 + 2*2.5 + pi*2 = 4+5+6.2832 = 15.2832
    const r = calcularGeometriaFrente({ tipo: "herradura", ancho_m: 4, alto_m: 4.5 });
    expect(r.alturaCorona_m).toBeCloseTo(2, 6);
    expect(r.alturaHastial_m).toBeCloseTo(2.5, 6);
    expect(r.area_m2).toBeCloseTo(10 + (Math.PI * 4) / 2, 6);
    expect(r.perimetro_m).toBeCloseTo(4 + 5 + Math.PI * 2, 6);
  });

  it("herradura con alto menor que el radio de corona: la corona no puede exceder el alto total", () => {
    // ancho=4 (radioCorona=2) pero alto=1.5 < 2 -> toda la altura es corona, sin hastiales
    const r = calcularGeometriaFrente({ tipo: "herradura", ancho_m: 4, alto_m: 1.5 });
    expect(r.alturaCorona_m).toBeCloseTo(1.5, 6);
    expect(r.alturaHastial_m).toBe(0);
  });

  it("ancho o alto <=0 devuelve todo en cero, sin lanzar", () => {
    expect(calcularGeometriaFrente({ tipo: "rectangular", ancho_m: 0, alto_m: 5 }).area_m2).toBe(0);
    expect(calcularGeometriaFrente({ tipo: "herradura", ancho_m: 5, alto_m: -1 }).area_m2).toBe(0);
  });
});

describe("generarTaladrosFrenteTunel", () => {
  const poligono = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 5 },
    { x: 0, y: 5 },
  ];
  const secciones = calcularArranqueHolmberg({
    diametroIndividualAlivio_mm: 102,
    numeroTaladrosAlivio: 4,
    avance_m: 3,
  }).secciones;

  it("ubica cada taladro de la seccion k del arranque a radio E_k/sqrt(2) del centroide", () => {
    const centro = { x: 2, y: 2.5 };
    const r = generarTaladrosFrenteTunel({
      poligonoCresta: poligono,
      secciones,
      diametroIndividualAlivio_mm: 102,
      numeroTaladrosAlivio: 4,
      diametroCargaMm: 45,
      burdenProduccion_m: 0.7,
      espaciamientoProduccion_m: 0.8,
      espaciamientoContorno_m: 0.5,
    });
    expect(r.advertencias).toHaveLength(0);

    const anillo1 = r.puntos.filter((p) => p.zona === "arranque");
    expect(anillo1).toHaveLength(4);
    const rEsperado = secciones[0].espaciamiento_m / Math.SQRT2;
    anillo1.forEach((p) => {
      const dist = Math.hypot(p.x - centro.x, p.y - centro.y);
      expect(dist).toBeCloseTo(rEsperado, 6);
      expect(p.cargado).toBe(true);
      expect(p.etapa).toBe(1);
    });

    const alivio = r.puntos.filter((p) => p.zona === "alivio");
    expect(alivio).toHaveLength(4);
    alivio.forEach((p) => expect(p.cargado).toBe(false));
  });

  it("genera taladros de contorno (corona/hastial/arrastre) y produccion dentro del poligono", () => {
    const r = generarTaladrosFrenteTunel({
      poligonoCresta: poligono,
      secciones,
      diametroIndividualAlivio_mm: 102,
      numeroTaladrosAlivio: 4,
      diametroCargaMm: 45,
      burdenProduccion_m: 0.7,
      espaciamientoProduccion_m: 0.8,
      espaciamientoContorno_m: 0.5,
    });
    const zonas = new Set(r.puntos.map((p) => p.zona));
    expect(zonas.has("arrastre")).toBe(true);
    expect(zonas.has("hastial")).toBe(true);
    expect(zonas.has("corona")).toBe(true);
    expect(zonas.has("produccion")).toBe(true);

    r.puntos
      .filter((p) => p.zona === "produccion")
      .forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(4);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(5);
      });
  });

  it("poligono con menos de 3 vertices devuelve advertencia y ninguna entidad", () => {
    const r = generarTaladrosFrenteTunel({
      poligonoCresta: [{ x: 0, y: 0 }],
      secciones,
      diametroIndividualAlivio_mm: 102,
      numeroTaladrosAlivio: 4,
      diametroCargaMm: 45,
      burdenProduccion_m: 0.7,
      espaciamientoProduccion_m: 0.8,
      espaciamientoContorno_m: 0.5,
    });
    expect(r.puntos).toHaveLength(0);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });
});
