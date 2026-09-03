import { describe, expect, it } from "vitest";
import {
  calcularEstabilidadPlanar,
  calcularHoekBrown,
  calcularQ,
  calcularRMR,
  gsiDesdeRMR89,
} from "../src/formulas/mining/geomechanics.js";

describe("calcularRMR (Bieniawski 1989)", () => {
  it("suma los 6 parametros y clasifica correctamente (caso Clase II 'Buena')", () => {
    const r = calcularRMR({
      resistenciaUCS_MPa: 150, // >100-250 -> 12
      rqd_pct: 95, // >90 -> 20
      espaciamientoDiscontinuidades_mm: 1000, // >600-2000 -> 15
      condicionDiscontinuidad: "rugosa_poco_meteorizada", // 25
      condicionAgua: "humedo", // 10
      orientacion: "favorable", // -5
    });
    expect(r.puntajes).toEqual({ resistencia: 12, rqd: 20, espaciamiento: 15, condicion: 25, agua: 10, orientacion: -5 });
    expect(r.rmr).toBe(77);
    expect(r.clase).toBe(2);
    expect(r.descripcionClase).toBe("Buena");
  });

  it("clasifica un macizo muy pobre (Clase V)", () => {
    const r = calcularRMR({
      resistenciaUCS_MPa: 0.5,
      rqd_pct: 10,
      espaciamientoDiscontinuidades_mm: 30,
      condicionDiscontinuidad: "relleno_blando_grueso",
      condicionAgua: "fluyendo",
      orientacion: "muy_desfavorable",
    });
    expect(r.rmr).toBe(0 + 3 + 5 + 0 + 0 - 60);
    expect(r.clase).toBe(5);
  });
});

describe("calcularQ (Barton, Lien & Lunde 1974)", () => {
  it("reproduce el calculo manual Q=(RQD/Jn)(Jr/Ja)(Jw/SRF)", () => {
    const r = calcularQ({
      rqd_pct: 90,
      jn: "dos_familias", // 4
      jr: "rugosa_ondulada", // 3
      ja: "paredes_sanas", // 1
      jw: "excavacion_seca", // 1
      srf: "esfuerzo_medio", // 1
    });
    expect(r.q).toBeCloseTo((90 / 4) * (3 / 1) * (1 / 1), 6);
    expect(r.q).toBeCloseTo(67.5, 6);
    expect(r.clase).toBe("Muy buena");
  });
});

describe("gsiDesdeRMR89", () => {
  it("GSI = RMR89 - 5", () => {
    expect(gsiDesdeRMR89(77)).toBe(72);
  });
});

describe("calcularHoekBrown (Hoek, Carranza-Torres & Corkum 2002)", () => {
  it("para roca intacta (GSI=100) reproduce mb=mi, s=1, a=0.5 y resistencia de macizo = UCS intacta", () => {
    const r = calcularHoekBrown({
      gsi: 100,
      mi: 15,
      resistenciaUCS_MPa: 80,
      factorPerturbacion: 0,
      pesoUnitarioRoca_kNm3: 26,
      alturaTalud_m: 40,
    });
    expect(r.mb).toBeCloseTo(15, 6);
    expect(r.s).toBeCloseTo(1, 6);
    expect(r.a).toBeCloseTo(0.5, 6);
    expect(r.resistenciaMacizoUCS_MPa).toBeCloseTo(80, 6);
  });

  it("un mayor factor de perturbacion D reduce mb y s (macizo mas debil)", () => {
    const base = { gsi: 55, mi: 12, resistenciaUCS_MPa: 60, pesoUnitarioRoca_kNm3: 26, alturaTalud_m: 40 };
    const noPerturbado = calcularHoekBrown({ ...base, factorPerturbacion: 0 });
    const perturbado = calcularHoekBrown({ ...base, factorPerturbacion: 1 });
    expect(perturbado.mb).toBeLessThan(noPerturbado.mb);
    expect(perturbado.s).toBeLessThan(noPerturbado.s);
    expect(perturbado.cohesionEquivalente_MPa).toBeLessThan(noPerturbado.cohesionEquivalente_MPa);
  });

  it("un mejor GSI produce mayor cohesion y friccion equivalentes (macizo mas resistente)", () => {
    const base = { mi: 12, resistenciaUCS_MPa: 60, factorPerturbacion: 0, pesoUnitarioRoca_kNm3: 26, alturaTalud_m: 40 };
    const rocaPobre = calcularHoekBrown({ ...base, gsi: 30 });
    const rocaBuena = calcularHoekBrown({ ...base, gsi: 70 });
    expect(rocaBuena.cohesionEquivalente_MPa).toBeGreaterThan(rocaPobre.cohesionEquivalente_MPa);
    expect(rocaBuena.anguloFriccionEquivalente_grados).toBeGreaterThan(rocaPobre.anguloFriccionEquivalente_grados);
  });

  it("devuelve angulos y cohesiones fisicamente sensatos", () => {
    const r = calcularHoekBrown({
      gsi: 50,
      mi: 12,
      resistenciaUCS_MPa: 50,
      factorPerturbacion: 0,
      pesoUnitarioRoca_kNm3: 26,
      alturaTalud_m: 50,
    });
    expect(r.anguloFriccionEquivalente_grados).toBeGreaterThan(0);
    expect(r.anguloFriccionEquivalente_grados).toBeLessThan(90);
    expect(r.cohesionEquivalente_MPa).toBeGreaterThan(0);
  });
});

describe("calcularEstabilidadPlanar", () => {
  it("reproduce el calculo manual con angulos 'limpios' (60/30/20 grados)", () => {
    const r = calcularEstabilidadPlanar({
      alturaTalud_m: 20,
      anguloCaraTalud_grados: 60,
      anguloPlanoFalla_grados: 30,
      cohesion_kPa: 50,
      anguloFriccion_grados: 20,
      pesoUnitarioRoca_kNm3: 25,
    });
    expect(r.cinematicamenteFactible).toBe(true);
    expect(r.longitudPlanoFalla_m).toBeCloseTo(40, 4); // 20/sin(30)=40 exacto
    expect(r.peso_kN).toBeCloseTo(5773.5027, 3); // 25 * 400*(cot30-cot60)/2
    expect(r.fuerzaActuante_kN).toBeCloseTo(2886.7513, 3);
    expect(r.factorSeguridad).toBeCloseTo(1.3232, 3);
  });

  it("marca no factible cinematicamente cuando la cara no es mas empinada que el plano de falla", () => {
    const r = calcularEstabilidadPlanar({
      alturaTalud_m: 20,
      anguloCaraTalud_grados: 35,
      anguloPlanoFalla_grados: 40, // plano mas empinado que la cara: geometricamente inconsistente
      cohesion_kPa: 50,
      anguloFriccion_grados: 20,
      pesoUnitarioRoca_kNm3: 25,
    });
    expect(r.cinematicamenteFactible).toBe(false);
    expect(r.advertencias.some((a) => a.includes("cinematica"))).toBe(true);
  });

  it("advierte cuando FS < 1 (talud inestable)", () => {
    const r = calcularEstabilidadPlanar({
      alturaTalud_m: 30,
      anguloCaraTalud_grados: 70,
      anguloPlanoFalla_grados: 45,
      cohesion_kPa: 5,
      anguloFriccion_grados: 15,
      pesoUnitarioRoca_kNm3: 25,
    });
    expect(r.factorSeguridad).toBeLessThan(1);
    expect(r.advertencias.some((a) => a.includes("inestable"))).toBe(true);
  });
});
