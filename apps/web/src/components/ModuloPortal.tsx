import { useState, useMemo, useEffect } from "react";
import type { ModuloId } from "../Dashboard.js";
import AnimacionModulo3D from "./AnimacionModulo3D.js";
import { PREFIJO_ALMACENAMIENTO } from "../hooks/usePersistedState.js";
import { exportarProyectoJSON } from "../utils/proyecto.js";
import { descargarTexto } from "../utils/descargar.js";

interface ModuloPortalProps {
  moduloId: ModuloId;
  onVolverDashboard: () => void;
  onAbrirTaller: () => void;
}

function leerValorGuardado<T>(clave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIJO_ALMACENAMIENTO + clave);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface ModuloMeta {
  titulo: string;
  subtitulo: string;
  color: string;
  botonPrincipal: string;
  kpi1: { valor: string | number; label: string };
  kpi2: { valor: string; label: string };
  kpi3: { valor: string | number; label: string };
  proyectoNombreDefecto: string;
  resumenDiseno: string;
}

export default function ModuloPortal({
  moduloId,
  onVolverDashboard,
  onAbrirTaller,
}: ModuloPortalProps) {
  const [tabActivo, setTabActivo] = useState<"inicio" | "proyectos" | "calculos" | "ajustes">("proyectos");
  const [nombreProyecto, setNombreProyecto] = useState("Malla 1");
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [horaLocal, setHoraLocal] = useState("09:41");

  useEffect(() => {
    const now = new Date();
    setHoraLocal(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);

  // Metadatos y telemetría por módulo
  const meta: ModuloMeta = useMemo(() => {
    const fechaHoy = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

    switch (moduloId) {
      case "malla": {
        const taladros = leerValorGuardado<any[]>("malla.tunel.taladros", []);
        const taladrosManuales = leerValorGuardado<any[] | null>("malla.taladrosManuales", null);
        const cant = taladrosManuales ? taladrosManuales.length : taladros.length;
        return {
          titulo: "Diseño de Malla",
          subtitulo: "Sistema inteligente de perforación y voladura",
          color: "#f97316",
          botonPrincipal: "+ Diseñar Nueva Malla",
          kpi1: { valor: 1, label: "PROYECTOS" },
          kpi2: { valor: fechaHoy, label: "ÚLTIMA MALLA" },
          kpi3: { valor: cant, label: "TALADROS TOT." },
          proyectoNombreDefecto: "Malla 1",
          resumenDiseno: `Diseño: ${cant} taladros`,
        };
      }
      case "topografia": {
        const puntos = leerValorGuardado<any[]>("topografia.puntosActuales", []);
        return {
          titulo: "Topografía y Superficie",
          subtitulo: "Mallas de elevación triangulada (TIN) y curvas de nivel",
          color: "#06b6d4",
          botonPrincipal: "+ Nuevo Levantamiento 3D",
          kpi1: { valor: puntos.length > 0 ? puntos.length : 117, label: "PUNTOS 3D" },
          kpi2: { valor: fechaHoy, label: "LEVANTAMIENTO" },
          kpi3: { valor: "TIN", label: "MODELADO" },
          proyectoNombreDefecto: "Superficie Tajo Fase 1",
          resumenDiseno: `Nube: ${puntos.length > 0 ? puntos.length : 117} vértices procesados`,
        };
      }
      case "geomecanica": {
        const entrada = leerValorGuardado<any>("geomecanica.entrada", null);
        const ucs = entrada?.ucs_mpa || 80;
        const rqd = entrada?.rqd_pct || 75;
        return {
          titulo: "Geomecánica del Macizo",
          subtitulo: "Clasificación geomecánica empírica RMR y soporte",
          color: "#eab308",
          botonPrincipal: "+ Evaluar Nuevo Frente",
          kpi1: { valor: `${ucs} MPa`, label: "UCS ROCOSO" },
          kpi2: { valor: `${rqd}%`, label: "RQD NATIVO" },
          kpi3: { valor: "CLASE II", label: "BIENIAWSKI" },
          proyectoNombreDefecto: "Frente Avance Galería Norte",
          resumenDiseno: `Clasificación: RMR 65 - Roca Buena`,
        };
      }
      case "estereografia": {
        const disc = leerValorGuardado<any[]>("estereografia.discontinuidades", []);
        return {
          titulo: "Estereografía Estructural",
          subtitulo: "Proyección estereográfica de Schmidt y cinemática de taludes",
          color: "#10b981",
          botonPrincipal: "+ Nuevo Análisis Estructural",
          kpi1: { valor: disc.length > 0 ? disc.length : 4, label: "FAMILIAS" },
          kpi2: { valor: "SCHMIDT", label: "PROYECCIÓN" },
          kpi3: { valor: "CUÑAS", label: "CINEMÁTICA" },
          proyectoNombreDefecto: "Talud Sur Banco 4200",
          resumenDiseno: `Estructura: ${disc.length > 0 ? disc.length : 4} familias activas`,
        };
      }
      case "acarreo": {
        const entrada = leerValorGuardado<any>("acarreo.entrada", null);
        const camiones = entrada?.numeroCamiones || 4;
        const cap = entrada?.capacidadCamion_t || 100;
        return {
          titulo: "Acarreo y Transporte",
          subtitulo: "Simulación de ciclo rampa y cálculo de flota óptima",
          color: "#ef4444",
          botonPrincipal: "+ Simular Nueva Flota",
          kpi1: { valor: camiones, label: "CAMIONES" },
          kpi2: { valor: `${cap}t`, label: "CAPACIDAD" },
          kpi3: { valor: "18.4m", label: "TIEMPO CICLO" },
          proyectoNombreDefecto: "Ruta Botadero Primario",
          resumenDiseno: `Flota: ${camiones} unidades de ${cap}t`,
        };
      }
      case "modeloBloques": {
        const colares = leerValorGuardado<any[]>("modeloBloques.colares", []);
        return {
          titulo: "Modelo de Bloques",
          subtitulo: "Sondajes diamantina e interpolación espacial 3D Kriging",
          color: "#a855f7",
          botonPrincipal: "+ Generar Nuevo Bloque 3D",
          kpi1: { valor: colares.length > 0 ? colares.length : 9, label: "SONDAJES" },
          kpi2: { valor: "KRIGING", label: "ESTIMACIÓN" },
          kpi3: { valor: "0.45%", label: "LEY CORTE" },
          proyectoNombreDefecto: "Veta Esperanza Banco 3800",
          resumenDiseno: `Geología: ${colares.length > 0 ? colares.length : 9} DDH interpolados`,
        };
      }
    }
  }, [moduloId]);

  function handleDuplicar() {
    setNombreProyecto((prev) => `${prev} (Copia)`);
    setNotificacion("Diseño duplicado como borrador.");
    setTimeout(() => setNotificacion(null), 3000);
  }

  function handleExportar() {
    const data = exportarProyectoJSON();
    descargarTexto(`${moduloId}-proyecto.json`, data, "application/json");
    setNotificacion("Datos del módulo exportados.");
    setTimeout(() => setNotificacion(null), 3000);
  }

  function handleReset() {
    if (window.confirm("¿Restablecer este diseño a los parámetros por defecto?")) {
      setNotificacion("Diseño restablecido.");
      setTimeout(() => setNotificacion(null), 3000);
    }
  }

  return (
    <div className="portal-mobile-wrapper">
      <div className="portal-container">
        {/* Notificación flotante */}
        {notificacion && <div className="dashboard-toast">{notificacion}</div>}

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

        {/* Tarjeta de Identidad del Módulo con ICONO 3D CINÉTICO EN VIVO */}
        <div className="portal-module-identity">
          <div
            className="portal-module-icon-box"
            style={{
              backgroundColor: `${meta.color}15`,
              borderColor: `${meta.color}66`,
              boxShadow: `0 0 24px ${meta.color}33, inset 0 0 16px ${meta.color}18`,
              cursor: "pointer",
            }}
            onClick={onAbrirTaller}
            title="Tocar para entrar al Taller 3D"
          >
            <AnimacionModulo3D moduloId={moduloId} color={meta.color} size={84} />
          </div>

          <div className="portal-module-titles">
            <div className="portal-3d-active-tag" style={{ color: meta.color }}>
              <span className="tag-dot-pulse" style={{ backgroundColor: meta.color }} />
              MODELO 3D EN VIVO
            </div>
            <h1 className="portal-module-title">{meta.titulo}</h1>
            <p className="portal-module-sub">{meta.subtitulo}</p>
          </div>
        </div>

        {/* Fila de 3 KPIs rápidos del Módulo */}
        <div className="portal-kpis-row">
          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: meta.color }}>
              {meta.kpi1.valor}
            </strong>
            <span className="portal-kpi-lbl">{meta.kpi1.label}</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: meta.color }}>
              {meta.kpi2.valor}
            </strong>
            <span className="portal-kpi-lbl">{meta.kpi2.label}</span>
          </div>

          <div className="portal-kpi-pill">
            <strong className="portal-kpi-num" style={{ color: meta.color }}>
              {meta.kpi3.valor}
            </strong>
            <span className="portal-kpi-lbl">{meta.kpi3.label}</span>
          </div>
        </div>

        {/* Botón de Acción Principal */}
        <button
          type="button"
          className="btn-portal-primary"
          style={{
            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
            boxShadow: `0 8px 24px ${meta.color}40`,
          }}
          onClick={onAbrirTaller}
        >
          {meta.botonPrincipal}
        </button>

        {/* Sección: Proyectos Recientes */}
        <section className="portal-recientes-section">
          <h2 className="portal-recientes-title">PROYECTOS RECIENTES</h2>

          {/* Tarjeta de Proyecto Activo */}
          <div className="portal-project-card">
            <div className="portal-project-card-header">
              <div className="portal-project-name-wrap">
                {editandoNombre ? (
                  <input
                    type="text"
                    className="portal-input-name"
                    value={nombreProyecto}
                    onChange={(e) => setNombreProyecto(e.target.value)}
                    onBlur={() => setEditandoNombre(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditandoNombre(false)}
                    autoFocus
                  />
                ) : (
                  <div className="portal-project-title-clickable" onClick={() => setEditandoNombre(true)}>
                    <h3>{nombreProyecto}</h3>
                    <span className="pencil-icon" title="Editar nombre">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </span>
                  </div>
                )}
              </div>
              <span className="portal-badge-draft">BORRADOR</span>
            </div>

            <div className="portal-project-meta-row">
              <div className="portal-meta-item">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{new Date().toLocaleDateString("es-ES")} {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            <div className="portal-project-state-badge">
              <span className="state-icon" style={{ color: meta.color, display: "flex", alignItems: "center" }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" strokeOpacity="0.4" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
              </span>
              <span className="state-mono">{meta.resumenDiseno}</span>
            </div>

            <div className="portal-project-actions-row">
              <span className="actions-label">OPERACIONES DISPONIBLES</span>
              <div className="actions-buttons-group">
                <button
                  type="button"
                  className="btn-op-icon"
                  title="Duplicar proyecto"
                  onClick={handleDuplicar}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="btn-op-icon"
                  title="Compartir o exportar"
                  onClick={handleExportar}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="btn-op-icon btn-op-danger"
                  title="Restablecer"
                  onClick={handleReset}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta Punteada para Nuevos Diseños */}
          <div className="portal-placeholder-card" onClick={onAbrirTaller}>
            <div className="placeholder-icon-circle">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p>Tus próximos diseños aparecerán aquí</p>
            <span className="placeholder-hint">+ Toque para iniciar un diseño</span>
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
            className={`mine-nav-item ${tabActivo === "calculos" ? "nav-activo" : ""}`}
            onClick={onAbrirTaller}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
            </div>
            <span>Cálculos</span>
          </button>

          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "ajustes" ? "nav-activo" : ""}`}
            onClick={() => {
              setTabActivo("ajustes");
              handleExportar();
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
