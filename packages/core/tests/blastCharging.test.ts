import { describe, expect, it } from "vitest";
import {
  asignarRolTaladro,
  calcularCargaTaladro,
  disenarCarguioVoladura,
  evaluarResultadoVoladura,
} from "../src/formulas/mining/blastCharging.js";
import type { Taladro } from "../src/domain/blastPattern.js";
import type { ConfigCarguio, ConfigRolCarguio } from "../src/domain/blastCharging.js";
import { CATALOGO_EXPLOSIVOS_PERU } from "../src/domain/tunnelRound.js";

const EXPLOSIVO = CATALOGO_EXPLOSIVOS_PERU[0];

function taladroFalso(fila: number, columna: number, x: number, y: number): Taladro {
  return {
    id: `T-${fila}-${columna}`,
    fila,
    columna,
    collar: { x, y, z: 100 },
    fondo: { x, y, z: 90 },
    profundidad_m: 10,
    diametroMm: 89,
    taco_m: 2,
    longitudCarga_m: 8,
  };
}

function configRol(overrides?: Partial<ConfigRolCarguio>): ConfigRolCarguio {
  return {
    explosivo: EXPLOSIVO,
    taco_m: 2,
    llenado: 0.9,
    cebosPorTaladro: 1,
    cargar: true,
    ...overrides,
  };
}

function configCompleta(overrides?: Partial<Record<string, Partial<ConfigRolCarguio>>>): ConfigCarguio {
  return {
    arranque: configRol(overrides?.arranque),
    produccion: configRol(overrides?.produccion),
    contorno: configRol(overrides?.contorno),
    recorte: configRol({ cargar: false, ...overrides?.recorte }),
    arrastres: configRol(overrides?.arrastres),
  };
}

describe("asignarRolTaladro", () => {
  it("clasifica el taladro central como arranque y el de borde como contorno", () => {
    const contexto = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const centro = taladroFalso(1, 1, 5, 5);
    const borde = taladroFalso(0, 0, 0, 5);
    expect(asignarRolTaladro(centro, contexto)).toBe("arranque");
    expect(asignarRolTaladro(borde, contexto)).toBe("contorno");
  });

  it("usa la zona de tunel cuando esta presente en vez de la geometria", () => {
    const t = { ...taladroFalso(0, 0, 5, 5), zona: "arrastre" };
    const contexto = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    expect(asignarRolTaladro(t, contexto)).toBe("arrastres");
  });
});

describe("calcularCargaTaladro", () => {
  it("no carga explosivo cuando el rol esta desactivado", () => {
    const t = taladroFalso(0, 0, 0, 0);
    const carga = calcularCargaTaladro(t, "recorte", configRol({ cargar: false }));
    expect(carga.cargado).toBe(false);
    expect(carga.pesoExplosivo_kg).toBe(0);
  });

  it("calcula un peso de explosivo positivo cuando el rol esta activo", () => {
    const t = taladroFalso(0, 0, 0, 0);
    const carga = calcularCargaTaladro(t, "arranque", configRol());
    expect(carga.cargado).toBe(true);
    expect(carga.pesoExplosivo_kg).toBeGreaterThan(0);
    expect(carga.longitudCargada_m).toBeLessThanOrEqual(carga.longitudDisponible_m);
  });
});

describe("disenarCarguioVoladura", () => {
  it("deja vacios los taladros cuyo rol asignado esta desactivado", () => {
    const taladros = [taladroFalso(0, 0, 0, 0), taladroFalso(2, 2, 20, 20)];
    const resultado = disenarCarguioVoladura(taladros, configCompleta());
    expect(resultado.cargas).toHaveLength(2);
    expect(resultado.taladrosCargados + resultado.taladrosVacios).toBe(2);
    expect(resultado.pesoExplosivoTotal_kg).toBeGreaterThan(0);
  });

  it("retorna un resultado vacio para una lista de taladros vacia", () => {
    const resultado = disenarCarguioVoladura([], configCompleta());
    expect(resultado.cargas).toHaveLength(0);
    expect(resultado.pesoExplosivoTotal_kg).toBe(0);
  });
});

describe("evaluarResultadoVoladura", () => {
  it("produce un factor de carga y un estado coherentes para un carguio tipico", () => {
    const taladros = Array.from({ length: 9 }, (_, i) => taladroFalso(Math.floor(i / 3), i % 3, (i % 3) * 3, Math.floor(i / 3) * 3));
    const carguio = disenarCarguioVoladura(taladros, configCompleta());
    const evaluacion = evaluarResultadoVoladura({
      carguio,
      burden_m: 3,
      espaciamiento_m: 3,
      alturaBanco_m: 10,
      densidadRoca_tm3: 2.7,
      rwsPromedio: EXPLOSIVO.rwsPeso,
    });
    expect(evaluacion.factorCarga_kgm3).toBeGreaterThan(0);
    expect(evaluacion.tonelaje_t).toBeGreaterThan(0);
    expect(["Apto", "Revisar", "No apto"]).toContain(evaluacion.estado);
    expect(["Bajo", "Moderado", "Alto"]).toContain(evaluacion.riesgo);
  });
});
