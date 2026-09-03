/** Utilidades geometricas 2D usadas para generar la grilla de taladros dentro del poligono del banco. */

export interface Punto2D {
  x: number;
  y: number;
}

/** Ray casting: true si el punto esta dentro del poligono (incluye tolerancia en el borde). */
export function puntoEnPoligono(p: Punto2D, poligono: Punto2D[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const xi = poligono[i].x;
    const yi = poligono[i].y;
    const xj = poligono[j].x;
    const yj = poligono[j].y;
    const cruzaY = yi > p.y !== yj > p.y;
    if (cruzaY) {
      const xInterseccion = ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
      if (p.x < xInterseccion) dentro = !dentro;
    }
  }
  return dentro;
}

export function normalizar(v: Punto2D): Punto2D {
  const largo = Math.hypot(v.x, v.y);
  if (largo === 0) return { x: 0, y: 0 };
  return { x: v.x / largo, y: v.y / largo };
}

export function centroide(poligono: Punto2D[]): Punto2D {
  const n = poligono.length;
  const suma = poligono.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: suma.x / n, y: suma.y / n };
}

/**
 * Construye un marco local (u = a lo largo de la cara libre, v = perpendicular hacia adentro
 * del banco = direccion del burden) a partir del primer segmento del poligono (vertices 0-1),
 * que se asume es la cara libre principal.
 */
export function marcoLocalDesdeCaraLibre(poligono: Punto2D[]): {
  origen: Punto2D;
  u: Punto2D;
  v: Punto2D;
} {
  const origen = poligono[0];
  const p1 = poligono[1];
  const u = normalizar({ x: p1.x - origen.x, y: p1.y - origen.y });
  // perpendicular a u (rotacion 90°); se orienta hacia el centroide del poligono (hacia "adentro")
  let v: Punto2D = { x: -u.y, y: u.x };
  const c = centroide(poligono);
  const haciaCentro = { x: c.x - origen.x, y: c.y - origen.y };
  if (v.x * haciaCentro.x + v.y * haciaCentro.y < 0) {
    v = { x: -v.x, y: -v.y };
  }
  return { origen, u, v };
}

export function aMundoXY(origen: Punto2D, u: Punto2D, v: Punto2D, coordU: number, coordV: number): Punto2D {
  return {
    x: origen.x + u.x * coordU + v.x * coordV,
    y: origen.y + u.y * coordU + v.y * coordV,
  };
}
