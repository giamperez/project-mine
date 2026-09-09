import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULTS_VOLADURA,
  calcularArranqueHolmberg,
  calcularGeometriaFrente,
  disenarMallaPerforacion,
  disenarVoladura,
  type EntradaArranqueHolmberg,
  type EntradaMallaPerforacion,
  type GeometriaFrenteTunel,
  type Taladro,
  type TaladroTunel,
} from "@suite/core";
import { exportarTaladrosCSV, exportarTaladrosDXF, importarCrestaBancoDesdeDXF } from "@suite/mining-blast-pattern";
import { exportarSecuenciaCSV } from "@suite/mining-blasting";
import type { EstadoCapa } from "@suite/engine";
import EditorCadMalla from "./components/EditorCadMalla.js";
import Visor3D from "./components/Visor3D.js";
import { EditorPoligono2D } from "../../components/shared/index.js";
import EditorTaladros from "./components/EditorTaladros.js";
import EditorFrenteTunel from "./components/EditorFrenteTunel.js";
import PanelDisenoMalla from "./components/PanelDisenoMalla.js";
import PanelDisenoTunel from "./components/PanelDisenoTunel.js";
import PanelDerecho, { type SubPestanaDerecha } from "./components/PanelDerecho.js";
import PanelDerechoTunel from "./components/PanelDerechoTunel.js";
import type { EntradaVoladuraUI } from "./components/PanelVoladura.js";
import { descargarTexto } from "../../utils/descargar.js";
import { EXPLOSIVOS_PRESET } from "../../data/presets.js";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import { useExplosivoGlobal } from "../../hooks/useExplosivoGlobal.js";

type Pestana = "diseno" | "3d" | "tabla" | "voladura";
type ModoVisor = "3d" | "editarCresta" | "editarTaladros";
type ModoDiseno = "banco" | "tunel";

const DURACION_VISUAL_ANIMACION_MS = 5000;

function rectangulo(largo: number, ancho: number) {
  return [
    { x: 0, y: 0 },
    { x: largo, y: 0 },
    { x: largo, y: ancho },
    { x: 0, y: ancho },
  ];
}

interface EspacioMallaProps {
  proyectoId?: string;
  onVolverAlPortal?: () => void;
}

export default function EspacioMalla({ proyectoId = "malla-1", onVolverAlPortal }: EspacioMallaProps = {}) {
  const esNuevaMalla = proyectoId !== "malla-1";
  const [vistaActual, setVistaActual] = useState<"cad" | "taller3d">("cad");
  const [modoDiseno, setModoDiseno] = usePersistedState<ModoDiseno>("malla.modoDiseno", "tunel");
  const { explosivo: explosivoGlobal, propiedadesExplosivoCompat } = useExplosivoGlobal();

  const [geometriaTunel, setGeometriaTunel] = usePersistedState<GeometriaFrenteTunel>("malla.tunel.geometria", {
    tipo: "herradura",
    ancho_m: 4.5,
    alto_m: 4.5,
  });
  const [entradaArranqueTunel, setEntradaArranqueTunel] = usePersistedState<EntradaArranqueHolmberg>("malla.tunel.arranque", {
    diametroIndividualAlivio_mm: 102,
    numeroTaladrosAlivio: 4,
    avance_m: 3.2,
  });
  const [taladrosTunel, setTaladrosTunel] = usePersistedState<TaladroTunel[]>(`malla.${proyectoId}.tunel.taladros`, []);
  const resultadoGeometriaTunel = useMemo(() => calcularGeometriaFrente(geometriaTunel), [geometriaTunel]);
  const resultadoArranqueTunel = useMemo(() => calcularArranqueHolmberg(entradaArranqueTunel), [entradaArranqueTunel]);

  const [largoRectangulo, setLargoRectangulo] = usePersistedState("malla.largoRectangulo", 24);
  const [anchoRectangulo, setAnchoRectangulo] = usePersistedState("malla.anchoRectangulo", 16);
  const [pestana, setPestana] = useState<Pestana>("diseno");
  const [modoVisor, setModoVisor] = useState<ModoVisor>("3d");
  const [subPestanaDerecha, setSubPestanaDerecha] = useState<SubPestanaDerecha>("tabla");
  const [capas, setCapas] = useState<EstadoCapa[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [entrada, setEntrada] = usePersistedState<EntradaMallaPerforacion>(`malla.${proyectoId}.entrada`, () =>
    esNuevaMalla
      ? {
          poligonoCresta: [],
          cotaCresta: 4500,
          alturaBanco_m: 10,
          diametroMm: 89,
          densidadRocaGcm3: 2.7,
          tipoRoca: "media",
          explosivo: EXPLOSIVOS_PRESET[0],
        }
      : {
          poligonoCresta: rectangulo(24, 16),
          cotaCresta: 4500,
          alturaBanco_m: 10,
          diametroMm: 89,
          densidadRocaGcm3: 2.7,
          tipoRoca: "media",
          explosivo: EXPLOSIVOS_PRESET[0],
        }
  );

  // Sincronizar explosivo global de Perú con la entrada de perforación
  useEffect(() => {
    setEntrada((prev) => {
      if (
        !prev.explosivo ||
        prev.explosivo.nombre !== explosivoGlobal.nombre ||
        prev.explosivo.densidadGcm3 !== explosivoGlobal.densidadGcm3 ||
        prev.explosivo.fuerzaRelativaANFO !== explosivoGlobal.fuerzaRelativaANFO
      ) {
        return { ...prev, explosivo: propiedadesExplosivoCompat };
      }
      return prev;
    });
  }, [explosivoGlobal, propiedadesExplosivoCompat, setEntrada]);

  const [entradaVoladura, setEntradaVoladura] = usePersistedState<EntradaVoladuraUI>("malla.entradaVoladura", {
    patronIniciacion: "echelon",
    msPorMetroBurden: DEFAULTS_VOLADURA.msPorMetroBurden,
    msPorMetroEspaciamiento: DEFAULTS_VOLADURA.msPorMetroEspaciamiento,
  });

  const [reproduciendo, setReproduciendo] = useState(false);
  const [tiempoActual_ms, setTiempoActual_ms] = useState(0);

  const [menuExportarAbierto, setMenuExportarAbierto] = useState(false);
  const menuExportarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickAfuera(e: MouseEvent) {
      if (menuExportarRef.current && !menuExportarRef.current.contains(e.target as Node)) {
        setMenuExportarAbierto(false);
      }
    }
    if (menuExportarAbierto) {
      document.addEventListener("mousedown", handleClickAfuera);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickAfuera);
    };
  }, [menuExportarAbierto]);

  const resultado = useMemo(() => disenarMallaPerforacion(entrada), [entrada]);

  // null = usar la grilla auto-generada por formula (resultado.taladros); no-null = edicion manual
  // (agregar/mover/eliminar taladros sueltos) que reemplaza esa grilla en toda la app hasta que se
  // regenera explicitamente.
  const [taladrosManuales, setTaladrosManuales] = usePersistedState<Taladro[] | null>(
    `malla.${proyectoId}.taladrosManuales`,
    () => (esNuevaMalla ? [] : null)
  );
  const taladrosEfectivos =
    taladrosManuales ??
    (entrada.poligonoCresta && entrada.poligonoCresta.length >= 3 ? resultado.taladros : []);
  const resultadoEfectivo = useMemo(() => ({ ...resultado, taladros: taladrosEfectivos }), [resultado, taladrosEfectivos]);

  const resultadoVoladura = useMemo(
    () =>
      disenarVoladura({
        taladros: taladrosEfectivos,
        burden_m: resultado.burdenDiseno_m,
        espaciamiento_m: resultado.espaciamiento_m,
        alturaBanco_m: entrada.alturaBanco_m,
        explosivo: entrada.explosivo,
        patronIniciacion: entradaVoladura.patronIniciacion,
        msPorMetroBurden: entradaVoladura.msPorMetroBurden,
        msPorMetroEspaciamiento: entradaVoladura.msPorMetroEspaciamiento,
      }),
    [taladrosEfectivos, resultado.burdenDiseno_m, resultado.espaciamiento_m, entrada.alturaBanco_m, entrada.explosivo, entradaVoladura]
  );

  const opcionesEscena = useMemo(
    () => ({
      poligonoCresta: entrada.poligonoCresta,
      cotaCresta: entrada.cotaCresta,
      alturaBanco_m: entrada.alturaBanco_m,
    }),
    [entrada.poligonoCresta, entrada.cotaCresta, entrada.alturaBanco_m]
  );

  // Reproduccion de la secuencia de iniciacion: siempre dura ~5s en pantalla, sin importar los
  // ms reales de la voladura (que suelen ser demasiado breves para percibirse).
  useEffect(() => {
    if (!reproduciendo) return;
    const duracionReal_ms = Math.max(resultadoVoladura.duracionTotalSecuencia_ms, 1);
    const escala = duracionReal_ms / DURACION_VISUAL_ANIMACION_MS;
    let cuadro: number;
    let inicio: number | null = null;

    const tick = (t: number) => {
      if (inicio === null) inicio = t;
      const nuevo = (t - inicio) * escala;
      if (nuevo >= duracionReal_ms + 200) {
        setTiempoActual_ms(duracionReal_ms + 200);
        setReproduciendo(false);
        return;
      }
      setTiempoActual_ms(nuevo);
      cuadro = requestAnimationFrame(tick);
    };
    cuadro = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(cuadro);
  }, [reproduciendo, resultadoVoladura.duracionTotalSecuencia_ms]);

  function handleCambiarRectangulo(largo: number, ancho: number) {
    setLargoRectangulo(largo);
    setAnchoRectangulo(ancho);
    setEntrada((prev) => ({ ...prev, poligonoCresta: rectangulo(largo, ancho) }));
  }

  async function handleImportarDXF(archivo: File) {
    const texto = await archivo.text();
    const resultadoImport = importarCrestaBancoDesdeDXF(texto);
    if (!resultadoImport) {
      setMensaje("No se encontró ninguna polilínea (LWPOLYLINE/POLYLINE) en el DXF importado.");
      return;
    }
    setEntrada((prev) => ({
      ...prev,
      poligonoCresta: resultadoImport.poligonoCresta,
      cotaCresta: resultadoImport.cotaDetectada || prev.cotaCresta,
    }));
    setMensaje(`Cresta importada: ${resultadoImport.poligonoCresta.length} vértices.`);
  }

  function handleExportarDXF() {
    descargarTexto("malla-perforacion.dxf", exportarTaladrosDXF(resultadoEfectivo), "application/dxf");
  }

  function handleExportarCSV() {
    descargarTexto("malla-perforacion.csv", exportarTaladrosCSV(resultadoEfectivo), "text/csv");
  }

  async function handleExportarPDF() {
    const { generarReporteMalla } = await import("../../utils/reportePdf.js");
    const doc = generarReporteMalla(entrada, resultadoEfectivo, resultadoVoladura);
    doc.save("reporte-malla-perforacion.pdf");
  }

  function handleExportarSecuenciaCSV() {
    descargarTexto("secuencia-voladura.csv", exportarSecuenciaCSV(resultadoVoladura), "text/csv");
  }

  function handlePlay() {
    if (tiempoActual_ms >= resultadoVoladura.duracionTotalSecuencia_ms) setTiempoActual_ms(0);
    setReproduciendo(true);
  }

  function handlePausar() {
    setReproduciendo(false);
  }

  function handleReiniciar() {
    setReproduciendo(false);
    setTiempoActual_ms(0);
  }

  function irAPestana(nueva: Pestana) {
    setPestana(nueva);
    if (nueva === "tabla" || nueva === "voladura") setSubPestanaDerecha(nueva);
  }

  if (vistaActual === "cad") {
    return (
      <EditorCadMalla
        proyectoId={proyectoId}
        poligonoCresta={entrada.poligonoCresta}
        onCambiarPoligono={(nuevos) => setEntrada({ ...entrada, poligonoCresta: nuevos })}
        taladros={taladrosEfectivos}
        onCambiarTaladros={setTaladrosManuales}
        onIrARender={() => {
          setModoDiseno("tunel");
          setVistaActual("taller3d");
        }}
        onVolver={() => onVolverAlPortal?.()}
      />
    );
  }

  return (
    <>
      {mensaje && (
        <div className="mensaje-notificacion" role="status">
          <span className="cad-toast-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <span className="cad-toast-text">{mensaje}</span>
        </div>
      )}

      {/* Barra Superior Profesional del Taller 3D */}
      <header className="taller-top-bar">
        <div className="taller-top-left">
          {onVolverAlPortal && (
            <button
              type="button"
              className="btn-taller-portal"
              onClick={onVolverAlPortal}
              title="Volver al Portal Principal"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Portal</span>
            </button>
          )}
        </div>

        {/* Selector de Modo Segmentado Compacto y Acoplado */}
        <div className="taller-segmented-control">
          <button
            type="button"
            className={`taller-segment-btn ${modoDiseno === "banco" ? "segment-active" : ""}`}
            onClick={() => setModoDiseno("banco")}
            title="Módulo Subterráneo (Diseño de Banco y Malla de Perforación)"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 21h18M5 21V7l7-4 7 4v14" />
              <path d="M9 10a3 3 0 0 1 6 0v11H9V10z" />
            </svg>
            <span>Subterráneo (Malla)</span>
          </button>
          <button
            type="button"
            className={`taller-segment-btn ${modoDiseno === "tunel" ? "segment-active" : ""}`}
            onClick={() => setModoDiseno("tunel")}
            title="Módulo Cielo Abierto (Frente de Avance y Galerías)"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
            <span>Cielo Abierto (Frente)</span>
          </button>
        </div>

        <div className="taller-top-right">
          {/* Picker Desplegable de Exportación CAD en la esquina superior derecha */}
          <div className="export-picker-wrapper" ref={menuExportarRef}>
            <button
              type="button"
              className="btn-export-picker"
              onClick={() => setMenuExportarAbierto((prev) => !prev)}
              data-activo={menuExportarAbierto}
              title="Opciones de exportación de Malla y Taladros"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exportar</span>
              <svg
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: menuExportarAbierto ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.18s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {menuExportarAbierto && (
              <div className="export-picker-dropdown">
                <button
                  type="button"
                  className="export-picker-item"
                  onClick={() => {
                    handleExportarDXF();
                    setMenuExportarAbierto(false);
                  }}
                >
                  <span className="export-item-icon dxf-icon">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </span>
                  <div className="export-item-info">
                    <span className="export-item-title">Exportar DXF</span>
                    <span className="export-item-desc">Plano CAD (.dxf) para software minero</span>
                  </div>
                  <span className="export-item-tag tag-orange">.DXF</span>
                </button>

                <button
                  type="button"
                  className="export-picker-item"
                  onClick={() => {
                    handleExportarCSV();
                    setMenuExportarAbierto(false);
                  }}
                >
                  <span className="export-item-icon csv-icon">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                  <div className="export-item-info">
                    <span className="export-item-title">Exportar CSV</span>
                    <span className="export-item-desc">Coordenadas y cotas de taladros</span>
                  </div>
                  <span className="export-item-tag tag-green">.CSV</span>
                </button>

                <button
                  type="button"
                  className="export-picker-item"
                  onClick={() => {
                    handleExportarPDF();
                    setMenuExportarAbierto(false);
                  }}
                >
                  <span className="export-item-icon pdf-icon">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  <div className="export-item-info">
                    <span className="export-item-title">Reporte Técnico PDF</span>
                    <span className="export-item-desc">Balance volumétrico y cálculos de diseño</span>
                  </div>
                  <span className="export-item-tag tag-cyan">.PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {modoDiseno === "tunel" ? (
        <>
          <main className="app-main">
            <PanelDisenoTunel
              geometria={geometriaTunel}
              onCambiarGeometria={setGeometriaTunel}
              entradaArranque={entradaArranqueTunel}
              onCambiarEntradaArranque={setEntradaArranqueTunel}
              resultadoGeometria={resultadoGeometriaTunel}
              resultadoArranque={resultadoArranqueTunel}
              taladros={taladrosTunel}
              oculto={pestana !== "diseno"}
            />

            <div className="visor-contenedor" data-oculto={pestana !== "3d"}>
              <div className="visor-contenido">
                <EditorFrenteTunel taladros={taladrosTunel} onCambiarTaladros={setTaladrosTunel} />
              </div>
            </div>

            <PanelDerechoTunel
              subPestana={subPestanaDerecha}
              onCambiarSubPestana={setSubPestanaDerecha}
              taladros={taladrosTunel}
              resultadoGeometria={resultadoGeometriaTunel}
              entradaArranque={entradaArranqueTunel}
              oculto={pestana !== "tabla" && pestana !== "voladura"}
            />
          </main>

          <nav className="tabs-inferior">
            <button
              type="button"
              className="tab-inferior-back-cad"
              onClick={() => {
                setVistaActual("cad");
                setModoDiseno("banco");
              }}
              title="Volver al Editor CAD interactivo"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Editor CAD</span>
            </button>
            <button type="button" data-activo={pestana === "diseno"} onClick={() => irAPestana("diseno")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Diseño</span>
            </button>
            <button type="button" data-activo={pestana === "3d"} onClick={() => irAPestana("3d")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Frente</span>
            </button>
            <button type="button" data-activo={pestana === "tabla"} onClick={() => irAPestana("tabla")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span>Taladros</span>
            </button>
            <button type="button" data-activo={pestana === "voladura"} onClick={() => irAPestana("voladura")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
              <span>Voladura</span>
            </button>
          </nav>
        </>
      ) : (
        <>
      <main className="app-main">
        <PanelDisenoMalla
          entrada={entrada}
          onCambiarEntrada={setEntrada}
          resultado={resultadoEfectivo}
          largoRectangulo={largoRectangulo}
          anchoRectangulo={anchoRectangulo}
          onCambiarRectangulo={handleCambiarRectangulo}
          onImportarDXF={handleImportarDXF}
          onExportarDXF={handleExportarDXF}
          onExportarCSV={handleExportarCSV}
          onExportarPDF={handleExportarPDF}
          oculto={pestana !== "diseno"}
        />

        <div className="visor-contenedor" data-oculto={pestana !== "3d"}>
          <div className="visor-modo-toggle">
            <button type="button" data-activo={modoVisor === "3d"} onClick={() => setModoVisor("3d")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>Vista 3D</span>
            </button>
            <button type="button" data-activo={modoVisor === "editarCresta"} onClick={() => setModoVisor("editarCresta")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Dibujar cresta 2D</span>
            </button>
            <button type="button" data-activo={modoVisor === "editarTaladros"} onClick={() => setModoVisor("editarTaladros")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span>Editar taladros</span>
            </button>
          </div>
          <div className="visor-contenido">
            <div style={{ display: modoVisor === "3d" ? "contents" : "none" }}>
              <Visor3D
                resultado={resultadoEfectivo}
                opciones={opcionesEscena}
                resultadoVoladura={resultadoVoladura}
                tiempoAnimacion_ms={tiempoActual_ms}
                onCapas={setCapas}
              />
              <div className="capas-leyenda">
                <div className="leyenda-titulo">Capas 3D</div>
                {capas.map((c) => (
                  <div className="item" key={c.id}>
                    <span className="swatch" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                    <span>{c.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
            {modoVisor === "editarCresta" && (
              <EditorPoligono2D
                puntos={entrada.poligonoCresta}
                onCambiarPuntos={(nuevos) => setEntrada((prev) => ({ ...prev, poligonoCresta: nuevos }))}
              />
            )}
            {modoVisor === "editarTaladros" && (
              <EditorTaladros
                taladros={taladrosEfectivos}
                onCambiarTaladros={setTaladrosManuales}
                onRegenerarGrilla={() => setTaladrosManuales(null)}
                esManual={taladrosManuales !== null}
                defaults={{
                  cotaCresta: entrada.cotaCresta,
                  profundidad_m: resultado.profundidadTaladro_m,
                  diametroMm: entrada.diametroMm,
                  taco_m: resultado.taco_m,
                  longitudCarga_m: resultado.longitudCarga_m,
                }}
              />
            )}
          </div>
        </div>

        <PanelDerecho
          subPestana={subPestanaDerecha}
          onCambiarSubPestana={setSubPestanaDerecha}
          resultado={resultadoEfectivo}
          resultadoVoladura={resultadoVoladura}
          entradaVoladura={entradaVoladura}
          onCambiarEntradaVoladura={setEntradaVoladura}
          reproduciendo={reproduciendo}
          tiempoActual_ms={tiempoActual_ms}
          onPlay={handlePlay}
          onPausar={handlePausar}
          onReiniciar={handleReiniciar}
          onExportarSecuenciaCSV={handleExportarSecuenciaCSV}
          oculto={pestana !== "tabla" && pestana !== "voladura"}
        />
      </main>

      <nav className="tabs-inferior">
        <button
          type="button"
          className="tab-inferior-back-cad"
          onClick={() => {
            setVistaActual("cad");
            setModoDiseno("banco");
          }}
          title="Volver al Editor CAD interactivo"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Editor CAD</span>
        </button>
        <button type="button" data-activo={pestana === "diseno"} onClick={() => irAPestana("diseno")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Diseño</span>
        </button>
        <button type="button" data-activo={pestana === "3d"} onClick={() => irAPestana("3d")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span>Vista 3D</span>
        </button>
        <button type="button" data-activo={pestana === "tabla"} onClick={() => irAPestana("tabla")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span>Taladros</span>
        </button>
        <button type="button" data-activo={pestana === "voladura"} onClick={() => irAPestana("voladura")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
          <span>Voladura</span>
        </button>
      </nav>
        </>
      )}
    </>
  );
}
