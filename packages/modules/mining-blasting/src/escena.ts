import * as THREE from "three";
import { viridis, type LayerManager, type EstadoCapa } from "@suite/engine";
import type { ResultadoVoladura, Taladro } from "@suite/core";
import { CAPAS, MODULO_ID } from "./etiquetas.js";

interface MarcadorSecuencia {
  taladroId: string;
  tiempoDetonacion_ms: number;
  mesh: THREE.Mesh;
}

const VENTANA_DESTELLO_MS = 150;

/**
 * Controla la animacion de reproduccion de la secuencia de iniciacion: dado un tiempo "actual"
 * (en la linea de tiempo de la voladura, no en tiempo real de reloj), ilumina cada marcador al
 * momento de su detonacion y lo deja "apagado" despues.
 */
export class SecuenciaAnimador {
  private marcadores: MarcadorSecuencia[] = [];

  constructor(readonly capa: EstadoCapa) {}

  establecerMarcadores(marcadores: MarcadorSecuencia[]): void {
    this.marcadores = marcadores;
  }

  actualizarTiempo(tiempoActual_ms: number): void {
    for (const m of this.marcadores) {
      const material = m.mesh.material as THREE.MeshStandardMaterial;
      const delta = tiempoActual_ms - m.tiempoDetonacion_ms;
      if (delta >= 0 && delta < VENTANA_DESTELLO_MS) {
        const t = 1 - delta / VENTANA_DESTELLO_MS;
        material.emissiveIntensity = 0.3 + 2.5 * t;
        m.mesh.scale.setScalar(1 + 1.5 * t);
      } else {
        material.emissiveIntensity = 0.15;
        m.mesh.scale.setScalar(1);
      }
    }
  }
}

/** Mapa de color viridis (perceptualmente uniforme, apto para daltonismo) tipo "mapa de isocronas": morado oscuro (temprano) -> amarillo (tardio). */
function colorPorTiempo(t: number, tMax: number): THREE.Color {
  const frac = tMax > 0 ? THREE.MathUtils.clamp(t / tMax, 0, 1) : 0;
  const { r, g, b } = viridis(frac);
  return new THREE.Color(r, g, b);
}

/**
 * Construye la capa de marcadores de secuencia (uno por taladro, sobre su collar) coloreados
 * segun su tiempo de detonacion, y devuelve un animador para reproducir la secuencia.
 */
export function construirEscenaSecuencia(
  layerManager: LayerManager,
  resultado: ResultadoVoladura,
  taladros: Taladro[]
): SecuenciaAnimador {
  const capa = layerManager.crearCapa({ id: CAPAS.secuencia, nombre: "Secuencia de iniciación", color: "#38bdf8" });
  layerManager.limpiarCapa(CAPAS.secuencia);

  const collarPorId = new Map(taladros.map((t) => [t.id, t.collar]));
  const marcadores: MarcadorSecuencia[] = [];

  for (const carga of resultado.cargas) {
    const collar = collarPorId.get(carga.taladroId);
    if (!collar) continue;
    const color = colorPorTiempo(carga.tiempoDetonacion_ms, resultado.duracionTotalSecuencia_ms);
    const geometria = new THREE.SphereGeometry(0.35, 12, 12);
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 });
    const mesh = new THREE.Mesh(geometria, material);
    mesh.position.set(collar.x, collar.y, collar.z + 0.6);
    mesh.userData = { moduloId: MODULO_ID, tipo: "marcador-secuencia", taladroId: carga.taladroId, atributos: carga };
    capa.grupo.add(mesh);
    marcadores.push({ taladroId: carga.taladroId, tiempoDetonacion_ms: carga.tiempoDetonacion_ms, mesh });
  }

  const animador = new SecuenciaAnimador(capa);
  animador.establecerMarcadores(marcadores);
  return animador;
}
