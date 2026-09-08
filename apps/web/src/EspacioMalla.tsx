import { useEffect, useMemo, useState } from "react";
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
import EditorPoligono2D from "./components/EditorPoligono2D.js";
import EditorTaladros from "./components/EditorTaladros.js";
import EditorFrenteTunel from "./components/EditorFrenteTunel.js";
import PanelDisenoMalla from "./components/PanelDisenoMalla.js";
import PanelDisenoTunel from "./components/PanelDisenoTunel.js";
import PanelDerecho, { type SubPestanaDerecha } from "./components/PanelDerecho.js";
import PanelDerechoTunel from "./components/PanelDerechoTunel.js";
import type { EntradaVoladuraUI } from "./components/PanelVoladura.js";
import { descargarTexto } from "./utils/descargar.js";
import { EXPLOSIVOS_PRESET } from "./data/presets.js";
import { usePersistedState } from "./hooks/usePersistedState.js";
import { useExplosivoGlobal } from "./hooks/useExplosivoGlobal.js";

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
    const { generarReporteMalla } = await import("./utils/reportePdf.js");
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
          {mensaje}
        </div>
      )}

      {/* Barra Superior Profesional del Taller 3D */}
      <header className="taller-top-bar">
        <div className="taller-top-left">
          <button
            type="button"
            className="btn-taller-back"
            onClick={() => {
              setVistaActual("cad");
            }}
            title="Volver al Editor CAD interactivo"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Volver al Editor CAD</span>
          </button>

          {onVolverAlPortal && (
            <button
              type="button"
              className="btn-taller-portal"
              onClick={onVolverAlPortal}
              title="Volver al Portal Principal"
            >
              Portal
            </button>
          )}
        </div>

        {/* Selector de Modo Segmentado - Prioridad a Galería Subterránea */}
        <div className="taller-segmented-control">
          <button
            type="button"
            className="taller-segment-btn"
            onClick={() => {
              setVistaActual("cad");
            }}
            title="Ir al Editor CAD 2D/3D"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span>Editor CAD (2D/3D)</span>
          </button>
          <button
            type="button"
            className={`taller-segment-btn ${modoDiseno === "tunel" ? "segment-active" : ""}`}
            onClick={() => setModoDiseno("tunel")}
          >
            Galería / Túnel (subterráneo)
          </button>
          <button
            type="button"
            className={`taller-segment-btn ${modoDiseno === "banco" ? "segment-active" : ""}`}
            onClick={() => setModoDiseno("banco")}
            title="Diseño de banco superficial (opcional)"
          >
            Banco (cielo abierto · preliminar)
          </button>
        </div>

        <div className="taller-top-right">
          <span className="taller-mode-tag" style={{ color: modoDiseno === "tunel" ? "#f97316" : "#06b6d4" }}>
            {modoDiseno === "tunel" ? "MÓDULO SUBTERRÁNEO · GALERÍA DE AVANCE" : "MÓDULO SUPERFICIE · BANCO"}
          </span>
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
              <span>← Editor CAD</span>
            </button>
            <button type="button" data-activo={pestana === "diseno"} onClick={() => irAPestana("diseno")}>
              Diseño
            </button>
            <button type="button" data-activo={pestana === "3d"} onClick={() => irAPestana("3d")}>
              Frente
            </button>
            <button type="button" data-activo={pestana === "tabla"} onClick={() => irAPestana("tabla")}>
              Taladros
            </button>
            <button type="button" data-activo={pestana === "voladura"} onClick={() => irAPestana("voladura")}>
              Voladura
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
              Vista 3D
            </button>
            <button type="button" data-activo={modoVisor === "editarCresta"} onClick={() => setModoVisor("editarCresta")}>
              Dibujar cresta 2D
            </button>
            <button type="button" data-activo={modoVisor === "editarTaladros"} onClick={() => setModoVisor("editarTaladros")}>
              Editar taladros
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
                {capas.map((c) => (
                  <div className="item" key={c.id}>
                    <span className="swatch" style={{ background: c.color }} />
                    {c.nombre}
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
          <span>← Editor CAD</span>
        </button>
        <button type="button" data-activo={pestana === "diseno"} onClick={() => irAPestana("diseno")}>
          Diseño
        </button>
        <button type="button" data-activo={pestana === "3d"} onClick={() => irAPestana("3d")}>
          Vista 3D
        </button>
        <button type="button" data-activo={pestana === "tabla"} onClick={() => irAPestana("tabla")}>
          Taladros
        </button>
        <button type="button" data-activo={pestana === "voladura"} onClick={() => irAPestana("voladura")}>
          Voladura
        </button>
      </nav>
        </>
      )}
    </>
  );
}
