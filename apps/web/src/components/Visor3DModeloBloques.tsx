import { useEffect, useMemo, useRef, useState } from "react";
import { SceneManager, LayerManager, type EstadoCapa } from "@suite/engine";
import { construirEscenaSondajes, construirEscenaBloques, CAPAS, type ModoColorBloques, type RangoLey } from "@suite/mining-block-model";
import type { ColarSondaje, CompositoEnsayo, ModeloBloques } from "@suite/core";

interface Props {
  colares: ColarSondaje[];
  compositos: CompositoEnsayo[];
  modelo: ModeloBloques;
  leyCorte: number;
  rangoLey: RangoLey;
  /** true si el modelo se interpolo por kriging (habilita el modo de color "Varianza"). */
  esKriging: boolean;
  onCapas?: (capas: EstadoCapa[]) => void;
  /** Entrega el LayerManager de esta escena una vez creado, para paneles externos (PanelCapas). */
  onGestorCapas?: (layers: LayerManager | null) => void;
}

interface GestorEscena {
  scene: SceneManager;
  layers: LayerManager;
  encuadrado: boolean;
}

export default function Visor3DModeloBloques({
  colares,
  compositos,
  modelo,
  leyCorte,
  rangoLey,
  esKriging,
  onCapas,
  onGestorCapas,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<GestorEscena | null>(null);
  const [modoColor, setModoColor] = useState<ModoColorBloques>("ley");

  const [planoCotaActivo, setPlanoCotaActivo] = useState(false);
  const [cotaCentral, setCotaCentral] = useState(0);
  const [rangoAbajo, setRangoAbajo] = useState(5);
  const [rangoArriba, setRangoArriba] = useState(5);

  const rangoVarianza = useMemo(() => {
    const varianzas = modelo.bloques.map((b) => b.varianzaKriging).filter((v): v is number => v !== null && v !== undefined);
    return varianzas.length > 0 ? { min: Math.min(...varianzas), max: Math.max(...varianzas) } : null;
  }, [modelo]);

  const modoColorEfectivo: ModoColorBloques = esKriging && modoColor === "varianza" ? "varianza" : "ley";

  useEffect(() => {
    if (!contenedorRef.current) return;
    const scene = new SceneManager({ contenedor: contenedorRef.current });
    const layers = new LayerManager(scene.escena);
    managerRef.current = { scene, layers, encuadrado: false };
    onGestorCapas?.(layers);
    scene.iniciarLoop();
    return () => {
      scene.destruir();
      managerRef.current = null;
      onGestorCapas?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    construirEscenaSondajes(manager.layers, colares, compositos, rangoLey);
    construirEscenaBloques(manager.layers, modelo, leyCorte, rangoLey, modoColorEfectivo, rangoVarianza ?? undefined);
    onCapas?.(manager.layers.listarCapas());
    if (!manager.encuadrado) {
      const capa = manager.layers.obtenerCapa(CAPAS.sondajes);
      if (capa) {
        manager.scene.encuadrarObjeto(capa.grupo);
        manager.encuadrado = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colares, compositos, modelo, leyCorte, rangoLey, modoColorEfectivo, rangoVarianza]);

  function aplicarCorteVisual() {
    const manager = managerRef.current;
    if (!manager) return;
    manager.scene.establecerPlanoCota(
      planoCotaActivo ? { zMin: cotaCentral - rangoAbajo, zMax: cotaCentral + rangoArriba } : null
    );
  }

  useEffect(() => {
    aplicarCorteVisual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoCotaActivo, cotaCentral, rangoAbajo, rangoArriba]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {esKriging && (
        <div className="visor-modo-toggle" style={{ position: "absolute", top: 8, left: 8, zIndex: 1, width: "auto" }}>
          <button type="button" data-activo={modoColor === "ley"} onClick={() => setModoColor("ley")}>
            Ley
          </button>
          <button type="button" data-activo={modoColor === "varianza"} onClick={() => setModoColor("varianza")}>
            Varianza (kriging)
          </button>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: esKriging ? 48 : 8,
          right: 8,
          zIndex: 1,
          width: 220,
          background: "rgba(18, 22, 28, 0.9)",
          backdropFilter: "blur(4px)",
          border: "1px solid var(--borde)",
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <input type="checkbox" checked={planoCotaActivo} onChange={(e) => setPlanoCotaActivo(e.target.checked)} />
          Plano de cota (corte visual)
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: planoCotaActivo ? 1 : 0.5 }}>
          <label>
            Cota central
            <input
              type="number"
              disabled={!planoCotaActivo}
              value={cotaCentral}
              onChange={(e) => setCotaCentral(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <label style={{ flex: 1 }}>
              Abajo (m)
              <input
                type="number"
                disabled={!planoCotaActivo}
                min={0}
                value={rangoAbajo}
                onChange={(e) => setRangoAbajo(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ flex: 1 }}>
              Arriba (m)
              <input
                type="number"
                disabled={!planoCotaActivo}
                min={0}
                value={rangoArriba}
                onChange={(e) => setRangoArriba(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </div>
      </div>

      <div ref={contenedorRef} className="visor3d" />
    </div>
  );
}
