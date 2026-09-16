import { useMemo, useState, useRef, type CSSProperties } from "react";
import {
  agruparFamiliasEsfericas,
  analizarCinematicaCompleta,
  analizarEstereografia,
  calcularContornosDensidad,
  calcularDensidadPolos,
  calcularSMR,
  type Discontinuidad,
  type Hemisferio,
  type MetodoExcavacionSMR,
  type ModoDensidad,
  type ModoElementos,
  type TaludEstereografia,
  type TipoFallaSMR,
  type TipoProyeccion,
} from "@suite/core";
import {
  exportarDiscontinuidadesCSV,
  importarDiscontinuidadesDesdeCSV,
  FORMATO_IMPORTACION_DISCONTINUIDADES,
} from "@suite/mining-stereonet";
import EstereogramaSVG from "./components/EstereogramaSVG.js";
import DiagramaRosaRumbos from "./components/DiagramaRosaRumbos.js";
import PanelDatosEstereografia from "./components/PanelDatosEstereografia.js";
import PanelResultadosEstereografia from "./components/PanelResultadosEstereografia.js";
import { descargarTexto } from "../../utils/descargar.js";
import { leerArchivoTabularComoTexto } from "../../utils/leerArchivo.js";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import {
  IconoVolver,
  IconoRed2D,
  IconoParametros,
  IconoCinematica,
  IconoInspeccionar,
  IconoAgregarPolo,
  IconoEtiquetas,
  IconoRosaRumbos,
  IconoCamara,
} from "./components/IconosEstereonet.js";

type Pestana = "datos" | "estereograma" | "resultados";
type VistaCentral = "estereograma" | "rosaRumbos";

const NIVELES_CONTORNO_PCT = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const DISCONTINUIDADES_DEMO: Discontinuidad[] = [
  { id: "D-1", nombre: "J1", dip_grados: 40, dipDirection_grados: 185 },
  { id: "D-2", nombre: "J2", dip_grados: 65, dipDirection_grados: 260 },
  { id: "D-3", nombre: "J3", dip_grados: 75, dipDirection_grados: 10 },
  { id: "D-4", nombre: "J4", dip_grados: 55, dipDirection_grados: 150 },
];

let contadorDiscontinuidad = 100;

interface EspacioEstereografiaProps {
  onVolverAlPortal?: () => void;
  onVolverDashboard?: () => void;
}

export default function EspacioEstereografia({
  onVolverAlPortal,
  onVolverDashboard,
}: EspacioEstereografiaProps = {}) {
  const [pestana, setPestana] = useState<Pestana>("estereograma");
  const [vistaCentral, setVistaCentral] = useState<VistaCentral>("estereograma");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [discontinuidades, setDiscontinuidades] = usePersistedState<Discontinuidad[]>(
    "estereografia.discontinuidades",
    DISCONTINUIDADES_DEMO
  );
  const [talud, setTalud] = usePersistedState<TaludEstereografia>("estereografia.talud", { dip_grados: 60, dipDirection_grados: 180 });
  const [anguloFriccion_grados, setAnguloFriccion] = usePersistedState("estereografia.anguloFriccion_grados", 30);
  const [toleranciaDireccion_grados, setTolerancia] = usePersistedState("estereografia.toleranciaDireccion_grados", 20);
  const [modoAgregarTocando, setModoAgregarTocando] = useState(false);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(true);

  // --- Vista de la red: proyeccion/hemisferio/elementos/densidad ---
  const [proyeccion, setProyeccion] = usePersistedState<TipoProyeccion>("estereografia.proyeccion", "schmidt");
  const [hemisferio, setHemisferio] = usePersistedState<Hemisferio>("estereografia.hemisferio", "inferior");
  const [elementos, setElementos] = usePersistedState<ModoElementos>("estereografia.elementos", "polos");
  const [modoDensidad, setModoDensidad] = usePersistedState<ModoDensidad>("estereografia.modoDensidad", "ninguna");
  const [radioConteo_grados, setRadioConteo] = usePersistedState("estereografia.radioConteo_grados", 24);

  // --- Familias estructurales (k-means esferico) ---
  const [numeroFamilias, setNumeroFamilias] = usePersistedState("estereografia.numeroFamilias", 4);

  // --- SMR (vinculo con mining.geomechanics: RMR basico + geometria cinematica ya calculada aqui) ---
  const [rmrBasicoSMR, setRmrBasicoSMR] = usePersistedState("estereografia.rmrBasicoSMR", 50);
  const [discontinuidadSmrId, setDiscontinuidadSmrId] = usePersistedState<string | null>("estereografia.discontinuidadSmrId", null);
  const [tipoFallaSMR, setTipoFallaSMR] = usePersistedState<TipoFallaSMR>("estereografia.tipoFallaSMR", "planar");
  const [metodoExcavacionSMR, setMetodoExcavacionSMR] = usePersistedState<MetodoExcavacionSMR>(
    "estereografia.metodoExcavacionSMR",
    "voladura_o_mecanico"
  );

  const radarFrameRef = useRef<HTMLDivElement>(null);

  const resultado = useMemo(
    () =>
      analizarEstereografia({
        discontinuidades,
        talud,
        anguloFriccion_grados,
        toleranciaDireccion_grados,
      }),
    [discontinuidades, talud, anguloFriccion_grados, toleranciaDireccion_grados]
  );

  const agrupamiento = useMemo(
    () => agruparFamiliasEsfericas(discontinuidades, numeroFamilias),
    [discontinuidades, numeroFamilias]
  );

  const densidad = useMemo(
    () =>
      modoDensidad === "ninguna"
        ? null
        : calcularDensidadPolos(discontinuidades, radioConteo_grados, proyeccion, hemisferio),
    [discontinuidades, radioConteo_grados, proyeccion, hemisferio, modoDensidad]
  );

  const contornos = useMemo(
    () => (modoDensidad === "contornos" && densidad ? calcularContornosDensidad(densidad, NIVELES_CONTORNO_PCT) : []),
    [modoDensidad, densidad]
  );

  const cinematica = useMemo(
    () =>
      analizarCinematicaCompleta(discontinuidades, {
        talud,
        anguloFriccion_grados,
        limiteLateral_grados: toleranciaDireccion_grados,
      }),
    [discontinuidades, talud, anguloFriccion_grados, toleranciaDireccion_grados]
  );

  const discontinuidadSmr =
    discontinuidades.find((d) => d.id === discontinuidadSmrId) ?? discontinuidades[0] ?? null;

  const smr = useMemo(
    () =>
      discontinuidadSmr
        ? calcularSMR({
            rmrBasico: rmrBasicoSMR,
            discontinuidad: discontinuidadSmr,
            talud,
            tipoFalla: tipoFallaSMR,
            metodoExcavacion: metodoExcavacionSMR,
          })
        : null,
    [discontinuidadSmr, rmrBasicoSMR, talud, tipoFallaSMR, metodoExcavacionSMR]
  );

  async function handleImportarCSV(archivo: File) {
    const texto = await leerArchivoTabularComoTexto(archivo);
    const nuevas = importarDiscontinuidadesDesdeCSV(texto);
    if (nuevas.length === 0) {
      setMensaje(FORMATO_IMPORTACION_DISCONTINUIDADES);
      return;
    }
    setDiscontinuidades(nuevas);
    setMensaje(`${nuevas.length} discontinuidades importadas exitosamente.`);
  }

  function handleExportarCSV() {
    descargarTexto("discontinuidades.csv", exportarDiscontinuidadesCSV(discontinuidades), "text/csv");
  }

  function handleTocarRed(dip_grados: number, dipDirection_grados: number) {
    contadorDiscontinuidad++;
    const nombre = `J${discontinuidades.length + 1}`;
    setDiscontinuidades((prev) => [
      ...prev,
      { id: `D-${contadorDiscontinuidad}`, nombre, dip_grados: Math.round(dip_grados * 10) / 10, dipDirection_grados: Math.round(dipDirection_grados) },
    ]);
    setMensaje(`Polo registrado como ${nombre}: dip ${Math.round(dip_grados)}° / dir ${Math.round(dipDirection_grados)}°.`);
  }

  function capturarImagenRed() {
    const svgEl = radarFrameRef.current?.querySelector("svg");
    if (!svgEl) return;

    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#051411";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = `estereograma_${talud.dip_grados}_${talud.dipDirection_grados}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setMensaje("Imagen PNG en alta definición descargada.");
        }
      };
      image.src = blobURL;
    } catch {
      setMensaje("No fue posible generar la imagen PNG.");
    }
  }

  const tieneRiesgo =
    resultado.resumen.riesgoPlanar > 0 ||
    resultado.resumen.riesgoVuelco > 0 ||
    resultado.resumen.cunasFactibles > 0;

  const accionVolver = onVolverAlPortal || onVolverDashboard;

  return (
    <div className="estereo-container" style={{ "--acento": "#10b981", "--acento-suave": "#34d399" } as CSSProperties}>
      {/* Header superior limpio y responsivo (no se desborda en teléfonos) */}
      <header className="estereo-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {accionVolver && (
            <button
              type="button"
              className="estereo-btn-volver"
              onClick={accionVolver}
              title="Volver al Portal Principal"
            >
              <IconoVolver />
              <span>Volver</span>
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.06em", color: "#f1f5f9" }}>
              ESTEREOGRAFÍA
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: "#34d399",
                background: "rgba(16, 185, 129, 0.16)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                padding: "1px 6px",
                borderRadius: 6,
                letterSpacing: "0.04em",
              }}
            >
              SMR
            </span>
          </div>
        </div>

        {/* Acciones del encabezado: Captura de pantalla PNG */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={capturarImagenRed}
            title="Exportar imagen de alta resolución (PNG)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(6, 26, 20, 0.85)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <IconoCamara />
            <span style={{ fontSize: 10.5 }}>PNG</span>
          </button>
        </div>
      </header>

      {/* Toast de notificación rápida */}
      {mensaje && (
        <div
          style={{
            position: "absolute",
            top: 54,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(4, 16, 13, 0.95)",
            border: "1px solid rgba(16, 185, 129, 0.45)",
            borderRadius: 30,
            padding: "8px 20px",
            color: "#34d399",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(16, 185, 129, 0.25)",
            cursor: "pointer",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: 8,
            backdropFilter: "blur(12px)",
          }}
          onClick={() => setMensaje(null)}
        >
          <span>{mensaje}</span>
          <span style={{ color: "#64748b", fontSize: 11 }}>(cerrar)</span>
        </div>
      )}

      {/* Workspace principal con 3 áreas de ingeniería */}
      <main className="estereo-workspace">
        {/* Panel izquierdo: Entrada de datos, talud y discontinuidades */}
        <PanelDatosEstereografia
          discontinuidades={discontinuidades}
          onCambiarDiscontinuidades={setDiscontinuidades}
          talud={talud}
          onCambiarTalud={setTalud}
          anguloFriccion_grados={anguloFriccion_grados}
          onCambiarAnguloFriccion={setAnguloFriccion}
          toleranciaDireccion_grados={toleranciaDireccion_grados}
          onCambiarTolerancia={setTolerancia}
          onImportarCSV={handleImportarCSV}
          onExportarCSV={handleExportarCSV}
          proyeccion={proyeccion}
          onCambiarProyeccion={setProyeccion}
          hemisferio={hemisferio}
          onCambiarHemisferio={setHemisferio}
          elementos={elementos}
          onCambiarElementos={setElementos}
          modoDensidad={modoDensidad}
          onCambiarModoDensidad={setModoDensidad}
          radioConteo_grados={radioConteo_grados}
          onCambiarRadioConteo={setRadioConteo}
          densidadMaxima_pct={densidad?.densidadMaxima_pct ?? 0}
          numeroFamilias={numeroFamilias}
          onCambiarNumeroFamilias={setNumeroFamilias}
          oculto={pestana !== "datos"}
        />

        {/* Viewport central: Red estereográfica SVG / Rosa de rumbos */}
        <div className="estereo-viewport" data-oculto={pestana !== "estereograma"}>
          <div className="estereo-viewport-toolbar">
            {/* Selector de modo central: Estereograma vs Rosa de Rumbos (ubicado aquí para no saturar el header) */}
            <div
              style={{
                display: "inline-flex",
                background: "rgba(6, 24, 19, 0.7)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: 8,
                padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setVistaCentral("estereograma")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 11,
                  fontWeight: vistaCentral === "estereograma" ? 700 : 500,
                  background: vistaCentral === "estereograma" ? "rgba(16, 185, 129, 0.3)" : "transparent",
                  color: vistaCentral === "estereograma" ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <IconoRed2D width={13} height={13} />
                <span>Red 2D</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaCentral("rosaRumbos")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 11,
                  fontWeight: vistaCentral === "rosaRumbos" ? 700 : 500,
                  background: vistaCentral === "rosaRumbos" ? "rgba(16, 185, 129, 0.3)" : "transparent",
                  color: vistaCentral === "rosaRumbos" ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <IconoRosaRumbos width={13} height={13} />
                <span>Rosa</span>
              </button>
            </div>

            {vistaCentral === "estereograma" && (
              <div className="estereo-mode-pill">
                <button
                  type="button"
                  className={`estereo-mode-btn ${!modoAgregarTocando ? "activo" : ""}`}
                  onClick={() => setModoAgregarTocando(false)}
                >
                  <IconoInspeccionar />
                  <span>Inspeccionar</span>
                </button>
                <button
                  type="button"
                  className={`estereo-mode-btn ${modoAgregarTocando ? "activo" : ""}`}
                  onClick={() => setModoAgregarTocando(true)}
                >
                  <IconoAgregarPolo />
                  <span>Agregar</span>
                </button>
              </div>
            )}

            {vistaCentral === "estereograma" && (
              <button
                type="button"
                onClick={() => setMostrarEtiquetas(!mostrarEtiquetas)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: mostrarEtiquetas ? "rgba(16, 185, 129, 0.22)" : "rgba(6, 24, 19, 0.6)",
                  border: `1px solid ${mostrarEtiquetas ? "#10b981" : "rgba(255, 255, 255, 0.1)"}`,
                  color: mostrarEtiquetas ? "#ffffff" : "#94a3b8",
                  padding: "5px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <IconoEtiquetas />
                <span>{mostrarEtiquetas ? "Etiquetas" : "Sin etiq."}</span>
              </button>
            )}
          </div>

          <div className="estereo-canvas-container">
            <div className="estereo-radar-frame" ref={radarFrameRef}>
              {vistaCentral === "estereograma" ? (
                <EstereogramaSVG
                  discontinuidades={discontinuidades}
                  talud={talud}
                  anguloFriccion_grados={anguloFriccion_grados}
                  analisis={resultado.analisisPlanoVuelco}
                  tamanoPx={480}
                  onTocarRed={modoAgregarTocando ? handleTocarRed : undefined}
                  proyeccion={proyeccion}
                  hemisferio={hemisferio}
                  elementos={elementos}
                  contornos={modoDensidad === "contornos" ? contornos : undefined}
                  densidadGrid={modoDensidad === "mapa" ? densidad?.grid : undefined}
                  familias={agrupamiento.familias}
                  mostrarEtiquetas={mostrarEtiquetas}
                />
              ) : (
                <DiagramaRosaRumbos discontinuidades={discontinuidades} tamanoPx={440} />
              )}
            </div>

            {/* Pastilla flotante con telemetry resumida (útil en teléfonos) */}
            <div
              className="estereo-hud-banner"
              onClick={() => setPestana("resultados")}
              title="Toca para ver el análisis detallado"
              style={{ cursor: "pointer" }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: tieneRiesgo ? "#fca5a5" : "#6ee7b7", whiteSpace: "nowrap" }}>
                {tieneRiesgo
                  ? `${resultado.resumen.riesgoPlanar} Planar · ${resultado.resumen.cunasFactibles} Cuña(s) factibles`
                  : "Talud cinemáticamente estable"}
              </div>
              <span
                style={{
                  fontSize: 10,
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#34d399",
                  padding: "2px 7px",
                  borderRadius: 999,
                  fontWeight: 800,
                }}
              >
                Ver resultados →
              </span>
            </div>
          </div>
        </div>

        {/* Panel derecho: Análisis cinemático, cuñas, familias, SMR y calculadora FOS */}
        <PanelResultadosEstereografia
          discontinuidades={discontinuidades}
          resultado={resultado}
          agrupamiento={agrupamiento}
          cinematica={cinematica}
          smr={smr}
          rmrBasicoSMR={rmrBasicoSMR}
          onCambiarRmrBasicoSMR={setRmrBasicoSMR}
          discontinuidadSmrId={discontinuidadSmr?.id ?? null}
          onCambiarDiscontinuidadSmrId={setDiscontinuidadSmrId}
          tipoFallaSMR={tipoFallaSMR}
          onCambiarTipoFallaSMR={setTipoFallaSMR}
          metodoExcavacionSMR={metodoExcavacionSMR}
          onCambiarMetodoExcavacionSMR={setMetodoExcavacionSMR}
          oculto={pestana !== "resultados"}
        />
      </main>

      {/* Dock de Navegación Inferior (Botones abajo con iconos y texto sin cortes) */}
      <nav className="estereo-bottom-nav">
        <div className="estereo-bottom-tabs-grid">
          <button
            type="button"
            className={`estereo-bottom-tab-btn ${pestana === "estereograma" ? "activo" : ""}`}
            onClick={() => setPestana("estereograma")}
          >
            <IconoRed2D width={19} height={19} />
            <span>Red 2D</span>
          </button>
          <button
            type="button"
            className={`estereo-bottom-tab-btn ${pestana === "datos" ? "activo" : ""}`}
            onClick={() => setPestana("datos")}
          >
            <IconoParametros width={19} height={19} />
            <span>Entrada &amp; Talud</span>
          </button>
          <button
            type="button"
            className={`estereo-bottom-tab-btn ${pestana === "resultados" ? "activo" : ""}`}
            onClick={() => setPestana("resultados")}
          >
            <IconoCinematica width={19} height={19} />
            <span>Cinemática &amp; SMR</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
