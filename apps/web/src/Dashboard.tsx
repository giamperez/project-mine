import { useMemo, useState, useEffect } from "react";
import { PREFIJO_ALMACENAMIENTO } from "./hooks/usePersistedState.js";
import { PLANTILLAS_DEMO, aplicarPlantilla } from "./data/plantillasDemo.js";
import type { ProyectoGuardado } from "./utils/proyectos.js";
import {
  cargarProyectoGuardado,
  eliminarProyectoGuardado,
  guardarProyectoComo,
  listarProyectosGuardados,
} from "./utils/proyectos.js";
import { exportarProyectoJSON, limpiarProyectoLocal } from "./utils/proyecto.js";
import { descargarTexto } from "./utils/descargar.js";

export type ModuloId = "malla" | "topografia" | "geomecanica" | "estereografia" | "acarreo" | "modeloBloques" | "modelo3d";

interface DashboardProps {
  onSeleccionarModulo: (modulo: ModuloId) => void;
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

// Iconos vectoriales técnicos SVG con estilo ingeniería minera
function IconoMalla() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.35" />
      <circle cx="12" cy="12" r="6" strokeOpacity="0.7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function IconoTopografia() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" strokeOpacity="0.8" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
      <path d="M5 14c2-1 3-1 4 0s3 1 4 0" strokeWidth="1.5" />
    </svg>
  );
}

function IconoGeomecanica() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5-6 4 13 2.5-7h5" />
      <path d="M4 19h16" strokeDasharray="2 2" strokeOpacity="0.5" />
    </svg>
  );
}

function IconoEstereografia() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" strokeOpacity="0.6" />
      <ellipse cx="12" cy="12" rx="4.5" ry="9" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconoAcarreo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="13" height="7" rx="1" />
      <path d="M15 11h4l2 4v2h-6v-6z" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function IconoBloques() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <line x1="12" y1="8" x2="12" y2="15" strokeDasharray="2 2" />
    </svg>
  );
}

function IconoModelo3D() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// Iconos vectoriales técnicos para escenarios y plantillas
function IconoPlantilla({ id, color }: { id: string; color: string }) {
  if (id === "tajo-abierto") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21v-4h4v-4h4v-4h4V5h3" />
        <circle cx="9" cy="9" r="1.5" fill={color} />
      </svg>
    );
  }
  if (id === "tunel-subterraneo" || id.includes("subterranea")) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21V11a8 8 0 0 1 16 0v10" />
        <path d="M4 21h16" />
        <line x1="12" y1="11" x2="12" y2="21" strokeDasharray="2 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M10 9l2 12 2-12" />
      <path d="M2 9h20" />
    </svg>
  );
}

export default function Dashboard({ onSeleccionarModulo }: DashboardProps) {
  const [categoria, setCategoria] = useState<"todas" | "operacion" | "geotecnia" | "recursos">("todas");
  const [modalProyectos, setModalProyectos] = useState(false);
  const [modalAlertas, setModalAlertas] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoGuardado[]>(() => listarProyectosGuardados());
  const [modoConexion, setModoConexion] = useState<"satelital" | "local">("satelital");
  const [tabActivo, setTabActivo] = useState<"dashboard" | "modulos" | "alertas" | "perfil">("dashboard");
  const [horaLocal, setHoraLocal] = useState("09:41");

  // Reloj simulado o real sincronizado
  useEffect(() => {
    function actualizarHora() {
      const now = new Date();
      setHoraLocal(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
    actualizarHora();
    const interval = setInterval(actualizarHora, 30000);
    return () => clearInterval(interval);
  }, []);

  // Lectura de KPIs en vivo del almacenamiento local
  const metricas = useMemo(() => {
    // Malla
    const modoDiseno = leerValorGuardado<string>("malla.modoDiseno", "banco");
    const entradaMalla = leerValorGuardado<any>("malla.entrada", null);
    const taladrosTunel = leerValorGuardado<any[]>("malla.tunel.taladros", []);
    const taladrosManuales = leerValorGuardado<any[] | null>("malla.taladrosManuales", null);

    let taladrosNum = "0 taladros";
    let taladrosSub = "Frente de avance";
    let taladrosActivo = "0 taladros de frente";

    if (modoDiseno === "tunel") {
      const cant = taladrosTunel?.length ?? 0;
      taladrosNum = `${cant} taladros`;
      taladrosSub = "Frente de avance";
      taladrosActivo = `${cant} taladros de frente`;
    } else if (taladrosManuales && taladrosManuales.length > 0) {
      taladrosNum = `${taladrosManuales.length} taladros`;
      taladrosSub = "Malla manual activa";
      taladrosActivo = `${taladrosManuales.length} taladros de producción`;
    } else if (entradaMalla) {
      const b = entradaMalla.burden_m || 4.5;
      const e = entradaMalla.espaciamiento_m || 5.5;
      taladrosNum = `${b}m × ${e}m`;
      taladrosSub = "Malla estándar";
      taladrosActivo = `B=${b}m · E=${e}m configurado`;
    }

    // Topografía
    const puntosTopo = leerValorGuardado<any[]>("topografia.puntosActuales", []);
    const puntosNum = puntosTopo.length > 0 ? `${puntosTopo.length} puntos` : "117 puntos";
    const puntosSub = "Nube de puntos 3D";
    const puntosActivo = puntosTopo.length > 0 ? `${puntosTopo.length} puntos 3D cargados` : "117 puntos 3D cargados";

    // Geomecánica
    const geoEntrada = leerValorGuardado<any>("geomecanica.entrada", null);
    let ucsVal = 80;
    let rqdVal = 75;
    if (geoEntrada) {
      ucsVal = geoEntrada.ucs_mpa || 80;
      rqdVal = geoEntrada.rqd_pct || 75;
    }
    const rmrNum = `${ucsVal} MPa`;
    const rmrSub = `UCS · RQD ${rqdVal}%`;
    const rmrActivo = `UCS: ${ucsVal} MPa - RQD: ${rqdVal}%`;

    // Estereografía
    const discontinuidades = leerValorGuardado<any[]>("estereografia.discontinuidades", []);
    const familiasActivo = discontinuidades.length > 0 ? `${discontinuidades.length} discontinuidades` : "4 discontinuidades";

    // Acarreo
    const acarreoEntrada = leerValorGuardado<any>("acarreo.entrada", null);
    let camiones = 4;
    let capacidad = 100;
    if (acarreoEntrada) {
      camiones = acarreoEntrada.numeroCamiones || 4;
      capacidad = acarreoEntrada.capacidadCamion_t || 100;
    }
    const acarreoNum = `${camiones} camiones`;
    const acarreoSub = `Capacidad de ${capacidad}t`;
    const acarreoActivo = `${camiones} camiones de ${capacidad}t`;

    // Modelo de Bloques
    const colares = leerValorGuardado<any[]>("modeloBloques.colares", []);
    const bloquesActivo = colares.length > 0 ? `${colares.length} sondajes perforados` : "9 sondajes perforados";

    // Modelo 3D
    const proyectosModelo3D = leerValorGuardado<any[]>("modelo3d.listaProyectos", []);
    const modelo3dActivo = `${proyectosModelo3D.length} proyecto${proyectosModelo3D.length === 1 ? "" : "s"}`;

    return {
      taladrosNum,
      taladrosSub,
      taladrosActivo,
      puntosNum,
      puntosSub,
      puntosActivo,
      rmrNum,
      rmrSub,
      rmrActivo,
      familiasActivo,
      acarreoNum,
      acarreoSub,
      acarreoActivo,
      bloquesActivo,
      modelo3dActivo,
    };
  }, []);

  const modulos = [
    {
      id: "malla" as ModuloId,
      nombre: "Diseño de Malla y Voladura",
      codigo: "ENG.MOD.v2.4",
      categoria: "operacion",
      Icono: IconoMalla,
      color: "#f97316",
      descripcion: "Perforación y voladura para bancos a cielo abierto y frentes subterráneos.",
      metricaClave: metricas.taladrosActivo,
      etiquetas: ["3D Interactivo", "DXF & CSV", "Simulación ms"],
    },
    {
      id: "topografia" as ModuloId,
      nombre: "Topografía y Superficie",
      codigo: "ENG.MOD.v2.4",
      categoria: "geotecnia",
      Icono: IconoTopografia,
      color: "#06b6d4",
      descripcion: "Malla de elevación triangulada, curvas de nivel y cubicación volumétrica.",
      metricaClave: metricas.puntosActivo,
      etiquetas: ["Nubes de Puntos", "Curvas de Nivel", "Corte / Relleno"],
    },
    {
      id: "geomecanica" as ModuloId,
      nombre: "Geomecánica del Macizo",
      codigo: "ENG.MOD.v2.4",
      categoria: "geotecnia",
      Icono: IconoGeomecanica,
      color: "#eab308",
      descripcion: "Clasificación geomecánica RMR, Q de Barton y soporte de sostenimiento.",
      metricaClave: metricas.rmrActivo,
      etiquetas: ["RMR Bieniawski", "Q Barton", "Soporte Túneles"],
    },
    {
      id: "estereografia" as ModuloId,
      nombre: "Estereografía Estructural",
      codigo: "ENG.MOD.v2.4",
      categoria: "geotecnia",
      Icono: IconoEstereografia,
      color: "#10b981",
      descripcion: "Proyección estereográfica de igual área, análisis cinemático de taludes.",
      metricaClave: metricas.familiasActivo,
      etiquetas: ["Red Schmidt", "Análisis Cinemático", "Polos y Planos"],
    },
    {
      id: "acarreo" as ModuloId,
      nombre: "Acarreo y Transporte",
      codigo: "ENG.MOD.v2.4",
      categoria: "operacion",
      Icono: IconoAcarreo,
      color: "#ef4444",
      descripcion: "Simulación de ciclo, velocidades en rampa, cálculo de flota óptima.",
      metricaClave: metricas.acarreoActivo,
      etiquetas: ["Ciclo Pala-Camión", "Flota Óptima", "Costos Unitarios"],
    },
    {
      id: "modeloBloques" as ModuloId,
      nombre: "Modelo de Bloques y Recursos",
      codigo: "ENG.MOD.v2.4",
      categoria: "recursos",
      Icono: IconoBloques,
      color: "#a855f7",
      descripcion: "Sondajes de perforación, interpolación espacial 3D por ordinary kriging.",
      metricaClave: metricas.bloquesActivo,
      etiquetas: ["Sondajes DDH", "Kriging / IDW", "Ley de Corte 3D"],
    },
    {
      id: "modelo3d" as ModuloId,
      nombre: "Modelo 3D",
      codigo: "ENG.MOD.v2.4",
      categoria: "recursos",
      Icono: IconoModelo3D,
      color: "#38bdf8",
      descripcion: "Visualización 3D de modelos de bloques, sondajes, curvas de nivel y wireframes en capas.",
      metricaClave: metricas.modelo3dActivo,
      etiquetas: ["Capas Independientes", "Wireframes Datamine", "Importar/Compartir"],
    },
  ];

  const modulosFiltrados = modulos.filter((m) => {
    if (categoria === "todas") return true;
    return m.categoria === categoria;
  });

  function handleExportar() {
    const nombre = `proyecto-mineria-${new Date().toISOString().slice(0, 10)}.json`;
    descargarTexto(nombre, exportarProyectoJSON(), "application/json");
    setMensaje("Proyecto exportado exitosamente.");
    setTimeout(() => setMensaje(null), 4000);
  }

  function handleCargarPlantilla(id: string) {
    if (
      !window.confirm(
        "¿Cargar esta plantilla? Se configurarán los parámetros de ejemplo para todo el proyecto."
      )
    ) {
      return;
    }
    const ok = aplicarPlantilla(id);
    if (ok) {
      setMensaje("Plantilla cargada. Actualizando espacio...");
      setTimeout(() => window.location.reload(), 500);
    }
  }

  function handleGuardarComo() {
    const nombre = window.prompt("Nombre para guardar este proyecto en el dispositivo (ej. Mina Sur - Fase 2):");
    if (!nombre || !nombre.trim()) return;
    guardarProyectoComo(nombre.trim());
    setProyectos(listarProyectosGuardados());
    setMensaje(`Guardado como "${nombre.trim()}".`);
    setTimeout(() => setMensaje(null), 3500);
  }

  function handleCargarProyecto(nombre: string) {
    if (!window.confirm(`¿Cargar el proyecto "${nombre}"? Reemplazará los datos actuales.`)) return;
    const res = cargarProyectoGuardado(nombre);
    setMensaje(res.mensaje);
    if (res.ok) setTimeout(() => window.location.reload(), 400);
  }

  function handleEliminarProyecto(nombre: string) {
    if (!window.confirm(`¿Eliminar el proyecto guardado "${nombre}"?`)) return;
    eliminarProyectoGuardado(nombre);
    setProyectos(listarProyectosGuardados());
  }

  return (
    <div className="mine-mobile-wrapper">
      <div className="mine-dashboard">
        {/* Notificación flotante */}
        {mensaje && <div className="dashboard-toast">{mensaje}</div>}

        {/* Barra superior de telemetría de dispositivo móvil / minero */}
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

        {/* Cabecera Principal: Título + Badge Satelital */}
        <header className="mine-app-header">
          <div>
            <h1 className="mine-app-title">Suite Minera</h1>
            <span className="mine-app-version">v3.88 · OFFLINE</span>
          </div>

          <button
            type="button"
            className={`mine-badge-satelital ${modoConexion === "satelital" ? "satelital-activo" : "local-activo"}`}
            onClick={() => setModoConexion((m) => (m === "satelital" ? "local" : "satelital"))}
            title="Alternar modo de sincronización"
          >
            <span className="satelital-dot" />
            {modoConexion === "satelital" ? "SATELITAL" : "LOCAL CACHE"}
          </button>
        </header>

        {/* Banner de advertencia de sistema offline */}
        <div className="mine-banner-offline">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>SISTEMA PRINCIPAL OFFLINE — ALMACENANDO LOCAL</span>
        </div>

        {/* 4 Métricas Clave / KPIs (Grid 2x2 en móvil) */}
        <section className="mine-kpis-grid">
          {/* Perforación */}
          <div className="mine-kpi-card" onClick={() => onSeleccionarModulo("malla")}>
            <div className="mine-kpi-header">
              <span className="mine-kpi-dot" style={{ backgroundColor: "#f97316" }} />
              <span className="mine-kpi-label">PERFORACIÓN</span>
            </div>
            <strong className="mine-kpi-value">{metricas.taladrosNum}</strong>
            <span className="mine-kpi-sub">{metricas.taladrosSub}</span>
          </div>

          {/* Topografía */}
          <div className="mine-kpi-card" onClick={() => onSeleccionarModulo("topografia")}>
            <div className="mine-kpi-header">
              <span className="mine-kpi-dot" style={{ backgroundColor: "#06b6d4" }} />
              <span className="mine-kpi-label">TOPOGRAFÍA</span>
            </div>
            <strong className="mine-kpi-value">{metricas.puntosNum}</strong>
            <span className="mine-kpi-sub">{metricas.puntosSub}</span>
          </div>

          {/* Macizo Rocoso */}
          <div className="mine-kpi-card" onClick={() => onSeleccionarModulo("geomecanica")}>
            <div className="mine-kpi-header">
              <span className="mine-kpi-dot" style={{ backgroundColor: "#eab308" }} />
              <span className="mine-kpi-label">MACIZO ROCOSO</span>
            </div>
            <strong className="mine-kpi-value">{metricas.rmrNum}</strong>
            <span className="mine-kpi-sub">{metricas.rmrSub}</span>
          </div>

          {/* Flota Acarreo */}
          <div className="mine-kpi-card" onClick={() => onSeleccionarModulo("acarreo")}>
            <div className="mine-kpi-header">
              <span className="mine-kpi-dot" style={{ backgroundColor: "#ef4444" }} />
              <span className="mine-kpi-label">FLOTA ACARREO</span>
            </div>
            <strong className="mine-kpi-value">{metricas.acarreoNum}</strong>
            <span className="mine-kpi-sub">{metricas.acarreoSub}</span>
          </div>
        </section>

        {/* Título de Sección de Módulos Técnicos */}
        <section className="mine-modules-section" id="seccion-modulos">
          <div className="mine-section-title-wrap">
            <h2 className="mine-section-title">Módulos Técnicos</h2>
            <p className="mine-section-sub">Selecciona el módulo en el que deseas operar:</p>
          </div>

          {/* Filtro por categoría estilo chips */}
          <div className="mine-category-chips">
            <button
              type="button"
              className={`mine-chip ${categoria === "todas" ? "chip-activo" : ""}`}
              onClick={() => setCategoria("todas")}
            >
              Todos ({modulos.length})
            </button>
            <button
              type="button"
              className={`mine-chip ${categoria === "operacion" ? "chip-activo" : ""}`}
              onClick={() => setCategoria("operacion")}
            >
              Operación
            </button>
            <button
              type="button"
              className={`mine-chip ${categoria === "geotecnia" ? "chip-activo" : ""}`}
              onClick={() => setCategoria("geotecnia")}
            >
              Geotecnia
            </button>
            <button
              type="button"
              className={`mine-chip ${categoria === "recursos" ? "chip-activo" : ""}`}
              onClick={() => setCategoria("recursos")}
            >
              Recursos
            </button>
          </div>

          {/* Lista de Tarjetas de Módulos Técnicos */}
          <div className="mine-cards-list">
            {modulosFiltrados.map((m) => {
              const { Icono } = m;
              return (
                <article
                  key={m.id}
                  className="mine-module-card"
                  style={{ "--mod-color": m.color } as React.CSSProperties}
                  onClick={() => onSeleccionarModulo(m.id)}
                >
                  <div className="mine-module-card-top">
                    <div
                      className="mine-module-icon-box"
                      style={{
                        backgroundColor: `${m.color}18`,
                        borderColor: `${m.color}55`,
                        color: m.color,
                      }}
                    >
                      <Icono />
                    </div>

                    <div className="mine-module-titles">
                      <h3 className="mine-module-name">{m.nombre}</h3>
                      <span className="mine-module-code">{m.codigo}</span>
                    </div>
                  </div>

                  <p className="mine-module-desc">{m.descripcion}</p>

                  {/* Estado activo con chip monoespaciado */}
                  <div className="mine-status-badge">
                    <span className="mine-status-dot" style={{ backgroundColor: m.color }} />
                    <span className="mine-status-text">
                      Estado activo: <span className="mine-mono-val">{m.metricaClave}</span>
                    </span>
                  </div>

                  {/* Botón Abrir Módulo con borde de color y flecha */}
                  <button
                    type="button"
                    className="mine-btn-open-module"
                    style={{
                      borderColor: `${m.color}88`,
                      color: m.color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeleccionarModulo(m.id);
                    }}
                  >
                    Abrir Módulo <span>→</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Acceso a Plantillas Rápidas */}
        <section className="mine-plantillas-panel">
          <div className="mine-section-title-wrap">
            <h3 className="mine-section-title" style={{ fontSize: 16 }}>Escenarios y Plantillas Demo</h3>
            <p className="mine-section-sub">Carga configuraciones reales con un toque</p>
          </div>

          <div className="mine-plantillas-scroll">
            {PLANTILLAS_DEMO.map((p) => (
              <div key={p.id} className="mine-plantilla-mini-card">
                <div
                  className="mini-plantilla-icon-box"
                  style={{
                    backgroundColor: `${p.color}15`,
                    borderColor: `${p.color}44`,
                  }}
                >
                  <IconoPlantilla id={p.id} color={p.color} />
                </div>
                <div className="mini-plantilla-info">
                  <strong>{p.nombre}</strong>
                  <span>{p.subtitulo}</span>
                </div>
                <button
                  type="button"
                  className="btn-cargar-mini"
                  onClick={() => handleCargarPlantilla(p.id)}
                >
                  Cargar
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Modal de Alertas del Sistema */}
        {modalAlertas && (
          <div className="modal-overlay" onClick={() => setModalAlertas(false)}>
            <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🔔 Centro de Diagnóstico & Alertas</h3>
                <button type="button" className="btn-cerrar" onClick={() => setModalAlertas(false)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div className="mine-alert-item alert-warning">
                  <div className="alert-badge-pill">GEOTECNIA</div>
                  <div>
                    <strong>Criterio Hoek-Brown / RMR</strong>
                    <p>Frente de avance en roca Clase II (UCS 80 MPa). Factor de sostenimiento recomendado: Pernos sistemáticos 2.5m + Shotcrete 50mm.</p>
                  </div>
                </div>

                <div className="mine-alert-item alert-info">
                  <div className="alert-badge-pill">SINCRONIZACIÓN</div>
                  <div>
                    <strong>Almacenamiento Local Activo</strong>
                    <p>Todos los cálculos y mallas se guardan en IndexedDB / LocalStorage de este terminal. Listo para trabajar bajo tierra sin internet.</p>
                  </div>
                </div>

                <div className="mine-alert-item alert-success">
                  <div className="alert-badge-pill">FLOTA ACARREO</div>
                  <div>
                    <strong>Capacidad Operativa</strong>
                    <p>4 camiones de 100t asignados a ciclo de rampa. Tiempo de ciclo estimado: 18.4 min con factor de acoplamiento óptimo.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Gestión de Proyectos */}
        {modalProyectos && (
          <div className="modal-overlay" onClick={() => setModalProyectos(false)}>
            <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📁 Proyectos en este dispositivo</h3>
                <button type="button" className="btn-cerrar" onClick={() => setModalProyectos(false)}>
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <p style={{ fontSize: 13, color: "var(--texto-tenue)", margin: "0 0 14px" }}>
                  Almacenamiento en este dispositivo. Puedes guardar versiones de distintas minas o fases.
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button type="button" className="btn btn-primario" onClick={handleGuardarComo} style={{ flex: 1 }}>
                    💾 Guardar como…
                  </button>
                  <button type="button" className="btn" onClick={handleExportar}>
                    ⬇ Exportar
                  </button>
                  <button
                    type="button"
                    className="btn btn-peligro"
                    onClick={() => {
                      if (window.confirm("¿Restablecer todo a los valores por defecto?")) {
                        limpiarProyectoLocal();
                        window.location.reload();
                      }
                    }}
                  >
                    ✕ Limpiar
                  </button>
                </div>

                {proyectos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "var(--texto-tenue)", fontSize: 13 }}>
                    No tienes proyectos guardados aún. Usa "Guardar como…" para respaldar el estado actual.
                  </div>
                ) : (
                  <ul className="lista-proyectos-modal">
                    {proyectos.map((p) => (
                      <li key={p.nombre} className="item-proyecto-modal">
                        <div>
                          <strong>{p.nombre}</strong>
                          <span className="fecha-proyecto">{new Date(p.actualizado).toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleCargarProyecto(p.nombre)}
                          >
                            Cargar
                          </button>
                          <button
                            type="button"
                            className="btn btn-peligro btn-sm"
                            onClick={() => handleEliminarProyecto(p.nombre)}
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Barra de Navegación Inferior Flotante & Responsiva */}
        <nav className="mine-bottom-nav">
          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "dashboard" ? "nav-activo" : ""}`}
            onClick={() => {
              setTabActivo("dashboard");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill={tabActivo === "dashboard" ? "currentColor" : "none"} fillOpacity={tabActivo === "dashboard" ? "0.2" : "0"} />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill={tabActivo === "dashboard" ? "currentColor" : "none"} fillOpacity={tabActivo === "dashboard" ? "0.2" : "0"} />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill={tabActivo === "dashboard" ? "currentColor" : "none"} fillOpacity={tabActivo === "dashboard" ? "0.2" : "0"} />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill={tabActivo === "dashboard" ? "currentColor" : "none"} fillOpacity={tabActivo === "dashboard" ? "0.2" : "0"} />
              </svg>
            </div>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "modulos" ? "nav-activo" : ""}`}
            onClick={() => {
              setTabActivo("modulos");
              const el = document.getElementById("seccion-modulos");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" fill={tabActivo === "modulos" ? "currentColor" : "none"} fillOpacity={tabActivo === "modulos" ? "0.2" : "0"} />
                <path d="M2 12l10 5 10-5" />
                <path d="M2 17l10 5 10-5" />
              </svg>
            </div>
            <span>Módulos</span>
          </button>

          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "alertas" ? "nav-activo" : ""}`}
            onClick={() => {
              setTabActivo("alertas");
              setModalAlertas(true);
            }}
          >
            <div className="mine-nav-icon-wrap nav-icon-badge-wrap">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill={tabActivo === "alertas" ? "currentColor" : "none"} fillOpacity={tabActivo === "alertas" ? "0.2" : "0"} />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="nav-badge-pill">3</span>
            </div>
            <span>Alertas</span>
          </button>

          <button
            type="button"
            className={`mine-nav-item ${tabActivo === "perfil" ? "nav-activo" : ""}`}
            onClick={() => {
              setTabActivo("perfil");
              setModalProyectos(true);
            }}
          >
            <div className="mine-nav-icon-wrap">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill={tabActivo === "perfil" ? "currentColor" : "none"} fillOpacity={tabActivo === "perfil" ? "0.2" : "0"} />
                <circle cx="12" cy="7" r="4" fill={tabActivo === "perfil" ? "currentColor" : "none"} fillOpacity={tabActivo === "perfil" ? "0.2" : "0"} />
              </svg>
            </div>
            <span>Perfil</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
