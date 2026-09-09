import type { LineaCad3D, PolilineaCad3D, ArcoCad3D, PuntoCad3D } from "../features/blast-pattern/components/EditorCadMalla.js";

export interface RefEntidadUni {
  tipo: "linea" | "polilinea" | "arco";
  id: string;
}

export interface ContextoCadUni {
  lineas: LineaCad3D[];
  polilineas: PolilineaCad3D[];
  arcos: ArcoCad3D[];
  capaActivaId: string;
}

export interface Punto3DUni {
  x: number;
  y: number;
  z: number;
}

/**
 * Calcula la distancia euclidiana entre dos puntos 3D.
 */
function dist(p1: Punto3DUni, p2: Punto3DUni): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y, (p2.z || 0) - (p1.z || 0));
}

/**
 * Extrae la secuencia de puntos de una entidad CAD.
 */
function extraerPuntosDeEntidad(
  ref: RefEntidadUni,
  contexto: ContextoCadUni
): Punto3DUni[] | null {
  if (ref.tipo === "linea") {
    const l = contexto.lineas.find((item) => item.id === ref.id);
    if (!l) return null;
    return [
      { x: l.p1.x, y: l.p1.y, z: l.p1.z || 0 },
      { x: l.p2.x, y: l.p2.y, z: l.p2.z || 0 },
    ];
  }

  if (ref.tipo === "polilinea") {
    const pl = contexto.polilineas.find((item) => item.id === ref.id);
    if (!pl || pl.puntos.length < 2) return null;
    return pl.puntos.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 }));
  }

  if (ref.tipo === "arco") {
    const arc = contexto.arcos.find((item) => item.id === ref.id);
    if (!arc || arc.puntos.length < 2) return null;
    return arc.puntos.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 }));
  }

  return null;
}

/**
 * Une múltiples entidades (líneas, arcos, polilíneas) en una única polilínea continua,
 * emparejando automáticamente los extremos más cercanos e invirtiendo el sentido si hace falta.
 */
export function unirEntidadesEnPolilinea(
  seleccionadas: RefEntidadUni[],
  contexto: ContextoCadUni,
  forzarCerrada: boolean
): {
  nuevaPolilinea: PolilineaCad3D;
  lineasConsumidas: string[];
  polilineasConsumidas: string[];
  arcosConsumidos: string[];
} | null {
  if (seleccionadas.length < 2) return null;

  // Extraer todos los tramos válidos
  const tramos: { id: string; tipo: "linea" | "polilinea" | "arco"; puntos: Punto3DUni[] }[] = [];

  for (const ref of seleccionadas) {
    const pts = extraerPuntosDeEntidad(ref, contexto);
    if (pts && pts.length >= 2) {
      tramos.push({ id: ref.id, tipo: ref.tipo, puntos: pts });
    }
  }

  if (tramos.length < 2) return null;

  // Algoritmo de encadenamiento continuo por extremos
  const cadenaPuntos: Punto3DUni[] = [...tramos[0].puntos];
  const tramosRestantes = tramos.slice(1);
  const TOL_EMPALME = 1.5; // tolerancia máxima de 1.5m para unir extremos cercanos

  while (tramosRestantes.length > 0) {
    const cabeza = cadenaPuntos[0];
    const cola = cadenaPuntos[cadenaPuntos.length - 1];

    let mejorIdx = -1;
    let mejorModo: "cola_inicio" | "cola_fin" | "cabeza_fin" | "cabeza_inicio" = "cola_inicio";
    let menorDist = Infinity;

    for (let i = 0; i < tramosRestantes.length; i++) {
      const pCand = tramosRestantes[i].puntos;
      const cInicio = pCand[0];
      const cFin = pCand[pCand.length - 1];

      // 1. Cola con inicio de candidato
      const d1 = dist(cola, cInicio);
      if (d1 < menorDist) {
        menorDist = d1;
        mejorIdx = i;
        mejorModo = "cola_inicio";
      }

      // 2. Cola con fin de candidato (candidato invertido)
      const d2 = dist(cola, cFin);
      if (d2 < menorDist) {
        menorDist = d2;
        mejorIdx = i;
        mejorModo = "cola_fin";
      }

      // 3. Cabeza con fin de candidato
      const d3 = dist(cabeza, cFin);
      if (d3 < menorDist) {
        menorDist = d3;
        mejorIdx = i;
        mejorModo = "cabeza_fin";
      }

      // 4. Cabeza con inicio de candidato (candidato invertido)
      const d4 = dist(cabeza, cInicio);
      if (d4 < menorDist) {
        menorDist = d4;
        mejorIdx = i;
        mejorModo = "cabeza_inicio";
      }
    }

    if (mejorIdx === -1) break;

    const [elegido] = tramosRestantes.splice(mejorIdx, 1);
    const ptsElegidos = [...elegido.puntos];

    if (mejorModo === "cola_inicio") {
      // Si el punto de empalme está muy cerca, no duplicar el vértice
      const skipFirst = dist(cola, ptsElegidos[0]) < 0.05;
      cadenaPuntos.push(...(skipFirst ? ptsElegidos.slice(1) : ptsElegidos));
    } else if (mejorModo === "cola_fin") {
      ptsElegidos.reverse();
      const skipFirst = dist(cola, ptsElegidos[0]) < 0.05;
      cadenaPuntos.push(...(skipFirst ? ptsElegidos.slice(1) : ptsElegidos));
    } else if (mejorModo === "cabeza_fin") {
      const skipLast = dist(cabeza, ptsElegidos[ptsElegidos.length - 1]) < 0.05;
      cadenaPuntos.unshift(...(skipLast ? ptsElegidos.slice(0, -1) : ptsElegidos));
    } else if (mejorModo === "cabeza_inicio") {
      ptsElegidos.reverse();
      const skipLast = dist(cabeza, ptsElegidos[ptsElegidos.length - 1]) < 0.05;
      cadenaPuntos.unshift(...(skipLast ? ptsElegidos.slice(0, -1) : ptsElegidos));
    }
  }

  // Si se fuerza cerrada y los extremos no coinciden, cerramos
  const esCerrada =
    forzarCerrada ||
    dist(cadenaPuntos[0], cadenaPuntos[cadenaPuntos.length - 1]) < 0.2;

  // Calcular longitud total
  let longTotal = 0;
  for (let i = 0; i < cadenaPuntos.length - 1; i++) {
    longTotal += dist(cadenaPuntos[i], cadenaPuntos[i + 1]);
  }
  if (esCerrada) {
    longTotal += dist(cadenaPuntos[cadenaPuntos.length - 1], cadenaPuntos[0]);
  }

  const nuevaPolilinea: PolilineaCad3D = {
    id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    puntos: cadenaPuntos.map((p) => ({
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      z: Math.round((p.z || 0) * 100) / 100,
    })),
    cerrada: esCerrada,
    capaId: contexto.capaActivaId === "capa-cresta" || contexto.capaActivaId === "capa-puntos" ? "capa-polilineas" : contexto.capaActivaId,
    tipo: "continua",
    rol: "galeria",
    longitud: Math.round(longTotal * 100) / 100,
  };

  const lineasConsumidas = seleccionadas.filter((s) => s.tipo === "linea").map((s) => s.id);
  const polilineasConsumidas = seleccionadas.filter((s) => s.tipo === "polilinea").map((s) => s.id);
  const arcosConsumidos = seleccionadas.filter((s) => s.tipo === "arco").map((s) => s.id);

  return {
    nuevaPolilinea,
    lineasConsumidas,
    polilineasConsumidas,
    arcosConsumidos,
  };
}

/**
 * Descompone (explode) una o varias polilíneas en líneas individuales independientes.
 */
export function separarPolilineaEnLineas(
  polilineas: PolilineaCad3D[],
  idsASeparar: string[]
): {
  nuevasLineas: LineaCad3D[];
  polilineasEliminadas: string[];
} {
  const nuevasLineas: LineaCad3D[] = [];
  const polilineasEliminadas: string[] = [];

  for (const pl of polilineas) {
    if (!idsASeparar.includes(pl.id)) continue;
    polilineasEliminadas.push(pl.id);

    const pts = pl.puntos;
    const n = pts.length;
    const nSeg = pl.cerrada ? n : n - 1;

    for (let i = 0; i < nSeg; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const long = Math.hypot(dx, dy);
      const az = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

      nuevasLineas.push({
        id: `lin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${i}`,
        p1: { x: p1.x, y: p1.y, z: p1.z || 0 },
        p2: { x: p2.x, y: p2.y, z: p2.z || 0 },
        capaId: pl.capaId,
        tipo: pl.tipo,
        rol: pl.rol,
        longitud: Math.round(long * 100) / 100,
        azimut: Math.round(az * 10) / 10,
      });
    }
  }

  return { nuevasLineas, polilineasEliminadas };
}

export interface CentroideResultado extends Punto3DUni {
  tipoCalculo: "centro_arco" | "centroide_area" | "centro_ponderado_linea" | "centro_caja";
  descripcion: string;
}

/**
 * Calcula el centroide de área 2D de un polígono cerrado usando el Teorema de Green (Fórmula de Gauss / Shoelace).
 * Es el centro de masa exacto para perfiles de galería, secciones de túnel y bancos mineros.
 */
function calcularCentroideAreaPoligono(puntos: Punto3DUni[]): CentroideResultado | null {
  let pts = [...puntos];
  // Si el último punto es duplicado del primero, eliminarlo para no sesgar el cálculo
  if (pts.length > 3 && dist(pts[0], pts[pts.length - 1]) < 0.02) {
    pts = pts.slice(0, pts.length - 1);
  }

  const n = pts.length;
  if (n < 3) return null;

  let areaSigned2 = 0;
  let cx = 0;
  let cy = 0;
  let sumaZ = 0;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const factor = p1.x * p2.y - p2.x * p1.y;
    areaSigned2 += factor;
    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
    sumaZ += p1.z || 0;
  }

  const area = areaSigned2 / 2;
  if (Math.abs(area) < 0.0001) return null;

  cx = cx / (6 * area);
  cy = cy / (6 * area);
  const cz = sumaZ / n;

  return {
    x: Math.round(cx * 100) / 100,
    y: Math.round(cy * 100) / 100,
    z: Math.round(cz * 100) / 100,
    tipoCalculo: "centroide_area",
    descripcion: `Centroide de área (Área = ${Math.abs(Math.round(area * 100) / 100)}m²)`,
  };
}

/**
 * Calcula el centro geométrico de precisión según el tipo de entidad:
 * 1. Arco individual: Centro de curvatura (origen geométrico del radio).
 * 2. Polilínea cerrada o conjunto de entidades que forman un contorno cerrado:
 *    Centroide de área 2D exacto mediante el Teorema de Green / Shoelace.
 * 3. Línea o curvas abiertas:
 *    Centro de masa lineal ponderado por la longitud real de cada segmento.
 * 4. Fallback: Centro de la caja envolvente (Bounding Box).
 */
export function calcularCentroideEntidades(
  seleccionadas: RefEntidadUni[],
  contexto: ContextoCadUni
): CentroideResultado | null {
  if (seleccionadas.length === 0) return null;

  // CASO 1: Un solo arco seleccionado -> Centro de curvatura (centro del círculo)
  if (seleccionadas.length === 1 && seleccionadas[0].tipo === "arco") {
    const arc = contexto.arcos.find((item) => item.id === seleccionadas[0].id);
    if (arc && arc.centro) {
      return {
        x: Math.round(arc.centro.x * 100) / 100,
        y: Math.round(arc.centro.y * 100) / 100,
        z: Math.round((arc.centro.z || 0) * 100) / 100,
        tipoCalculo: "centro_arco",
        descripcion: `Centro de curvatura del arco (Radio = ${arc.radio}m)`,
      };
    }
  }

  // CASO 2: Una sola polilínea cerrada -> Centroide de Área de Sección
  if (seleccionadas.length === 1 && seleccionadas[0].tipo === "polilinea") {
    const pl = contexto.polilineas.find((item) => item.id === seleccionadas[0].id);
    if (pl && pl.puntos.length >= 3 && pl.cerrada) {
      const centroideArea = calcularCentroideAreaPoligono(pl.puntos);
      if (centroideArea) return centroideArea;
    }
  }

  // Extraer todos los tramos seleccionados
  const tramos: Punto3DUni[][] = [];
  for (const ref of seleccionadas) {
    const pts = extraerPuntosDeEntidad(ref, contexto);
    if (pts && pts.length >= 2) {
      tramos.push(pts);
    }
  }

  if (tramos.length === 0) return null;

  // Si hay varias entidades, intentar encadenarlas para ver si forman un contorno cerrado
  if (tramos.length > 1) {
    const unionRes = unirEntidadesEnPolilinea(seleccionadas, contexto, false);
    if (unionRes && unionRes.nuevaPolilinea.puntos.length >= 3) {
      const pts = unionRes.nuevaPolilinea.puntos;
      const dCierre = dist(pts[0], pts[pts.length - 1]);
      if (dCierre < 0.6) {
        const centroideArea = calcularCentroideAreaPoligono(pts);
        if (centroideArea) return centroideArea;
      }
    }
  }

  // CASO 3: Curvas o segmentos abiertos -> Centro ponderado por longitud de arco real
  let sumaX = 0;
  let sumaY = 0;
  let sumaZ = 0;
  let longTotal = 0;

  for (const tramo of tramos) {
    for (let i = 0; i < tramo.length - 1; i++) {
      const p1 = tramo[i];
      const p2 = tramo[i + 1];
      const l = dist(p1, p2);
      if (l > 0.0001) {
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const mz = ((p1.z || 0) + (p2.z || 0)) / 2;

        sumaX += l * mx;
        sumaY += l * my;
        sumaZ += l * mz;
        longTotal += l;
      }
    }
  }

  if (longTotal > 0.0001) {
    return {
      x: Math.round((sumaX / longTotal) * 100) / 100,
      y: Math.round((sumaY / longTotal) * 100) / 100,
      z: Math.round((sumaZ / longTotal) * 100) / 100,
      tipoCalculo: "centro_ponderado_linea",
      descripcion: `Centro de masa lineal (Longitud = ${Math.round(longTotal * 10) / 10}m)`,
    };
  }

  // CASO 4: Fallback -> Centro del Bounding Box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const tramo of tramos) {
    for (const p of tramo) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      const z = p.z || 0;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  return {
    x: Math.round(((minX + maxX) / 2) * 100) / 100,
    y: Math.round(((minY + maxY) / 2) * 100) / 100,
    z: Math.round(((minZ + maxZ) / 2) * 100) / 100,
    tipoCalculo: "centro_caja",
    descripcion: "Centro de envolvente (Bounding Box)",
  };
}
