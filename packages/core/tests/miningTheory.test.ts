import { describe, expect, it } from "vitest";
import {
  calcularAreaInfluenciaConeingemmet,
  calcularConstanteRocaCorregida,
  calcularConstanteRocaRmr,
  calcularHolmbergPersson,
  calcularKuzRam,
  calcularLongitudYAvance,
  calcularTaladrosEmpiricos,
  generarLayoutCompletoTunel,
  obtenerParametrosRmr,
} from "../src/formulas/mining/tunnelRound.js";
import {
  burdenAsh_m,
  burdenKonya_m,
  burdenLangeforsMax_m,
} from "../src/formulas/mining/blastPattern.js";

describe("Teoría Minera: Correlación RMR ↔ Constante de Roca c (Lee et al., 2005)", () => {
  it("calcula c = 5.73e-3 * RMR + 0.057 correctamente", () => {
    expect(calcularConstanteRocaRmr(20)).toBeCloseTo(0.172, 2);
    expect(calcularConstanteRocaRmr(45)).toBeCloseTo(0.315, 2);
    expect(calcularConstanteRocaRmr(66)).toBeCloseTo(0.435, 2);
    expect(calcularConstanteRocaRmr(90)).toBeCloseTo(0.573, 2);
  });

  it("calcula constante de roca corregida de López Jimeno c_bar", () => {
    // B >= 1.4 m -> c + 0.05
    expect(calcularConstanteRocaCorregida(0.4, 1.5)).toBeCloseTo(0.45, 2);
    // B < 1.4 m -> c + 0.07 / B
    expect(calcularConstanteRocaCorregida(0.4, 0.7)).toBeCloseTo(0.5, 2);
  });
});

describe("Teoría Minera: Métodos Empíricos de Número de Taladros", () => {
  it("reproduce el ejemplo de galería 2.5 x 2.5 m (Area=3.719 m2, Perimetro=8.122 m)", () => {
    const area = 3.719;
    const perimetro = 8.122;
    const res = calcularTaladrosEmpiricos(area, perimetro, 50); // roca intermedia

    // Regla rápida N = 10 * sqrt(3.719) = 19.28 -> 19
    expect(res.reglaRapida).toBe(19);

    // Regla precisa N = (8.122 / 0.6) + c * 3.719 -> ~15
    expect(res.reglaPrecisa).toBeGreaterThanOrEqual(14);
    expect(res.reglaPrecisa).toBeLessThanOrEqual(20);

    // FAMESA Walter Guillén N = (P / E) + K * S
    expect(res.famesaGuillen).toBeGreaterThanOrEqual(18);
    expect(res.famesaGuillen).toBeLessThanOrEqual(21);
  });

  it("diferencia correctamente parámetros entre roca suave, intermedia y dura", () => {
    const suave = obtenerParametrosRmr(30);
    const intermedia = obtenerParametrosRmr(50);
    const dura = obtenerParametrosRmr(75);

    expect(suave.factorK).toBeLessThan(intermedia.factorK);
    expect(intermedia.factorK).toBeLessThan(dura.factorK);

    expect(suave.espaciamientoE_m).toBeGreaterThan(intermedia.espaciamientoE_m);
    expect(intermedia.espaciamientoE_m).toBeGreaterThan(dura.espaciamientoE_m);
  });
});

describe("Teoría Minera: Tajo Abierto (Konya vs Ash vs Langefors)", () => {
  it("calcula el burden de Konya B = 0.012*(2*rho_e/rho_r + 1.5)*De verificado contra el manual", () => {
    // Ejemplo: rho_e = 1.5, rho_r = 2.5, De = 152.4 mm -> B = 4.94 m
    const bKonya = burdenKonya_m(152.4, 1.5, 2.5);
    expect(bKonya).toBeCloseTo(4.938, 2);
  });

  it("calcula el burden de Ash y Langefors coherentemente", () => {
    const bAsh = burdenAsh_m(152.4, 2.7, 1.0);
    expect(bAsh).toBeGreaterThan(3.5);
    expect(bAsh).toBeLessThan(6.0);

    const bLang = burdenLangeforsMax_m(152.4, 1.15, 1.0, 0.4, 1.0, 1.25);
    expect(bLang).toBeGreaterThan(4.0);
  });
});

describe("Teoría Minera: Modelo de Fragmentación Kuz-Ram y Daño Holmberg-Persson", () => {
  it("Kuz-Ram produce fragmentación óptima para galería de 2.5 x 2.5 m", () => {
    const resKuz = calcularKuzRam({
      area_m2: 3.719,
      avance_m: 3.2,
      numTaladrosCargados: 36,
      pesoExplosivoTotal_kg: 35, // FC ≈ 2.94 kg/m³, rango estándar 2-4 kg/m³ para galería 2.5x2.5m
      rmr: 50,
      rwsPeso: 100,
    });

    expect(resKuz.x50_cm).toBeGreaterThan(2);
    expect(resKuz.x50_cm).toBeLessThan(35);
    expect(resKuz.indiceUniformidad_n).toBeGreaterThan(1.0);
    expect(resKuz.porcentajeFinos_5cm).toBeGreaterThan(0);
  });

  it("Holmberg-Persson evalúa PPV y recomienda voladura suave si es necesario", () => {
    const resHP = calcularHolmbergPersson({
      diametroCargaMm: 45,
      densidadExplosivoGcm3: 1.18,
      espaciamientoContorno_m: 0.6,
      voladuraControlada: true,
    });

    expect(resHP.ppvContorno_mms).toBeGreaterThan(0);
    expect(resHP.radioDanoCritico_m).toBeGreaterThan(0);
  });
});

describe("Teoría Minera: Layout Completo de Galería 2.5 x 2.5 m", () => {
  it("genera ~24 a 30 taladros cargados con distribución limpia y equilibrada", () => {
    const res = generarLayoutCompletoTunel({
      ancho_m: 2.5,
      alto_m: 2.5,
      tipoSeccion: "herradura",
      numAlivios: 4,
      diametroAlivioMm: 102,
      diametroProdMm: 45,
      avanceM: 3.2,
      rmr: 50,
      metodo: "holmberg_1982",
    });

    // Desglose de zonas
    expect(res.desglose.alivios).toBe(4);
    expect(res.desglose.arranque).toBe(4);
    // Ayudas intermedias presentes sin saturación ni hacinamiento
    expect(res.desglose.ayudas).toBeGreaterThanOrEqual(6);
    expect(res.desglose.ayudas).toBeLessThanOrEqual(12);
    expect(res.desglose.cuadradores).toBeGreaterThanOrEqual(4);
    expect(res.desglose.corona).toBeGreaterThanOrEqual(5);
    expect(res.desglose.arrastre).toBeGreaterThanOrEqual(4);

    // Total de taladros cargados debe estar en el rango estándar minero para 2.5x2.5m (24 a 30)
    expect(res.desglose.totalCargados).toBeGreaterThanOrEqual(23);
    expect(res.desglose.totalCargados).toBeLessThanOrEqual(30);

    // Total de taladros incluyendo alivios
    expect(res.desglose.totalTaladros).toBe(res.desglose.totalCargados + 4);

    // Verificación estricta: Ningún taladro puede estar por debajo del piso ni fuera del contorno
    for (const p of res.puntos) {
      expect(p.y).toBeGreaterThanOrEqual(0.14);
      expect(p.y).toBeLessThanOrEqual(2.5 - 0.14);
      expect(p.x).toBeGreaterThanOrEqual(0.14);
      expect(p.x).toBeLessThanOrEqual(2.5 - 0.14);
    }
  });

  it("galería rectangular 2.5 x 2.5 m cubre completamente los costados y esquinas", () => {
    const res = generarLayoutCompletoTunel({
      ancho_m: 2.5,
      alto_m: 2.5,
      tipoSeccion: "rectangular",
      numAlivios: 4,
      diametroAlivioMm: 102,
      diametroProdMm: 45,
      avanceM: 3.2,
      rmr: 50,
      metodo: "holmberg_1982",
    });

    // En rectangular la pared vertical es completa, debe tener 6 cuadradores (3 por lado)
    expect(res.desglose.cuadradores).toBe(6);
    // Corona debe cubrir de esquina a esquina con 5 taladros
    expect(res.desglose.corona).toBe(5);
    // Ayudas totales = 4 de cuele Q2 + 6 de destroza (2 alzas + 4 laterales en tresbolillo) = 10
    expect(res.desglose.ayudas).toBe(10);
    // Total cargados en rango óptimo empírico para área de 6.25 m² (29 cargados)
    expect(res.desglose.totalCargados).toBe(29);

    // Sin invasión de límites
    for (const p of res.puntos) {
      expect(p.y).toBeGreaterThanOrEqual(0.14);
      expect(p.y).toBeLessThanOrEqual(2.5 - 0.14);
      expect(p.x).toBeGreaterThanOrEqual(0.14);
      expect(p.x).toBeLessThanOrEqual(2.5 - 0.14);
    }
  });

  it("galería tipo D (baúl) mantiene la corona suavemente retranqueada sin deformar las esquinas", () => {
    const res = generarLayoutCompletoTunel({
      ancho_m: 2.5,
      alto_m: 2.5,
      tipoSeccion: "tipo_d",
      numAlivios: 4,
      diametroAlivioMm: 102,
      diametroProdMm: 45,
      avanceM: 3.2,
      rmr: 50,
      metodo: "holmberg_1982",
    });

    // 5 taladros de corona bien distribuidos a lo largo del arco
    expect(res.desglose.corona).toBe(5);
    // Cuadradores en pared vertical
    expect(res.desglose.cuadradores).toBeGreaterThanOrEqual(4);
    // Ayudas en flancos equilibradas
    expect(res.desglose.ayudas).toBeGreaterThanOrEqual(8);

    const hCorona = Math.min(2.5 * 0.35, 2.5 * 0.5); // 0.875 m
    const hHastial = 2.5 - hCorona; // 1.625 m

    // Ningún taladro puede estar a menos de 14cm del perfil exterior del arco
    for (const p of res.puntos) {
      expect(p.y).toBeGreaterThanOrEqual(0.14);
      expect(p.x).toBeGreaterThanOrEqual(0.14);
      expect(p.x).toBeLessThanOrEqual(2.5 - 0.14);

      if (p.y > hHastial) {
        const dxNorm = (p.x - 1.25) / 1.25;
        const dyNorm = (p.y - hHastial) / hCorona;
        const distNorm = Math.hypot(dxNorm, dyNorm);
        // Debe estar estrictamente dentro del contorno con margen seguro
        expect(distNorm).toBeLessThanOrEqual(0.88);
      }
    }
  });

  it("cambiar patronContorno altera dinámicamente el número y espaciamiento de corona y cuadradores", () => {
    const baseOpt = {
      ancho_m: 3.0,
      alto_m: 3.0,
      tipoSeccion: "rectangular" as const,
      numAlivios: 4,
      diametroAlivioMm: 102,
      diametroProdMm: 45,
      avanceM: 3.2,
      rmr: 50,
      metodo: "holmberg_1982" as const,
    };

    // 1. Uniforme: sin voladura controlada (espaciamiento abierto)
    const resUniforme = generarLayoutCompletoTunel({
      ...baseOpt,
      patronContorno: "uniforme",
    });

    // 2. Corona + Recorte: solo techo con smooth blasting denso
    const resCoronaRecorte = generarLayoutCompletoTunel({
      ...baseOpt,
      patronContorno: "corona_recorte",
    });

    // 3. Recorte Continuo: techo y paredes con smooth blasting
    const resRecorteContinuo = generarLayoutCompletoTunel({
      ...baseOpt,
      patronContorno: "recorte_continuo",
    });

    // Corona en 'corona_recorte' debe tener más o iguales taladros que en 'uniforme'
    expect(resCoronaRecorte.desglose.corona).toBeGreaterThanOrEqual(resUniforme.desglose.corona);

    // Cuadradores en 'recorte_continuo' debe tener más taladros que en 'uniforme'
    expect(resRecorteContinuo.desglose.cuadradores).toBeGreaterThan(resUniforme.desglose.cuadradores);

    // Total de taladros en recorte continuo debe ser mayor que uniforme
    expect(resRecorteContinuo.desglose.totalTaladros).toBeGreaterThan(resUniforme.desglose.totalTaladros);
  });
});



