import { useEffect, useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import AnimacionModulo3D from "../../components/shared/AnimacionModulo3D.js";
import { type ProyectoVoladura, PROYECTOS_VOLADURA_INICIALES } from "./proyectosVoladura.js";

const COLOR_VOLADURA = "#f43f5e";

interface HubVoladuraProps {
  onVolverDashboard: () => void;
  onAbrirProyecto: (proyecto: ProyectoVoladura) => void;
  onNuevoProyecto: () => void;
}

export default function HubVoladura({ onVolverDashboard, onAbrirProyecto, onNuevoProyecto }: HubVoladuraProps) {
  const [proyectos, setProyectos] = usePersistedState<ProyectoVoladura[]>(
    "voladura.proyectosLista",
    () => PROYECTOS_VOLADURA_INICIALES
  );
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [horaLocal, setHoraLocal] = useState("09:41");

  useEffect(() => {
    const now = new Date();
    setHoraLocal(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);

  function notificar(msg: string) {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(null), 3000);
  }

  function handleDuplicar(p: ProyectoVoladura, e: React.MouseEvent) {
    e.stopPropagation();
    const ahora = new Date().toISOString();
    const nuevo: ProyectoVoladura = {
      ...p,
      id: "vol-" + Math.random().toString(36).substr(2, 9),
      nombre: `${p.nombre} (Copia)`,
      fechaCreacion: ahora,
      fechaModificacion: ahora,
    };
    setProyectos([nuevo, ...proyectos]);
    notificar(`Copia de "${p.nombre}" creada.`);
  }

  function handleBorrar(p: ProyectoVoladura, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm(`¿Estás seguro de eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) {
      setProyectos(proyectos.filter((item) => item.id !== p.id));
      notificar(`"${p.nombre}" eliminada.`);
    }
  }

  function formatearFechaHora(isoStr: string) {
    try {
      const d = new Date(isoStr);
      const dia = d.getDate().toString().padStart(2, "0");
      const mes = (d.getMonth() + 1).toString().padStart(2, "0");
      const anio = d.getFullYear();
      const hora = d.getHours().toString().padStart(2, "0");
      const min = d.getMinutes().toString().padStart(2, "0");
      return `${dia}/${mes}/${anio} · ${hora}:${min}`;
    } catch {
      return "—";
    }
  }

  const ultimaFecha =
    proyectos.length > 0 ? formatearFechaHora(proyectos[0].fechaModificacion || proyectos[0].fechaCreacion).split(" · ")[0] : "—";
  const totalTaladros = proyectos.reduce((acc, p) => acc + p.snapshot.taladros.length, 0);

  return (
    <div className="portal-mobile-wrapper">
      <div className="portal-container">
        {notificacion && (
          <div className="dashboard-toast">
            <span className="cad-toast-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="cad-toast-text">{notificacion}</span>
          </div>
        )}

        <div className="mine-status-bar">
          <span className="mine-clock">{horaLocal}</span>
          <div className="mine-telemetry-icons">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 3c-4.97 0-9.2 2.1-12 5.5l12 14.5 12-14.5c-2.8-3.4-7.03-5.5-12-5.5zm0 4c3.8 0 7.15 1.5 9.4 3.9l-9.4 11.4-9.4-11.4c2.25-2.4 5.6-3.9 9.4-3.9z" />
            </svg>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <rect x="2" y="7" width="16" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="20" y1="10" x2="20" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="4" y="9" width="10" height="6" rx="1" />
            </svg>
          </div>
        </div>

        <header className="portal-nav-header">
          <button type="button" className="btn-portal-back" onClick={onVolverDashboard}>
            <span className="arrow-back">←</span> Suite Minera
          </button>

          <div className="portal-badge-conectado">
            <span className="conectado-dot" />
            CONECTADO
          </div>
        </header>

        <div className="portal-module-identity">
          <div
            className="portal-module-icon-box"
            style={{
              backgroundColor: `${COLOR_VOLADURA}15`,
              borderColor: `${COLOR_VOLADURA}66`,
              boxShadow: `0 0 24px ${COLOR_VOLADURA}33, inset 0 0 16px ${COLOR_VOLADURA}18`,
              cursor: "pointer",
            }}
            onClick={onNuevoProyecto}
            title="Tocar para diseñar una nueva voladura"
          >
            <AnimacionModulo3D moduloId="voladura" color={COLOR_VOLADURA} size={84} />
          </div>

          <div className="portal-module-titles">
            <div className="portal-3d-active-tag" style={{ color: COLOR_VOLADURA }}>
              <span className="tag-dot-pulse" style={{ backgroundColor: COLOR_VOLADURA }} />
              MOTOR DE VOLADURA
            </div>
            <h1
              className="portal-module-title"
              style={{
                background: `linear-gradient(135deg, #ffffff 30%, #fda4af 80%, ${COLOR_VOLADURA} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Diseño de Voladura
            </h1>
            <p className="portal-module-sub" style={{ color: "#fecdd3" }}>
              Carguío, retardos y simulación técnica a partir de una malla ya diseñada
            </p>
          </div>
        </div>

        <div className="portal-kpis-row">
          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: COLOR_VOLADURA }}>
              {proyectos.length}
            </strong>
            <span className="portal-kpi-lbl">VOLADURAS</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: COLOR_VOLADURA }}>
              {ultimaFecha}
            </strong>
            <span className="portal-kpi-lbl">ÚLTIMA VOLADURA</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: COLOR_VOLADURA }}>
              {totalTaladros}
            </strong>
            <span className="portal-kpi-lbl">TALADROS TOT.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "14px 0 18px 0" }}>
          <button
            type="button"
            className="btn-portal-primary"
            style={{
              margin: 0,
              background: `linear-gradient(135deg, ${COLOR_VOLADURA}, #be123c)`,
              border: "1px solid #fb7185",
              boxShadow: `0 6px 20px ${COLOR_VOLADURA}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onClick={onNuevoProyecto}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            SIMULAR VOLADURA
          </button>
        </div>

        <section className="portal-recientes-section">
          <div className="portal-recientes-header">
            <h2 className="portal-recientes-title" style={{ color: "#fb7185" }}>
              PROYECTOS RECIENTES ({proyectos.length})
            </h2>
          </div>

          {proyectos.map((p) => (
            <div
              key={p.id}
              className="portal-project-card"
              style={{
                background: "linear-gradient(145deg, rgba(30, 6, 14, 0.9) 0%, rgba(16, 3, 8, 0.95) 100%)",
                borderColor: "rgba(244, 63, 94, 0.22)",
              }}
              onClick={() => onAbrirProyecto(p)}
              title="Tocar para abrir en el taller de voladura"
            >
              <div className="portal-project-card-header">
                <div className="portal-project-name-wrap">
                  <div className="portal-project-title-clickable">
                    <h3 style={{ color: "#fff1f2" }}>{p.nombre}</h3>
                  </div>
                </div>
                <span
                  className="portal-badge-active"
                  style={{ color: COLOR_VOLADURA, borderColor: "rgba(244, 63, 94, 0.4)", background: "rgba(244, 63, 94, 0.15)" }}
                >
                  BOOM
                </span>
              </div>

              <div className="portal-project-meta-row">
                <div className="portal-meta-item" style={{ color: "#fda4af" }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{formatearFechaHora(p.fechaModificacion || p.fechaCreacion)}</span>
                </div>
              </div>

              <div className="portal-project-state-badge" style={{ background: "#1a040a", border: "1px solid rgba(244, 63, 94, 0.2)" }}>
                <span className="state-mono" style={{ color: "#fda4af" }}>
                  Malla: {p.snapshot.mallaNombre} · {p.snapshot.poligonoCresta.length > 0 ? `${p.snapshot.burden_m.toFixed(2)} × ${p.snapshot.espaciamiento_m.toFixed(2)} m` : "—"}
                </span>
              </div>

              <div className="portal-project-actions-row">
                <span className="actions-label">OPERACIONES</span>
                <div className="actions-buttons-group">
                  <button type="button" className="btn-op-icon" title="Duplicar voladura" onClick={(e) => handleDuplicar(p, e)}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>

                  <button type="button" className="btn-op-icon btn-op-danger" title="Eliminar voladura" onClick={(e) => handleBorrar(p, e)}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {proyectos.length === 0 && (
            <div className="portal-empty-card">
              <p style={{ margin: "0 0 6px 0", color: "#94a3b8", fontSize: "13px", fontWeight: 600 }}>
                No tienes voladuras diseñadas en este momento.
              </p>
              <span style={{ color: "#64748b", fontSize: "11px" }}>
                Presiona "SIMULAR VOLADURA" para importar una malla y comenzar.
              </span>
            </div>
          )}
        </section>

        <nav className="mine-bottom-nav">
          <button type="button" className="mine-nav-item" onClick={onVolverDashboard}>
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span>Inicio</span>
          </button>

          <button type="button" className="mine-nav-item nav-activo">
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span>Proyectos</span>
          </button>

          <button
            type="button"
            className="mine-nav-item"
            onClick={() => {
              if (proyectos.length > 0) onAbrirProyecto(proyectos[0]);
              else onNuevoProyecto();
            }}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </div>
            <span>Taller</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
