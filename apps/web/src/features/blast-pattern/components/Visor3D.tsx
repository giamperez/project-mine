import { useEffect, useRef } from "react";
import { SceneManager, LayerManager, type EstadoCapa } from "@suite/engine";
import { construirEscenaMalla, type OpcionesEscenaMalla } from "@suite/mining-blast-pattern";
import { construirEscenaSecuencia, SecuenciaAnimador } from "@suite/mining-blasting";
import type { ResultadoMallaPerforacion, ResultadoVoladura } from "@suite/core";

interface Props {
  resultado: ResultadoMallaPerforacion;
  opciones: OpcionesEscenaMalla;
  resultadoVoladura?: ResultadoVoladura;
  tiempoAnimacion_ms?: number;
  onCapas?: (capas: EstadoCapa[]) => void;
}

interface GestorEscena {
  scene: SceneManager;
  layers: LayerManager;
  encuadrado: boolean;
}

export default function Visor3D({ resultado, opciones, resultadoVoladura, tiempoAnimacion_ms, onCapas }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<GestorEscena | null>(null);
  const animadorRef = useRef<SecuenciaAnimador | null>(null);

  useEffect(() => {
    if (!contenedorRef.current) return;
    const scene = new SceneManager({ contenedor: contenedorRef.current });
    const layers = new LayerManager(scene.escena);
    managerRef.current = { scene, layers, encuadrado: false };
    scene.iniciarLoop();
    return () => {
      scene.destruir();
      managerRef.current = null;
      animadorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    construirEscenaMalla(manager.layers, resultado, opciones);
    onCapas?.(manager.layers.listarCapas());
    if (!manager.encuadrado && resultado.taladros.length > 0) {
      const capaBanco = manager.layers.obtenerCapa("layer.mining.blast-pattern.bench");
      if (capaBanco) {
        manager.scene.encuadrarObjeto(capaBanco.grupo);
        manager.encuadrado = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, opciones]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !resultadoVoladura) return;
    animadorRef.current = construirEscenaSecuencia(manager.layers, resultadoVoladura, resultado.taladros);
    onCapas?.(manager.layers.listarCapas());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultadoVoladura]);

  useEffect(() => {
    animadorRef.current?.actualizarTiempo(tiempoAnimacion_ms ?? 0);
  }, [tiempoAnimacion_ms]);

  function encuadrar() {
    const manager = managerRef.current;
    if (!manager) return;
    const capaBanco = manager.layers.obtenerCapa("layer.mining.blast-pattern.bench");
    if (capaBanco) {
      manager.scene.encuadrarObjeto(capaBanco.grupo);
    } else {
      manager.scene.encuadrarObjeto(manager.scene.escena);
    }
  }

  function zoomIn() {
    const manager = managerRef.current;
    if (!manager) return;
    const { camara, controles } = manager.scene;
    camara.position.lerp(controles.target, 0.2);
    controles.update();
  }

  function zoomOut() {
    const manager = managerRef.current;
    if (!manager) return;
    const { camara, controles } = manager.scene;
    const dir = camara.position.clone().sub(controles.target).normalize();
    camara.position.addScaledVector(dir, 8);
    controles.update();
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={contenedorRef} className="visor3d" />

      {/* Herramientas flotantes de vista 3D */}
      <div className="visor3d-floating-tools">
        <button type="button" onClick={zoomIn} title="Acercar (+ o Rueda del mouse)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button type="button" onClick={zoomOut} title="Alejar (- o Rueda del mouse)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button type="button" onClick={encuadrar} title="Re-encuadrar vista 3D">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>

      <div className="visor3d-hint">
        <span>💡 Rueda del mouse: Zoom · Click izq: Rotar · Click der: Desplazar</span>
      </div>
    </div>
  );
}
