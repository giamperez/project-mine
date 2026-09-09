import { useRef, useState } from "react";
import { usePersistedState, PREFIJO_ALMACENAMIENTO } from "../../hooks/usePersistedState.js";
import { descargarTexto } from "../../utils/descargar.js";
import type { ProyectoModelo3D } from "./types.js";

interface Props {
  onVolverDashboard: () => void;
  onAbrirTaller: (proyectoId: string) => void;
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fecha} ${hora}`;
}

function crearProyecto(nombre: string): ProyectoModelo3D {
  return { id: `modelo3d-${Date.now()}`, nombre, capas: 0, modificadoISO: new Date().toISOString() };
}

export default function PortalModelo3D({ onVolverDashboard, onAbrirTaller }: Props) {
  const [proyectos, setProyectos] = usePersistedState<ProyectoModelo3D[]>("modelo3d.listaProyectos", []);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const inputImportarRef = useRef<HTMLInputElement>(null);

  function notificar(msg: string) {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(null), 3000);
  }

  function handleNuevoProyecto() {
    const nuevo = crearProyecto(`Proyecto ${proyectos.length + 1}`);
    const listaActualizada = [nuevo, ...proyectos];
    setProyectos(listaActualizada);
    // Escritura sincrónica: el taller monta en el mismo commit y lee localStorage al abrir,
    // antes de que el efecto de usePersistedState (asíncrono) alcance a guardar el nuevo estado.
    try {
      localStorage.setItem(PREFIJO_ALMACENAMIENTO + "modelo3d.listaProyectos", JSON.stringify(listaActualizada));
    } catch {}
    onAbrirTaller(nuevo.id);
  }

  function handleEditar(p: ProyectoModelo3D, e: React.MouseEvent) {
    e.stopPropagation();
    onAbrirTaller(p.id);
  }

  function handleCompartir(p: ProyectoModelo3D, e: React.MouseEvent) {
    e.stopPropagation();
    const contenido = JSON.stringify({ formato: "namicad3d", version: 1, proyecto: p }, null, 2);
    descargarTexto(`${p.nombre.toLowerCase().replace(/\s+/g, "_")}.namicad3d`, contenido, "application/json");
    notificar(`"${p.nombre}" exportado como .namicad3d`);
  }

  function handleEliminar(p: ProyectoModelo3D, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el proyecto "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    setProyectos(proyectos.filter((item) => item.id !== p.id));
    notificar(`"${p.nombre}" eliminado.`);
  }

  function handleImportar(archivo: File) {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const data = JSON.parse(String(lector.result));
        const nombreBase = data?.proyecto?.nombre ?? archivo.name.replace(/\.[^.]+$/, "");
        const capas = typeof data?.proyecto?.capas === "number" ? data.proyecto.capas : 0;
        const nuevo: ProyectoModelo3D = { ...crearProyecto(nombreBase), capas };
        setProyectos((actuales) => [nuevo, ...actuales]);
        notificar(`Proyecto "${nombreBase}" importado.`);
      } catch {
        notificar("No se pudo leer el archivo .namicad3d (formato inválido).");
      }
    };
    lector.readAsText(archivo);
  }

  return (
    <div className="m3d-portal">
      {notificacion && <div className="dashboard-toast">{notificacion}</div>}

      <header className="m3d-portal-header">
        <button type="button" className="btn-portal-back" onClick={onVolverDashboard}>
          <span className="arrow-back">←</span>
        </button>
        <div>
          <h1 className="m3d-portal-titulo">MODELO 3D</h1>
          <p className="m3d-portal-subtitulo">Centro de visualización minera</p>
        </div>
      </header>

      <section className="m3d-hero-card">
        <div className="m3d-hero-icono">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <h2 className="m3d-hero-titulo">VISUALIZACIÓN MINERA 3D</h2>
        <p className="m3d-hero-desc">
          Modelos de bloques, sondajes, curvas de nivel y wireframes Datamine PT/TR en capas independientes.
        </p>
      </section>

      <section className="m3d-seccion">
        <h3 className="m3d-seccion-titulo">COMPARTIR / IMPORTAR PROYECTOS</h3>
        <p className="m3d-seccion-texto">
          Comparte el proyecto completo .namicad3d o expórtalo para abrir geometría y textos en software CAD/minero.
        </p>
        <button type="button" className="btn-m3d-primario" onClick={() => inputImportarRef.current?.click()}>
          IMPORTAR PROYECTO .namicad3d
          <input
            ref={inputImportarRef}
            type="file"
            accept=".namicad3d,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const a = e.target.files?.[0];
              if (a) handleImportar(a);
              e.target.value = "";
            }}
          />
        </button>
      </section>

      <section className="m3d-seccion">
        <h3 className="m3d-seccion-titulo m3d-recientes-titulo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2 2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          PROYECTOS RECIENTES
        </h3>

        {proyectos.length === 0 && (
          <p className="m3d-seccion-texto" style={{ textAlign: "center", padding: "20px 0" }}>
            No tienes proyectos todavía. Toca "+ Nuevo Proyecto" para empezar.
          </p>
        )}

        {proyectos.map((p) => (
          <div key={p.id} className="m3d-proyecto-card" onClick={() => onAbrirTaller(p.id)}>
            <div className="m3d-proyecto-icono">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div className="m3d-proyecto-info">
              <span className="m3d-proyecto-nombre">{p.nombre}</span>
              <span className="m3d-proyecto-capas">{p.capas} capas</span>
              <span className="m3d-proyecto-fecha">Modificado {formatearFecha(p.modificadoISO)}</span>
            </div>
            <div className="m3d-proyecto-acciones">
              <button type="button" className="m3d-accion-link" onClick={(e) => handleEditar(p, e)}>
                Editar
              </button>
              <button type="button" className="m3d-accion-link" onClick={(e) => handleCompartir(p, e)}>
                Compartir
              </button>
              <button type="button" className="m3d-accion-icono" title="Eliminar" onClick={(e) => handleEliminar(p, e)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </section>

      <button type="button" className="btn-m3d-nuevo-flotante" onClick={handleNuevoProyecto}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        NUEVO PROYECTO
      </button>
    </div>
  );
}
