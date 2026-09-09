import { useEffect, useRef } from "react";
import { SceneManager, LayerManager, type EstadoCapa } from "@suite/engine";
import { construirEscenaTalud, CAPAS } from "@suite/mining-geomechanics";
import type { EntradaEstabilidadPlanar, ResultadoEstabilidadPlanar } from "@suite/core";

interface Props {
  entrada: EntradaEstabilidadPlanar;
  resultado: ResultadoEstabilidadPlanar;
  onCapas?: (capas: EstadoCapa[]) => void;
}

interface GestorEscena {
  scene: SceneManager;
  layers: LayerManager;
  encuadrado: boolean;
}

export default function Visor3DGeomecanica({ entrada, resultado, onCapas }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<GestorEscena | null>(null);

  useEffect(() => {
    if (!contenedorRef.current) return;
    const scene = new SceneManager({ contenedor: contenedorRef.current });
    const layers = new LayerManager(scene.escena);
    managerRef.current = { scene, layers, encuadrado: false };
    scene.iniciarLoop();
    return () => {
      scene.destruir();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    construirEscenaTalud(manager.layers, entrada, resultado);
    onCapas?.(manager.layers.listarCapas());
    if (!manager.encuadrado) {
      const capa = manager.layers.obtenerCapa(CAPAS.terreno);
      if (capa) {
        manager.scene.encuadrarObjeto(capa.grupo);
        manager.encuadrado = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada, resultado]);

  return <div ref={contenedorRef} className="visor3d" />;
}
