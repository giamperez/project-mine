import type { Punto2D } from "@suite/core";
import type { LineaCad3D, PolilineaCad3D, ArcoCad3D } from "../components/EditorCadMalla.js";

export type TipoEntidadRec = "linea" | "polilinea" | "arco" | "perfil";

export interface EntidadRecortable {
  tipo: TipoEntidadRec;
  id?: string;
  nombre: string;
}

export interface Punto3DCad {
  x: number;
  y: number;
  z?: number;
}

export interface InterseccionRecorte {
  punto: Punto3DCad;
  distanciaEnObjeto: number; // Distancia acumulada a lo largo del objeto
  indiceSegmento: number; // Índice del segmento del objeto donde intersecta
  tSegmento: number; // Parámetro [0, 1] dentro de ese segmento
}

export interface ResultadoParticion {
  tramosQueda: Punto3DCad[][];
  tramosElimina: Punto3DCad[][];
  puntosCorte: Punto3DCad[];
}

/**
 * Calcula la intersección en el plano 2D (XY) entre dos segmentos P1-P2 y P3-P4,
 * interpolando la cota Z.
 */
export function interseccionSegmentos2D(
  p1: Punto3DCad,
  p2: Punto3DCad,
  p3: Punto3DCad,
  p4: Punto3DCad
): { punto: Punto3DCad; t: number; u: number } | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;

  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;

  const t = (dx * d2y - dy * d2x) / denom;
  const u = (dx * d1y - dy * d1x) / denom;

  const EPS = 1e-4;
  if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) {
    const clampedT = Math.max(0, Math.min(1, t));
    const z1 = p1.z || 0;
    const z2 = p2.z || 0;
    return {
      punto: {
        x: Math.round((p1.x + clampedT * d1x) * 1000) / 1000,
        y: Math.round((p1.y + clampedT * d1y) * 1000) / 1000,
        z: Math.round((z1 + clampedT * (z2 - z1)) * 1000) / 1000,
      },
      t: clampedT,
      u: Math.max(0, Math.min(1, u)),
    };
  }
  return null;
}

/**
 * Obtiene los puntos ordenados de cualquier entidad CAD para análisis geométrico.
 */
export function obtenerPuntosDeEntidad(
  ent: EntidadRecortable,
  contexto: {
    lineas: LineaCad3D[];
    polilineas: PolilineaCad3D[];
    arcos: ArcoCad3D[];
    perfil: Punto2D[];
  }
): { puntos: Punto3DCad[]; cerrada: boolean } | null {
  if (ent.tipo === "linea") {
    const l = contexto.lineas.find((item) => item.id === ent.id);
    if (!l) return null;
    return {
      puntos: [
        { x: l.p1.x, y: l.p1.y, z: l.p1.z || 0 },
        { x: l.p2.x, y: l.p2.y, z: l.p2.z || 0 },
      ],
      cerrada: false,
    };
  }

  if (ent.tipo === "polilinea") {
    const pl = contexto.polilineas.find((item) => item.id === ent.id);
    if (!pl || pl.puntos.length < 2) return null;
    return {
      puntos: pl.puntos.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })),
      cerrada: pl.cerrada,
    };
  }

  if (ent.tipo === "arco") {
    const arc = contexto.arcos.find((item) => item.id === ent.id);
    if (!arc || arc.puntos.length < 2) return null;
    return {
      puntos: arc.puntos.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })),
      cerrada: false,
    };
  }

  if (ent.tipo === "perfil") {
    if (contexto.perfil.length < 3) return null;
    return {
      puntos: contexto.perfil.map((p) => ({ x: p.x, y: p.y, z: 0 })),
      cerrada: true,
    };
  }

  return null;
}

/**
 * Encuentra todas las intersecciones entre un objeto a recortar y una entidad cortante.
 */
export function calcularInterseccionesEntidades(
  puntosObjeto: Punto3DCad[],
  cerradaObjeto: boolean,
  puntosCortante: Punto3DCad[],
  cerradaCortante: boolean
): InterseccionRecorte[] {
  const intersecciones: InterseccionRecorte[] = [];

  const nObj = puntosObjeto.length;
  const nSegObj = cerradaObjeto ? nObj : nObj - 1;

  const nCort = puntosCortante.length;
  const nSegCort = cerradaCortante ? nCort : nCort - 1;

  let distAcumulada = 0;

  for (let i = 0; i < nSegObj; i++) {
    const p1 = puntosObjeto[i];
    const p2 = puntosObjeto[(i + 1) % nObj];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    for (let j = 0; j < nSegCort; j++) {
      const c1 = puntosCortante[j];
      const c2 = puntosCortante[(j + 1) % nCort];

      const res = interseccionSegmentos2D(p1, p2, c1, c2);
      if (res) {
        // Evitar duplicados cercanos (< 0.05m)
        const yaExiste = intersecciones.some(
          (exist) => Math.hypot(exist.punto.x - res.punto.x, exist.punto.y - res.punto.y) < 0.05
        );
        if (!yaExiste) {
          intersecciones.push({
            punto: res.punto,
            distanciaEnObjeto: distAcumulada + res.t * segLen,
            indiceSegmento: i,
            tSegmento: res.t,
          });
        }
      }
    }

    distAcumulada += segLen;
  }

  // Ordenar intersecciones por avance a lo largo del objeto
  intersecciones.sort((a, b) => a.distanciaEnObjeto - b.distanciaEnObjeto);
  return intersecciones;
}

/**
 * Divide la curva del objeto en tramos 'queda' (VERDE) y 'elimina' (ROJO)
 * dependiendo de si el usuario elige 'conservarInicio'.
 */
export function partirCurvaPorCortes(
  puntosObjeto: Punto3DCad[],
  cerradaObjeto: boolean,
  intersecciones: InterseccionRecorte[],
  conservarInicio: boolean
): ResultadoParticion {
  if (intersecciones.length === 0) {
    return {
      tramosQueda: [puntosObjeto],
      tramosElimina: [],
      puntosCorte: [],
    };
  }

  const puntosCorte = intersecciones.map((it) => it.punto);

  // CASO 1: Curva Abierta (Línea, Polilínea abierta, Arco)
  if (!cerradaObjeto) {
    // Tomamos el primer corte más representativo
    const corte = intersecciones[0];
    const idx = corte.indiceSegmento;

    // Tramo 1: desde el inicio hasta el corte
    const tramo1: Punto3DCad[] = [];
    for (let i = 0; i <= idx; i++) {
      tramo1.push(puntosObjeto[i]);
    }
    tramo1.push(corte.punto);

    // Tramo 2: desde el corte hasta el final
    const tramo2: Punto3DCad[] = [corte.punto];
    for (let i = idx + 1; i < puntosObjeto.length; i++) {
      tramo2.push(puntosObjeto[i]);
    }

    const tramoQueda = conservarInicio ? tramo1 : tramo2;
    const tramoElimina = conservarInicio ? tramo2 : tramo1;

    return {
      tramosQueda: [tramoQueda],
      tramosElimina: [tramoElimina],
      puntosCorte,
    };
  }

  // CASO 2: Curva Cerrada (Polilínea cerrada o Perfil de Cresta)
  // "REC detecta las intersecciones de toda la figura; una polilínea cerrada puede abrirse entre dos cortes."
  if (intersecciones.length >= 2) {
    const c1 = intersecciones[0];
    const c2 = intersecciones[intersecciones.length - 1];

    // Camino A: de c1 a c2 siguiendo el contorno interior
    const caminoA: Punto3DCad[] = [c1.punto];
    for (let i = c1.indiceSegmento + 1; i <= c2.indiceSegmento; i++) {
      caminoA.push(puntosObjeto[i]);
    }
    caminoA.push(c2.punto);

    // Camino B: de c2 a c1 pasando por el origen de la figura cerrada
    const caminoB: Punto3DCad[] = [c2.punto];
    for (let i = c2.indiceSegmento + 1; i < puntosObjeto.length; i++) {
      caminoB.push(puntosObjeto[i]);
    }
    for (let i = 0; i <= c1.indiceSegmento; i++) {
      caminoB.push(puntosObjeto[i]);
    }
    caminoB.push(c1.punto);

    // Si conserva inicio, queda el camino que contiene el punto inicial (camino B)
    const tramoQueda = conservarInicio ? caminoB : caminoA;
    const tramoElimina = conservarInicio ? caminoA : caminoB;

    return {
      tramosQueda: [tramoQueda],
      tramosElimina: [tramoElimina],
      puntosCorte,
    };
  } else {
    // Sólo 1 corte en figura cerrada: se abre en ese punto
    const corte = intersecciones[0];
    const abierta: Punto3DCad[] = [corte.punto];
    for (let i = corte.indiceSegmento + 1; i < puntosObjeto.length; i++) {
      abierta.push(puntosObjeto[i]);
    }
    for (let i = 0; i <= corte.indiceSegmento; i++) {
      abierta.push(puntosObjeto[i]);
    }
    abierta.push(corte.punto);

    return {
      tramosQueda: [abierta],
      tramosElimina: [],
      puntosCorte,
    };
  }
}
