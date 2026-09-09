import { useEffect, useRef } from "react";
import { SceneManager, LayerManager, type EstadoCapa } from "@suite/engine";
import { construirEscenaSuperficie, construirEscenaCurvasNivel, CAPAS } from "@suite/mining-topography";
import type { SegmentoCurvaNivel, SuperficieTIN } from "@suite/core";

interface Props {
  superficie: SuperficieTIN;
  curvasNivel: SegmentoCurvaNivel[];
  superficieReferencia?: SuperficieTIN | null;
  onCapas?: (capas: EstadoCapa[]) => void;
}

interface GestorEscena {
  scene: SceneManager;
  layers: LayerManager;
  encuadrado: boolean;
}

export default function Visor3DTopografia({ superficie, curvasNivel, superficieReferencia, onCapas }: Props) {
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
    construirEscenaSuperficie(manager.layers, superficie);
    onCapas?.(manager.layers.listarCapas());
    if (!manager.encuadrado && superficie.indices.length > 0) {
      const capa = manager.layers.obtenerCapa(CAPAS.superficie);
      if (capa) {
        manager.scene.encuadrarObjeto(capa.grupo);
        manager.encuadrado = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superficie]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    construirEscenaCurvasNivel(manager.layers, curvasNivel);
    onCapas?.(manager.layers.listarCapas());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curvasNivel]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (superficieReferencia) {
      construirEscenaSuperficie(manager.layers, superficieReferencia, {
        capaId: CAPAS.superficieReferencia,
        nombreCapa: "Superficie de referencia",
        opacidad: 0.45,
      });
    } else {
      manager.layers.limpiarCapa(CAPAS.superficieReferencia);
    }
    onCapas?.(manager.layers.listarCapas());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superficieReferencia]);

  return <div ref={contenedorRef} className="visor3d" />;
}
