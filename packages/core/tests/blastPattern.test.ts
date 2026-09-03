import { describe, expect, it } from "vitest";
import {
  burdenAsh_m,
  burdenLangeforsMax_m,
  burdenLangeforsPractico_m,
  burdenPracticoOSMRE_m,
  disenarMallaPerforacion,
  espaciamientoKonya_m,
  sobreperforacion_m,
  taco_m,
} from "../src/formulas/mining/blastPattern.js";
import type { EntradaMallaPerforacion } from "../src/domain/blastPattern.js";

describe("burdenPracticoOSMRE_m (OSMRE rules of thumb)", () => {
  it("crece con el diametro y respeta el rango 2x-3x (tipico 2.5x)", () => {
    const r1 = burdenPracticoOSMRE_m(76); // 3"
    const r2 = burdenPracticoOSMRE_m(152); // 6"
    expect(r2.tipico_m).toBeGreaterThan(r1.tipico_m);
    expect(r1.tipico_m).toBeGreaterThan(r1.min_m);
    expect(r1.tipico_m).toBeLessThan(r1.max_m);
  });

  it("reproduce el calculo manual para d=89mm (3.5\")", () => {
    // dIn = 89/25.4 = 3.503937...; B_tipico(ft) = 2.5*dIn = 8.759843...; a metros: *0.3048
    const esperado_m = 2.5 * (89 / 25.4) * 0.3048;
    const r = burdenPracticoOSMRE_m(89);
    expect(r.tipico_m).toBeCloseTo(esperado_m, 6);
  });
});

describe("burdenAsh_m (Ash 1963/1968, KB por densidad de roca)", () => {
  it("usa KB~25 para roca media (2.7 g/cc) con ANFO (fuerza=1.0)", () => {
    // B(ft) = 25 * dIn / 12 => en metros
    const diametroMm = 76;
    const dIn = diametroMm / 25.4;
    const esperado_m = ((25 * dIn) / 12) * 0.3048;
    const resultado = burdenAsh_m(diametroMm, 2.7, 1.0);
    expect(resultado).toBeCloseTo(esperado_m, 6);
  });

  it("un explosivo mas fuerte que ANFO agranda el burden (raiz de la fuerza relativa)", () => {
    const bAnfo = burdenAsh_m(89, 2.7, 1.0);
    const bFuerte = burdenAsh_m(89, 2.7, 1.44); // sqrt(1.44)=1.2 -> +20%
    expect(bFuerte).toBeCloseTo(bAnfo * 1.2, 6);
  });

  it("roca mas densa reduce KB (burden algo menor a igual diametro/explosivo)", () => {
    const bLiviana = burdenAsh_m(89, 2.2, 1.0);
    const bDensa = burdenAsh_m(89, 3.2, 1.0);
    expect(bDensa).toBeLessThan(bLiviana);
  });
});

describe("burdenLangeforsMax_m (Langefors-Kihlstrom)", () => {
  it("reproduce el calculo manual: db=51mm, P=1.2, s=1.0, c=0.4, f=1.0, E/V=1.25 -> ~2.394 m", () => {
    const bMax = burdenLangeforsMax_m(51, 1.2, 1.0, 0.4, 1.0, 1.25);
    expect(bMax).toBeCloseTo(2.394, 3);
  });

  it("una constante de roca mayor (roca mas dificil) reduce el burden maximo", () => {
    const bFacil = burdenLangeforsMax_m(89, 1.2, 1.0, 0.35, 1.0, 1.25);
    const bDificil = burdenLangeforsMax_m(89, 1.2, 1.0, 0.5, 1.0, 1.25);
    expect(bDificil).toBeLessThan(bFacil);
  });
});

describe("burdenLangeforsPractico_m", () => {
  it("resta el error de emboquille + desviacion por profundidad al burden maximo", () => {
    const bMax = 2.3942078867464033;
    const bPractico = burdenLangeforsPractico_m(bMax, 10, 0.05, 0.03);
    // desviacion total = 0.05 + 0.03*10 = 0.35
    expect(bPractico).toBeCloseTo(bMax - 0.35, 6);
  });

  it("nunca baja de un piso minimo de 0.1 m aunque la correccion sea enorme", () => {
    const bPractico = burdenLangeforsPractico_m(1.0, 100, 0.05, 0.03);
    expect(bPractico).toBe(0.1);
  });
});

describe("espaciamientoKonya_m (razon de rigidez SR = H/B)", () => {
  it("SR < 1: banco demasiado bajo, S=B y emite advertencia", () => {
    const r = espaciamientoKonya_m(2, 1); // SR=0.5
    expect(r.espaciamiento_m).toBeCloseTo(2, 6);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });

  it("1<=SR<4: S = B*(SR+7)/8 (ej. SR=3 -> S=2.5 con B=2)", () => {
    const r = espaciamientoKonya_m(2, 6); // SR=3
    expect(r.razonRigidezHB).toBeCloseTo(3, 6);
    expect(r.espaciamiento_m).toBeCloseTo(2.5, 6);
  });

  it("SR>=4: S=1.4*B (constante)", () => {
    const r = espaciamientoKonya_m(2, 10); // SR=5
    expect(r.espaciamiento_m).toBeCloseTo(2.8, 6);
  });
});

describe("sobreperforacion_m y taco_m", () => {
  it("usan las razones default KJ=0.3 y KT=0.7", () => {
    expect(sobreperforacion_m(2)).toBeCloseTo(0.6, 6);
    expect(taco_m(2)).toBeCloseTo(1.4, 6);
  });
});

describe("disenarMallaPerforacion (orquestador end-to-end)", () => {
  const entradaBase: EntradaMallaPerforacion = {
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
  };

  it("genera al menos un taladro dentro del poligono con profundidad = altura + sobreperforacion", () => {
    const resultado = disenarMallaPerforacion(entradaBase);
    expect(resultado.taladros.length).toBeGreaterThan(0);
    expect(resultado.profundidadTaladro_m).toBeCloseTo(
      entradaBase.alturaBanco_m + resultado.sobreperforacion_m,
      6
    );
    for (const t of resultado.taladros) {
      expect(t.collar.z).toBeCloseTo(entradaBase.cotaCresta, 6);
      expect(t.fondo.z).toBeCloseTo(entradaBase.cotaCresta - resultado.profundidadTaladro_m, 6);
      expect(t.profundidad_m).toBeCloseTo(resultado.profundidadTaladro_m, 6);
    }
  });

  it("advierte si el poligono tiene menos de 3 vertices", () => {
    const resultado = disenarMallaPerforacion({ ...entradaBase, poligonoCresta: [{ x: 0, y: 0 }] });
    expect(resultado.advertencias.some((a) => a.includes("3 vertices"))).toBe(true);
    expect(resultado.taladros.length).toBe(0);
  });

  it("un banco mas grande produce mas taladros que uno pequeno (mismo diseno)", () => {
    const chico = disenarMallaPerforacion(entradaBase);
    const grande = disenarMallaPerforacion({
      ...entradaBase,
      poligonoCresta: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: 45 },
        { x: 0, y: 45 },
      ],
    });
    expect(grande.taladros.length).toBeGreaterThan(chico.taladros.length);
  });
});
