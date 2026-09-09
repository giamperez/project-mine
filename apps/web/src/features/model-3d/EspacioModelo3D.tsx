import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SceneManager, LayerManager, type EstadoCapa } from "@suite/engine";
import { PanelCapas } from "../../components/shared/index.js";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import type { ProyectoModelo3D } from "./types.js";

interface Props {
  proyectoId: string;
  onVolverAlPortal: () => void;
}

type ModoVisor = "3d" | "modelar";
type TabInferior = "escena" | "importar" | "analizar" | "vista";

interface HerramientaDock {
  id: string;
  titulo: string;
  icono: ReactNode;
}

const HERRAMIENTAS_DOCK: HerramientaDock[] = [
  {
    id: "ajustes",
    titulo: "Ajustes de visualización",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    id: "terreno",
    titulo: "Superficie / terreno",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
      </svg>
    ),
  },
  {
    id: "editar",
    titulo: "Editar geometría",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    id: "capas",
    titulo: "Capas y tabla técnica",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: "exportar",
    titulo: "Exportar / descargar",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    id: "topografia",
    titulo: "Curvas de nivel",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      </svg>
    ),
  },
  {
    id: "escanear",
    titulo: "Escanear / modelar",
    icono: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect x="7" y="7" width="10" height="10" rx="1" />
      </svg>
    ),
  },
];

export default function EspacioModelo3D({ proyectoId, onVolverAlPortal }: Props) {
  const [proyectos, setProyectos] = usePersistedState<ProyectoModelo3D[]>("modelo3d.listaProyectos", []);
  const proyecto = proyectos.find((p) => p.id === proyectoId);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<{ scene: SceneManager; layers: LayerManager } | null>(null);
  const [layerManager, setLayerManager] = useState<LayerManager | null>(null);
  const [capasVersion, setCapasVersion] = useState(0);
  const [capas, setCapas] = useState<EstadoCapa[]>([]);

  const [modoVisor, setModoVisor] = useState<ModoVisor>("3d");
  const [docksVisibles, setDocksVisibles] = useState(true);
  const [tabInferior, setTabInferior] = useState<TabInferior>("escena");
  const [notificacion, setNotificacion] = useState<string | null>(null);

  useEffect(() => {
    if (!contenedorRef.current) return;
    const scene = new SceneManager({ contenedor: contenedorRef.current });
    const layers = new LayerManager(scene.escena);
    managerRef.current = { scene, layers };
    setLayerManager(layers);
    scene.iniciarLoop();
    return () => {
      scene.destruir();
      managerRef.current = null;
      setLayerManager(null);
    };
  }, []);

  useEffect(() => {
    if (!layerManager) return;
    const nuevasCapas = layerManager.listarCapas();
    setCapas(nuevasCapas);
    setProyectos((actuales) =>
      actuales.map((p) => (p.id === proyectoId ? { ...p, capas: nuevasCapas.length } : p))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerManager, capasVersion]);

  function notificar(msg: string) {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(null), 2500);
  }

  const visibles = capas.filter((c) => c.visible).length;
  const estiloAcento = { "--acento": "#38bdf8" } as CSSProperties;

  return (
    <div className="m3d-taller" style={estiloAcento}>
      {notificacion && <div className="dashboard-toast">{notificacion}</div>}

      <header className="taller-top-bar">
        <div className="taller-top-left">
          <button type="button" className="btn-taller-portal" onClick={onVolverAlPortal} title="Volver al portal">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
          <div>
            <div className="m3d-taller-nombre">{proyecto?.nombre ?? "Proyecto"}</div>
            <div className="m3d-taller-sub">MODELO 3D · {capas.length} capas</div>
          </div>
        </div>
        <div className="taller-top-right">
          <button type="button" className="btn-m3d-ocultar" onClick={() => setDocksVisibles((v) => !v)}>
            {docksVisibles ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </header>

      <div className="m3d-contador-fila">
        <span>
          <b>{visibles}</b> visibles
        </span>
        <span>
          <b>{capas.length}</b> elementos
        </span>
      </div>

      <div className="visor-modo-toggle" style={{ margin: "0 14px 8px" }}>
        <button type="button" data-activo={modoVisor === "3d"} onClick={() => setModoVisor("3d")}>
          Editar 3D
        </button>
        <button type="button" data-activo={modoVisor === "modelar"} onClick={() => setModoVisor("modelar")}>
          Modelar
        </button>
      </div>

      <div className="m3d-visor-contenedor">
        <div ref={contenedorRef} className="visor3d" />

        {docksVisibles && (
          <aside className="cad-dock-right-exact">
            {HERRAMIENTAS_DOCK.map((h) => (
              <button
                key={h.id}
                type="button"
                className="btn-dock-circle-exact"
                title={h.titulo}
                onClick={() => notificar(`${h.titulo}: próximamente`)}
              >
                {h.icono}
              </button>
            ))}
          </aside>
        )}
      </div>

      <div className="m3d-panel-inferior">
        {tabInferior === "escena" && <PanelCapas layers={layerManager} version={capasVersion} />}
        {tabInferior === "importar" && <p className="m3d-placeholder-tab">Importar geometría: próximamente.</p>}
        {tabInferior === "analizar" && <p className="m3d-placeholder-tab">Herramientas de análisis: próximamente.</p>}
        {tabInferior === "vista" && <p className="m3d-placeholder-tab">Ajustes de vista: próximamente.</p>}
      </div>

      <nav className="tabs-inferior">
        <button type="button" data-activo={tabInferior === "escena"} onClick={() => setTabInferior("escena")}>
          Escena
        </button>
        <button type="button" data-activo={tabInferior === "importar"} onClick={() => setTabInferior("importar")}>
          Importar
        </button>
        <button type="button" data-activo={tabInferior === "analizar"} onClick={() => setTabInferior("analizar")}>
          Analizar
        </button>
        <button type="button" data-activo={tabInferior === "vista"} onClick={() => setTabInferior("vista")}>
          Vista
        </button>
      </nav>
    </div>
  );
}
