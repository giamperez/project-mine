import { describe, expect, it } from "vitest";
import {
  compositarSondaje,
  curvaLeyTonelaje,
  generarGrillaBloques,
  interpolarIDW,
  interpolarKriging,
  interpolarModeloBloques,
  puntoEnSondaje,
  recortarPorCota,
} from "../src/formulas/mining/blockModel.js";
import type { Bloque, ColarSondaje, CompositoEnsayo, IntervaloEnsayo, ModeloVariograma } from "../src/domain/blockModel.js";

describe("puntoEnSondaje", () => {
  it("un sondaje vertical solo cambia la cota, no x/y", () => {
    const p = puntoEnSondaje({ x: 100, y: 200, z: 50 }, 45, -90, 30);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(200, 6);
    expect(p.z).toBeCloseTo(20, 6);
  });

  it("un sondaje horizontal hacia el este solo cambia x", () => {
    const p = puntoEnSondaje({ x: 0, y: 0, z: 100 }, 90, 0, 50);
    expect(p.x).toBeCloseTo(50, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(100, 6);
  });
});

describe("compositarSondaje", () => {
  const collar: ColarSondaje = { id: "DH1", x: 0, y: 0, z: 100, profundidadTotal_m: 10, azimut_grados: 0, inclinacion_grados: -90 };
  const intervalos: IntervaloEnsayo[] = [
    { sondajeId: "DH1", desde_m: 0, hasta_m: 4, ley: 1.0 },
    { sondajeId: "DH1", desde_m: 4, hasta_m: 10, ley: 2.0 },
  ];

  it("promedia por longitud dentro de cada tramo de 5m", () => {
    const compositos = compositarSondaje(collar, intervalos, 5);
    expect(compositos.length).toBe(2);
    expect(compositos[0].ley).toBeCloseTo(1.2, 6); // (4*1.0 + 1*2.0)/5
    expect(compositos[1].ley).toBeCloseTo(2.0, 6); // 5m enteros en el intervalo de ley 2.0
  });

  it("ubica cada composito en su profundidad media a lo largo del sondaje vertical", () => {
    const compositos = compositarSondaje(collar, intervalos, 5);
    expect(compositos[0].z).toBeCloseTo(97.5, 6); // profundidad media 2.5m
    expect(compositos[1].z).toBeCloseTo(92.5, 6); // profundidad media 7.5m
  });
});

describe("interpolarIDW", () => {
  it("si el punto coincide con una muestra, devuelve su ley exacta", () => {
    const muestras: CompositoEnsayo[] = [{ sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 5, x: 0, y: 0, z: 0 }];
    const r = interpolarIDW({ x: 0, y: 0, z: 0 }, muestras, 2, 10, 1);
    expect(r.ley).toBe(5);
    expect(r.numeroMuestras).toBe(1);
  });

  it("dos muestras equidistantes promedian simple (pesos iguales)", () => {
    const muestras: CompositoEnsayo[] = [
      { sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 10, x: 1, y: 0, z: 0 },
      { sondajeId: "B", desde_m: 0, hasta_m: 1, ley: 20, x: -1, y: 0, z: 0 },
    ];
    const r = interpolarIDW({ x: 0, y: 0, z: 0 }, muestras, 2, 10, 1);
    expect(r.ley).toBeCloseTo(15, 6);
  });

  it("reproduce el calculo manual con pesos 1/d^2 para d=1 y d=2", () => {
    const muestras: CompositoEnsayo[] = [
      { sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 10, x: 1, y: 0, z: 0 },
      { sondajeId: "B", desde_m: 0, hasta_m: 1, ley: 20, x: 2, y: 0, z: 0 },
    ];
    const r = interpolarIDW({ x: 0, y: 0, z: 0 }, muestras, 2, 10, 1);
    expect(r.ley).toBeCloseTo(12, 6); // (10/1 + 20/0.25... ver comentario) = (1*10+0.25*20)/1.25=12
  });

  it("devuelve null si no hay suficientes muestras dentro del radio de busqueda", () => {
    const muestras: CompositoEnsayo[] = [{ sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 10, x: 100, y: 0, z: 0 }];
    const r = interpolarIDW({ x: 0, y: 0, z: 0 }, muestras, 2, 10, 1);
    expect(r.ley).toBeNull();
    expect(r.numeroMuestras).toBe(0);
  });
});

describe("interpolarKriging", () => {
  const variograma: ModeloVariograma = { tipo: "esferico", pepita: 0, meseta: 1, alcance_m: 20 };

  it("si el punto coincide con una muestra, devuelve su ley exacta y varianza 0", () => {
    const muestras: CompositoEnsayo[] = [{ sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 5, x: 0, y: 0, z: 0 }];
    const r = interpolarKriging({ x: 0, y: 0, z: 0 }, muestras, variograma, 10, 1);
    expect(r.ley).toBe(5);
    expect(r.varianza).toBe(0);
  });

  it("con muestras equidistantes de igual variograma, los pesos son iguales por simetria (verificado a mano)", () => {
    // A=(0,0,0) ley=2, B=(10,0,0) ley=6, punto objetivo P=(5,0,0): equidistante de A y B.
    // Por simetria el sistema de kriging fuerza lambdaA=lambdaB=0.5 -> estimacion = (2+6)/2 = 4.
    // Verificacion a mano del sistema (ver comentario de variogram.ts para la formula esferica):
    //   gamma(h=10, alcance=20) = 1*(1.5*0.5 - 0.5*0.5^3) = 0.6875
    //   gamma(h=5,  alcance=20) = 1*(1.5*0.25 - 0.5*0.25^3) = 0.3671875
    //   lambdaA=lambdaB=0.5, mu = 0.3671875 - 0.5*0.6875 = 0.0234375 (satisface ambas ecuaciones por simetria)
    //   varianza = 0.5*0.3671875 + 0.5*0.3671875 + 0.0234375 = 0.390625
    const muestras: CompositoEnsayo[] = [
      { sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 2, x: 0, y: 0, z: 0 },
      { sondajeId: "B", desde_m: 0, hasta_m: 1, ley: 6, x: 10, y: 0, z: 0 },
    ];
    const r = interpolarKriging({ x: 5, y: 0, z: 0 }, muestras, variograma, 20, 1);
    expect(r.ley).toBeCloseTo(4, 9);
    expect(r.varianza).toBeCloseTo(0.390625, 9);
  });

  it("unico peso (n=1) degenera a la ley de esa muestra, con varianza = meseta", () => {
    const muestras: CompositoEnsayo[] = [{ sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 7, x: 50, y: 0, z: 0 }];
    const r = interpolarKriging({ x: 0, y: 0, z: 0 }, muestras, variograma, 100, 1);
    expect(r.ley).toBe(7);
    expect(r.varianza).toBe(variograma.meseta);
  });

  it("insesgadez (suma de pesos = 1): un campo de ley constante se reproduce exactamente sin importar la configuracion de muestras", () => {
    // Prueba independiente de si el variograma "acierta": la restriccion sum(lambda)=1 del kriging
    // ordinario garantiza que un campo perfectamente constante se estime exactamente igual a esa
    // constante, para cualquier arreglo (asimetrico) de muestras y cualquier punto objetivo.
    const muestras: CompositoEnsayo[] = [
      { sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 7.5, x: 3, y: -8, z: 1 },
      { sondajeId: "B", desde_m: 0, hasta_m: 1, ley: 7.5, x: -12, y: 4, z: -2 },
      { sondajeId: "C", desde_m: 0, hasta_m: 1, ley: 7.5, x: 9, y: 9, z: 0 },
      { sondajeId: "D", desde_m: 0, hasta_m: 1, ley: 7.5, x: -5, y: -1, z: 3 },
      { sondajeId: "E", desde_m: 0, hasta_m: 1, ley: 7.5, x: 15, y: -6, z: -1 },
    ];
    const variogramaAsimetrico: ModeloVariograma = { tipo: "esferico", pepita: 0.3, meseta: 2, alcance_m: 12 };
    const r = interpolarKriging({ x: 2, y: 2, z: 2 }, muestras, variogramaAsimetrico, 100, 1);
    expect(r.ley).toBeCloseTo(7.5, 9);
  });

  it("devuelve null si no hay suficientes muestras dentro del radio de busqueda", () => {
    const muestras: CompositoEnsayo[] = [{ sondajeId: "A", desde_m: 0, hasta_m: 1, ley: 10, x: 100, y: 0, z: 0 }];
    const r = interpolarKriging({ x: 0, y: 0, z: 0 }, muestras, variograma, 10, 1);
    expect(r.ley).toBeNull();
    expect(r.numeroMuestras).toBe(0);
  });
});

describe("generarGrillaBloques", () => {
  it("genera N=nx*ny*nz bloques con centros correctos", () => {
    const bloques = generarGrillaBloques({
      origen: { x: 0, y: 0, z: 0 },
      numeroBloques: { x: 2, y: 2, z: 1 },
      tamanoBloque: { x: 10, y: 10, z: 5 },
    });
    expect(bloques.length).toBe(4);
    const b00 = bloques.find((b) => b.i === 0 && b.j === 0 && b.k === 0)!;
    expect(b00.centro).toEqual({ x: 5, y: 5, z: 2.5 });
    const b11 = bloques.find((b) => b.i === 1 && b.j === 1 && b.k === 0)!;
    expect(b11.centro).toEqual({ x: 15, y: 15, z: 2.5 });
  });
});

describe("curvaLeyTonelaje", () => {
  const bloques: Bloque[] = [
    { i: 0, j: 0, k: 0, centro: { x: 0, y: 0, z: 0 }, ley: 1, numeroMuestras: 1 },
    { i: 1, j: 0, k: 0, centro: { x: 0, y: 0, z: 0 }, ley: 3, numeroMuestras: 1 },
    { i: 2, j: 0, k: 0, centro: { x: 0, y: 0, z: 0 }, ley: 5, numeroMuestras: 1 },
    { i: 3, j: 0, k: 0, centro: { x: 0, y: 0, z: 0 }, ley: null, numeroMuestras: 0 },
  ];

  it("calcula tonelaje y ley media correctos para varias leyes de corte", () => {
    const curva = curvaLeyTonelaje(bloques, 100, 2.7, [0, 2, 4, 6]);
    expect(curva[0]).toEqual({ leyCorte: 0, tonelaje_ton: 810, leyMedia: 3 });
    expect(curva[1]).toEqual({ leyCorte: 2, tonelaje_ton: 540, leyMedia: 4 });
    expect(curva[2]).toEqual({ leyCorte: 4, tonelaje_ton: 270, leyMedia: 5 });
    expect(curva[3]).toEqual({ leyCorte: 6, tonelaje_ton: 0, leyMedia: 0 });
  });
});

describe("recortarPorCota", () => {
  const bloques: Bloque[] = [
    { i: 0, j: 0, k: 0, centro: { x: 0, y: 0, z: 90 }, ley: 1, numeroMuestras: 1 },
    { i: 0, j: 0, k: 1, centro: { x: 0, y: 0, z: 100 }, ley: 2, numeroMuestras: 1 },
    { i: 0, j: 0, k: 2, centro: { x: 0, y: 0, z: 110 }, ley: 3, numeroMuestras: 1 },
    { i: 0, j: 0, k: 3, centro: { x: 0, y: 0, z: 120 }, ley: null, numeroMuestras: 0 }, // sin ley: se excluye siempre
  ];

  it('lado="bajo" conserva z<=cota (excluyendo siempre los bloques sin ley)', () => {
    const r = recortarPorCota(bloques, 100, "bajo", 10, 2.7);
    expect(r.numeroBloques).toBe(2); // z=90 y z=100
    expect(r.volumen_m3).toBeCloseTo(20, 6);
    expect(r.tonelaje_ton).toBeCloseTo(20 * 2.7, 6);
    expect(r.leyMedia).toBeCloseTo(1.5, 6); // (1+2)/2
  });

  it('lado="sobre" conserva z>=cota', () => {
    const r = recortarPorCota(bloques, 100, "sobre", 10, 2.7);
    expect(r.numeroBloques).toBe(2); // z=100 y z=110
    expect(r.leyMedia).toBeCloseTo(2.5, 6); // (2+3)/2
  });

  it("sin bloques del lado elegido, devuelve ceros sin lanzar", () => {
    const r = recortarPorCota(bloques, 1000, "sobre", 10, 2.7);
    expect(r.numeroBloques).toBe(0);
    expect(r.tonelaje_ton).toBe(0);
    expect(r.leyMedia).toBe(0);
  });
});

describe("interpolarModeloBloques (orquestador end-to-end)", () => {
  it("interpola una grilla completa a partir de compositos reales de un sondaje", () => {
    const collar: ColarSondaje = { id: "DH1", x: 5, y: 5, z: 100, profundidadTotal_m: 20, azimut_grados: 0, inclinacion_grados: -90 };
    const intervalos: IntervaloEnsayo[] = [{ sondajeId: "DH1", desde_m: 0, hasta_m: 20, ley: 2.5 }];
    const compositos = compositarSondaje(collar, intervalos, 5);

    const modelo = interpolarModeloBloques({
      compositos,
      definicion: { origen: { x: 0, y: 0, z: 80 }, numeroBloques: { x: 2, y: 2, z: 4 }, tamanoBloque: { x: 5, y: 5, z: 5 } },
      radioBusqueda_m: 15,
      numeroMinimoMuestras: 1,
    });

    expect(modelo.bloques.length).toBe(16);
    // Toda la ley del sondaje es uniforme (2.5): cualquier bloque interpolado debe dar ~2.5.
    const bloquesConLey = modelo.bloques.filter((b) => b.ley !== null);
    expect(bloquesConLey.length).toBeGreaterThan(0);
    for (const b of bloquesConLey) {
      expect(b.ley).toBeCloseTo(2.5, 6);
    }
  });

  it("con metodo=kriging interpola igual de bien un campo uniforme y agrega varianzaKriging a cada bloque", () => {
    const collar: ColarSondaje = { id: "DH1", x: 5, y: 5, z: 100, profundidadTotal_m: 20, azimut_grados: 0, inclinacion_grados: -90 };
    const intervalos: IntervaloEnsayo[] = [{ sondajeId: "DH1", desde_m: 0, hasta_m: 20, ley: 2.5 }];
    const compositos = compositarSondaje(collar, intervalos, 5);

    const modelo = interpolarModeloBloques({
      compositos,
      definicion: { origen: { x: 0, y: 0, z: 80 }, numeroBloques: { x: 2, y: 2, z: 4 }, tamanoBloque: { x: 5, y: 5, z: 5 } },
      radioBusqueda_m: 15,
      numeroMinimoMuestras: 1,
      metodo: "kriging",
      variograma: { tipo: "esferico", pepita: 0, meseta: 1, alcance_m: 25 },
    });

    const bloquesConLey = modelo.bloques.filter((b) => b.ley !== null);
    expect(bloquesConLey.length).toBeGreaterThan(0);
    for (const b of bloquesConLey) {
      expect(b.ley).toBeCloseTo(2.5, 6); // insesgadez: campo uniforme -> estimacion exacta
      expect(b.varianzaKriging).not.toBeNull();
    }
  });

  it("lanza un error claro si se pide kriging sin variograma", () => {
    expect(() =>
      interpolarModeloBloques({
        compositos: [],
        definicion: { origen: { x: 0, y: 0, z: 0 }, numeroBloques: { x: 1, y: 1, z: 1 }, tamanoBloque: { x: 5, y: 5, z: 5 } },
        radioBusqueda_m: 10,
        metodo: "kriging",
      })
    ).toThrow(/variograma/);
  });
});
