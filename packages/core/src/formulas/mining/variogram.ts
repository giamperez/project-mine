/**
 * Variograma para kriging ordinario en `mining.block-model`.
 *
 * Fuentes:
 * - Modelos de semivarianza (esferico/exponencial/gaussiano): Journel & Huijbregts (1978)
 *   "Mining Geostatistics", sec. III.B; Isaaks & Srivastava (1989) "An Introduction to Applied
 *   Geostatistics", cap. II.
 * - Variograma experimental (estimador de momentos): Matheron (1963); Isaaks & Srivastava cap. 7.
 *
 * Convencion de `alcance_m`: es el parametro de forma "a" de cada formula, no necesariamente el
 * "alcance practico" (distancia a la que la semivarianza llega al 95% de la meseta). Para el
 * modelo esferico coinciden (a = alcance practico exacto). Para exponencial y gaussiano el
 * alcance practico es ~3*a y a*sqrt(3) respectivamente.
 */

import type { ModeloVariograma, PuntoVariogramaExperimental, TipoModeloVariograma } from "../../domain/blockModel.js";

/** Semivarianza teorica gamma(h) del modelo dado. gamma(0) = 0 (efecto pepita es una discontinuidad en el origen). */
export function semivarianza(modelo: ModeloVariograma, h: number): number {
  if (h <= 1e-9) return 0;
  const { pepita, meseta, alcance_m } = modelo;
  const mesetaParcial = Math.max(meseta - pepita, 0);
  if (alcance_m <= 0) return meseta;

  switch (modelo.tipo) {
    case "esferico": {
      if (h >= alcance_m) return meseta;
      const r = h / alcance_m;
      return pepita + mesetaParcial * (1.5 * r - 0.5 * r ** 3);
    }
    case "exponencial":
      return pepita + mesetaParcial * (1 - Math.exp(-h / alcance_m));
    case "gaussiano":
      return pepita + mesetaParcial * (1 - Math.exp(-((h / alcance_m) ** 2)));
    default:
      return meseta;
  }
}

/** Forma normalizada f(h) del modelo, tal que gamma(h) = pepita*(1-f(h)) + meseta*f(h). Usada por el ajuste. */
function formaNormalizada(tipo: TipoModeloVariograma, h: number, alcance_m: number): number {
  if (h <= 1e-9 || alcance_m <= 0) return 0;
  switch (tipo) {
    case "esferico": {
      if (h >= alcance_m) return 1;
      const r = h / alcance_m;
      return 1.5 * r - 0.5 * r ** 3;
    }
    case "exponencial":
      return 1 - Math.exp(-h / alcance_m);
    case "gaussiano":
      return 1 - Math.exp(-((h / alcance_m) ** 2));
  }
}

/**
 * Variograma experimental (estimador clasico de Matheron) de un conjunto de puntos con valor:
 * agrupa todos los pares en bins de distancia ("lags") de ancho `tamanoLag_m` y promedia
 * 0.5*(valor_i - valor_j)^2 dentro de cada bin. Solo devuelve bins con al menos un par.
 */
export function variogramaExperimental(
  puntos: Array<{ x: number; y: number; z: number; valor: number }>,
  tamanoLag_m: number,
  numeroLags: number
): PuntoVariogramaExperimental[] {
  if (tamanoLag_m <= 0 || numeroLags <= 0) return [];
  const acumulador = Array.from({ length: numeroLags }, () => ({ sumaCuadrados: 0, numeroPares: 0, sumaDistancia: 0 }));

  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const h = Math.hypot(puntos[i].x - puntos[j].x, puntos[i].y - puntos[j].y, puntos[i].z - puntos[j].z);
      const lag = Math.floor(h / tamanoLag_m);
      if (lag < 0 || lag >= numeroLags) continue;
      const dv = puntos[i].valor - puntos[j].valor;
      acumulador[lag].sumaCuadrados += dv * dv;
      acumulador[lag].numeroPares += 1;
      acumulador[lag].sumaDistancia += h;
    }
  }

  return acumulador
    .map((a, i) => ({
      distancia_m: a.numeroPares > 0 ? a.sumaDistancia / a.numeroPares : (i + 0.5) * tamanoLag_m,
      semivarianza: a.numeroPares > 0 ? a.sumaCuadrados / (2 * a.numeroPares) : 0,
      numeroPares: a.numeroPares,
    }))
    .filter((p) => p.numeroPares > 0);
}

/**
 * Ajusta pepita y meseta por minimos cuadrados ponderados (peso = numero de pares del lag) para
 * un alcance FIJO: como gamma(h) = pepita*(1-f(h)) + meseta*f(h) es lineal en (pepita, meseta)
 * para f(h) fijo, esto es una regresion lineal de 2 parametros con solucion cerrada (ecuaciones
 * normales 2x2, resueltas por Cramer). Devuelve null si el sistema normal es singular (p.ej. un
 * unico lag disponible con f(h) degenerado).
 */
function ajustarPepitaMesetaParaAlcance(
  experimental: PuntoVariogramaExperimental[],
  tipo: TipoModeloVariograma,
  alcance_m: number
): { pepita: number; meseta: number; sce: number } | null {
  let sAA = 0;
  let sAB = 0;
  let sBB = 0;
  let sAY = 0;
  let sBY = 0;
  for (const p of experimental) {
    const f = formaNormalizada(tipo, p.distancia_m, alcance_m);
    const a = 1 - f;
    const b = f;
    const w = p.numeroPares;
    sAA += w * a * a;
    sAB += w * a * b;
    sBB += w * b * b;
    sAY += w * a * p.semivarianza;
    sBY += w * b * p.semivarianza;
  }
  const det = sAA * sBB - sAB * sAB;
  if (Math.abs(det) < 1e-12) return null;

  let pepita = (sAY * sBB - sBY * sAB) / det;
  let meseta = (sAA * sBY - sAB * sAY) / det;
  pepita = Math.max(pepita, 0);
  meseta = Math.max(meseta, pepita);

  let sce = 0;
  for (const p of experimental) {
    const f = formaNormalizada(tipo, p.distancia_m, alcance_m);
    const predicho = pepita * (1 - f) + meseta * f;
    sce += p.numeroPares * (p.semivarianza - predicho) ** 2;
  }
  return { pepita, meseta, sce };
}

/**
 * Ajusta un modelo de variograma al variograma experimental por minimos cuadrados ponderados.
 * El alcance es el unico parametro no lineal de los 3 modelos soportados: se prueba una grilla
 * de candidatos entre el primer y el ultimo lag y, para cada uno, pepita/meseta se resuelven
 * exactamente (ver `ajustarPepitaMesetaParaAlcance`); se adopta el alcance que minimiza la suma
 * de cuadrados ponderada. Devuelve null si no hay suficientes lags para ajustar.
 */
export function ajustarVariograma(
  experimental: PuntoVariogramaExperimental[],
  tipo: TipoModeloVariograma
): ModeloVariograma | null {
  if (experimental.length < 2) return null;

  const distanciaMax = Math.max(...experimental.map((p) => p.distancia_m));
  const distanciaMin = Math.min(...experimental.map((p) => p.distancia_m));
  if (distanciaMax <= 0) return null;

  const NUMERO_CANDIDATOS = 60;
  let mejor: { pepita: number; meseta: number; sce: number; alcance_m: number } | null = null;
  for (let i = 1; i <= NUMERO_CANDIDATOS; i++) {
    const alcance_m = (distanciaMin > 0 ? distanciaMin * 0.25 : distanciaMax / NUMERO_CANDIDATOS) + (distanciaMax * i) / NUMERO_CANDIDATOS;
    const ajuste = ajustarPepitaMesetaParaAlcance(experimental, tipo, alcance_m);
    if (ajuste && (!mejor || ajuste.sce < mejor.sce)) {
      mejor = { ...ajuste, alcance_m };
    }
  }
  if (!mejor) return null;
  return { tipo, pepita: mejor.pepita, meseta: mejor.meseta, alcance_m: mejor.alcance_m };
}
