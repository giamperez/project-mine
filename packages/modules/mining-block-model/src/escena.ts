import * as THREE from "three";
import { viridis, type LayerManager, type Wireframe3D } from "@suite/engine";
import type { ColarSondaje, CompositoEnsayo, ModeloBloques } from "@suite/core";
import { puntoEnSondaje } from "@suite/core";
import { CAPAS, MODULO_ID, idCapaWireframe } from "./etiquetas.js";

export interface RangoLey {
  min: number;
  max: number;
}

/** Mapa de color viridis (perceptualmente uniforme, apto para daltonismo). Mismo lenguaje visual que mining.blasting. */
function colorPorValor(valor: number, rango: RangoLey): THREE.Color {
  const frac = rango.max > rango.min ? Math.min(Math.max((valor - rango.min) / (rango.max - rango.min), 0), 1) : 0.5;
  const { r, g, b } = viridis(frac);
  return new THREE.Color(r, g, b);
}

const RADIO_SONDAJE_VISUAL_M = 0.6;

/** Dibuja cada sondaje: traza completa (gris, contexto) + un cilindro coloreado por ley por cada composito. */
export function construirEscenaSondajes(
  layerManager: LayerManager,
  colares: ColarSondaje[],
  compositos: CompositoEnsayo[],
  rangoLey: RangoLey
): void {
  const capa = layerManager.crearCapa({ id: CAPAS.sondajes, nombre: "Sondajes", color: "#94a3b8" });
  layerManager.limpiarCapa(CAPAS.sondajes);

  for (const collar of colares) {
    const azimut = collar.azimut_grados ?? 0;
    const inclinacion = collar.inclinacion_grados ?? -90;
    const fondo = puntoEnSondaje(collar, azimut, inclinacion, collar.profundidadTotal_m);

    const geoTraza = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(collar.x, collar.y, collar.z),
      new THREE.Vector3(fondo.x, fondo.y, fondo.z),
    ]);
    const lineaTraza = new THREE.Line(geoTraza, new THREE.LineBasicMaterial({ color: 0x475569 }));
    lineaTraza.userData = { moduloId: MODULO_ID, tipo: "traza-sondaje", sondajeId: collar.id };
    capa.grupo.add(lineaTraza);

    for (const c of compositos.filter((x) => x.sondajeId === collar.id)) {
      const a = puntoEnSondaje(collar, azimut, inclinacion, c.desde_m);
      const b = puntoEnSondaje(collar, azimut, inclinacion, c.hasta_m);
      const centro = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      const alto = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.01;

      const geo = new THREE.CylinderGeometry(RADIO_SONDAJE_VISUAL_M, RADIO_SONDAJE_VISUAL_M, alto, 8);
      // orienta el cilindro (eje local Y) a lo largo de la direccion real del tramo a->b
      const direccion = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direccion));

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorPorValor(c.ley, rangoLey) }));
      mesh.position.copy(centro);
      mesh.userData = { moduloId: MODULO_ID, tipo: "composito", sondajeId: collar.id, atributos: c };
      capa.grupo.add(mesh);
    }
  }
}

export type ModoColorBloques = "ley" | "varianza";

/**
 * Dibuja los bloques (que superen leyCorte) como un unico InstancedMesh — eficiente para miles de
 * bloques. El corte de visibilidad SIEMPRE es por ley (es el criterio real: "que bloques son
 * mena"), pero el COLOR puede mostrar la ley o, si el modelo se interpolo por kriging, la varianza
 * de kriging (incertidumbre de la estimacion) — util para ver donde el modelo es menos confiable
 * (tipicamente lejos de sondajes).
 */
export function construirEscenaBloques(
  layerManager: LayerManager,
  modelo: ModeloBloques,
  leyCorte: number,
  rangoLey: RangoLey,
  modoColor: ModoColorBloques = "ley",
  rangoVarianza?: RangoLey
): void {
  const nombreCapa = modoColor === "varianza" ? "Bloques (varianza de kriging)" : "Bloques (sobre ley de corte)";
  const capa = layerManager.crearCapa({ id: CAPAS.bloques, nombre: nombreCapa, color: "#eab308" });
  layerManager.limpiarCapa(CAPAS.bloques);

  const bloquesVisibles = modelo.bloques.filter((b) => b.ley !== null && (b.ley as number) >= leyCorte);
  if (bloquesVisibles.length === 0) return;

  const usarVarianza = modoColor === "varianza" && !!rangoVarianza;

  const { tamanoBloque } = modelo.definicion;
  const geometria = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const instanced = new THREE.InstancedMesh(geometria, material, bloquesVisibles.length);
  instanced.userData = { moduloId: MODULO_ID, tipo: "bloques-instanciados" };

  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const escala = new THREE.Vector3(tamanoBloque.x * 0.92, tamanoBloque.y * 0.92, tamanoBloque.z * 0.92);
  const rotacion = new THREE.Quaternion();
  const color = new THREE.Color();

  bloquesVisibles.forEach((b, idx) => {
    posicion.set(b.centro.x, b.centro.y, b.centro.z);
    matriz.compose(posicion, rotacion, escala);
    instanced.setMatrixAt(idx, matriz);
    const valor = usarVarianza && b.varianzaKriging != null ? b.varianzaKriging : (b.ley as number);
    const rango = usarVarianza && b.varianzaKriging != null ? (rangoVarianza as RangoLey) : rangoLey;
    color.copy(colorPorValor(valor, rango));
    instanced.setColorAt(idx, color);
  });
  instanced.instanceMatrix.needsUpdate = true;
  if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

  capa.grupo.add(instanced);
}

const COLORES_WIREFRAME = ["#f97316", "#38bdf8", "#a3e635", "#e879f9", "#facc15", "#4ade80"];

/**
 * Dibuja cada wireframe importado (Datamine PT/TR) en su propia capa, para poder mostrar/ocultar
 * cada solido de forma independiente en el panel de capas.
 */
export function construirEscenaWireframes(layerManager: LayerManager, wireframes: Wireframe3D[]): void {
  wireframes.forEach((wf, idx) => {
    const id = idCapaWireframe(wf.id);
    const color = COLORES_WIREFRAME[idx % COLORES_WIREFRAME.length];
    const capa = layerManager.crearCapa({ id, nombre: wf.nombre, color, carpeta: "Wireframes", tipo: "wireframe" });
    layerManager.limpiarCapa(id);

    const posiciones = new Float32Array(wf.vertices.length * 3);
    wf.vertices.forEach((v, i) => {
      posiciones[i * 3] = v.x;
      posiciones[i * 3 + 1] = v.y;
      posiciones[i * 3 + 2] = v.z;
    });
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
    geometria.setIndex(wf.triangulos.flat());
    geometria.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometria,
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    mesh.userData = { moduloId: MODULO_ID, tipo: "wireframe", wireframeId: wf.id };
    capa.grupo.add(mesh);
  });
}
