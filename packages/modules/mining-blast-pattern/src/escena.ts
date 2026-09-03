import * as THREE from "three";
import type { LayerManager } from "@suite/engine";
import type { ResultadoMallaPerforacion } from "@suite/core";
import { CAPAS, MODULO_ID } from "./etiquetas.js";

export interface OpcionesEscenaMalla {
  poligonoCresta: Array<{ x: number; y: number }>;
  cotaCresta: number;
  alturaBanco_m: number;
}

/** Factor puramente visual para que taladros delgados sigan siendo visibles a escala de banco. */
const EXAGERACION_VISUAL_DIAMETRO = 4;
const RADIO_VISUAL_MINIMO_M = 0.06;

function cilindroVertical(
  x: number,
  y: number,
  zA: number,
  zB: number,
  radio: number,
  color: string
): THREE.Mesh {
  const alto = Math.max(Math.abs(zA - zB), 0.001);
  const geo = new THREE.CylinderGeometry(radio, radio, alto, 12);
  geo.rotateX(Math.PI / 2); // eje local Y -> Z (mundo Z-up)
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
  mesh.position.set(x, y, (zA + zB) / 2);
  return mesh;
}

/**
 * Construye/actualiza las capas 3D del modulo a partir de un resultado de diseno de malla:
 * - layer.mining.blast-pattern.bench: bloque del banco (cresta -> cresta - H).
 * - layer.mining.blast-pattern.holes: tramo de taco de cada taladro.
 * - layer.mining.blast-pattern.charges: tramo de carga explosiva de cada taladro.
 */
export function construirEscenaMalla(
  layerManager: LayerManager,
  resultado: ResultadoMallaPerforacion,
  opciones: OpcionesEscenaMalla
): void {
  const capaBanco = layerManager.crearCapa({ id: CAPAS.banco, nombre: "Banco", color: "#64748b" });
  const capaTaladros = layerManager.crearCapa({ id: CAPAS.taladros, nombre: "Taladros (taco)", color: "#94a3b8" });
  const capaCargas = layerManager.crearCapa({ id: CAPAS.cargas, nombre: "Carga explosiva", color: "#f97316" });

  layerManager.limpiarCapa(CAPAS.banco);
  layerManager.limpiarCapa(CAPAS.taladros);
  layerManager.limpiarCapa(CAPAS.cargas);

  if (opciones.poligonoCresta.length >= 3) {
    const shape = new THREE.Shape(opciones.poligonoCresta.map((p) => new THREE.Vector2(p.x, p.y)));
    const geometriaBanco = new THREE.ExtrudeGeometry(shape, { depth: opciones.alturaBanco_m, bevelEnabled: false });
    geometriaBanco.translate(0, 0, opciones.cotaCresta - opciones.alturaBanco_m);

    const materialBanco = new THREE.MeshStandardMaterial({
      color: capaBanco.color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const meshBanco = new THREE.Mesh(geometriaBanco, materialBanco);
    meshBanco.userData = { moduloId: MODULO_ID, tipo: "banco" };
    capaBanco.grupo.add(meshBanco);

    const aristas = new THREE.EdgesGeometry(geometriaBanco);
    capaBanco.grupo.add(new THREE.LineSegments(aristas, new THREE.LineBasicMaterial({ color: 0x475569 })));
  }

  for (const t of resultado.taladros) {
    const radio = Math.max((t.diametroMm / 1000 / 2) * EXAGERACION_VISUAL_DIAMETRO, RADIO_VISUAL_MINIMO_M);
    const zTacoInferior = t.collar.z - t.taco_m;

    const meshTaco = cilindroVertical(t.collar.x, t.collar.y, t.collar.z, zTacoInferior, radio, capaTaladros.color);
    meshTaco.userData = { moduloId: MODULO_ID, tipo: "taladro-taco", taladroId: t.id, atributos: t };
    capaTaladros.grupo.add(meshTaco);

    const meshCarga = cilindroVertical(t.collar.x, t.collar.y, zTacoInferior, t.fondo.z, radio, capaCargas.color);
    meshCarga.userData = { moduloId: MODULO_ID, tipo: "taladro-carga", taladroId: t.id, atributos: t };
    capaCargas.grupo.add(meshCarga);
  }
}
