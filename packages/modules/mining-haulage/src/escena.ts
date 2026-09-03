import * as THREE from "three";
import type { LayerManager } from "@suite/engine";
import type { EntradaAcarreo } from "@suite/core";
import { CAPAS, MODULO_ID } from "./etiquetas.js";

const ANCHO_VIA_REAL_M = 8;
/** Fraccion de la distancia total usada para el ancho/marcadores visuales: una via real de 8m es
 * imperceptible en una ruta de varios km, asi que se exagera (igual que el diametro de taladros
 * en mining.blast-pattern) — es una ayuda visual, no la dimension real. */
const FRACCION_VISUAL = 0.02;

/** Construye una vista simplificada de la ruta de acarreo: una rampa inclinada del punto de carguío al de descarga. */
export function construirEscenaRuta(layerManager: LayerManager, entrada: EntradaAcarreo): void {
  const capa = layerManager.crearCapa({ id: CAPAS.ruta, nombre: "Ruta de acarreo", color: "#78716c" });
  layerManager.limpiarCapa(CAPAS.ruta);

  const anchoVisual = Math.max(ANCHO_VIA_REAL_M, entrada.distanciaUnidireccional_m * FRACCION_VISUAL);
  const espesorVisual = anchoVisual * 0.15;
  const radioMarcador = anchoVisual * 0.6;

  const anguloRad = Math.atan(entrada.pendientePromedio_pct / 100);
  const horizontal = entrada.distanciaUnidireccional_m * Math.cos(anguloRad);
  const vertical = entrada.distanciaUnidireccional_m * Math.sin(anguloRad);

  const geoRuta = new THREE.BoxGeometry(entrada.distanciaUnidireccional_m, anchoVisual, espesorVisual);
  geoRuta.rotateY(-anguloRad);
  geoRuta.translate(horizontal / 2, 0, vertical / 2);
  const meshRuta = new THREE.Mesh(geoRuta, new THREE.MeshStandardMaterial({ color: capa.color }));
  meshRuta.userData = { moduloId: MODULO_ID, tipo: "ruta" };
  capa.grupo.add(meshRuta);

  const geoCarga = new THREE.SphereGeometry(radioMarcador, 16, 16);
  const meshCarga = new THREE.Mesh(geoCarga, new THREE.MeshStandardMaterial({ color: "#22c55e" }));
  meshCarga.position.set(0, 0, espesorVisual);
  meshCarga.userData = { moduloId: MODULO_ID, tipo: "punto-carga" };
  capa.grupo.add(meshCarga);

  const geoDescarga = new THREE.SphereGeometry(radioMarcador, 16, 16);
  const meshDescarga = new THREE.Mesh(geoDescarga, new THREE.MeshStandardMaterial({ color: "#f97316" }));
  meshDescarga.position.set(horizontal, 0, vertical + espesorVisual);
  meshDescarga.userData = { moduloId: MODULO_ID, tipo: "punto-descarga" };
  capa.grupo.add(meshDescarga);
}
