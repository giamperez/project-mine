import * as THREE from "three";
import type { LayerManager } from "@suite/engine";
import type { SegmentoCurvaNivel, SuperficieTIN } from "@suite/core";
import { CAPAS, MODULO_ID } from "./etiquetas.js";

const PARADAS_HIPSOMETRICAS = [
  { t: 0.0, color: new THREE.Color(0x1d4ed8) },
  { t: 0.25, color: new THREE.Color(0x22c55e) },
  { t: 0.5, color: new THREE.Color(0xeab308) },
  { t: 0.75, color: new THREE.Color(0xb45309) },
  { t: 1.0, color: new THREE.Color(0xf8fafc) },
];

/** Rampa de color hipsometrica (estilo mapa topografico): azul (bajo) -> verde -> amarillo -> marron -> blanco (alto). */
function colorHipsometrico(t: number): THREE.Color {
  for (let i = 0; i < PARADAS_HIPSOMETRICAS.length - 1; i++) {
    const a = PARADAS_HIPSOMETRICAS[i];
    const b = PARADAS_HIPSOMETRICAS[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      return a.color.clone().lerp(b.color, f);
    }
  }
  return PARADAS_HIPSOMETRICAS[PARADAS_HIPSOMETRICAS.length - 1].color.clone();
}

export interface OpcionesEscenaSuperficie {
  capaId?: string;
  nombreCapa?: string;
  /** 0-1. Util para superponer una superficie de referencia semi-transparente sobre la actual. */
  opacidad?: number;
}

/** Construye/actualiza la capa de la superficie TIN, coloreada por cota (hipsometrico). */
export function construirEscenaSuperficie(
  layerManager: LayerManager,
  superficie: SuperficieTIN,
  opciones: OpcionesEscenaSuperficie = {}
): void {
  const capaId = opciones.capaId ?? CAPAS.superficie;
  const capa = layerManager.crearCapa({ id: capaId, nombre: opciones.nombreCapa ?? "Superficie", color: "#eab308" });
  layerManager.limpiarCapa(capaId);

  if (superficie.indices.length === 0) return;

  const zValores = superficie.puntos.map((p) => p.z);
  const zMin = Math.min(...zValores);
  const zMax = Math.max(...zValores);
  const rango = zMax - zMin || 1;

  const posiciones = new Float32Array(superficie.indices.length * 3);
  const colores = new Float32Array(superficie.indices.length * 3);

  superficie.indices.forEach((idx, i) => {
    const p = superficie.puntos[idx];
    posiciones[i * 3] = p.x;
    posiciones[i * 3 + 1] = p.y;
    posiciones[i * 3 + 2] = p.z;
    const color = colorHipsometrico((p.z - zMin) / rango);
    colores[i * 3] = color.r;
    colores[i * 3 + 1] = color.g;
    colores[i * 3 + 2] = color.b;
  });

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  geometria.computeVertexNormals();

  const opacidad = opciones.opacidad ?? 1;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: opacidad < 1,
    opacity: opacidad,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geometria, material);
  mesh.userData = { moduloId: MODULO_ID, tipo: "superficie-tin" };
  capa.grupo.add(mesh);
}

/** Construye/actualiza la capa de curvas de nivel como segmentos de linea, levemente elevados sobre la superficie. */
export function construirEscenaCurvasNivel(layerManager: LayerManager, segmentos: SegmentoCurvaNivel[]): void {
  const capa = layerManager.crearCapa({ id: CAPAS.curvasNivel, nombre: "Curvas de nivel", color: "#38bdf8" });
  layerManager.limpiarCapa(CAPAS.curvasNivel);
  if (segmentos.length === 0) return;

  const posiciones = new Float32Array(segmentos.length * 2 * 3);
  segmentos.forEach((s, i) => {
    posiciones[i * 6] = s.a.x;
    posiciones[i * 6 + 1] = s.a.y;
    posiciones[i * 6 + 2] = s.cota + 0.05;
    posiciones[i * 6 + 3] = s.b.x;
    posiciones[i * 6 + 4] = s.b.y;
    posiciones[i * 6 + 5] = s.cota + 0.05;
  });
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x0ea5e9 });
  const lineas = new THREE.LineSegments(geometria, material);
  lineas.userData = { moduloId: MODULO_ID, tipo: "curvas-nivel" };
  capa.grupo.add(lineas);
}
