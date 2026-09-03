import * as THREE from "three";
import type { LayerManager } from "@suite/engine";
import type { EntradaEstabilidadPlanar, ResultadoEstabilidadPlanar } from "@suite/core";
import { CAPAS, MODULO_ID } from "./etiquetas.js";

const ANCHO_EXTRUSION_M = 12;

// Paleta Okabe & Ito (2008, "Color Universal Design") en vez de rojo/amarillo/VERDE: rojo-verde es
// el par que menos se distingue en deuteranopia/protanopia (~8% de los hombres), justo el tipo de
// confusion mas riesgosa en un indicador de "inestable vs estable". Vermellon/ambar/azul se
// distinguen entre si incluso con las formas mas comunes de daltonismo.
function colorPorFS(fs: number): string {
  if (fs < 1) return "#d55e00"; // vermellon: inestable
  if (fs < 1.3) return "#e69f00"; // ambar: marginal
  return "#0072b2"; // azul: estable
}

/** Construye un THREE.Shape a partir de puntos (x=horizontal, z=elevacion) y lo extruye en Y (ancho del talud). */
function extruirPerfilVertical(puntos: Array<{ x: number; z: number }>, ancho: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(puntos.map((p) => new THREE.Vector2(p.x, p.z)));
  const geometria = new THREE.ExtrudeGeometry(shape, { depth: ancho, bevelEnabled: false });
  geometria.rotateX(Math.PI / 2); // local (x,y,z_extrude) -> mundo (x, -z_extrude, y=elevacion)
  geometria.translate(0, ancho / 2, 0); // centra el ancho en Y=[-ancho/2, ancho/2], igual que el plano de falla
  return geometria;
}

/**
 * Construye la escena 3D del talud: un bloque de "terreno" de contexto (gris) y la cuna
 * potencialmente deslizante (triangulo cara-plano de falla-tope), coloreada segun el factor de
 * seguridad calculado (verde >=1.3, ambar 1.0-1.3, rojo <1.0).
 */
export function construirEscenaTalud(
  layerManager: LayerManager,
  entrada: EntradaEstabilidadPlanar,
  resultado: ResultadoEstabilidadPlanar
): void {
  const capaTerreno = layerManager.crearCapa({ id: CAPAS.terreno, nombre: "Terreno", color: "#64748b" });
  const capaCuna = layerManager.crearCapa({ id: CAPAS.cuna, nombre: "Cuña (color = FS)", color: colorPorFS(resultado.factorSeguridad) });
  const capaPlano = layerManager.crearCapa({ id: CAPAS.planoFalla, nombre: "Plano de falla", color: "#0ea5e9" });

  layerManager.limpiarCapa(CAPAS.terreno);
  layerManager.limpiarCapa(CAPAS.cuna);
  layerManager.limpiarCapa(CAPAS.planoFalla);

  const H = entrada.alturaTalud_m;
  const psiF = (entrada.anguloCaraTalud_grados * Math.PI) / 180;
  const psiP = (entrada.anguloPlanoFalla_grados * Math.PI) / 180;

  const toe = { x: 0, z: 0 };
  const crest = { x: H / Math.tan(psiF), z: H };
  const planePt = { x: H / Math.tan(psiP), z: H };
  const margen = Math.max(H * 0.35, 3);
  const toeBottom = { x: 0, z: -margen };
  const backBottom = { x: planePt.x + margen, z: -margen };
  const backTop = { x: planePt.x + margen, z: H };

  // Cuña potencialmente deslizante: cara del talud - plano de falla - tope.
  const geoCuna = extruirPerfilVertical([toe, crest, planePt], ANCHO_EXTRUSION_M);
  const matCuna = new THREE.MeshStandardMaterial({ color: capaCuna.color, side: THREE.DoubleSide });
  const meshCuna = new THREE.Mesh(geoCuna, matCuna);
  meshCuna.userData = { moduloId: MODULO_ID, tipo: "cuna", atributos: resultado };
  capaCuna.grupo.add(meshCuna);

  // Resto del macizo (contexto visual): detras/debajo del plano de falla.
  const geoTerreno = extruirPerfilVertical([toe, toeBottom, backBottom, backTop, planePt], ANCHO_EXTRUSION_M);
  const matTerreno = new THREE.MeshStandardMaterial({ color: capaTerreno.color, side: THREE.DoubleSide });
  const meshTerreno = new THREE.Mesh(geoTerreno, matTerreno);
  meshTerreno.userData = { moduloId: MODULO_ID, tipo: "terreno" };
  capaTerreno.grupo.add(meshTerreno);

  // Plano de falla resaltado (superficie semi-transparente sobre la cara de la cuna).
  const geometriaPlano = new THREE.BufferGeometry();
  const mitad = ANCHO_EXTRUSION_M / 2;
  const vertices = new Float32Array([
    toe.x, -mitad, toe.z,
    toe.x, mitad, toe.z,
    planePt.x, mitad, planePt.z,
    toe.x, -mitad, toe.z,
    planePt.x, mitad, planePt.z,
    planePt.x, -mitad, planePt.z,
  ]);
  geometriaPlano.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometriaPlano.computeVertexNormals();
  const matPlano = new THREE.MeshStandardMaterial({
    color: capaPlano.color,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const meshPlano = new THREE.Mesh(geometriaPlano, matPlano);
  meshPlano.userData = { moduloId: MODULO_ID, tipo: "plano-falla" };
  capaPlano.grupo.add(meshPlano);
}
