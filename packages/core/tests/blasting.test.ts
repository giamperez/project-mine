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

describe("calcularSecuenciaIniciacionTunel (secuencias mineras subterráneas)", () => {
  const taladrosTunel: Taladro[] = [
    {
      id: "AL-1",
      fila: 0,
      columna: 0,
      collar: { x: 2.25, y: 2.25, z: 0 },
      fondo: { x: 2.25, y: 2.25, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 102,
      taco_m: 0,
      longitudCarga_m: 0,
      zona: "alivio",
    },
    {
      id: "C1-1",
      fila: 1,
      columna: 0,
      collar: { x: 2.1, y: 2.1, z: 0 },
      fondo: { x: 2.1, y: 2.1, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 45,
      taco_m: 0.6,
      longitudCarga_m: 2.6,
      zona: "cuadrante1",
    },
    {
      id: "C2-1",
      fila: 2,
      columna: 0,
      collar: { x: 1.8, y: 1.8, z: 0 },
      fondo: { x: 1.8, y: 1.8, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 45,
      taco_m: 0.6,
      longitudCarga_m: 2.6,
      zona: "cuadrante2",
    },
    {
      id: "PR-1",
      fila: 3,
      columna: 0,
      collar: { x: 1.2, y: 2.0, z: 0 },
      fondo: { x: 1.2, y: 2.0, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 45,
      taco_m: 0.6,
      longitudCarga_m: 2.6,
      zona: "produccion",
    },
    {
      id: "AR-1",
      fila: 4,
      columna: 0,
      collar: { x: 2.25, y: 0.2, z: 0 },
      fondo: { x: 2.25, y: 0.2, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 45,
      taco_m: 0.6,
      longitudCarga_m: 2.6,
      zona: "arrastre",
    },
    {
      id: "CD-1",
      fila: 5,
      columna: 0,
      collar: { x: 0.2, y: 2.0, z: 0 },
      fondo: { x: 0.2, y: 2.0, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 45,
      taco_m: 0.6,
      longitudCarga_m: 2.6,
      zona: "cuadrador",
    },
    {
      id: "CO-1",
      fila: 6,
      columna: 0,
      collar: { x: 2.25, y: 4.3, z: 0 },
      fondo: { x: 2.25, y: 4.3, z: 3.2 },
      profundidad_m: 3.2,
      diametroMm: 45,
      taco_m: 0.6,
      longitudCarga_m: 2.6,
      zona: "corona",
    },
  ];

  it("tunel_concentrico: respeta la jerarquía geomecánica de tiempos (Alivio < Cuele < Ayudas < Producción < Arrastre < Cuadradores < Corona)", () => {
    const r = disenarVoladura({
      taladros: taladrosTunel,
      burden_m: 0.8,
      espaciamiento_m: 0.8,
      alturaBanco_m: 3.2,
      explosivo: { nombre: "Semexsa 65", densidadGcm3: 1.12, fuerzaRelativaANFO: 0.92 },
      patronIniciacion: "tunel_concentrico",
      esTunel: true,
    });

    const mapaTiempos = Object.fromEntries(r.cargas.map((c) => [c.taladroId, c.tiempoDetonacion_ms]));
    expect(mapaTiempos["AL-1"]).toBe(0); // Alivio 0ms
    expect(mapaTiempos["C1-1"]).toBe(25); // Cuele 25ms (MS 1)
    expect(mapaTiempos["C2-1"]).toBe(50); // Ayuda 50ms (MS 2)
    expect(mapaTiempos["PR-1"]).toBeGreaterThanOrEqual(150); // Producción >=150ms
    expect(mapaTiempos["AR-1"]).toBeGreaterThan(mapaTiempos["PR-1"]); // Arrastre > Producción
    expect(mapaTiempos["CD-1"]).toBeGreaterThan(mapaTiempos["AR-1"]); // Cuadrador > Arrastre
    expect(mapaTiempos["CO-1"]).toBeGreaterThan(mapaTiempos["CD-1"]); // Corona detona al final (smooth blasting)

    // Alivio no tiene peso de carga
    const cargaAlivio = r.cargas.find((c) => c.taladroId === "AL-1");
    expect(cargaAlivio?.pesoExplosivo_kg).toBe(0);
  });

  it("tunel_espiral: distribuye retardos radiales crecientes con rotación continua", () => {
    const r = disenarVoladura({
      taladros: taladrosTunel,
      burden_m: 0.8,
      espaciamiento_m: 0.8,
      alturaBanco_m: 3.2,
      explosivo: { nombre: "Semexsa 65", densidadGcm3: 1.12, fuerzaRelativaANFO: 0.92 },
      patronIniciacion: "tunel_espiral",
      esTunel: true,
    });

    expect(r.duracionTotalSecuencia_ms).toBeGreaterThan(900);
    const cargaCorona = r.cargas.find((c) => c.taladroId === "CO-1");
    expect(cargaCorona?.tiempoDetonacion_ms).toBeGreaterThanOrEqual(950);
  });
});

