import React, { useEffect, useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import AnimacionModulo3D from "../../components/shared/AnimacionModulo3D.js";
import {
  type ProyectoTopografico,
  MOTORES_TOPOGRAFICOS,
} from "./motoresTopograficos.js";
import { IconoMotor, IconoPlus } from "./components/IconosTopograficos.js";

const COLOR_TOPOGRAFIA = "#ffffff";

interface HubTopografiaProps {
  onVolverDashboard: () => void;
  onAbrirProyecto: (proyecto: ProyectoTopografico) => void;
  onNuevoProyecto: () => void;
}

const PROYECTOS_INICIALES_DEMO: ProyectoTopografico[] = [
  {
    id: "proj-buz-1",
    nombre: "Proyecto BUZ",
    motorId: "BUZ",
    datum: "WGS 84",
    zonaUtm: "18S",
    fechaCreacion: "2026-09-15T12:47:00.000Z",
    fechaModificacion: "2026-09-15T12:47:00.000Z",
    datosMotor: {
      diametroTuberia_mm: 200,
      pendienteMinima_pct: 0.5,
      buzones: [
        { id: "BZ-01", nombre: "Buzón 01", cotaTerreno: 250.0, cotaFondo: 247.8, distanciaSiguiente: 45.0 },
        { id: "BZ-02", nombre: "Buzón 02", cotaTerreno: 249.5, cotaFondo: 247.2, distanciaSiguiente: 50.0 },
        { id: "BZ-03", nombre: "Buzón 03", cotaTerreno: 249.1, cotaFondo: 246.5, distanciaSiguiente: 40.0 },
        { id: "BZ-04", nombre: "Buzón 04", cotaTerreno: 248.6, cotaFondo: 245.9, distanciaSiguiente: 0.0 },
      ],
    },
  },
  {
    id: "proj-ch-1",
    nombre: "Proyecto CH",
    motorId: "CH",
    datum: "WGS 84",
    zonaUtm: "18S",
    fechaCreacion: "2026-09-01T00:08:00.000Z",
    fechaModificacion: "2026-09-01T00:08:00.000Z",
    datosMotor: {
      progresivaPI: "1+200.000",
      radioR: 150.0,
      deflexionDelta_deg: 45.0,
      sentido: "Derecha",
      intervaloCuerda: 10.0,
    },
  },
];

export default function HubTopografia({
  onVolverDashboard,
  onAbrirProyecto,
  onNuevoProyecto,
}: HubTopografiaProps) {
  const [proyectos, setProyectos] = usePersistedState<ProyectoTopografico[]>(
    "topografia.proyectosLista",
    () => PROYECTOS_INICIALES_DEMO
  );
  const [tabActivo, setTabActivo] = useState<"inicio" | "proyectos" | "motores" | "ajustes">("proyectos");
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

  function handleDuplicar(p: ProyectoTopografico, e: React.MouseEvent) {
    e.stopPropagation();
    const nuevo: ProyectoTopografico = {
      ...p,
      id: "proj-" + Math.random().toString(36).substr(2, 9),
      nombre: `${p.nombre} (Copia)`,
      fechaCreacion: new Date().toISOString(),
      fechaModificacion: new Date().toISOString(),
    };
    setProyectos([nuevo, ...proyectos]);
    notificar(`Copia de "${p.nombre}" creada.`);
  }

  function handleBorrar(p: ProyectoTopografico, e: React.MouseEvent) {
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
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              boxShadow: "0 0 24px rgba(255, 255, 255, 0.08), inset 0 0 16px rgba(255, 255, 255, 0.04)",
              cursor: "pointer",
            }}
            onClick={onNuevoProyecto}
            title="Tocar para crear un nuevo levantamiento"
          >
            <AnimacionModulo3D moduloId="topografia" color="#ffffff" size={84} />
          </div>

          <div className="portal-module-titles">
            <div className="portal-3d-active-tag" style={{ color: "#ffffff" }}>
              <span className="tag-dot-pulse" style={{ backgroundColor: "#ffffff" }} />
              MODELO 3D EN VIVO
            </div>
            <h1 className="portal-module-title">Topografía y Geodesia</h1>
            <p className="portal-module-sub">Cálculo, control métrico y representación técnica</p>
          </div>
        </div>

        {/* Fila de 3 KPIs rápidos del Módulo */}
        <div className="portal-kpis-row">
          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: "#ffffff" }}>
              {proyectos.length}
            </strong>
            <span className="portal-kpi-lbl">PROYECTOS</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: "#ffffff" }}>
              {ultimaFecha}
            </strong>
            <span className="portal-kpi-lbl">ÚLTIMO PROYECTO</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: "#ffffff" }}>
              {MOTORES_TOPOGRAFICOS.length}
            </strong>
            <span className="portal-kpi-lbl">MOTORES</span>
          </div>
        </div>

        {/* Botón principal de creación en monocromo puro */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "14px 0 18px 0" }}>
          <button
            type="button"
            className="btn-portal-primary"
            style={{
              margin: 0,
              background: "#ffffff",
              color: "#0c1017",
              fontWeight: 800,
              border: "1px solid #ffffff",
              boxShadow: "0 6px 20px rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onClick={onNuevoProyecto}
          >
            <IconoPlus size={16} /> NUEVO PROYECTO TOPOGRÁFICO
          </button>
        </div>

        {/* Sección: Proyectos Recientes */}
        <section className="portal-recientes-section">
          <div className="portal-recientes-header">
            <h2 className="portal-recientes-title">PROYECTOS RECIENTES ({proyectos.length})</h2>
          </div>

          {proyectos.map((p) => {
            const motor = MOTORES_TOPOGRAFICOS.find((m) => m.id === p.motorId) || MOTORES_TOPOGRAFICOS[0];
            return (
              <div
                key={p.id}
                className="portal-project-card"
                onClick={() => onAbrirProyecto(p)}
                title="Tocar para abrir en el taller"
              >
                <div className="portal-project-card-header">
                  <div className="portal-project-name-wrap">
                    <div className="portal-project-title-clickable">
                      <h3>{p.nombre}</h3>
                    </div>
                  </div>
                  <span
                    className="portal-badge-active"
                    style={{ color: "#ffffff", borderColor: "rgba(255, 255, 255, 0.25)", background: "rgba(255, 255, 255, 0.08)" }}
                  >
                    {motor.abreviatura}
                  </span>
                </div>

                <div className="portal-project-meta-row">
                  <div className="portal-meta-item">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{formatearFechaHora(p.fechaModificacion || p.fechaCreacion)}</span>
                  </div>
                </div>

                <div className="portal-project-state-badge">
                  <span className="state-icon" style={{ color: "#ffffff", display: "flex", alignItems: "center" }}>
                    <IconoMotor id={p.motorId} size={18} />
                  </span>
                  <span className="state-mono">
                    {motor.nombre} · {p.datum} / Zona {p.zonaUtm}
                  </span>
                </div>

                <div className="portal-project-actions-row">
                  <span className="actions-label">OPERACIONES</span>
                  <div className="actions-buttons-group">
                    <button
                      type="button"
                      className="btn-op-icon"
                      title="Duplicar proyecto"
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
                      title="Eliminar proyecto"
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
                No tienes proyectos topográficos en este momento.
              </p>
              <span style={{ color: "#64748b", fontSize: "11px" }}>
                Presiona "NUEVO PROYECTO TOPOGRÁFICO" para comenzar.
              </span>
            </div>
          )}

          {/* Tarjeta para Crear Nuevos Proyectos */}
          <div
            className="portal-placeholder-card"
            onClick={onNuevoProyecto}
            title="Toque para crear un nuevo proyecto topográfico"
          >
            <div className="placeholder-icon-circle">
              <IconoPlus size={18} />
            </div>
            <p>Agregar nuevo levantamiento o cálculo</p>
            <span className="placeholder-hint">Toque para seleccionar motor</span>
          </div>
        </section>

        {/* Barra de Navegación Inferior Flotante del Módulo */}
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
            className={`mine-nav-item ${tabActivo === "proyectos" ? "nav-activo" : ""}`}
            onClick={() => setTabActivo("proyectos")}
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
            className={`mine-nav-item ${tabActivo === "motores" ? "nav-activo" : ""}`}
            onClick={onNuevoProyecto}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
              </svg>
            </div>
            <span>Motores</span>
          </button>

          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "ajustes" ? "nav-activo" : ""}`}
            onClick={() => {
              setTabActivo("ajustes");
              notificar("Ajustes y Datum WGS84 UTM sincronizados.");
            }}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span>Ajustes</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
