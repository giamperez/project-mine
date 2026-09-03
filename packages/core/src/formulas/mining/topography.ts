/**
 * Motor de calculo del modulo `mining.topography` (Topografía): genera una superficie triangulada
 * (TIN) a partir de una nube de puntos de levantamiento, calcula curvas de nivel y volumenes de
 * corte/relleno entre dos superficies.
 *
 * Fuentes:
 * - Triangulacion: Delaunay 2D sobre (x,y) via `delaunator` (D. Agafonkin) — implementacion madura
 *   y ampliamente usada (D3, Mapbox); la cota z de cada vertice se conserva del punto original.
 * - Area por coordenadas (formula del poligono / Shoelace / Gauss): A = 1/2 |sum(xi*yi+1 - xi+1*yi)|.
 * - Volumen por secciones — Area media de extremos: V = (L/2)(A1+A2).
 * - Volumen — Formula Prismoidal (mas precisa): V = (L/6)(A1 + 4*Am + A2), con Am el area de la
 *   seccion media (no el promedio de A1 y A2). La diferencia entre ambos metodos es la
 *   "correccion prismoidal"; el metodo de area media sobreestima tipicamente 2-8%.
 * - Volumen corte/relleno entre dos superficies irregulares: metodo de grilla — se muestrean ambas
 *   superficies en una malla regular sobre su extension comun y se integra la diferencia de cotas
 *   por celda. Es el metodo estandar para terrenos irregulares (equivalente al "grid method" citado
 *   en la bibliografia de topografia minera), mas robusto que secciones transversales para
 *   superficies no lineales.
 */

import Delaunator from "delaunator";
import type {
  EntradaCurvasNivel,
  EntradaVolumenCorteRelleno,
  PuntoTopografico,
  ResultadoVolumenCorteRelleno,
  SegmentoCurvaNivel,
  SuperficieTIN,
} from "../../domain/topography.js";
import { DEFAULTS_TOPOGRAFIA } from "../../domain/topography.js";

/** Area de un poligono 2D por la formula del Shoelace (Gauss). Siempre positiva. */
export function areaPoligono_m2(poligono: Array<{ x: number; y: number }>): number {
  let suma = 0;
  for (let i = 0; i < poligono.length; i++) {
    const p1 = poligono[i];
    const p2 = poligono[(i + 1) % poligono.length];
    suma += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(suma) / 2;
}

/** Volumen por area media de extremos: V = (L/2)(A1+A2). */
export function volumenAreaMedia_m3(area1_m2: number, area2_m2: number, distancia_m: number): number {
  return (distancia_m / 2) * (area1_m2 + area2_m2);
}

/** Volumen prismoidal: V = (L/6)(A1 + 4*Am + A2). Am es el area de la seccion MEDIA real, no el promedio. */
export function volumenPrismoidal_m3(
  area1_m2: number,
  areaMedia_m2: number,
  area2_m2: number,
  distancia_m: number
): number {
  return (distancia_m / 6) * (area1_m2 + 4 * areaMedia_m2 + area2_m2);
}

/** Triangula una nube de puntos (x,y) mediante Delaunay 2D, conservando z por vertice. */
export function triangularSuperficie(puntos: PuntoTopografico[]): SuperficieTIN {
  if (puntos.length < 3) return { puntos, indices: [] };
  const delaunay = Delaunator.from(
    puntos,
    (p) => p.x,
    (p) => p.y
  );
  return { puntos, indices: Array.from(delaunay.triangles) };
}

function coordenadasBaricentricas(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): { u: number; v: number; w: number } | null {
  const v0x = bx - ax;
  const v0y = by - ay;
  const v1x = cx - ax;
  const v1y = cy - ay;
  const v2x = px - ax;
  const v2y = py - ay;
  const den = v0x * v1y - v1x * v0y;
  if (den === 0) return null;
  const v = (v2x * v1y - v1x * v2y) / den;
  const w = (v0x * v2y - v2x * v0y) / den;
  const u = 1 - v - w;
  return { u, v, w };
}

const TOLERANCIA_BARICENTRICA = 1e-9;

/** Interpola la cota z de una superficie TIN en (x,y). null si el punto cae fuera de la malla. */
export function interpolarEnSuperficie(superficie: SuperficieTIN, x: number, y: number): number | null {
  const { puntos, indices } = superficie;
  for (let i = 0; i < indices.length; i += 3) {
    const a = puntos[indices[i]];
    const b = puntos[indices[i + 1]];
    const c = puntos[indices[i + 2]];
    const bc = coordenadasBaricentricas(x, y, a.x, a.y, b.x, b.y, c.x, c.y);
    if (!bc) continue;
    if (bc.u >= -TOLERANCIA_BARICENTRICA && bc.v >= -TOLERANCIA_BARICENTRICA && bc.w >= -TOLERANCIA_BARICENTRICA) {
      return bc.u * a.z + bc.v * b.z + bc.w * c.z;
    }
  }
  return null;
}

function calcularBBox(puntos: Array<{ x: number; y: number }>) {
  return {
    xMin: Math.min(...puntos.map((p) => p.x)),
    xMax: Math.max(...puntos.map((p) => p.x)),
    yMin: Math.min(...puntos.map((p) => p.y)),
    yMax: Math.max(...puntos.map((p) => p.y)),
  };
}

/** Volumen de corte/relleno entre dos superficies TIN por muestreo en grilla regular. */
export function calcularVolumenCorteRelleno(entrada: EntradaVolumenCorteRelleno): ResultadoVolumenCorteRelleno {
  const resolucion = entrada.resolucionGrilla_m ?? DEFAULTS_TOPOGRAFIA.resolucionGrilla_m;
  const advertencias: string[] = [];

  const bboxActual = calcularBBox(entrada.superficieActual.puntos);
  const bboxDiseno = calcularBBox(entrada.superficieDiseno.puntos);
  const xMin = Math.max(bboxActual.xMin, bboxDiseno.xMin);
  const xMax = Math.min(bboxActual.xMax, bboxDiseno.xMax);
  const yMin = Math.max(bboxActual.yMin, bboxDiseno.yMin);
  const yMax = Math.min(bboxActual.yMax, bboxDiseno.yMax);

  const vacio: ResultadoVolumenCorteRelleno = {
    volumenCorte_m3: 0,
    volumenRelleno_m3: 0,
    volumenNeto_m3: 0,
    areaComun_m2: 0,
    resolucionGrilla_m: resolucion,
    celdasMuestreadas: 0,
    advertencias,
  };

  if (xMin >= xMax || yMin >= yMax) {
    advertencias.push("Las superficies no se solapan en planta: no se puede calcular corte/relleno.");
    return vacio;
  }

  const celdaArea = resolucion * resolucion;
  let volumenCorte = 0;
  let volumenRelleno = 0;
  let celdas = 0;

  for (let x = xMin + resolucion / 2; x < xMax; x += resolucion) {
    for (let y = yMin + resolucion / 2; y < yMax; y += resolucion) {
      const zActual = interpolarEnSuperficie(entrada.superficieActual, x, y);
      const zDiseno = interpolarEnSuperficie(entrada.superficieDiseno, x, y);
      if (zActual === null || zDiseno === null) continue;
      const diferencia = zActual - zDiseno;
      if (diferencia > 0) volumenCorte += diferencia * celdaArea;
      else volumenRelleno += -diferencia * celdaArea;
      celdas++;
    }
  }

  if (celdas === 0) {
    advertencias.push("Ninguna celda de la grilla cayo dentro de ambas superficies trianguladas.");
  }

  return {
    volumenCorte_m3: volumenCorte,
    volumenRelleno_m3: volumenRelleno,
    volumenNeto_m3: volumenCorte - volumenRelleno,
    areaComun_m2: celdas * celdaArea,
    resolucionGrilla_m: resolucion,
    celdasMuestreadas: celdas,
    advertencias,
  };
}

function cruceEnArista(
  za: number,
  zb: number,
  cota: number,
  pa: { x: number; y: number },
  pb: { x: number; y: number }
): { x: number; y: number } | null {
  if (za === cota && zb === cota) return null; // arista entera sobre el nivel: caso degenerado, se ignora
  if ((za - cota) * (zb - cota) > 0) return null; // ambos vertices del mismo lado: no cruza
  const t = (cota - za) / (zb - za);
  return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
}

/** Genera segmentos de curvas de nivel intersectando cada triangulo con planos horizontales. */
export function generarCurvasNivel(entrada: EntradaCurvasNivel): SegmentoCurvaNivel[] {
  const { superficie, intervalo_m } = entrada;
  const { puntos, indices } = superficie;
  const segmentos: SegmentoCurvaNivel[] = [];

  for (let i = 0; i < indices.length; i += 3) {
    const a = puntos[indices[i]];
    const b = puntos[indices[i + 1]];
    const c = puntos[indices[i + 2]];
    const zMin = Math.min(a.z, b.z, c.z);
    const zMax = Math.max(a.z, b.z, c.z);
    const primerNivel = Math.ceil(zMin / intervalo_m) * intervalo_m;

    for (let cota = primerNivel; cota <= zMax; cota += intervalo_m) {
      const cruces = [cruceEnArista(a.z, b.z, cota, a, b), cruceEnArista(b.z, c.z, cota, b, c), cruceEnArista(c.z, a.z, cota, c, a)].filter(
        (p): p is { x: number; y: number } => p !== null
      );
      if (cruces.length === 2) {
        segmentos.push({ cota, a: cruces[0], b: cruces[1] });
      }
    }
  }
  return segmentos;
}
