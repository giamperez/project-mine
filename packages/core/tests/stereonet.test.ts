import { describe, expect, it } from "vitest";
import {
  analizarCuna,
  analizarEstereografia,
  analizarPlanarVuelco,
  direccionAVector,
  planoDesdePuntoEnRed,
  poloDelPlano,
  proyeccionEquiareal,
  trayectoriaCirculoMayor,
  vectorATrendPlunge,
} from "../src/formulas/mining/stereonet.js";
import type { Discontinuidad } from "../src/domain/stereonet.js";

describe("poloDelPlano", () => {
  it("un plano horizontal tiene el polo apuntando recto hacia abajo (plunge=90)", () => {
    expect(poloDelPlano(0, 0).plunge_grados).toBeCloseTo(90, 6);
  });

  it("un plano vertical que buza al este (dipdir=90) tiene el polo horizontal apuntando al oeste", () => {
    const polo = poloDelPlano(90, 90);
    expect(polo.plunge_grados).toBeCloseTo(0, 6);
    expect(polo.trend_grados).toBeCloseTo(270, 6);
  });
});

describe("direccionAVector / vectorATrendPlunge (round-trip)", () => {
  it("recupera trend/plunge originales para una linea no degenerada (90°/45°)", () => {
    const v = direccionAVector(90, 45);
    const tp = vectorATrendPlunge(v);
    expect(tp.trend_grados).toBeCloseTo(90, 6);
    expect(tp.plunge_grados).toBeCloseTo(45, 6);
  });
});

describe("proyeccionEquiareal (red de Schmidt)", () => {
  it("plunge=90 (recto hacia abajo) proyecta al centro de la red", () => {
    const p = proyeccionEquiareal(0, 90);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("plunge=0 trend=0 (norte, horizontal) proyecta al borde superior (radio 1)", () => {
    const p = proyeccionEquiareal(0, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);
  });

  it("plunge=0 trend=90 (este, horizontal) proyecta al borde derecho", () => {
    const p = proyeccionEquiareal(90, 0);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });
});

describe("trayectoriaCirculoMayor", () => {
  it("el punto medio de la traza coincide con el vector de buzamiento real (trend=dipdir, plunge=dip)", () => {
    const puntos = trayectoriaCirculoMayor(40, 120, 60);
    const medio = puntos[30]; // t=pi/2 exactamente con nPuntos=60
    expect(medio.trend_grados).toBeCloseTo(120, 4);
    expect(medio.plunge_grados).toBeCloseTo(40, 4);
  });

  it("los extremos de la traza estan sobre el circulo primitivo (plunge≈0, es el rumbo)", () => {
    const puntos = trayectoriaCirculoMayor(40, 120, 60);
    expect(puntos[0].plunge_grados).toBeCloseTo(0, 4);
    expect(puntos[puntos.length - 1].plunge_grados).toBeCloseTo(0, 4);
  });
});

describe("analizarCuna (interseccion de dos planos)", () => {
  it("dos planos verticales ortogonales (rumbos E-O y N-S) se intersectan en una linea vertical", () => {
    const a: Discontinuidad = { id: "A", nombre: "A", dip_grados: 90, dipDirection_grados: 0 };
    const b: Discontinuidad = { id: "B", nombre: "B", dip_grados: 90, dipDirection_grados: 90 };
    const r = analizarCuna(a, b, { dip_grados: 60, dipDirection_grados: 180 }, 30);
    expect(r.plungeInterseccion_grados).toBeCloseTo(90, 4);
  });

  it("un plano horizontal y uno vertical (rumbo E-O) se intersectan en la linea de rumbo (horizontal, E-O)", () => {
    const horizontal: Discontinuidad = { id: "H", nombre: "H", dip_grados: 0, dipDirection_grados: 0 };
    const vertical: Discontinuidad = { id: "V", nombre: "V", dip_grados: 90, dipDirection_grados: 0 };
    const r = analizarCuna(horizontal, vertical, { dip_grados: 60, dipDirection_grados: 180 }, 30);
    expect(r.plungeInterseccion_grados).toBeCloseTo(0, 4);
    expect([90, 270]).toContain(Math.round(r.trendInterseccion_grados));
  });
});

describe("analizarPlanarVuelco", () => {
  const talud = { dip_grados: 60, dipDirection_grados: 180 };

  it("detecta riesgo de falla planar cuando el buzamiento y direccion se alinean con el talud", () => {
    const d: Discontinuidad = { id: "D1", nombre: "D1", dip_grados: 40, dipDirection_grados: 180 };
    const r = analizarPlanarVuelco(d, talud, 30);
    expect(r.planarFactible).toBe(true);
    expect(r.vuelcoFactible).toBe(false);
  });

  it("detecta riesgo de vuelco cuando la discontinuidad buza en sentido contrario y es empinada", () => {
    const d: Discontinuidad = { id: "D2", nombre: "D2", dip_grados: 70, dipDirection_grados: 0 };
    const r = analizarPlanarVuelco(d, talud, 30);
    expect(r.vuelcoFactible).toBe(true);
    expect(r.planarFactible).toBe(false);
  });

  it("no marca planar si la discontinuidad es mas empinada que el talud (no aflora)", () => {
    const d: Discontinuidad = { id: "D3", nombre: "D3", dip_grados: 80, dipDirection_grados: 180 };
    const r = analizarPlanarVuelco(d, talud, 30);
    expect(r.planarFactible).toBe(false);
  });

  it("no marca planar si el buzamiento es menor al angulo de friccion", () => {
    const d: Discontinuidad = { id: "D4", nombre: "D4", dip_grados: 20, dipDirection_grados: 180 };
    const r = analizarPlanarVuelco(d, talud, 30);
    expect(r.planarFactible).toBe(false);
  });
});

describe("analizarEstereografia (orquestador)", () => {
  it("clasifica un set de discontinuidades mixto y cuenta correctamente en el resumen", () => {
    const discontinuidades: Discontinuidad[] = [
      { id: "planar", nombre: "Riesgo planar", dip_grados: 40, dipDirection_grados: 180 },
      { id: "vuelco", nombre: "Riesgo vuelco", dip_grados: 70, dipDirection_grados: 0 },
      { id: "seguro", nombre: "Sin riesgo", dip_grados: 85, dipDirection_grados: 90 },
    ];
    const r = analizarEstereografia({
      discontinuidades,
      talud: { dip_grados: 60, dipDirection_grados: 180 },
      anguloFriccion_grados: 30,
    });
    expect(r.resumen.totalDiscontinuidades).toBe(3);
    expect(r.resumen.riesgoPlanar).toBe(1);
    expect(r.resumen.riesgoVuelco).toBe(1);
    expect(r.analisisCunas.length).toBe(3); // C(3,2) pares
  });
});

describe("planoDesdePuntoEnRed (tocar la red para agregar una discontinuidad)", () => {
  it("hace el viaje de ida y vuelta exacto para varios planos: plano -> polo -> punto en la red -> polo -> plano", () => {
    const casos = [
      { dip_grados: 40, dipDirection_grados: 185 },
      { dip_grados: 65, dipDirection_grados: 260 },
      { dip_grados: 75, dipDirection_grados: 10 },
      { dip_grados: 20, dipDirection_grados: 300 },
      { dip_grados: 89, dipDirection_grados: 45 },
    ];
    for (const caso of casos) {
      const polo = poloDelPlano(caso.dip_grados, caso.dipDirection_grados);
      const punto = proyeccionEquiareal(polo.trend_grados, polo.plunge_grados);
      const recuperado = planoDesdePuntoEnRed(punto.x, punto.y);
      expect(recuperado).not.toBeNull();
      expect(recuperado!.dip_grados).toBeCloseTo(caso.dip_grados, 6);
      expect(recuperado!.dipDirection_grados).toBeCloseTo(caso.dipDirection_grados, 6);
    }
  });

  it("el centro de la red (polo recto hacia abajo) corresponde a un plano horizontal", () => {
    const r = planoDesdePuntoEnRed(0, 0);
    expect(r).not.toBeNull();
    expect(r!.dip_grados).toBeCloseTo(0, 6);
  });

  it("un punto fuera del circulo primitivo (radio > 1) devuelve null", () => {
    expect(planoDesdePuntoEnRed(0.8, 0.8)).toBeNull();
  });
});
