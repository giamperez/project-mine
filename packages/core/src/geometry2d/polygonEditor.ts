/**
 * Operaciones puras de edicion de poligonos 2D — sin dependencia de ningun vertical (mineria o
 * construccion) ni de la UI. Pensadas para respaldar un editor interactivo (tocar para agregar,
 * arrastrar para mover, snap a grilla o a otro vertice) reutilizable entre modulos.
 */

import type { Punto2D } from "../formulas/mining/geometry.js";

/**
 * Genericas sobre T extends Punto2D (no solo {x,y}): asi un editor puede trabajar directamente
 * con objetos mas ricos (p.ej. un collar de sondaje con profundidad/azimut/inclinacion) sin
 * perder esos campos extra al agregar/mover/eliminar — no hay que reconciliar dos arreglos.
 */

export function agregarVertice<T extends Punto2D>(poligono: T[], punto: T): T[] {
  return [...poligono, punto];
}

export function insertarVerticeEnArista<T extends Punto2D>(poligono: T[], indiceArista: number, punto: T): T[] {
  const nuevo = [...poligono];
  nuevo.splice(indiceArista + 1, 0, punto);
  return nuevo;
}

export function moverVertice<T extends Punto2D>(poligono: T[], indice: number, nuevoPunto: T): T[] {
  return poligono.map((p, i) => (i === indice ? nuevoPunto : p));
}

export function eliminarVertice<T extends Punto2D>(poligono: T[], indice: number): T[] {
  return poligono.filter((_, i) => i !== indice);
}

export function snapAGrilla(punto: Punto2D, tamanoGrilla: number): Punto2D {
  if (tamanoGrilla <= 0) return punto;
  return { x: Math.round(punto.x / tamanoGrilla) * tamanoGrilla, y: Math.round(punto.y / tamanoGrilla) * tamanoGrilla };
}

/** Indice del vertice mas cercano a `punto` dentro de `tolerancia`, o null si ninguno califica. */
export function verticeMasCercano(poligono: Punto2D[], punto: Punto2D, tolerancia: number): number | null {
  let mejorIndice: number | null = null;
  let mejorDistancia = tolerancia;
  poligono.forEach((p, i) => {
    const d = Math.hypot(p.x - punto.x, p.y - punto.y);
    if (d <= mejorDistancia) {
      mejorDistancia = d;
      mejorIndice = i;
    }
  });
  return mejorIndice;
}

/** Indice de la arista (i -> i+1) mas cercana a `punto` dentro de `tolerancia`, o null. Util para "insertar en arista". */
export function aristaMasCercana(poligono: Punto2D[], punto: Punto2D, tolerancia: number): number | null {
  if (poligono.length < 2) return null;
  let mejorIndice: number | null = null;
  let mejorDistancia = tolerancia;
  const n = poligono.length;
  for (let i = 0; i < n; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % n];
    const d = distanciaPuntoSegmento(punto, a, b);
    if (d <= mejorDistancia) {
      mejorDistancia = d;
      mejorIndice = i;
    }
  }
  return mejorIndice;
}

function distanciaPuntoSegmento(p: Punto2D, a: Punto2D, b: Punto2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largoCuadrado = dx * dx + dy * dy;
  if (largoCuadrado === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / largoCuadrado;
  t = Math.max(0, Math.min(1, t));
  const proyeccion = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(p.x - proyeccion.x, p.y - proyeccion.y);
}

/** Perimetro del poligono, metros. `cerrado=true` incluye la arista de vuelta al primer vertice. */
export function longitudPoligono_m(poligono: Punto2D[], cerrado = true): number {
  if (poligono.length < 2) return 0;
  const n = poligono.length;
  const limite = cerrado ? n : n - 1;
  let total = 0;
  for (let i = 0; i < limite; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}
