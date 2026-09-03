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
  /** Vive en la instancia, no en un ref aparte: sobrevive intacto al doble montaje de StrictMode
   * (cada SceneManager real, nuevo o reciclado, sabe por si mismo si ya se encuadro la camara). */
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

  return <div ref={contenedorRef} className="visor3d" />;
}
