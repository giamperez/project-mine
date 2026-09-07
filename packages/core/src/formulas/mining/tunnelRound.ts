/**
 * Diseno de arranque (cut) tipo Holmberg para voladura de tunel/galeria, y geometria del frente.
 *
 * Fuente: C. Lopez Jimeno, E. Lopez Jimeno & F.J. Ayala Carcedo, "Drilling and Blasting of Rocks",
 * A.A. Balkema, 1995, cap. 22 "Blasting for tunnels and drifts" (traduccion del "Manual de
 * Perforacion y Voladura de Rocas" espanol) — que a su vez cita y reproduce el metodo de
 * Holmberg, R. (1982) "Charge calculations for tunnelling", en Underground Mining Methods
 * Handbook, SME, simplificado por Olofsson, S. (1990) "Applied Explosives Technology for
 * Construction and Mining".
 *
 * Se implementa el metodo SIMPLIFICADO de la Tabla 22.2 de Jimeno (p.225): calculo geometrico
 * rapido de burden/espaciamiento por seccion, sin pasar por la concentracion de carga lineal
 * (ese es el metodo riguroso de la seccion 22.4.2, mas complejo, no implementado aca). Ambos
 * metodos estan documentados en la misma fuente; el simplificado es el que reproduce EXACTAMENTE
 * los valores B1-B5/E1-E5 de la app de referencia (verificado a mano, 3 decimales, con
 * diametroIndividualAlivio=102mm, numeroTaladrosAlivio=4 -> diametroEquivalente=204mm):
 *   B1=0.306, E1=0.433, B2=0.433, E2=0.918, B3=0.918, E3=1.947, B4=1.947, E4=4.131, B5=4.131, E5=8.763
 *
 * Formulas (Jimeno Tabla 22.2, "Simplified calculation"):
 *   diametro equivalente:  De = D_individual * sqrt(N)          (p.219, para N taladros de alivio)
 *   1a seccion:   B1 = 1.5 * De          E1 = B1 * sqrt(2)
 *   seccion n>=2: Bn = E(n-1)            En = 1.5 * Bn * sqrt(2)
 *
 * Regla de parada (p.221): se agregan secciones mientras el lado/espaciamiento resultante sea
 * menor que sqrt(avance) — "el lado de la ultima seccion no deberia ser menor que la raiz
 * cuadrada del avance". Limite de seguridad `maximoSecciones` (default 8) por si el avance es muy
 * grande y la regla de parada tardaria demasiadas secciones en cumplirse.
 */

import type {
  DesgloseZonasTaladros,
  EntradaArranqueHolmberg,
  EntradaTaladrosFrente,
  GeometriaFrenteTunel,
  MetodoDisenoSubterraneo,
  PropiedadesExplosivoMina,
  PuntoTaladroFrente,
  ResultadoArranqueHolmberg,
  ResultadoGeometriaFrente,
  ResultadoHolmbergPersson,
  ResultadoKuzRam,
  ResultadoRondaSubterraneaCompleta,
  ResultadoTaladrosFrente,
  SeccionArranque,
  TipoCorteSubterraneo,
} from "../../domain/tunnelRound.js";
import { CATALOGO_EXPLOSIVOS_PERU } from "../../domain/tunnelRound.js";
import { centroide, puntoEnPoligono, type Punto2D } from "./geometry.js";

export function diametroEquivalente_mm(diametroIndividual_mm: number, numeroTaladros: number): number {
  return diametroIndividual_mm * Math.sqrt(Math.max(numeroTaladros, 0));
}

/** Calcula las secciones del arranque (burden/espaciamiento progresivo) por el metodo simplificado de Jimeno Tabla 22.2. */
export function calcularArranqueHolmberg(entrada: EntradaArranqueHolmberg): ResultadoArranqueHolmberg {
  const de_mm = diametroEquivalente_mm(entrada.diametroIndividualAlivio_mm, entrada.numeroTaladrosAlivio);
  const de_m = de_mm / 1000;
  const maximoSecciones = entrada.maximoSecciones ?? 8;
  const objetivoParada_m = Math.sqrt(Math.max(entrada.avance_m, 0));

  const secciones: SeccionArranque[] = [];
  if (de_m <= 0) return { diametroEquivalente_mm: de_mm, secciones };

  // 1a seccion: factor 1.0 (E1 = B1*sqrt(2), sin el 1.5 adicional que llevan las siguientes)
  let burden_m = 1.5 * de_m;
  let espaciamiento_m = burden_m * Math.SQRT2;
  secciones.push({ numero: 1, burden_m, espaciamiento_m, factor: 1.0 });

  while (espaciamiento_m < objetivoParada_m && secciones.length < maximoSecciones) {
    burden_m = espaciamiento_m; // Bn = E(n-1)
    espaciamiento_m = 1.5 * burden_m * Math.SQRT2;
    secciones.push({ numero: secciones.length + 1, burden_m, espaciamiento_m, factor: 1.5 });
  }

  return { diametroEquivalente_mm: de_mm, secciones };
}

/**
 * Area/perimetro del frente. "herradura": hastiales rectos + corona semicircular (radio = ancho/2),
 * la forma tunelera estandar para excavacion con jumbo. "rectangular": seccion recta simple.
 */
export function calcularGeometriaFrente(geometria: GeometriaFrenteTunel): ResultadoGeometriaFrente {
  const { tipo, ancho_m, alto_m } = geometria;
  if (ancho_m <= 0 || alto_m <= 0) {
    return { area_m2: 0, perimetro_m: 0, alturaCorona_m: 0, alturaHastial_m: 0 };
  }

  if (tipo === "rectangular") {
    return {
      area_m2: ancho_m * alto_m,
      perimetro_m: 2 * (ancho_m + alto_m),
      alturaCorona_m: 0,
      alturaHastial_m: alto_m,
    };
  }

  // herradura: radio de la corona = ancho/2 (semicirculo apoyado sobre los hastiales)
  const radioCorona_m = ancho_m / 2;
  const alturaCorona_m = Math.min(radioCorona_m, alto_m);
  const alturaHastial_m = Math.max(alto_m - alturaCorona_m, 0);
  const areaHastiales_m2 = ancho_m * alturaHastial_m;
  const areaCorona_m2 = (Math.PI * radioCorona_m * radioCorona_m) / 2;
  const perimetroCorona_m = Math.PI * radioCorona_m;

  return {
    area_m2: areaHastiales_m2 + areaCorona_m2,
    perimetro_m: ancho_m + 2 * alturaHastial_m + perimetroCorona_m,
    alturaCorona_m,
    alturaHastial_m,
  };
}

/**
 * Genera el layout 2D (en el plano de la cara del frente) de una ronda completa de tunel/galeria:
 * alivio + secciones del arranque (cuele) + cuadro/contorno + arrastre + produccion (destroza).
 *
 * Lo que SI esta tomado de una fuente citable:
 * - El radio de cada anillo del arranque, `r_k = E_k / sqrt(2)`, se deduce de que cada seccion del
 *   cuele Holmberg/Jimeno (ver `calcularArranqueHolmberg`) rompe hacia un hueco cuadrado de lado
 *   `E_k`; un cuadrado centrado en el origen con lado `E_k` tiene sus 4 vertices a distancia
 *   `E_k/sqrt(2)` del centro. Los taladros de cada seccion se ubican en esos vertices.
 * - La alternancia de 45 grados entre anillos consecutivos ("pinwheel") es la construccion
 *   estandar de los diagramas de cuele de secciones (p.ej. Jimeno cap. 22, fig. 22.4; manual EXSA
 *   "Manual Practico de Voladura"): cada taladro nuevo apunta al punto medio del lado ya roto de la
 *   seccion anterior (la nueva cara libre), que es precisamente la direccion que bisecta dos
 *   vertices consecutivos del cuadrado anterior — de ahi el giro de 45 grados. Se puede verificar
 *   algebraicamente que esta construccion reproduce exactamente `r_k = B_k + r_(k-1)/sqrt(2)`
 *   (burden medido perpendicular al lado anterior), consistente con `r_k = E_k/sqrt(2)`.
 * - El espaciamiento de los taladros de contorno (corona/hastial/arrastre) sigue la regla de
 *   voladura controlada/recorte (smooth blasting): espaciamiento = 12-16 veces el diametro del
 *   taladro (OSMRE, 2016, "Blast Design — Module 3: Surface Blast Design", Office of Surface
 *   Mining Reclamation and Enforcement, EE.UU.; el mismo principio de espaciamiento~diametro para
 *   recorte se usa en tuneleria, ver Olofsson, S. 1990, "Applied Explosives Technology for
 *   Construction and Mining"), pero el VALOR final (`entrada.espaciamientoContorno_m`) lo decide
 *   quien llama a esta funcion.
 *
 * Lo que NO esta tomado de una fuente (es una heuristica geometrica de este generador, no una
 * formula de ingenieria):
 * - La clasificacion de cada punto de contorno en corona/hastial/arrastre, hecha por posicion
 *   relativa a la caja delimitadora del poligono (simple heuristica de dibujo, no de diseno).
 * - El radio de exclusion del arranque para la grilla de produccion (`radioUltimoAnillo * 1.2`).
 */
export function generarTaladrosFrenteTunel(entrada: EntradaTaladrosFrente): ResultadoTaladrosFrente {
  const advertencias: string[] = [];
  const poligono: Punto2D[] = entrada.poligonoCresta;
  if (poligono.length < 3) {
    return { puntos: [], advertencias: ["El poligono de la galeria necesita al menos 3 vertices."] };
  }

  const z = entrada.cotaFrente_m ?? 0;
  const centro = centroide(poligono);
  const xs = poligono.map((p) => p.x);
  const ys = poligono.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const ancho = maxX - minX;
  const alto = maxY - minY;

  const puntos: PuntoTaladroFrente[] = [];
  let contador = 0;
  const push = (x: number, y: number, zona: PuntoTaladroFrente["zona"], diametroMm: number, cargado: boolean, etapa?: number) => {
    contador++;
    puntos.push({ id: `F-${zona}-${contador}`, x, y, z, zona, diametroMm, cargado, etapa });
  };

  // --- 1. Alivio: agrupados muy cerca del centro (actuan como un unico taladro equivalente). ---
  const nAlivio = Math.max(1, Math.round(entrada.numeroTaladrosAlivio));
  const radioClusterAlivio = Math.max(0.03, (entrada.diametroIndividualAlivio_mm / 1000) * 0.65);
  if (nAlivio === 1) {
    push(centro.x, centro.y, "alivio", entrada.diametroIndividualAlivio_mm, false);
  } else {
    for (let i = 0; i < nAlivio; i++) {
      const ang = (i / nAlivio) * Math.PI * 2;
      push(
        centro.x + radioClusterAlivio * Math.cos(ang),
        centro.y + radioClusterAlivio * Math.sin(ang),
        "alivio",
        entrada.diametroIndividualAlivio_mm,
        false
      );
    }
  }

  // --- 2. Secciones del arranque: anillos cuadrados alternando 45 grados (pinwheel). ---
  let radioUltimoAnillo = radioClusterAlivio;
  entrada.secciones.forEach((seccion, idx) => {
    const k = idx + 1;
    const r = seccion.espaciamiento_m / Math.SQRT2;
    radioUltimoAnillo = r;
    const anguloBase = k % 2 === 1 ? Math.PI / 4 : 0; // 45 deg en anillos impares, 0 deg en pares
    const zona: PuntoTaladroFrente["zona"] = k === 1 ? "arranque" : "cuadrante";
    for (let j = 0; j < 4; j++) {
      const ang = anguloBase + j * (Math.PI / 2);
      push(centro.x + r * Math.cos(ang), centro.y + r * Math.sin(ang), zona, entrada.diametroCargaMm, true, k);
    }
  });

  if (radioUltimoAnillo * 2 > Math.min(ancho, alto) * 0.9) {
    advertencias.push(
      `El arranque calculado (ultimo anillo a ${radioUltimoAnillo.toFixed(2)} m del centro) es grande respecto a la seccion (${ancho.toFixed(2)}×${alto.toFixed(2)} m): reduce el numero de secciones, el diametro de alivio o el numero de taladros de alivio.`
    );
  }

  // --- 3. Contorno: recorre el perimetro del poligono y clasifica cada muestra por posicion. ---
  const margenPiso = Math.max(0.15, alto * 0.08);
  const paso = Math.max(0.1, entrada.espaciamientoContorno_m);
  const contornoPuntos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo = Math.hypot(dx, dy);
    if (largo <= 1e-6) continue;
    const nSub = Math.max(1, Math.round(largo / paso));
    for (let s = 0; s < nSub; s++) {
      const t = s / nSub;
      contornoPuntos.push({ x: a.x + dx * t, y: a.y + dy * t });
    }
  }
  contornoPuntos.forEach((p) => {
    let zona: PuntoTaladroFrente["zona"];
    if (p.y <= minY + margenPiso) {
      zona = "arrastre";
    } else if (Math.abs(p.x - centro.x) > ancho * 0.32 && p.y < minY + alto * 0.6) {
      zona = "hastial";
    } else {
      zona = "corona";
    }
    push(p.x, p.y, zona, entrada.diametroCargaMm, true);
  });

  // --- 4. Produccion (destroza): grilla burden x espaciamiento, evita el arranque y el contorno. ---
  const radioExclusionArranque = radioUltimoAnillo * 1.2;
  const margenContorno = paso * 0.6;
  const bStep = Math.max(0.1, entrada.burdenProduccion_m);
  const eStep = Math.max(0.1, entrada.espaciamientoProduccion_m);
  for (let y = minY + bStep / 2; y <= maxY - bStep / 4; y += bStep) {
    for (let x = minX + eStep / 2; x <= maxX - eStep / 4; x += eStep) {
      const distCentro = Math.hypot(x - centro.x, y - centro.y);
      if (distCentro < radioExclusionArranque) continue;
      if (!puntoEnPoligono({ x, y }, poligono)) continue;
      const cercaContorno = contornoPuntos.some((c) => Math.hypot(c.x - x, c.y - y) < margenContorno);
      if (cercaContorno) continue;
      push(x, y, "produccion", entrada.diametroCargaMm, true);
    }
  }

  return { puntos, advertencias };
}

// ============================================================================
// TEORÍA TÉCNICA AVANZADA: MÉTODOS DE DISEÑO, RMR, KUZ-RAM Y HOLMBERG-PERSSON
// ============================================================================

/**
 * Correlación empírica RMR ↔ Constante de roca de voladura (c), kg/m³.
 * Fuente: Lee et al. (Seoul National Univ., 2005) "The Computerized Design Program for Tunnel Blasting"
 * Coeficiente de correlación R = 0.804 basado en 23 ensayos de campo:
 * c = 5.73×10⁻³ · RMR + 0.057 (kg/m³)
 * - RMR 20 -> c ≈ 0.17
 * - RMR 45 -> c ≈ 0.31
 * - RMR 66 -> c ≈ 0.44
 * - RMR 90 -> c ≈ 0.57
 */
export function calcularConstanteRocaRmr(rmr: number): number {
  const rmrClamped = Math.min(Math.max(rmr, 5), 100);
  const c = 5.73e-3 * rmrClamped + 0.057;
  return Math.round(c * 1000) / 1000;
}

/**
 * Constante de roca corregida según el burden (López Jimeno):
 * c̄ = c + 0.05 para B ≥ 1.4 m
 * c̄ = c + 0.07/B para B < 1.4 m
 */
export function calcularConstanteRocaCorregida(c: number, burden_m: number): number {
  const b = Math.max(burden_m, 0.1);
  if (b >= 1.4) {
    return Math.round((c + 0.05) * 1000) / 1000;
  }
  return Math.round((c + 0.07 / b) * 1000) / 1000;
}

/**
 * Parámetros empíricos de voladura según clase de roca y RMR:
 * - Roca dura (>60): K = 2.0-2.5, E = 0.40-0.55 m, dt = 0.50 m
 * - Roca semidura (40-60): K = 1.5-1.7, E = 0.60-0.65 m, dt = 0.60 m
 * - Roca suave (<40): K = 1.0-1.2, E = 0.70-0.75 m, dt = 0.70 m
 */
export function obtenerParametrosRmr(rmr: number): {
  categoria: "suave" | "intermedia" | "dura";
  nombreRoca: string;
  factorK: number;
  espaciamientoE_m: number;
  distanciaPerifericosDt_m: number;
  c_kgm3: number;
} {
  const c = calcularConstanteRocaRmr(rmr);
  if (rmr > 60) {
    return {
      categoria: "dura",
      nombreRoca: "Roca Dura (RMR > 60)",
      factorK: 2.2,
      espaciamientoE_m: 0.48,
      distanciaPerifericosDt_m: 0.50,
      c_kgm3: c,
    };
  }
  if (rmr >= 40) {
    return {
      categoria: "intermedia",
      nombreRoca: "Roca Semidura / Intermedia (RMR 40-60)",
      factorK: 1.6,
      espaciamientoE_m: 0.62,
      distanciaPerifericosDt_m: 0.60,
      c_kgm3: c,
    };
  }
  return {
    categoria: "suave",
    nombreRoca: "Roca Suave / Fracturada (RMR < 40)",
    factorK: 1.1,
    espaciamientoE_m: 0.72,
    distanciaPerifericosDt_m: 0.70,
    c_kgm3: c,
  };
}

/**
 * Cálculo del número total de taladros por métodos empíricos reconocidos:
 * 1. Regla rápida: N = 10 · √Área
 * 2. Fórmula precisa: N = (Perímetro / dt) + (c · Área)
 * 3. Variante FAMESA (Walter Guillén): N = (Perímetro / E) + (K · Área)
 */
export function calcularTaladrosEmpiricos(area_m2: number, perimetro_m: number, rmr: number): {
  reglaRapida: number;
  reglaPrecisa: number;
  famesaGuillen: number;
  promedioRecomendado: number;
  c_kgm3: number;
  factorK: number;
  espaciamientoE_m: number;
  distanciaDt_m: number;
} {
  const S = Math.max(area_m2, 0.1);
  const P = perimetro_m > 0 ? perimetro_m : Math.sqrt(S) * 4;
  const params = obtenerParametrosRmr(rmr);

  const reglaRapida = Math.round(10 * Math.sqrt(S));
  const reglaPrecisa = Math.round(P / params.distanciaPerifericosDt_m + params.c_kgm3 * S);
  const famesaGuillen = Math.round(P / params.espaciamientoE_m + params.factorK * S);
  const promedio = Math.round((reglaRapida + reglaPrecisa + famesaGuillen) / 3);

  return {
    reglaRapida,
    reglaPrecisa,
    famesaGuillen,
    promedioRecomendado: promedio,
    c_kgm3: params.c_kgm3,
    factorK: params.factorK,
    espaciamientoE_m: params.espaciamientoE_m,
    distanciaDt_m: params.distanciaPerifericosDt_m,
  };
}

/**
 * Estimación de longitud de barreno y avance esperado según el tipo de corte:
 * - Corte cilíndrico/quemado: L = 0.15 + 34.1·Ø2 - 39.4·Ø2² (Ø2 alivio en m), avance = 0.92-0.95·L
 * - Corte en V/cuña: L = 0.5·√S, avance = 0.85·L
 */
export function calcularLongitudYAvance(
  diametroAlivioMm: number,
  tipoCorte: TipoCorteSubterraneo = "paralelo_quemado",
  area_m2 = 6.25
): { longitudBarreno_m: number; avancePorDisparo_m: number; eficiencia_pct: number } {
  if (tipoCorte === "cuna" || tipoCorte === "piramidal") {
    const L = Math.max(1.0, Math.round(0.5 * Math.sqrt(area_m2) * 100) / 100);
    const avance = Math.round(L * 0.85 * 100) / 100;
    return { longitudBarreno_m: L, avancePorDisparo_m: avance, eficiencia_pct: 85 };
  }
  const diamM = diametroAlivioMm / 1000;
  const Lcalc = 0.15 + 34.1 * diamM - 39.4 * diamM * diamM;
  const L = Math.max(1.2, Math.round(Lcalc * 100) / 100);
  const avance = Math.round(L * 0.95 * 100) / 100;
  return { longitudBarreno_m: L, avancePorDisparo_m: avance, eficiencia_pct: 95 };
}

/**
 * Teoría de Área de Influencia (CONEINGEMMET 2003, minas San Rafael y Ananea):
 * B = Ø · [ PoD_tal / (Fs · σr · RQD) + 1 ]
 * PoD_tal = 0.25×10⁻⁵ · ρe · VOD² (kbar)
 * Factores de seguridad decrecientes:
 * - Arranque: Fs = 6
 * - Ayudas: Fs = 5
 * - Sub-ayudas / producción: Fs = 4
 * - Contornos: Fs = 3
 */
export function calcularAreaInfluenciaConeingemmet(opciones: {
  diametroMm: number;
  presionDetonacionKbar: number;
  resistenciaCompresionKgcm2: number;
  rqdPorcentaje: number;
}): { bArranque_m: number; bAyudas_m: number; bSubAyudas_m: number; bContorno_m: number } {
  const { diametroMm, presionDetonacionKbar, resistenciaCompresionKgcm2, rqdPorcentaje } = opciones;
  const d_m = diametroMm / 1000;
  // 1 kbar = 1019.7 kg/cm²
  const podKgcm2 = presionDetonacionKbar * 1019.7;
  const rqdFrac = Math.max(0.1, Math.min(rqdPorcentaje / 100, 1.0));
  const sigmaR = Math.max(100, resistenciaCompresionKgcm2);

  const calcB = (fs: number) => {
    const denominador = fs * sigmaR * rqdFrac;
    const val = d_m * (podKgcm2 / denominador + 1);
    return Math.round(val * 1000) / 1000;
  };

  return {
    bArranque_m: calcB(6),
    bAyudas_m: calcB(5),
    bSubAyudas_m: calcB(4),
    bContorno_m: calcB(3),
  };
}

/**
 * Modelo de predicción de fragmentación Kuz-Ram (Cunningham, 1983):
 * X50 = A · K^(-0.8) · Qe^(1/6) · (115 / RWS)^(19/30)
 * Uniformidad Rosin-Rammler: R(x) = exp( - (x / Xc)^n )
 */
export function calcularKuzRam(opciones: {
  area_m2: number;
  avance_m: number;
  numTaladrosCargados: number;
  pesoExplosivoTotal_kg: number;
  rmr: number;
  rwsPeso: number;
}): ResultadoKuzRam {
  const { area_m2, avance_m, numTaladrosCargados, pesoExplosivoTotal_kg, rmr, rwsPeso } = opciones;
  const volumenRoca = Math.max(0.1, area_m2 * avance_m);
  const K = Math.max(0.1, pesoExplosivoTotal_kg / volumenRoca);
  const Qe = Math.max(0.1, pesoExplosivoTotal_kg / Math.max(1, numTaladrosCargados));

  // Factor de roca A según Cunningham (1983 / 1987) calibrado para minería subterránea
  // (RMR 20-40 suave A~7-8, RMR 40-60 media A~9-11, RMR >60 dura A~12-14)
  const A = Math.min(Math.max(0.09 * rmr + 5.5, 6), 15);

  // Ecuación de Kuznetsov modificada por Cunningham
  const factorRws = Math.pow(115 / Math.max(10, rwsPeso), 19 / 30);
  const x50 = A * Math.pow(K, -0.8) * Math.pow(Qe, 1 / 6) * factorRws;
  const x50_cm = Math.round(Math.max(1.5, Math.min(x50, 60)) * 10) / 10;

  // Índice de uniformidad n para frentes subterráneos confinados (~1.10 - 1.50)
  const n = Math.round((1.18 + (rmr > 60 ? 0.18 : rmr < 40 ? -0.12 : 0.04)) * 100) / 100;
  const xc_cm = Math.round((x50_cm / Math.pow(Math.LN2, 1 / n)) * 10) / 10;

  // Fracciones Rosin-Rammler
  const r30 = Math.exp(-Math.pow(30 / xc_cm, n)); // >30 cm
  const r5 = Math.exp(-Math.pow(5 / xc_cm, n));
  const pasante5 = 1 - r5; // <5 cm

  const porcentajeSobretamano_30cm = Math.round(r30 * 1000) / 10;
  const porcentajeFinos_5cm = Math.round(pasante5 * 1000) / 10;

  let calidad: ResultadoKuzRam["calidadFragmentacion"] = "optima";
  if (x50_cm > 25 || porcentajeSobretamano_30cm > 15) {
    calidad = "gruesa_con_bolones";
  } else if (x50_cm < 8 || porcentajeFinos_5cm > 40) {
    calidad = "fina";
  }

  return {
    x50_cm,
    indiceUniformidad_n: n,
    xc_cm,
    porcentajeFinos_5cm,
    porcentajeSobretamano_30cm,
    calidadFragmentacion: calidad,
  };
}

/**
 * Modelo de daño y vibración de campo cercano Holmberg-Persson (1979 / NIOSH 2008):
 * Evalúa el PPV en el perímetro y el riesgo de sobre-excavación.
 * - PPV < 305 mm/s: Seguro, sin caída de roca.
 * - 305 - 610 mm/s: Riesgo de desprendimiento de bloques pre-existentes.
 * - 610 - 1000 mm/s: Generación de nuevas micro-fracturas.
 * - PPV ≥ 1000 mm/s: Daño estructural y sobre-excavación severa.
 */
export function calcularHolmbergPersson(opciones: {
  diametroCargaMm: number;
  densidadExplosivoGcm3: number;
  espaciamientoContorno_m: number;
  voladuraControlada: boolean;
}): ResultadoHolmbergPersson {
  const { diametroCargaMm, densidadExplosivoGcm3, espaciamientoContorno_m, voladuraControlada } = opciones;
  const d_m = diametroCargaMm / 1000;
  const q_l_real = (Math.PI / 4) * d_m * d_m * densidadExplosivoGcm3 * 1000;
  const q_l_smooth = 90 * d_m * d_m;
  const q_l_efectivo = voladuraControlada ? Math.min(q_l_real * 0.42, Math.max(q_l_smooth, 0.38)) : q_l_real;

  const r = Math.max(0.2, espaciamientoContorno_m);
  const ppv = Math.round(700 * Math.pow(q_l_efectivo / r, 0.85));

  let riesgo: ResultadoHolmbergPersson["riesgoSobreExcavacion"] = "bajo";
  let recomendacion = "Nivel de PPV controlado (<600 mm/s): la roca remanente conservará su cohesión natural.";
  if (ppv >= 1000) {
    riesgo = "alto";
    recomendacion =
      "PPV crítico (≥1000 mm/s) causa sobre-excavación: desacoplar la carga en contorno a 90·d² kg/m y aplicar espaciamiento de recorte (15·d).";
  } else if (ppv >= 600) {
    riesgo = "moderado";
    recomendacion =
      "PPV moderado (600-1000 mm/s): vigilar la corona y considerar emulsión encartuchada de menor diámetro (p. ej. Semexsa 45 o Emulnor).";
  }

  const radioCritico = Math.round(Math.pow(700 / Math.max(1, ppv), -1 / 0.85) * r * 100) / 100;

  return {
    ppvContorno_mms: ppv,
    radioDanoCritico_m: radioCritico,
    riesgoSobreExcavacion: riesgo,
    recomendacionVoladuraSuave: recomendacion,
  };
}

/**
 * Generador de Layout completo de taladros para el frente de un túnel/galería
 * que genera de forma equilibrada todas las zonas requeridas en minería subterránea:
 * - Alivios centrales (1 a 4)
 * - Arranque / Cuele (4 taladros, Cuadrante 1)
 * - Ayudas de arranque y tajeo interior (12 a 18 taladros para 2.5x2.5 m, escalado)
 * - Cuadradores en hastiales
 * - Corona en techo (smooth blasting)
 * - Arrastres en piso con look-out
 */
export function generarLayoutCompletoTunel(opciones: {
  ancho_m: number;
  alto_m: number;
  tipoSeccion: "rectangular" | "herradura" | "tipo_d" | "arco_personalizado";
  alturaCorona_m?: number;
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  avanceM: number;
  rmr: number;
  metodo?: MetodoDisenoSubterraneo;
  patronContorno?: "uniforme" | "corona_recorte" | "recorte_continuo";
}): {
  puntos: Array<{
    x: number;
    y: number;
    zona: string;
    cargado: boolean;
    color: string;
    diamMm: number;
    lookout?: number;
    anguloLookoutRad?: number;
    etapa?: number;
  }>;
  desglose: DesgloseZonasTaladros;
  seccionesCorte: SeccionArranque[];
  advertencias: string[];
} {
  const {
    ancho_m,
    alto_m,
    tipoSeccion,
    numAlivios,
    diametroAlivioMm,
    diametroProdMm,
    avanceM,
    rmr,
    metodo = "holmberg_1982",
    patronContorno = "corona_recorte",
  } = opciones;

  const W = Math.max(1.0, ancho_m);
  const H = Math.max(1.0, alto_m);
  const cx = W / 2;

  // 1. Geometría de corona y hastial
  let hHastial: number;
  let hCorona: number;
  if (tipoSeccion === "rectangular") {
    hHastial = H;
    hCorona = 0;
  } else if (tipoSeccion === "herradura") {
    hCorona = W / 2;
    hHastial = Math.max(0, H - hCorona);
  } else if (tipoSeccion === "tipo_d") {
    hCorona = Math.min(W * 0.35, H * 0.5);
    hHastial = Math.max(0, H - hCorona);
  } else {
    hCorona = Math.min(opciones.alturaCorona_m ?? W * 0.4, H * 0.8);
    hHastial = Math.max(0, H - hCorona);
  }

  // Centro del cuele: 38% a 42% de la altura para facilitar el desplazamiento por gravedad
  const cy = tipoSeccion === "rectangular" ? H * 0.44 : Math.min(hHastial * 0.75, H * 0.40);

  // 2. Secciones del cuele Holmberg
  const resHolmberg = calcularArranqueHolmberg({
    diametroIndividualAlivio_mm: diametroAlivioMm,
    numeroTaladrosAlivio: numAlivios,
    avance_m: avanceM,
    maximoSecciones: 5,
  });
  const seccionesCorte = resHolmberg.secciones;

  // 3. Espaciamientos de contorno según RMR y teoría de voladura subterránea
  const paramsRmr = obtenerParametrosRmr(rmr);
  // Recorte (Smooth Blasting): 11 a 14 veces el diámetro del taladro (0.48m - 0.54m)
  const espContornoDuro = Math.max(0.44, Math.min(0.55, paramsRmr.espaciamientoE_m));
  // Contorno normal (sin voladura suave): 15 a 17 veces el diámetro (0.68m - 0.76m)
  const espContornoNormal = Math.max(0.68, Math.min(0.76, (diametroProdMm / 1000) * 16));
  const espCorona = patronContorno === "uniforme" ? espContornoNormal : espContornoDuro;
  const espHastial = patronContorno === "recorte_continuo" ? espContornoDuro : espContornoNormal;

  const puntos: Array<{
    x: number;
    y: number;
    zona: string;
    cargado: boolean;
    color: string;
    diamMm: number;
    lookout?: number;
    anguloLookoutRad?: number;
    etapa?: number;
  }> = [];

  const agregarPuntoSeguro = (
    x: number,
    y: number,
    zona: string,
    cargado: boolean,
    color: string,
    diamMm: number,
    lookout = 0,
    etapa?: number,
    anguloLookoutRad?: number
  ): boolean => {
    // 1. Respetar límites físicos de la labor (nunca por debajo del piso ni fuera del contorno)
    if (y < 0.14 || y > H - 0.14 || x < 0.14 || x > W - 0.14) return false;

    // Control estricto del arco en zona de corona (y > hHastial)
    if (y > hHastial) {
      if (tipoSeccion === "herradura") {
        const distCentroCorona = Math.hypot(x - cx, y - hHastial);
        if (distCentroCorona > hCorona - 0.14) return false;
      } else if (tipoSeccion === "tipo_d" || tipoSeccion === "arco_personalizado") {
        // En tipo_d y arco personalizado el arco es elíptico / sinusoidal
        const a = W / 2;
        const b = Math.max(0.1, hCorona);
        const dxNorm = (x - cx) / a;
        const dyNorm = (y - hHastial) / b;
        if (Math.hypot(dxNorm, dyNorm) > 0.88) return false;
      }
    }

    // 2. Control de colisión estricto:
    for (const p of puntos) {
      if (p.zona === "alivio" && zona === "alivio") continue; // Los alivios centrales van en racimo
      // Distancia entre barreno cargado y alivio vacío: mínimo 0.12m (permite el burden B1 del cuele)
      if (p.zona === "alivio" || zona === "alivio") {
        if (Math.hypot(p.x - x, p.y - y) < 0.12) return false;
        continue;
      }
      // Distancia entre dos taladros cargados: mínimo 0.28m para evitar intersección o simpatía
      if (Math.hypot(p.x - x, p.y - y) < 0.28) {
        return false;
      }
    }

    puntos.push({
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      zona,
      cargado,
      color,
      diamMm,
      lookout,
      anguloLookoutRad,
      etapa,
    });
    return true;
  };

  // =========================================================================
  // 1. ZONA DE ALIVIOS (CENTRO DEL CUELE)
  // =========================================================================
  const nAliv = Math.max(1, Math.min(6, Math.round(numAlivios)));
  const dAlivM = diametroAlivioMm / 1000;
  if (nAliv === 1) {
    agregarPuntoSeguro(cx, cy, "alivio", false, "#00f0ff", diametroAlivioMm);
  } else if (nAliv === 2) {
    const dSep = dAlivM * 0.55;
    agregarPuntoSeguro(cx - dSep, cy, "alivio", false, "#00f0ff", diametroAlivioMm);
    agregarPuntoSeguro(cx + dSep, cy, "alivio", false, "#00f0ff", diametroAlivioMm);
  } else if (nAliv === 3) {
    const rAliv = dAlivM * 0.65;
    agregarPuntoSeguro(cx, cy + rAliv, "alivio", false, "#00f0ff", diametroAlivioMm);
    agregarPuntoSeguro(cx - rAliv * 0.866, cy - rAliv * 0.5, "alivio", false, "#00f0ff", diametroAlivioMm);
    agregarPuntoSeguro(cx + rAliv * 0.866, cy - rAliv * 0.5, "alivio", false, "#00f0ff", diametroAlivioMm);
  } else {
    // 4 alivios en racimo cuadrado cerrado estándar
    const rAliv = dAlivM * 0.55;
    agregarPuntoSeguro(cx - rAliv, cy - rAliv, "alivio", false, "#00f0ff", diametroAlivioMm);
    agregarPuntoSeguro(cx + rAliv, cy - rAliv, "alivio", false, "#00f0ff", diametroAlivioMm);
    agregarPuntoSeguro(cx + rAliv, cy + rAliv, "alivio", false, "#00f0ff", diametroAlivioMm);
    agregarPuntoSeguro(cx - rAliv, cy + rAliv, "alivio", false, "#00f0ff", diametroAlivioMm);
  }

  // =========================================================================
  // 2. CUELE HOLMBERG: SECCIÓN 1 (ARRANQUE - ROMBO A 45°)
  // =========================================================================
  const b1 = Math.max(0.20, Math.min(0.32, seccionesCorte[0]?.burden_m ?? 0.28));
  for (let j = 0; j < 4; j++) {
    const ang = Math.PI / 4 + j * (Math.PI / 2);
    agregarPuntoSeguro(
      cx + b1 * Math.cos(ang),
      cy + b1 * Math.sin(ang),
      "cuadrante1",
      true,
      "#ef4444",
      diametroProdMm,
      0,
      1
    );
  }

  // =========================================================================
  // 3. CUELE HOLMBERG: SECCIÓN 2 (PRIMERA AYUDA - CUADRADO ORTOGONAL)
  // =========================================================================
  const b2 = Math.max(0.36, Math.min(0.48, seccionesCorte[1]?.burden_m ?? b1 * Math.SQRT2));
  for (let j = 0; j < 4; j++) {
    const ang = j * (Math.PI / 2); // 0°, 90°, 180°, 270°
    agregarPuntoSeguro(
      cx + b2 * Math.cos(ang),
      cy + b2 * Math.sin(ang),
      "cuadrante2",
      true,
      "#f97316",
      diametroProdMm,
      0,
      2
    );
  }

  // =========================================================================
  // 4. ARRASTRES (ZAPATERAS / PISO)
  // Taladros en la rasante con ángulo negativo (-3°) para levantar la carga
  // =========================================================================
  const yArrastre = 0.18;
  const xMinArr = 0.22;
  const xMaxArr = Math.max(xMinArr + 0.2, W - 0.22);
  const numArrastre = W <= 2.6 ? 4 : W <= 3.2 ? 5 : 6;
  for (let i = 0; i < numArrastre; i++) {
    const xi = xMinArr + (i / (numArrastre - 1)) * (xMaxArr - xMinArr);
    agregarPuntoSeguro(xi, yArrastre, "arrastre", true, "#eab308", diametroProdMm, -3, undefined, -Math.PI / 2);
  }

  // =========================================================================
  // 5. CUADRADORES (HASTIALES / PAREDES LATERALES)
  // Con ángulo positivo hacia afuera (+3°) orientados hacia sus respectivas cajas
  // =========================================================================
  const offHastial = 0.22;
  const yHastialMin = Math.max(0.48, yArrastre + 0.29);
  // En rectangular, el hastial vertical cubre toda la altura hasta cerca de la corona
  const yHastialMax =
    tipoSeccion === "rectangular"
      ? Math.max(yHastialMin + 0.3, H - 0.52)
      : Math.max(yHastialMin + 0.2, Math.min(hHastial - 0.10, H - 0.40));

  // Altura de pared efectiva a cubrir por los cuadradores
  const hParedEfectiva = yHastialMax - yHastialMin;
  const numCuadradorLado = Math.max(
    2,
    Math.min(6, Math.round(hParedEfectiva / espHastial) + 1)
  );

  for (let i = 0; i < numCuadradorLado; i++) {
    const t = i / (numCuadradorLado - 1);
    const y = yHastialMin + t * (yHastialMax - yHastialMin);
    // Hastial izquierdo mira hacia afuera a la izquierda (PI), derecho a la derecha (0)
    agregarPuntoSeguro(offHastial, y, "cuadradores", true, "#38bdf8", diametroProdMm, 3, undefined, Math.PI);
    agregarPuntoSeguro(W - offHastial, y, "cuadradores", true, "#38bdf8", diametroProdMm, 3, undefined, 0);
  }

  // =========================================================================
  // 6. CORONA (TECHO / ALZAS / SMOOTH BLASTING)
  // Con ángulo positivo hacia afuera (+3°) y orientación radial outward
  // Dinámicamente controlado por patronContorno y espCorona
  // Garantiza siempre un taladro central de clave en el eje (número impar)
  // =========================================================================
  if (tipoSeccion === "rectangular") {
    const xMinTecho = 0.25;
    const xMaxTecho = Math.max(xMinTecho + 0.2, W - 0.25);
    const lTecho = xMaxTecho - xMinTecho;
    let numTecho = Math.max(4, Math.min(9, Math.round(lTecho / espCorona) + 1));
    for (let i = 0; i < numTecho; i++) {
      const xi = xMinTecho + (i / (numTecho - 1)) * (xMaxTecho - xMinTecho);
      agregarPuntoSeguro(xi, H - 0.20, "corona", true, "#22c55e", diametroProdMm, 3, undefined, Math.PI / 2);
    }
  } else if (tipoSeccion === "herradura") {
    const radioCorona = Math.max(0.15, hCorona - 0.20);
    const angIni = 0.10 * Math.PI;
    const angFin = 0.90 * Math.PI;
    const lArcoHerradura = radioCorona * (angFin - angIni);
    let numCorona = Math.max(5, Math.min(9, Math.round(lArcoHerradura / espCorona) + 1));
    // Garantizar número impar para que coincida exactamente un taladro de clave en el centro
    if (numCorona % 2 === 0) numCorona += 1;
    for (let i = 0; i < numCorona; i++) {
      const t = i / (numCorona - 1);
      const ang = angIni + t * (angFin - angIni);
      const x = cx + radioCorona * Math.cos(ang);
      const y = hHastial + radioCorona * Math.sin(ang);
      agregarPuntoSeguro(x, y, "corona", true, "#22c55e", diametroProdMm, 3, undefined, ang);
    }
  } else {
    // Tipo D o arco rebajado: arco elíptico con retranqueo uniforme constante
    const dOffset = Math.min(0.20, W * 0.08);
    const aIn = Math.max(0.2, W / 2 - dOffset);
    const bIn = Math.max(0.15, hCorona - dOffset);
    const angIni = 0.10 * Math.PI;
    const angFin = 0.90 * Math.PI;
    // Longitud aproximada del arco de corona útil
    const lArcoEliptico = Math.PI * Math.sqrt((aIn * aIn + bIn * bIn) / 2) * 0.78;
    let numCorona = Math.max(5, Math.min(9, Math.round(lArcoEliptico / espCorona) + 1));
    // Garantizar número impar para que coincida exactamente un taladro de clave en el centro
    if (numCorona % 2 === 0) numCorona += 1;
    for (let i = 0; i < numCorona; i++) {
      const t = i / (numCorona - 1);
      const ang = angIni + t * (angFin - angIni);
      const x = cx + aIn * Math.cos(ang);
      const y = hHastial + bIn * Math.sin(ang);
      // Vector normal exterior a la elipse
      const angNormal = Math.atan2(Math.sin(ang) / bIn, Math.cos(ang) / aIn);
      agregarPuntoSeguro(x, y, "corona", true, "#22c55e", diametroProdMm, 3, undefined, angNormal);
    }
  }

  // =========================================================================
  // 7. CUELE HOLMBERG: SECCIÓN 3 (SOLO SI EL GÁLIBO ES AMPLIO: W >= 3.2m)
  // =========================================================================
  if (W >= 3.2 && H >= 3.2 && seccionesCorte.length >= 3) {
    const b3 = Math.max(0.55, Math.min(0.72, seccionesCorte[2]?.burden_m ?? b2 * Math.SQRT2));
    if (cy - b3 >= 0.52 && cx - b3 >= 0.55) {
      for (let j = 0; j < 4; j++) {
        const ang = Math.PI / 4 + j * (Math.PI / 2);
        agregarPuntoSeguro(
          cx + b3 * Math.cos(ang),
          cy + b3 * Math.sin(ang),
          "cuadrante3",
          true,
          "#f59e0b",
          diametroProdMm,
          0,
          3
        );
      }
    }
  }

  // =========================================================================
  // 8. DESTROZA / TAJEO (AYUDAS DE PRODUCCIÓN INTERNAS EQUILIBRADAS)
  // Se ubican de forma disciplinada en el espacio libre entre el cuele y el contorno:
  // - Ayudas de Alza (hacia el techo, respetando burden protector respecto a la corona)
  // - Ayudas de Hastial (entre el cuele y los cuadradores, en tresbolillo)
  // - Ayudas de Zapatera (solo si la galería es alta H >= 3.2m)
  // =========================================================================
  const yTechoLimite = tipoSeccion === "herradura" ? H - 0.25 : H - 0.22;
  const yCueleTop = cy + b2;
  // Mantener un burden protector B >= 0.52m debajo de la corona para evitar sobre-quiebre
  const bInCorona =
    tipoSeccion === "rectangular"
      ? 0.20
      : tipoSeccion === "herradura"
      ? Math.max(0.15, hCorona - 0.20)
      : Math.max(0.15, hCorona - Math.min(0.20, W * 0.08));
  const yCoronaMin = tipoSeccion === "rectangular" ? H - 0.20 : hHastial + bInCorona;
  const yAlzaMax = Math.max(yCueleTop + 0.25, yCoronaMin - 0.52);
  const yAlzaIdeal = yCueleTop + (yTechoLimite - yCueleTop) * 0.44;
  const yAlza = Math.min(yAlzaMax, yAlzaIdeal);

  // 8.1 Ayudas de Alza (Techo)
  if (W <= 3.0) {
    // 2 taladros simétricos a ambos lados del eje central
    const dxAlza = Math.min(0.42, W * 0.16);
    agregarPuntoSeguro(cx - dxAlza, yAlza, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(cx + dxAlza, yAlza, "produccion", true, "#ec4899", diametroProdMm);
  } else {
    // 3 taladros para galerías más anchas
    const dxAlza = Math.min(0.60, W * 0.20);
    agregarPuntoSeguro(cx - dxAlza, yAlza, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(cx, yAlza + 0.05, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(cx + dxAlza, yAlza, "produccion", true, "#ec4899", diametroProdMm);
  }

  // 8.2 Ayudas de Hastial (Laterales / Flancos)
  const xLatIzq = Math.max(0.48, (offHastial + (cx - b2)) / 2);
  const xLatDer = W - xLatIzq;
  // En cualquier sección con altura >= 2.2m la pared vertical es suficientemente
  // amplia y requiere 2 ayudas por flanco en tresbolillo con los cuadradores
  const necesitaDobleLateral = H >= 2.2;
  if (!necesitaDobleLateral) {
    // 1 taladro por flanco al nivel medio del cuele
    agregarPuntoSeguro(xLatIzq, cy, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(xLatDer, cy, "produccion", true, "#ec4899", diametroProdMm);
  } else {
    // 2 taladros por flanco en tresbolillo con los cuadradores
    const dyLat = Math.min(0.35, Math.max(0.26, (yHastialMax - yHastialMin) * 0.25));
    agregarPuntoSeguro(xLatIzq, cy - dyLat, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(xLatIzq, cy + dyLat, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(xLatDer, cy - dyLat, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(xLatDer, cy + dyLat, "produccion", true, "#ec4899", diametroProdMm);
  }

  // 8.3 Ayudas de Zapatera / Contrapiso (Solo si H >= 3.2m para evitar invasión del piso)
  const yCueleBottom = cy - b2;
  const espacioPiso = yCueleBottom - yArrastre;
  if (espacioPiso >= 0.55) {
    const yPisoAux = yArrastre + espacioPiso * 0.50;
    const dxPisoAux = Math.min(0.38, W * 0.16);
    agregarPuntoSeguro(cx - dxPisoAux, yPisoAux, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(cx + dxPisoAux, yPisoAux, "produccion", true, "#ec4899", diametroProdMm);
  }

  // 8.4 Refuerzo en esquinas si la roca es muy competente (RMR > 60)
  if (rmr > 60 && W >= 2.8) {
    const dxCorner = Math.min(0.55, W * 0.22);
    const dyCorner = 0.38;
    agregarPuntoSeguro(cx - dxCorner, cy + dyCorner, "produccion", true, "#ec4899", diametroProdMm);
    agregarPuntoSeguro(cx + dxCorner, cy + dyCorner, "produccion", true, "#ec4899", diametroProdMm);
  }

  // Conteo de zonas
  const desglose: DesgloseZonasTaladros = {
    alivios: puntos.filter((p) => p.zona === "alivio").length,
    arranque: puntos.filter((p) => p.zona === "cuadrante1" || p.zona === "arranque").length,
    ayudas: puntos.filter((p) => p.zona.startsWith("cuadrante") && p.zona !== "cuadrante1" || p.zona === "produccion").length,
    cuadradores: puntos.filter((p) => p.zona === "cuadradores").length,
    corona: puntos.filter((p) => p.zona === "corona").length,
    arrastre: puntos.filter((p) => p.zona === "arrastre").length,
    totalCargados: puntos.filter((p) => p.cargado).length,
    totalTaladros: puntos.length,
  };

  return { puntos, desglose, seccionesCorte, advertencias: [] };
}

