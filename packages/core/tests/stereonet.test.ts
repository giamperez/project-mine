import { describe, expect, it } from "vitest";
import {
  agruparFamiliasEsfericas,
  analizarCuna,
  analizarCunaCinematico,
  analizarEstereografia,
  analizarPlanarCinematico,
  analizarPlanarVuelco,
  analizarVolcamientoDirectoCinematico,
  analizarVolcamientoFlexuralCinematico,
  calcularContornosDensidad,
  calcularDensidadPolos,
  calcularSMR,
  direccionAVector,
  direccionBuzamientoDesdeRumboRHR,
  lineaDesdeProyeccion,
  planoDesdePuntoEnRed,
  poloDelPlano,
  proyeccionEquiareal,
  proyeccionEstereografica,
  proyectarLinea,
  trayectoriaCirculoMayor,
  trendPlungeDesdeProyeccionEstereografica,
  vectorATrendPlunge,
} from "../src/formulas/mining/stereonet.js";
import { F4_POR_METODO } from "../src/domain/stereonet.js";
import type { Discontinuidad, ParametrosCinematicos } from "../src/domain/stereonet.js";

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
  it("respeta la tolerancia de direccion configurada tambien para el analisis de cunas (regresion: antes se ignoraba y usaba el default de 90 de analizarCuna)", () => {
    // Par D-1/D-4 tiene una interseccion que aflora y supera friccion, pero con una diferencia de
    // direccion de 27° respecto al talud — factible con tolerancia 90 (default de analizarCuna),
    // pero NO factible con la tolerancia de 20 configurada por el usuario.
    const discontinuidades: Discontinuidad[] = [
      { id: "D-1", nombre: "J1", dip_grados: 40, dipDirection_grados: 185 },
      { id: "D-4", nombre: "J4", dip_grados: 55, dipDirection_grados: 150 },
    ];
    const talud = { dip_grados: 60, dipDirection_grados: 180 };
    const r = analizarEstereografia({ discontinuidades, talud, anguloFriccion_grados: 30, toleranciaDireccion_grados: 20 });
    expect(r.analisisCunas[0].trendInterseccion_grados).toBeCloseTo(207, 0);
    expect(r.analisisCunas[0].factible).toBe(false);
  });

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

describe("proyeccionEstereografica (red de Wulff)", () => {
  it("plunge=90 proyecta al centro, plunge=0 al borde (radio 1), igual que Schmidt", () => {
    const centro = proyeccionEstereografica(0, 90);
    expect(centro.x).toBeCloseTo(0, 6);
    expect(centro.y).toBeCloseTo(0, 6);
    const borde = proyeccionEstereografica(45, 0);
    expect(Math.hypot(borde.x, borde.y)).toBeCloseTo(1, 6);
  });

  it("round-trip proyeccion/inversa recupera trend/plunge originales", () => {
    const casos = [
      { trend: 30, plunge: 10 },
      { trend: 200, plunge: 55 },
      { trend: 350, plunge: 80 },
    ];
    for (const c of casos) {
      const p = proyeccionEstereografica(c.trend, c.plunge);
      const tp = trendPlungeDesdeProyeccionEstereografica(p.x, p.y);
      expect(tp).not.toBeNull();
      expect(tp!.trend_grados).toBeCloseTo(c.trend, 5);
      expect(tp!.plunge_grados).toBeCloseTo(c.plunge, 5);
    }
  });

  it("Wulff y Schmidt dan el mismo punto en el centro y el borde, pero difieren a medio camino", () => {
    const wulffMedio = proyeccionEstereografica(0, 45);
    const schmidtMedio = proyeccionEquiareal(0, 45);
    expect(Math.abs(wulffMedio.y - schmidtMedio.y)).toBeGreaterThan(0.01);
  });
});

describe("proyectarLinea / lineaDesdeProyeccion (hemisferio)", () => {
  it("el hemisferio superior refleja el punto por el centro respecto al inferior", () => {
    const inferior = proyectarLinea(120, 30, "schmidt", "inferior");
    const superior = proyectarLinea(120, 30, "schmidt", "superior");
    expect(superior.x).toBeCloseTo(-inferior.x, 9);
    expect(superior.y).toBeCloseTo(-inferior.y, 9);
  });

  it("lineaDesdeProyeccion con hemisferio superior es la inversa exacta de proyectarLinea", () => {
    const p = proyectarLinea(75, 40, "wulff", "superior");
    const tp = lineaDesdeProyeccion(p.x, p.y, "wulff", "superior");
    expect(tp).not.toBeNull();
    expect(tp!.trend_grados).toBeCloseTo(75, 5);
    expect(tp!.plunge_grados).toBeCloseTo(40, 5);
  });
});

describe("direccionBuzamientoDesdeRumboRHR", () => {
  it("un rumbo N-S (0°) por la regla de la mano derecha da direccion de buzamiento este (90°)", () => {
    expect(direccionBuzamientoDesdeRumboRHR(0)).toBeCloseTo(90, 9);
  });

  it("normaliza a 0-360", () => {
    expect(direccionBuzamientoDesdeRumboRHR(300)).toBeCloseTo(30, 9);
  });
});

describe("agruparFamiliasEsfericas (k-means esferico + Fisher K)", () => {
  it("separa dos discontinuidades muy distintas en dos familias de 1 miembro cada una (Fisher K=0, N<2)", () => {
    const discontinuidades: Discontinuidad[] = [
      { id: "yh", nombre: "yh", dip_grados: 69, dipDirection_grados: 88 },
      { id: "t", nombre: "t", dip_grados: 5, dipDirection_grados: 6 },
    ];
    const r = agruparFamiliasEsfericas(discontinuidades, 4);
    expect(r.familias.length).toBe(2); // k se acota a N cuando N<numeroFamilias
    for (const f of r.familias) {
      expect(f.participacion_pct).toBeCloseTo(50, 6);
      expect(f.fisherK).toBe(0);
    }
  });

  it("agrupa un cluster apretado + 1 disperso en 2 familias, y el plano medio del cluster coincide con sus miembros", () => {
    const discontinuidades: Discontinuidad[] = [
      { id: "a", nombre: "a", dip_grados: 45, dipDirection_grados: 180 },
      { id: "b", nombre: "b", dip_grados: 46, dipDirection_grados: 181 },
      { id: "c", nombre: "c", dip_grados: 44, dipDirection_grados: 179 },
      { id: "outlier", nombre: "outlier", dip_grados: 10, dipDirection_grados: 30 },
    ];
    const r = agruparFamiliasEsfericas(discontinuidades, 2);
    expect(r.familias.length).toBe(2);
    const familiaGrande = r.familias.find((f) => f.miembrosIds.length === 3)!;
    expect(familiaGrande).toBeDefined();
    expect(familiaGrande.planoMedio.dip_grados).toBeCloseTo(45, 0);
    expect(familiaGrande.planoMedio.dipDirection_grados).toBeCloseTo(180, 0);
    expect(familiaGrande.fisherK).toBeGreaterThan(50); // cluster muy apretado -> alta concentracion
  });

  it("Fisher K crece con la concentracion: dos polos ortogonales agrupados a la fuerza (k=1) dan kappa≈1.707", () => {
    const horizontal: Discontinuidad = { id: "H", nombre: "H", dip_grados: 0, dipDirection_grados: 0 };
    const vertical: Discontinuidad = { id: "V", nombre: "V", dip_grados: 90, dipDirection_grados: 90 };
    const r = agruparFamiliasEsfericas([horizontal, vertical], 1);
    expect(r.familias.length).toBe(1);
    // R = |suma de 2 vectores ortogonales unitarios| = sqrt(2); kappa=(N-1)/(N-R)=1/(2-sqrt(2))
    expect(r.familias[0].fisherK).toBeCloseTo(1 / (2 - Math.SQRT2), 1);
  });

  it("nunca genera mas familias que discontinuidades (acota k a N)", () => {
    const uno: Discontinuidad[] = [{ id: "unico", nombre: "unico", dip_grados: 30, dipDirection_grados: 200 }];
    const r = agruparFamiliasEsfericas(uno, 4);
    expect(r.familias.length).toBe(1);
    expect(r.familias[0].participacion_pct).toBeCloseTo(100, 6);
  });
});

describe("calcularDensidadPolos (circulo de conteo de Kalsbeek)", () => {
  it("reproduce el ejemplo verificado: 2 polos separados, radio 24°, densidad maxima 50%", () => {
    const discontinuidades: Discontinuidad[] = [
      { id: "yh", nombre: "yh", dip_grados: 69, dipDirection_grados: 88 },
      { id: "t", nombre: "t", dip_grados: 5, dipDirection_grados: 6 },
    ];
    const r = calcularDensidadPolos(discontinuidades, 24);
    expect(r.densidadMaxima_pct).toBeCloseTo(50, 0);
  });

  it("con todos los polos identicos, la densidad maxima es 100%", () => {
    const discontinuidades: Discontinuidad[] = [
      { id: "a", nombre: "a", dip_grados: 40, dipDirection_grados: 90 },
      { id: "b", nombre: "b", dip_grados: 40, dipDirection_grados: 90 },
      { id: "c", nombre: "c", dip_grados: 40, dipDirection_grados: 90 },
    ];
    const r = calcularDensidadPolos(discontinuidades, 10);
    expect(r.densidadMaxima_pct).toBeCloseTo(100, 6);
  });

  it("sin discontinuidades, no hay grilla ni densidad", () => {
    const r = calcularDensidadPolos([], 24);
    expect(r.grid.length).toBe(0);
    expect(r.densidadMaxima_pct).toBe(0);
  });
});

describe("calcularContornosDensidad (marching squares)", () => {
  it("genera contornos no vacios para un nivel por debajo del maximo y vacios por encima", () => {
    const discontinuidades: Discontinuidad[] = Array.from({ length: 6 }, (_, i) => ({
      id: `d${i}`,
      nombre: `d${i}`,
      dip_grados: 40,
      dipDirection_grados: 90,
    }));
    const densidad = calcularDensidadPolos(discontinuidades, 20, "schmidt", "inferior", 31);
    const [bajo, sobreMaximo] = calcularContornosDensidad(densidad, [20, densidad.densidadMaxima_pct + 10]);
    const totalSegmentosBajo = bajo.polilineas.length;
    const totalSegmentosSobre = sobreMaximo.polilineas.length;
    expect(totalSegmentosBajo).toBeGreaterThan(0);
    expect(totalSegmentosSobre).toBe(0);
  });
});

describe("analizarPlanarCinematico / analizarVolcamientoFlexuralCinematico (4 mecanismos)", () => {
  const paramsBase: ParametrosCinematicos = {
    talud: { dip_grados: 60, dipDirection_grados: 180 },
    anguloFriccion_grados: 30,
    limiteLateral_grados: 20,
  };

  it("planar: factible cuando aflora, supera friccion y la direccion coincide con el talud", () => {
    const d: Discontinuidad = { id: "D1", nombre: "D1", dip_grados: 40, dipDirection_grados: 185 };
    const r = analizarPlanarCinematico(d, paramsBase);
    expect(r.factible).toBe(true);
    expect(r.cumpleDireccion).toBe(true);
    expect(r.cumpleAfloramiento).toBe(true);
    expect(r.cumpleFriccion).toBe(true);
  });

  it("planar: no factible si la diferencia de direccion supera el limite lateral", () => {
    const d: Discontinuidad = { id: "D2", nombre: "D2", dip_grados: 40, dipDirection_grados: 230 };
    const r = analizarPlanarCinematico(d, paramsBase);
    expect(r.cumpleDireccion).toBe(false);
    expect(r.factible).toBe(false);
  });

  it("volcamiento flexural: la formula de Goodman & Bray (1976) incluye el angulo del talud, no solo la friccion", () => {
    // dipMinimoRequerido = 90 - dip_talud + phi. Con dip_talud=60, phi=30 -> 60 (coincide con la
    // simplificacion antigua "90-phi" solo porque dip_talud=2*phi en este caso particular).
    const d: Discontinuidad = { id: "V1", nombre: "V1", dip_grados: 65, dipDirection_grados: 0 };
    const r60 = analizarVolcamientoFlexuralCinematico(d, paramsBase);
    expect(r60.dipMinimoRequerido_grados).toBeCloseTo(60, 9);
    expect(r60.factible).toBe(true);

    // Con un talud mas tendido (dip=45), el minimo requerido sube a 75° — la formula vieja (90-phi=60)
    // habria marcado esta misma discontinuidad (dip=65) como factible; la correcta la rechaza.
    const paramsTaludTendido: ParametrosCinematicos = { ...paramsBase, talud: { ...paramsBase.talud, dip_grados: 45 } };
    const r45 = analizarVolcamientoFlexuralCinematico(d, paramsTaludTendido);
    expect(r45.dipMinimoRequerido_grados).toBeCloseTo(75, 9);
    expect(r45.factible).toBe(false);
  });

  it("cuña cinematica: coincide con analizarCuna en la interseccion y agrega el desglose de condiciones", () => {
    const a: Discontinuidad = { id: "A", nombre: "A", dip_grados: 45, dipDirection_grados: 140 };
    const b: Discontinuidad = { id: "B", nombre: "B", dip_grados: 55, dipDirection_grados: 220 };
    const base = analizarCuna(a, b, paramsBase.talud, paramsBase.anguloFriccion_grados, paramsBase.limiteLateral_grados);
    const detallado = analizarCunaCinematico(a, b, paramsBase);
    expect(detallado.plungeInterseccion_grados).toBeCloseTo(base.plungeInterseccion_grados, 9);
    expect(detallado.factible).toBe(base.factible);
  });

  it("volcamiento directo: factible solo si la interseccion es casi vertical y buza hacia el macizo", () => {
    // Dos planos muy empinados, subverticales, con rumbos distintos -> interseccion casi vertical.
    const a: Discontinuidad = { id: "A", nombre: "A", dip_grados: 85, dipDirection_grados: 5 };
    const b: Discontinuidad = { id: "B", nombre: "B", dip_grados: 85, dipDirection_grados: 95 };
    const r = analizarVolcamientoDirectoCinematico(a, b, paramsBase);
    expect(r.plungeInterseccion_grados).toBeGreaterThan(80);
    expect(r.cumpleVerticalidad).toBe(true);
  });
});

describe("calcularSMR (Slope Mass Rating, Romana 1985)", () => {
  it("caso 'Normal' (clase III): reproduce a mano F1=1.00, F2=1.00, F3=-6 -> SMR=54", () => {
    const r = calcularSMR({
      rmrBasico: 60,
      discontinuidad: { id: "J1", nombre: "J1", dip_grados: 50, dipDirection_grados: 180 },
      talud: { dip_grados: 40, dipDirection_grados: 180 },
      tipoFalla: "planar",
      metodoExcavacion: "voladura_o_mecanico",
    });
    expect(r.f1).toBeCloseTo(1.0, 6);
    expect(r.f2).toBeCloseTo(1.0, 6);
    expect(r.f3).toBeCloseTo(-6, 6);
    expect(r.f4).toBe(0);
    expect(r.smr).toBeCloseTo(54, 6);
    expect(r.clase).toBe("III");
  });

  it("caso muy desfavorable (F3=-60, C=dip_junta-dip_talud<-10°): reduce fuertemente el RMR basico y baja de clase", () => {
    const r = calcularSMR({
      rmrBasico: 70,
      discontinuidad: { id: "J2", nombre: "J2", dip_grados: 20, dipDirection_grados: 180 },
      talud: { dip_grados: 40, dipDirection_grados: 180 },
      tipoFalla: "planar",
      metodoExcavacion: "voladura_o_mecanico",
    });
    expect(r.c_grados).toBeCloseTo(-20, 6);
    expect(r.f3).toBeCloseTo(-60, 6);
    expect(r.smr).toBeLessThan(r.rmrBasico);
  });

  it("F4 usa la tabla de metodo de excavacion (Romana 1985, Tabla 2)", () => {
    expect(F4_POR_METODO.presplitting).toBe(10);
    expect(F4_POR_METODO.voladura_suave).toBe(8);
    expect(F4_POR_METODO.voladura_o_mecanico).toBe(0);
    expect(F4_POR_METODO.talud_natural).toBe(15);
  });

  it("volcamiento: F2 siempre es 1.00 sin importar el buzamiento de la discontinuidad", () => {
    const r = calcularSMR({
      rmrBasico: 50,
      discontinuidad: { id: "J3", nombre: "J3", dip_grados: 15, dipDirection_grados: 0 },
      talud: { dip_grados: 60, dipDirection_grados: 180 },
      tipoFalla: "volcamiento",
      metodoExcavacion: "presplitting",
    });
    expect(r.f2).toBe(1.0);
  });

  it("clasifica correctamente las 5 clases (I-V) segun los limites de la Tabla 3", () => {
    const base = {
      discontinuidad: { id: "X", nombre: "X", dip_grados: 50, dipDirection_grados: 180 },
      talud: { dip_grados: 50, dipDirection_grados: 180 },
      tipoFalla: "planar" as const,
      metodoExcavacion: "voladura_o_mecanico" as const,
    };
    // A=0 (F1=1), B=50 (F2=1), C=0 (F3=-25 exacto) -> smr = rmrBasico - 25
    expect(calcularSMR({ ...base, rmrBasico: 100 }).clase).toBe("II"); // smr=75
    expect(calcularSMR({ ...base, rmrBasico: 76 }).clase).toBe("III"); // smr=51
    expect(calcularSMR({ ...base, rmrBasico: 50 }).clase).toBe("IV"); // smr=25
    expect(calcularSMR({ ...base, rmrBasico: 30 }).clase).toBe("V"); // smr=5
  });
});
