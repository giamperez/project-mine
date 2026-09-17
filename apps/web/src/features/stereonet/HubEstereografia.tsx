import React, { useEffect, useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import AnimacionModulo3D from "../../components/shared/AnimacionModulo3D.js";
import {
  type ProyectoEstereografico,
  ESCENARIOS_ESTEREOGRAFIA,
  PROYECTOS_ESTEREOGRAFIA_INICIALES,
} from "./proyectosEstereografia.js";

const COLOR_ESTEREOGRAFIA = "#10b981";

interface HubEstereografiaProps {
  onVolverDashboard: () => void;
  onAbrirProyecto: (proyecto: ProyectoEstereografico) => void;
  onNuevoProyecto: () => void;
}

function IconoEstudio({ id, size = 18 }: { id: string; size?: number }) {
  if (id === "MIN") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21v-4h4v-4h4v-4h4V5h3" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (id === "VIAL") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" strokeOpacity="0.8" />
        <line x1="9" y1="3" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="21" />
      </svg>
    );
  }
  if (id === "SUB") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21V11a8 8 0 0 1 16 0v10" />
        <path d="M4 21h16" />
        <line x1="12" y1="11" x2="12" y2="21" strokeDasharray="2 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" strokeOpacity="0.6" />
      <ellipse cx="12" cy="12" rx="4.5" ry="9" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function HubEstereografia({
  onVolverDashboard,
  onAbrirProyecto,
  onNuevoProyecto,
}: HubEstereografiaProps) {
  const [proyectos, setProyectos] = usePersistedState<ProyectoEstereografico[]>(
    "estereografia.proyectosLista",
    () => PROYECTOS_ESTEREOGRAFIA_INICIALES
  );
  const [tabActivo, setTabActivo] = useState<"inicio" | "estudios" | "taller">("estudios");
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

  function handleDuplicar(p: ProyectoEstereografico, e: React.MouseEvent) {
    e.stopPropagation();
    const nuevo: ProyectoEstereografico = {
      ...p,
      id: "est-" + Math.random().toString(36).substr(2, 9),
      nombre: `${p.nombre} (Copia)`,
      fechaCreacion: new Date().toISOString(),
      fechaModificacion: new Date().toISOString(),
    };
    setProyectos([nuevo, ...proyectos]);
    notificar(`Copia de "${p.nombre}" creada.`);
  }

  function handleBorrar(p: ProyectoEstereografico, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm(`¿Estás seguro de eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) {
      setProyectos(proyectos.filter((item) => item.id !== p.id));
      notificar(`"${p.nombre}" eliminado.`);
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
      return "15/09/2026 · 12:47";
    }
  }

  const ultimaFecha =
    proyectos.length > 0
      ? formatearFechaHora(proyectos[0].fechaModificacion || proyectos[0].fechaCreacion).split(" · ")[0]
      : "—";

  return (
    <div className="portal-mobile-wrapper">
      <div className="portal-container">
        {/* Notificación flotante */}
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

        {/* Barra superior de telemetría de dispositivo móvil */}
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

        {/* Header de navegación interna del módulo */}
        <header className="portal-nav-header">
          <button type="button" className="btn-portal-back" onClick={onVolverDashboard}>
            <span className="arrow-back">←</span> Suite Minera
          </button>

          <div className="portal-badge-conectado">
            <span className="conectado-dot" />
            CONECTADO
          </div>
        </header>

        {/* Tarjeta de Identidad del Módulo con MODELADO 3D EN VIVO */}
        <div className="portal-module-identity">
          <div
            className="portal-module-icon-box"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              borderColor: "rgba(16, 185, 129, 0.4)",
              boxShadow: "0 0 24px rgba(16, 185, 129, 0.25), inset 0 0 16px rgba(16, 185, 129, 0.1)",
              cursor: "pointer",
            }}
            onClick={onNuevoProyecto}
            title="Tocar para crear un nuevo análisis estereográfico"
          >
            <AnimacionModulo3D moduloId="estereografia" color={COLOR_ESTEREOGRAFIA} size={84} />
          </div>

          <div className="portal-module-titles">
            <div className="portal-3d-active-tag" style={{ color: COLOR_ESTEREOGRAFIA }}>
              <span className="tag-dot-pulse" style={{ backgroundColor: COLOR_ESTEREOGRAFIA }} />
              MODELO 3D EN VIVO
            </div>
            <h1
              className="portal-module-title"
              style={{
                background: "linear-gradient(135deg, #ffffff 30%, #6ee7b7 80%, #10b981 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Estereografía y Cinemática
            </h1>
            <p className="portal-module-sub" style={{ color: "#a7f3d0" }}>
              Proyección estereográfica, análisis cinemático y clasificación SMR
            </p>
          </div>
        </div>

        {/* Fila de 3 KPIs rápidos del Módulo */}
        <div className="portal-kpis-row">
          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: COLOR_ESTEREOGRAFIA }}>
              {proyectos.length}
            </strong>
            <span className="portal-kpi-lbl">PROYECTOS</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: COLOR_ESTEREOGRAFIA }}>
              {ultimaFecha}
            </strong>
            <span className="portal-kpi-lbl">ÚLTIMO PROYECTO</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: COLOR_ESTEREOGRAFIA }}>
              {ESCENARIOS_ESTEREOGRAFIA.length}
            </strong>
            <span className="portal-kpi-lbl">ESCENARIOS</span>
          </div>
        </div>

        {/* Botón principal de creación en esmeralda elegante */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "14px 0 18px 0" }}>
          <button
            type="button"
            className="btn-portal-primary"
            style={{
              margin: 0,
              background: `linear-gradient(135deg, ${COLOR_ESTEREOGRAFIA}, #059669)`,
              color: "#022c22",
              fontWeight: 800,
              border: "1px solid #34d399",
              boxShadow: "0 6px 20px rgba(16, 185, 129, 0.35)",
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
            NUEVO ESTUDIO ESTRUCTURAL
          </button>
        </div>

        {/* Sección: Proyectos Recientes */}
        <section className="portal-recientes-section">
          <div className="portal-recientes-header">
            <h2 className="portal-recientes-title" style={{ color: "#34d399" }}>
              PROYECTOS RECIENTES ({proyectos.length})
            </h2>
          </div>

          {proyectos.map((p) => {
            const esc = ESCENARIOS_ESTEREOGRAFIA.find((m) => m.id === p.escenarioId) || ESCENARIOS_ESTEREOGRAFIA[0];
            const cantFam = Array.isArray(p.discontinuidades) ? p.discontinuidades.length : 0;
            return (
              <div
                key={p.id}
                className="portal-project-card"
                style={{
                  background: "linear-gradient(145deg, rgba(6, 28, 22, 0.9) 0%, rgba(3, 16, 12, 0.95) 100%)",
                  borderColor: "rgba(16, 185, 129, 0.22)",
                }}
                onClick={() => onAbrirProyecto(p)}
                title="Tocar para abrir en el taller estereográfico"
              >
                <div className="portal-project-card-header">
                  <div className="portal-project-name-wrap">
                    <div className="portal-project-title-clickable">
                      <h3 style={{ color: "#f0fdf4" }}>{p.nombre}</h3>
                    </div>
                  </div>
                  <span
                    className="portal-badge-active"
                    style={{
                      color: COLOR_ESTEREOGRAFIA,
                      borderColor: "rgba(16, 185, 129, 0.4)",
                      background: "rgba(16, 185, 129, 0.15)",
                    }}
                  >
                    {esc.abreviatura}
                  </span>
                </div>

                <div className="portal-project-meta-row">
                  <div className="portal-meta-item" style={{ color: "#6ee7b7" }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{formatearFechaHora(p.fechaModificacion || p.fechaCreacion)}</span>
                  </div>
                </div>

                <div className="portal-project-state-badge" style={{ background: "#041a14", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                  <span className="state-icon" style={{ color: COLOR_ESTEREOGRAFIA, display: "flex", alignItems: "center" }}>
                    <IconoEstudio id={p.escenarioId} size={18} />
                  </span>
                  <span className="state-mono" style={{ color: "#a7f3d0" }}>
                    Talud: Dip {p.talud?.dip_grados ?? 65}° / Dir {p.talud?.dipDirection_grados ?? 195}° · {cantFam} Familias · Φ {p.anguloFriccion_grados ?? 30}°
                  </span>
                </div>

                <div className="portal-project-actions-row">
                  <span className="actions-label">OPERACIONES</span>
                  <div className="actions-buttons-group">
                    <button
                      type="button"
                      className="btn-op-icon"
                      title="Duplicar estudio"
                      onClick={(e) => handleDuplicar(p, e)}
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="btn-op-icon btn-op-danger"
                      title="Eliminar estudio"
                      onClick={(e) => handleBorrar(p, e)}
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {proyectos.length === 0 && (
            <div className="portal-empty-card">
              <p style={{ margin: "0 0 6px 0", color: "#94a3b8", fontSize: "13px", fontWeight: 600 }}>
                No tienes estudios estructurales en este momento.
              </p>
              <span style={{ color: "#64748b", fontSize: "11px" }}>
                Presiona "+ NUEVO ESTUDIO ESTRUCTURAL" para comenzar.
              </span>
            </div>
          )}


        </section>

        {/* Barra de Navegación Inferior Flotante */}
        <nav className="mine-bottom-nav">
          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "inicio" ? "nav-activo" : ""}`}
            onClick={onVolverDashboard}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span>Inicio</span>
          </button>

          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "estudios" ? "nav-activo" : ""}`}
            onClick={() => setTabActivo("estudios")}
          >
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
                <circle cx="12" cy="12" r="9" />
                <path d="M3.6 9h16.8M3.6 15h16.8" strokeOpacity="0.6" />
                <ellipse cx="12" cy="12" rx="4.5" ry="9" strokeOpacity="0.6" />
              </svg>
            </div>
            <span>Taller 2D</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
