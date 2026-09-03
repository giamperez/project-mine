import { describe, expect, it } from "vitest";
import {
  calcularSecuenciaIniciacion,
  cargaLineal_kgm,
  disenarVoladura,
  factorCargaTaladro_kgm3,
  pesoExplosivoPorTaladro_kg,
} from "../src/formulas/mining/blasting.js";
import { disenarMallaPerforacion } from "../src/formulas/mining/blastPattern.js";
import type { Taladro } from "../src/domain/blastPattern.js";
import type { EntradaVoladura } from "../src/domain/blasting.js";

function taladroFalso(fila: number, columna: number): Taladro {
  return {
    id: `T-${fila}-${columna}`,
    fila,
    columna,
    collar: { x: columna * 3, y: fila * 3, z: 100 },
    fondo: { x: columna * 3, y: fila * 3, z: 90 },
    profundidad_m: 10,
    diametroMm: 89,
    taco_m: 2,
    longitudCarga_m: 8,
  };
}

describe("cargaLineal_kgm", () => {
  it("reproduce el calculo manual: d=100mm, densidad=1.0 g/cc -> 2.5*pi kg/m", () => {
    expect(cargaLineal_kgm(100, 1.0)).toBeCloseTo(2.5 * Math.PI, 5);
  });

  it("crece con el cuadrado del diametro", () => {
    const c1 = cargaLineal_kgm(50, 1.0);
    const c2 = cargaLineal_kgm(100, 1.0);
    expect(c2).toBeCloseTo(c1 * 4, 6);
  });
});

describe("pesoExplosivoPorTaladro_kg", () => {
  it("multiplica longitud de carga por carga lineal", () => {
    expect(pesoExplosivoPorTaladro_kg(8, 2)).toBeCloseTo(16, 6);
  });

  it("nunca es negativo aunque la longitud de carga lo sea", () => {
    expect(pesoExplosivoPorTaladro_kg(-3, 2)).toBe(0);
  });
});

describe("factorCargaTaladro_kgm3", () => {
  it("PF = peso / (B*S*H)", () => {
    expect(factorCargaTaladro_kgm3(10, 2, 2.5, 10)).toBeCloseTo(0.2, 6);
  });
});

describe("calcularSecuenciaIniciacion", () => {
  const grilla = [
    taladroFalso(0, 0),
    taladroFalso(0, 1),
    taladroFalso(0, 2),
    taladroFalso(1, 0),
    taladroFalso(1, 1),
    taladroFalso(1, 2),
  ];

  it("fila_por_fila: todos los taladros de una fila detonan juntos, ignora ms/taladro", () => {
    const r = calcularSecuenciaIniciacion(grilla, "fila_por_fila", 10, 5);
    expect(r.filter((x) => x.fila === 0).every((x) => x.tiempoDetonacion_ms === 0)).toBe(true);
    expect(r.filter((x) => x.fila === 1).every((x) => x.tiempoDetonacion_ms === 10)).toBe(true);
  });

  it("echelon: avanza en diagonal desde la columna 0 (esquina)", () => {
    const r = calcularSecuenciaIniciacion(grilla, "echelon", 10, 5);
    const porId = Object.fromEntries(r.map((x) => [x.taladroId, x.tiempoDetonacion_ms]));
    expect(porId["T-0-0"]).toBe(0);
    expect(porId["T-0-1"]).toBe(5);
    expect(porId["T-0-2"]).toBe(10);
    expect(porId["T-1-0"]).toBe(10);
    expect(porId["T-1-2"]).toBe(20);
  });

  it("v_corte: avanza en diagonal desde la columna central hacia ambos extremos", () => {
    const r = calcularSecuenciaIniciacion(grilla, "v_corte", 10, 5);
    const porId = Object.fromEntries(r.map((x) => [x.taladroId, x.tiempoDetonacion_ms]));
    expect(porId["T-0-1"]).toBe(0); // columna central (columnaMax=2 -> centro=1)
    expect(porId["T-0-0"]).toBe(5);
    expect(porId["T-0-2"]).toBe(5);
    expect(porId["T-1-1"]).toBe(10);
  });
});

describe("disenarVoladura (orquestador end-to-end sobre una malla real)", () => {
  const malla = disenarMallaPerforacion({
    poligonoCresta: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 15 },
      { x: 0, y: 15 },
    ],
    cotaCresta: 100,
    alturaBanco_m: 10,
    diametroMm: 89,
    densidadRocaGcm3: 2.7,
    tipoRoca: "media",
    explosivo: { nombre: "ANFO", densidadGcm3: 0.85, fuerzaRelativaANFO: 1.0 },
  });

  const entradaBase: EntradaVoladura = {
    taladros: malla.taladros,
    burden_m: malla.burdenDiseno_m,
    espaciamiento_m: malla.espaciamiento_m,
    alturaBanco_m: 10,
    explosivo: { nombre: "ANFO", densidadGcm3: 0.85, fuerzaRelativaANFO: 1.0 },
    patronIniciacion: "echelon",
  };

  it("calcula una carga y un tiempo de detonacion por cada taladro", () => {
    const r = disenarVoladura(entradaBase);
    expect(r.cargas.length).toBe(malla.taladros.length);
    expect(r.pesoExplosivoTotal_kg).toBeGreaterThan(0);
    expect(r.factorCarga_kgm3).toBeGreaterThan(0);
    expect(r.duracionTotalSecuencia_ms).toBeGreaterThan(0);
    for (const c of r.cargas) {
      expect(c.pesoExplosivo_kg).toBeGreaterThan(0);
      expect(c.tiempoDetonacion_ms).toBeGreaterThanOrEqual(0);
    }
  });

  it("fila_por_fila produce una duracion total menor o igual que echelon (menos taladros distintos por tiempo)", () => {
    const rFila = disenarVoladura({ ...entradaBase, patronIniciacion: "fila_por_fila" });
    const rEchelon = disenarVoladura({ ...entradaBase, patronIniciacion: "echelon" });
    expect(rFila.duracionTotalSecuencia_ms).toBeLessThanOrEqual(rEchelon.duracionTotalSecuencia_ms);
  });

  it("advierte si el factor de carga global se sale del rango tipico 0.15-1.5 kg/m3", () => {
    const rExplosivoDebil = disenarVoladura({
      ...entradaBase,
      explosivo: { nombre: "Debil", densidadGcm3: 0.05, fuerzaRelativaANFO: 0.2 },
    });
    expect(rExplosivoDebil.advertencias.some((a) => a.includes("Factor de carga global"))).toBe(true);
  });
});
