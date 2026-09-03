/**
 * Utilidades geométricas para la herramienta DESFASE (OFFSET) en NAMICAD Pro.
 * Soporta:
 * - Desfase 2D paralelo Exterior / Izquierda
 * - Desfase 2D paralelo Interior / Derecha
 * - Duplicación en profundidad Z (Z matemático / Profundidad constante)
 */

export type ModoDesfase = "exterior" | "interior" | "z_matematico" | "profundidad";

export interface Punto3DSimple {
  x: number;
  y: number;
  z: number;
}

export interface ResultadoDesfaseLinea {
  tipo: "linea";
  p1: Punto3DSimple;
  p2: Punto3DSimple;
  longitud: number;
  azimut: number;
}

export interface ResultadoDesfaseArco {
  tipo: "arco";
  centro: Punto3DSimple;
  radio: number;
  anguloInicio: number;
  anguloFin: number;
}

export interface ResultadoDesfasePolilinea {
  tipo: "polilinea";
  puntos: Punto3DSimple[];
  cerrada: boolean;
  longitud: number;
}

export type ResultadoDesfase =
  | ResultadoDesfaseLinea
  | ResultadoDesfaseArco
  | ResultadoDesfasePolilinea;

export interface EntradaPunto3D {
  x: number;
  y: number;
  z?: number;
}

/**
 * Desfasa una línea individual
 */
export function desfasarLinea(
  p1: EntradaPunto3D,
  p2: EntradaPunto3D,
  distancia: number,
  modo: ModoDesfase
): ResultadoDesfaseLinea {
  const z1 = p1.z || 0;
  const z2 = p2.z || 0;

  if (modo === "z_matematico" || modo === "profundidad") {
    const deltaZ = modo === "z_matematico" ? distancia : -distancia;
    const np1 = { x: p1.x, y: p1.y, z: Math.round((z1 + deltaZ) * 100) / 100 };
    const np2 = { x: p2.x, y: p2.y, z: Math.round((z2 + deltaZ) * 100) / 100 };
    const dx = np2.x - np1.x;
    const dy = np2.y - np1.y;
    const long = Math.round(Math.hypot(dx, dy) * 100) / 100;
    const az = Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 * 10) / 10;
    return { tipo: "linea", p1: np1, p2: np2, longitud: long, azimut: az };
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);

  if (len === 0) {
    return { tipo: "linea", p1: { x: p1.x, y: p1.y, z: p1.z || 0 }, p2: { x: p2.x, y: p2.y, z: p2.z || 0 }, longitud: 0, azimut: 0 };
  }

  // Vector normal unitario hacia la izquierda (nx, ny)
  const nxIzq = -dy / len;
  const nyIzq = dx / len;

  // Si es exterior/izq: dirección +normal; si interior/der: -normal
  const signo = modo === "exterior" ? 1 : -1;
  const ox = signo * distancia * nxIzq;
  const oy = signo * distancia * nyIzq;

  const np1 = { x: Math.round((p1.x + ox) * 100) / 100, y: Math.round((p1.y + oy) * 100) / 100, z: z1 };
  const np2 = { x: Math.round((p2.x + ox) * 100) / 100, y: Math.round((p2.y + oy) * 100) / 100, z: z2 };
  const nDx = np2.x - np1.x;
  const nDy = np2.y - np1.y;
  const long = Math.round(Math.hypot(nDx, nDy) * 100) / 100;
  const az = Math.round(((Math.atan2(nDx, nDy) * 180) / Math.PI + 360) % 360 * 10) / 10;

  return { tipo: "linea", p1: np1, p2: np2, longitud: long, azimut: az };
}

/**
 * Desfasa un arco circular
 */
export function desfasarArco(
  centro: EntradaPunto3D,
  radio: number,
  anguloInicio: number,
  anguloFin: number,
  distancia: number,
  modo: ModoDesfase
): ResultadoDesfaseArco {
  if (modo === "z_matematico" || modo === "profundidad") {
    const deltaZ = modo === "z_matematico" ? distancia : -distancia;
    return {
      tipo: "arco",
      centro: { x: centro.x, y: centro.y, z: Math.round(((centro.z || 0) + deltaZ) * 100) / 100 },
      radio,
      anguloInicio,
      anguloFin,
    };
  }

  let nuevoRadio = radio;
  if (modo === "exterior") {
    nuevoRadio = Math.round((radio + distancia) * 100) / 100;
  } else {
    nuevoRadio = Math.max(0.1, Math.round((radio - distancia) * 100) / 100);
  }

  return {
    tipo: "arco",
    centro: { x: centro.x, y: centro.y, z: centro.z || 0 },
    radio: nuevoRadio,
    anguloInicio,
    anguloFin,
  };
}

/**
 * Desfasa una polilínea (abierta o cerrada)
 */
export function desfasarPolilinea(
  puntos: EntradaPunto3D[],
  cerrada: boolean,
  distancia: number,
  modo: ModoDesfase
): ResultadoDesfasePolilinea | null {
  const n = puntos.length;
  if (n < 2) return null;

  // Modo Z matemático o Profundidad minera
  if (modo === "z_matematico" || modo === "profundidad") {
    const deltaZ = modo === "z_matematico" ? distancia : -distancia;
    const nuevosPuntos = puntos.map((p) => ({
      x: p.x,
      y: p.y,
      z: Math.round(((p.z || 0) + deltaZ) * 100) / 100,
    }));
    let lTot = 0;
    const nSeg = cerrada ? n : n - 1;
    for (let i = 0; i < nSeg; i++) {
      const p1 = nuevosPuntos[i];
      const p2 = nuevosPuntos[(i + 1) % n];
      lTot += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
    return {
      tipo: "polilinea",
      puntos: nuevosPuntos,
      cerrada,
      longitud: Math.round(lTot * 100) / 100,
    };
  }

  // Modo 2D: Exterior o Interior
  // 1. Determinar orientación si es cerrada (Área con signo)
  let areaConSigno = 0;
  if (cerrada) {
    for (let i = 0; i < n; i++) {
      const p1 = puntos[i];
      const p2 = puntos[(i + 1) % n];
      areaConSigno += p1.x * p2.y - p2.x * p1.y;
    }
  }

  // En polígono cerrado CCW (área > 0), la normal izquierda (-dy, dx) apunta hacia adentro.
  // Por lo tanto: Exterior = hacia afuera (-normal), Interior = hacia adentro (+normal).
  // Si es CW (área < 0): Exterior = +normal, Interior = -normal.
  let signoGlobal = 1;
  if (cerrada) {
    const esCCW = areaConSigno > 0;
    if (modo === "exterior") {
      signoGlobal = esCCW ? -1 : 1;
    } else {
      signoGlobal = esCCW ? 1 : -1;
    }
  } else {
    // Para polilínea abierta: exterior = izquierda (+1), interior = derecha (-1)
    signoGlobal = modo === "exterior" ? 1 : -1;
  }

  // 2. Calcular rectas paralelas de cada segmento
  const nSeg = cerrada ? n : n - 1;
  interface RectaOffset {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    dx: number;
    dy: number;
  }

  const rectas: RectaOffset[] = [];
  for (let i = 0; i < nSeg; i++) {
    const p1 = puntos[i];
    const p2 = puntos[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const nx = (-dy / len) * signoGlobal * distancia;
    const ny = (dx / len) * signoGlobal * distancia;

    rectas.push({
      p1: { x: p1.x + nx, y: p1.y + ny },
      p2: { x: p2.x + nx, y: p2.y + ny },
      dx,
      dy,
    });
  }

  if (rectas.length === 0) return null;

  // 3. Intersecar rectas consecutivas
  function intersecarRectas2D(
    r1: RectaOffset,
    r2: RectaOffset
  ): { x: number; y: number } | null {
    const a1 = r1.p2.y - r1.p1.y;
    const b1 = r1.p1.x - r1.p2.x;
    const c1 = a1 * r1.p1.x + b1 * r1.p1.y;

    const a2 = r2.p2.y - r2.p1.y;
    const b2 = r2.p1.x - r2.p2.x;
    const c2 = a2 * r2.p1.x + b2 * r2.p1.y;

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-6) {
      return { x: (r1.p2.x + r2.p1.x) / 2, y: (r1.p2.y + r2.p1.y) / 2 };
    }

    const ix = (b2 * c1 - b1 * c2) / det;
    const iy = (a1 * c2 - a2 * c1) / det;

    const distMax = Math.hypot(ix - r1.p2.x, iy - r1.p2.y);
    if (distMax > distancia * 4) {
      return { x: (r1.p2.x + r2.p1.x) / 2, y: (r1.p2.y + r2.p1.y) / 2 };
    }

    return { x: ix, y: iy };
  }

  const offsetPuntos: Punto3DSimple[] = [];

  if (cerrada) {
    for (let i = 0; i < rectas.length; i++) {
      const prev = rectas[(i - 1 + rectas.length) % rectas.length];
      const curr = rectas[i];
      const inter = intersecarRectas2D(prev, curr);
      const zOrig = puntos[i]?.z || 0;
      if (inter) {
        offsetPuntos.push({
          x: Math.round(inter.x * 100) / 100,
          y: Math.round(inter.y * 100) / 100,
          z: zOrig,
        });
      }
    }
  } else {
    offsetPuntos.push({
      x: Math.round(rectas[0].p1.x * 100) / 100,
      y: Math.round(rectas[0].p1.y * 100) / 100,
      z: puntos[0]?.z || 0,
    });

    for (let i = 0; i < rectas.length - 1; i++) {
      const curr = rectas[i];
      const next = rectas[i + 1];
      const inter = intersecarRectas2D(curr, next);
      const zOrig = puntos[i + 1]?.z || 0;
      if (inter) {
        offsetPuntos.push({
          x: Math.round(inter.x * 100) / 100,
          y: Math.round(inter.y * 100) / 100,
          z: zOrig,
        });
      }
    }

    const ultRecta = rectas[rectas.length - 1];
    offsetPuntos.push({
      x: Math.round(ultRecta.p2.x * 100) / 100,
      y: Math.round(ultRecta.p2.y * 100) / 100,
      z: puntos[puntos.length - 1]?.z || 0,
    });
  }

  let totalL = 0;
  const nRes = cerrada ? offsetPuntos.length : offsetPuntos.length - 1;
  for (let i = 0; i < nRes; i++) {
    const p1 = offsetPuntos[i];
    const p2 = offsetPuntos[(i + 1) % offsetPuntos.length];
    totalL += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  return {
    tipo: "polilinea",
    puntos: offsetPuntos,
    cerrada,
    longitud: Math.round(totalL * 100) / 100,
  };
}
