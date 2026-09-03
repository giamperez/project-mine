import { useEffect, useRef } from "react";
import { SceneManager, LayerManager, type EstadoCapa } from "@suite/engine";
import { construirEscenaRuta, CAPAS } from "@suite/mining-haulage";
import type { EntradaAcarreo } from "@suite/core";

interface Props {
  entrada: EntradaAcarreo;
  onCapas?: (capas: EstadoCapa[]) => void;
}

interface GestorEscena {
  scene: SceneManager;
  layers: LayerManager;
  encuadrado: boolean;
}

export default function Visor3DAcarreo({ entrada, onCapas }: Props) {
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
    construirEscenaRuta(manager.layers, entrada);
    onCapas?.(manager.layers.listarCapas());
    if (!manager.encuadrado) {
      const capa = manager.layers.obtenerCapa(CAPAS.ruta);
      if (capa) {
        manager.scene.encuadrarObjeto(capa.grupo);
        manager.encuadrado = true;
      }
    } else {
      const capa = manager.layers.obtenerCapa(CAPAS.ruta);
      if (capa) manager.scene.encuadrarObjeto(capa.grupo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada]);

  return <div ref={contenedorRef} className="visor3d" />;
}
