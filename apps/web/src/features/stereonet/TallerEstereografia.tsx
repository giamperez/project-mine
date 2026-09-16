import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
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
import type { ProyectoEstereografico } from "./proyectosEstereografia.js";

type Pestana = "datos" | "estereograma" | "resultados";
type VistaCentral = "estereograma" | "rosaRumbos";

const NIVELES_CONTORNO_PCT = [10, 20, 30, 40, 50, 60, 70, 80, 90];

let contadorDiscontinuidad = 200;

interface TallerEstereografiaProps {
  proyecto: ProyectoEstereografico;
  onVolver: () => void;
  onGuardarProyecto?: (p: ProyectoEstereografico) => void;
}

export default function TallerEstereografia({
  proyecto,
  onVolver,
  onGuardarProyecto,
}: TallerEstereografiaProps) {
  const [pestana, setPestana] = useState<Pestana>("estereograma");
  const [vistaCentral, setVistaCentral] = useState<VistaCentral>("estereograma");
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Auto-descartar toast de notificación después de 3.5 segundos
  useEffect(() => {
    if (!mensaje) return;
    const timer = setTimeout(() => {
      setMensaje(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [mensaje]);
  const [discontinuidades, setDiscontinuidades] = useState<Discontinuidad[]>(
    () => (Array.isArray(proyecto.discontinuidades) && proyecto.discontinuidades.length > 0
      ? proyecto.discontinuidades
      : [
          { id: "D-1", nombre: "J1", dip_grados: 55, dipDirection_grados: 190 },
          { id: "D-2", nombre: "J2", dip_grados: 70, dipDirection_grados: 110 },
          { id: "D-3", nombre: "J3", dip_grados: 40, dipDirection_grados: 280 },
        ])
  );
  const [talud, setTalud] = useState<TaludEstereografia>(
    () => proyecto.talud || { dip_grados: 65, dipDirection_grados: 195 }
  );
  const [anguloFriccion_grados, setAnguloFriccion] = useState(
    () => (typeof proyecto.anguloFriccion_grados === "number" ? proyecto.anguloFriccion_grados : 34)
  );
  const [toleranciaDireccion_grados, setTolerancia] = useState(
    () => (typeof proyecto.toleranciaDireccion_grados === "number" ? proyecto.toleranciaDireccion_grados : 20)
  );
  const [modoAgregarTocando, setModoAgregarTocando] = useState(false);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(true);

  // Vista de la red
  const [proyeccion, setProyeccion] = useState<TipoProyeccion>(() => proyecto.proyeccion || "schmidt");
  const [hemisferio, setHemisferio] = useState<Hemisferio>(() => proyecto.hemisferio || "inferior");
  const [elementos, setElementos] = useState<ModoElementos>(() => proyecto.elementos || "polos");
  const [modoDensidad, setModoDensidad] = useState<ModoDensidad>(() => proyecto.modoDensidad || "ninguna");
  const [radioConteo_grados, setRadioConteo] = useState(() => proyecto.radioConteo_grados || 24);
  const [numeroFamilias, setNumeroFamilias] = useState(() => proyecto.numeroFamilias || 4);

  // SMR
  const [rmrBasicoSMR, setRmrBasicoSMR] = useState(() => proyecto.rmrBasicoSMR || 55);
  const [discontinuidadSmrId, setDiscontinuidadSmrId] = useState<string | null>(
    () => proyecto.discontinuidadSmrId || null
  );
  const [tipoFallaSMR, setTipoFallaSMR] = useState<TipoFallaSMR>(() => proyecto.tipoFallaSMR || "planar");
  const [metodoExcavacionSMR, setMetodoExcavacionSMR] = useState<MetodoExcavacionSMR>(
    () => proyecto.metodoExcavacionSMR || "voladura_o_mecanico"
  );

  const radarFrameRef = useRef<HTMLDivElement>(null);

  // Normalización defensiva de datos
  const discontinuidadesValidas = useMemo<Discontinuidad[]>(() => {
    if (!Array.isArray(discontinuidades) || discontinuidades.length === 0) {
      return [
        { id: "D-1", nombre: "J1", dip_grados: 55, dipDirection_grados: 190 },
        { id: "D-2", nombre: "J2", dip_grados: 70, dipDirection_grados: 110 },
      ];
    }
    return discontinuidades.map((d, i) => ({
      id: d?.id ?? `D-${i + 1}`,
      nombre: d?.nombre ?? `J${i + 1}`,
      dip_grados: typeof d?.dip_grados === "number" && !isNaN(d.dip_grados) ? d.dip_grados : 45,
      dipDirection_grados: typeof d?.dipDirection_grados === "number" && !isNaN(d.dipDirection_grados) ? d.dipDirection_grados : 0,
    }));
  }, [discontinuidades]);

  const taludValido = useMemo<TaludEstereografia>(() => {
    return {
      dip_grados: typeof talud?.dip_grados === "number" && !isNaN(talud.dip_grados) ? talud.dip_grados : 60,
      dipDirection_grados: typeof talud?.dipDirection_grados === "number" && !isNaN(talud.dipDirection_grados) ? talud.dipDirection_grados : 180,
    };
  }, [talud]);

  const anguloFriccionValido = typeof anguloFriccion_grados === "number" && !isNaN(anguloFriccion_grados) ? anguloFriccion_grados : 30;
  const toleranciaValida = typeof toleranciaDireccion_grados === "number" && !isNaN(toleranciaDireccion_grados) ? toleranciaDireccion_grados : 20;

  // Auto-guardado en el proyecto activo
  useEffect(() => {
    if (onGuardarProyecto) {
      onGuardarProyecto({
        ...proyecto,
        talud: taludValido,
        discontinuidades: discontinuidadesValidas,
        anguloFriccion_grados: anguloFriccionValido,
        toleranciaDireccion_grados: toleranciaValida,
        proyeccion,
        hemisferio,
        elementos,
        modoDensidad,
        radioConteo_grados,
        numeroFamilias,
        rmrBasicoSMR,
        discontinuidadSmrId,
        tipoFallaSMR,
        metodoExcavacionSMR,
        fechaModificacion: new Date().toISOString(),
      });
    }
  }, [
    taludValido,
    discontinuidadesValidas,
    anguloFriccionValido,
    toleranciaValida,
    proyeccion,
    hemisferio,
    elementos,
    modoDensidad,
    radioConteo_grados,
    numeroFamilias,
    rmrBasicoSMR,
    discontinuidadSmrId,
    tipoFallaSMR,
    metodoExcavacionSMR,
  ]);

  const resultado = useMemo(
    () =>
      analizarEstereografia({
        discontinuidades: discontinuidadesValidas,
        talud: taludValido,
        anguloFriccion_grados: anguloFriccionValido,
        toleranciaDireccion_grados: toleranciaValida,
      }),
    [discontinuidadesValidas, taludValido, anguloFriccionValido, toleranciaValida]
  );

  const agrupamiento = useMemo(
    () => agruparFamiliasEsfericas(discontinuidadesValidas, numeroFamilias),
    [discontinuidadesValidas, numeroFamilias]
  );

  const densidad = useMemo(
    () =>
      modoDensidad === "ninguna"
        ? null
        : calcularDensidadPolos(discontinuidadesValidas, radioConteo_grados, proyeccion, hemisferio),
    [discontinuidadesValidas, radioConteo_grados, proyeccion, hemisferio, modoDensidad]
  );

  const contornos = useMemo(
    () => (modoDensidad === "contornos" && densidad ? calcularContornosDensidad(densidad, NIVELES_CONTORNO_PCT) : []),
    [modoDensidad, densidad]
  );

  const cinematica = useMemo(
    () =>
      analizarCinematicaCompleta(discontinuidadesValidas, {
        talud: taludValido,
        anguloFriccion_grados: anguloFriccionValido,
        limiteLateral_grados: toleranciaValida,
      }),
    [discontinuidadesValidas, taludValido, anguloFriccionValido, toleranciaValida]
  );

  const discontinuidadSmr =
    discontinuidadesValidas.find((d) => d.id === discontinuidadSmrId) ?? discontinuidadesValidas[0] ?? null;

  const smr = useMemo(
    () =>
      discontinuidadSmr
        ? calcularSMR({
            rmrBasico: rmrBasicoSMR,
            discontinuidad: discontinuidadSmr,
            talud: taludValido,
            tipoFalla: tipoFallaSMR,
            metodoExcavacion: metodoExcavacionSMR,
          })
        : null,
    [discontinuidadSmr, rmrBasicoSMR, taludValido, tipoFallaSMR, metodoExcavacionSMR]
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
    descargarTexto(`${proyecto.nombre.replace(/\s+/g, "_")}_discontinuidades.csv`, exportarDiscontinuidadesCSV(discontinuidadesValidas), "text/csv");
  }

  function handleTocarRed(dip_grados: number, dipDirection_grados: number) {
    contadorDiscontinuidad++;
    const nombre = `J${discontinuidadesValidas.length + 1}`;
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
          downloadLink.download = `estereograma_${proyecto.nombre}_${taludValido.dip_grados}_${taludValido.dipDirection_grados}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          setMensaje("Imagen PNG descargada.");
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

  return (
    <div className="estereo-container" style={{ "--acento": "#10b981", "--acento-suave": "#34d399" } as CSSProperties}>
      {/* Header superior limpio y responsivo */}
      <header className="estereo-header">
        <div className="estereo-header-main">
          <button
            type="button"
            className="estereo-btn-volver"
            onClick={onVolver}
            title="Volver al Catálogo de Estudios"
          >
            <IconoVolver />
            <span className="estereo-btn-volver-txt">Estudios</span>
          </button>

          <div className="estereo-header-info">
            <span
              className="estereo-header-title"
              title={proyecto.nombre}
            >
              {proyecto.nombre}
            </span>
            <span className="estereo-header-smr">
              SMR {smr?.smr.toFixed(0) ?? "—"}
            </span>
          </div>
        </div>

        {/* Acciones del encabezado */}
        <div className="estereo-header-actions">
          <button
            type="button"
            onClick={capturarImagenRed}
            title="Exportar imagen de alta resolución (PNG)"
            className="estereo-btn-png"
          >
            <IconoCamara />
            <span>PNG</span>
          </button>
        </div>
      </header>

      {/* Workspace principal con 3 áreas de ingeniería */}
      <main className="estereo-workspace">
        {/* Panel izquierdo: Entrada de datos, talud y discontinuidades */}
        <PanelDatosEstereografia
          discontinuidades={discontinuidadesValidas}
          onCambiarDiscontinuidades={setDiscontinuidades}
          talud={taludValido}
          onCambiarTalud={setTalud}
          anguloFriccion_grados={anguloFriccionValido}
          onCambiarAnguloFriccion={setAnguloFriccion}
          toleranciaDireccion_grados={toleranciaValida}
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
          {/* Toast flotante discreto adentro del viewport */}
          {mensaje && (
            <div
              className="estereo-toast"
              onClick={() => setMensaje(null)}
              title="Toca para descartar"
            >
              <span className="estereo-toast-dot" />
              <span className="estereo-toast-text">{mensaje}</span>
              <button
                type="button"
                className="estereo-toast-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setMensaje(null);
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="estereo-viewport-toolbar">
            <div className="estereo-tab-pill">
              <button
                type="button"
                className={`estereo-tab-btn ${vistaCentral === "estereograma" ? "activo" : ""}`}
                onClick={() => setVistaCentral("estereograma")}
              >
                <IconoRed2D width={13} height={13} />
                <span>Red 2D</span>
              </button>
              <button
                type="button"
                className={`estereo-tab-btn ${vistaCentral === "rosaRumbos" ? "activo" : ""}`}
                onClick={() => setVistaCentral("rosaRumbos")}
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
                  <IconoInspeccionar width={13} height={13} />
                  <span>Inspeccionar</span>
                </button>
                <button
                  type="button"
                  className={`estereo-mode-btn ${modoAgregarTocando ? "activo" : ""}`}
                  onClick={() => setModoAgregarTocando(true)}
                >
                  <IconoAgregarPolo width={13} height={13} />
                  <span>Agregar</span>
                </button>
              </div>
            )}

            {vistaCentral === "estereograma" && (
              <button
                type="button"
                className={`estereo-toolbar-btn ${mostrarEtiquetas ? "activo" : ""}`}
                onClick={() => setMostrarEtiquetas(!mostrarEtiquetas)}
              >
                <IconoEtiquetas width={13} height={13} />
                <span>{mostrarEtiquetas ? "Etiquetas" : "Sin etiq."}</span>
              </button>
            )}
          </div>

          <div className="estereo-canvas-container">
            <div className="estereo-radar-frame" ref={radarFrameRef}>
              {vistaCentral === "estereograma" ? (
                <EstereogramaSVG
                  discontinuidades={discontinuidadesValidas}
                  talud={taludValido}
                  anguloFriccion_grados={anguloFriccionValido}
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
                <DiagramaRosaRumbos discontinuidades={discontinuidadesValidas} tamanoPx={440} />
              )}
            </div>

            {/* Pastilla flotante con telemetry resumida */}
            <div
              className="estereo-hud-banner"
              onClick={() => setPestana("resultados")}
              title="Toca para ver el análisis detallado"
              style={{ cursor: "pointer" }}
            >
              <div className="estereo-hud-text" style={{ color: tieneRiesgo ? "#fca5a5" : "#6ee7b7" }}>
                {tieneRiesgo
                  ? `${resultado.resumen.riesgoPlanar} Planar · ${resultado.resumen.cunasFactibles} Cuña(s)`
                  : "Talud cinemáticamente estable"}
              </div>
              <span className="estereo-hud-btn">
                Ver más →
              </span>
            </div>
          </div>
        </div>

        {/* Panel derecho: Análisis cinemático, cuñas, familias, SMR y calculadora FOS */}
        <PanelResultadosEstereografia
          discontinuidades={discontinuidadesValidas}
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
          talud={taludValido}
          anguloFriccion_grados={anguloFriccionValido}
          oculto={pestana !== "resultados"}
        />
      </main>

      {/* Dock de Navegación Inferior */}
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
