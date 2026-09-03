import { describe, expect, it } from "vitest";
import { ajustarVariograma, semivarianza, variogramaExperimental } from "../src/formulas/mining/variogram.js";
import type { ModeloVariograma, TipoModeloVariograma } from "../src/domain/blockModel.js";

describe("semivarianza", () => {
  it("gamma(0) = 0 para los 3 modelos (discontinuidad en el origen por el efecto pepita)", () => {
    const tipos: TipoModeloVariograma[] = ["esferico", "exponencial", "gaussiano"];
    for (const tipo of tipos) {
      const modelo: ModeloVariograma = { tipo, pepita: 0.5, meseta: 3, alcance_m: 20 };
      expect(semivarianza(modelo, 0)).toBe(0);
    }
  });

  it("esferico: gamma(alcance) = meseta exactamente, y es lineal-cubica antes", () => {
    const modelo: ModeloVariograma = { tipo: "esferico", pepita: 0.5, meseta: 3, alcance_m: 20 };
    expect(semivarianza(modelo, 20)).toBeCloseTo(3, 9);
    expect(semivarianza(modelo, 30)).toBeCloseTo(3, 9); // mas alla del alcance, se mantiene en la meseta
    // a h=alcance/2: r=0.5 -> forma = 1.5*0.5 - 0.5*0.5^3 = 0.6875
    const esperado = 0.5 + (3 - 0.5) * 0.6875;
    expect(semivarianza(modelo, 10)).toBeCloseTo(esperado, 9);
  });

  it("exponencial: se aproxima a la meseta pero nunca la alcanza exactamente (asintotico)", () => {
    const modelo: ModeloVariograma = { tipo: "exponencial", pepita: 0, meseta: 2, alcance_m: 10 };
    // a h=alcance: gamma = meseta*(1 - e^-1)
    expect(semivarianza(modelo, 10)).toBeCloseTo(2 * (1 - Math.exp(-1)), 9);
    // al alcance practico (~3a) debe estar muy cerca (>95%) de la meseta
    expect(semivarianza(modelo, 30)).toBeGreaterThan(2 * 0.95);
    expect(semivarianza(modelo, 30)).toBeLessThan(2);
  });

  it("gaussiano: se aproxima a la meseta con forma sigmoidal (mas suave en el origen que esferico/exponencial)", () => {
    const modelo: ModeloVariograma = { tipo: "gaussiano", pepita: 0, meseta: 2, alcance_m: 10 };
    expect(semivarianza(modelo, 10)).toBeCloseTo(2 * (1 - Math.exp(-1)), 9);
    // al alcance practico (~a*sqrt(3)) debe estar muy cerca de la meseta
    expect(semivarianza(modelo, 10 * Math.sqrt(3))).toBeGreaterThan(2 * 0.94);
  });
});

describe("variogramaExperimental", () => {
  it("agrupa pares por lag y promedia 0.5*(dv)^2 dentro de cada bin (calculado a mano)", () => {
    // 3 puntos colineales: h(0,1)=10, h(0,2)=20, h(1,2)=10
    const puntos = [
      { x: 0, y: 0, z: 0, valor: 1 },
      { x: 10, y: 0, z: 0, valor: 3 },
      { x: 20, y: 0, z: 0, valor: 1 },
    ];
    const resultado = variogramaExperimental(puntos, 10, 3);
    // lag0 [0,10): sin pares -> filtrado
    // lag1 [10,20): 2 pares con h=10, dv=2 cada uno -> semivarianza = (4+4)/(2*2) = 2
    // lag2 [20,30): 1 par con h=20, dv=0 -> semivarianza = 0
    expect(resultado).toHaveLength(2);
    expect(resultado[0].distancia_m).toBeCloseTo(10, 9);
    expect(resultado[0].numeroPares).toBe(2);
    expect(resultado[0].semivarianza).toBeCloseTo(2, 9);
    expect(resultado[1].distancia_m).toBeCloseTo(20, 9);
    expect(resultado[1].numeroPares).toBe(1);
    expect(resultado[1].semivarianza).toBeCloseTo(0, 9);
  });

  it("devuelve arreglo vacio si no hay suficientes puntos o el lag es invalido", () => {
    expect(variogramaExperimental([{ x: 0, y: 0, z: 0, valor: 1 }], 10, 5)).toEqual([]);
    expect(variogramaExperimental([], 10, 5)).toEqual([]);
    expect(
      variogramaExperimental(
        [
          { x: 0, y: 0, z: 0, valor: 1 },
          { x: 5, y: 0, z: 0, valor: 2 },
        ],
        0,
        5
      )
    ).toEqual([]);
  });
});

describe("ajustarVariograma", () => {
  it("recupera aproximadamente pepita/meseta/alcance de un variograma experimental sin ruido generado desde un modelo conocido", () => {
    const modeloVerdadero: ModeloVariograma = { tipo: "esferico", pepita: 0.5, meseta: 3, alcance_m: 50 };
    const distancias = [5, 15, 25, 35, 45, 55, 65, 75];
    const experimental = distancias.map((d) => ({
      distancia_m: d,
      semivarianza: semivarianza(modeloVerdadero, d),
      numeroPares: 20,
    }));

    const ajustado = ajustarVariograma(experimental, "esferico");
    expect(ajustado).not.toBeNull();
    expect(ajustado!.pepita).toBeCloseTo(0.5, 1);
    expect(ajustado!.meseta).toBeCloseTo(3, 1);
    // el alcance se busca en una grilla discreta (60 candidatos entre 0 y ~75m) -> tolerancia mas laxa
    expect(Math.abs(ajustado!.alcance_m - 50)).toBeLessThan(3);
  });

  it("devuelve null con menos de 2 puntos experimentales", () => {
    expect(ajustarVariograma([], "esferico")).toBeNull();
    expect(ajustarVariograma([{ distancia_m: 10, semivarianza: 1, numeroPares: 5 }], "esferico")).toBeNull();
  });
});
