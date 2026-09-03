import { describe, expect, it } from "vitest";
import {
  disenarAcarreo,
  matchFactor,
  numeroBaldesPorCamion,
  numeroCamionesOptimo,
  productividadCamion_tph,
  resistenciaRodadura_pct,
  resistenciaTotal_pct,
  tiempoCarga_s,
  velocidadPorPotencia_kmh,
} from "../src/formulas/mining/haulage.js";
import type { EntradaAcarreo } from "../src/domain/haulage.js";

describe("resistenciaRodadura_pct y resistenciaTotal_pct", () => {
  it("valores tipicos por condicion de via", () => {
    expect(resistenciaRodadura_pct("buena")).toBe(2);
    expect(resistenciaRodadura_pct("regular")).toBe(4);
    expect(resistenciaRodadura_pct("pobre")).toBe(6);
  });

  it("resistencia total = pendiente + rodadura", () => {
    expect(resistenciaTotal_pct(8, 2)).toBe(10);
  });
});

describe("velocidadPorPotencia_kmh", () => {
  it("reproduce el calculo manual: 200000kg, RT=10%, 1500kW, eta=0.85 -> ~23.39 km/h", () => {
    const v = velocidadPorPotencia_kmh(200000, 10, 1500, 0.85, 60);
    expect(v).toBeCloseTo(23.394, 2);
  });

  it("se limita al tope mecanico cuando la potencia disponible sobra", () => {
    const v = velocidadPorPotencia_kmh(200000, 10, 100000, 0.85, 60);
    expect(v).toBe(60);
  });

  it("con resistencia total <= 0.5% (bajada), usa el tope mecanico (no limitado por potencia)", () => {
    const v = velocidadPorPotencia_kmh(200000, 0.2, 1500, 0.85, 60);
    expect(v).toBe(60);
  });

  it("mas peso reduce la velocidad alcanzable a igual potencia", () => {
    const liviano = velocidadPorPotencia_kmh(100000, 10, 1500, 0.85, 60);
    const pesado = velocidadPorPotencia_kmh(300000, 10, 1500, 0.85, 60);
    expect(pesado).toBeLessThan(liviano);
  });
});

describe("numeroBaldesPorCamion y tiempoCarga_s", () => {
  it("200t camion / 40t balde = 5 baldadas", () => {
    expect(numeroBaldesPorCamion(200, 40)).toBe(5);
  });

  it("tiempo de carga = baldadas x ciclo del cargador", () => {
    expect(tiempoCarga_s(5, 30)).toBe(150);
  });
});

describe("productividadCamion_tph", () => {
  it("reproduce el calculo manual: 100t, ciclo 1200s (20min), eficiencia 0.83 -> 249 t/h", () => {
    expect(productividadCamion_tph(100, 1200, 0.83)).toBeCloseTo(249, 6);
  });
});

describe("matchFactor y numeroCamionesOptimo", () => {
  it("MF = (N_camiones x Tc_cargador) / (N_cargadores x Tc_camion)", () => {
    expect(matchFactor(5, 30, 1, 140)).toBeCloseTo(150 / 140, 6);
  });

  it("numero optimo de camiones ~ Tc_camion / t_carga", () => {
    expect(numeroCamionesOptimo(600, 100)).toBe(6);
  });
});

describe("disenarAcarreo (orquestador end-to-end)", () => {
  const entradaBase: EntradaAcarreo = {
    distanciaUnidireccional_m: 2000,
    pendientePromedio_pct: 8,
    condicionVia: "regular",
    capacidadCamion_ton: 220,
    pesoVacioCamion_kg: 180000,
    potenciaCamion_kW: 1900,
    capacidadBalde_ton: 40,
    tiempoCicloCargador_s: 30,
    tiempoDescarga_s: 60,
    numeroCargadores: 1,
  };

  it("el tiempo de ciclo es exactamente la suma de sus partes", () => {
    const r = disenarAcarreo(entradaBase);
    const suma = r.tiempoCarga_s + r.tiempoAcarreoCargado_s + 60 + r.tiempoRetornoVacio_s + 60; // 60=descarga, 60=colas default
    expect(r.tiempoCicloCamion_s).toBeCloseTo(suma, 4);
  });

  it("produce valores positivos y coherentes de productividad y flota", () => {
    const r = disenarAcarreo(entradaBase);
    expect(r.productividadCamion_tph).toBeGreaterThan(0);
    expect(r.numeroCamionesOptimo).toBeGreaterThanOrEqual(1);
    expect(r.produccionFlota_tph).toBeCloseTo(r.productividadCamion_tph * r.numeroCamionesUsado, 4);
  });

  it("advierte cuando el numero de baldadas esta fuera de 4-6", () => {
    const r = disenarAcarreo({ ...entradaBase, capacidadCamion_ton: 220, capacidadBalde_ton: 100 }); // 2.2 -> redondea a 2
    expect(r.numeroBaldesPorCamion).toBe(2);
    expect(r.advertencias.some((a) => a.includes("baldadas"))).toBe(true);
  });

  it("advierte sobre limitacion por freno en bajadas pronunciadas de retorno", () => {
    const r = disenarAcarreo({ ...entradaBase, pendientePromedio_pct: 12, condicionVia: "buena" }); // RT vacio = -12+2 = -10 <= 0.5
    expect(r.advertencias.some((a) => a.includes("freno"))).toBe(true);
  });

  it("un match factor cercano a 1 no genera advertencia de flota desbalanceada", () => {
    const r = disenarAcarreo(entradaBase); // usa la flota "optima" -> MF cercano a 1 por construccion
    expect(r.matchFactor).toBeGreaterThan(0.8);
    expect(r.matchFactor).toBeLessThan(1.2);
  });
});
