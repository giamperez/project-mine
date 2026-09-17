import { useEffect, useMemo, useState } from "react";
import {
  disenarCarguioVoladura,
  disenarVoladura,
  evaluarResultadoVoladura,
  type ConfigCarguio,
  type PatronIniciacion,
} from "@suite/core";
import PanelMalla from "./components/PanelMalla.js";
import PanelCarguio from "./components/PanelCarguio.js";
import PanelRetardos from "./components/PanelRetardos.js";
import PanelResultados from "./components/PanelResultados.js";
import PanelSimulacion from "./components/PanelSimulacion.js";
import type { ProyectoVoladura } from "./proyectosVoladura.js";

type PestanaVoladura = "malla" | "carguio" | "retardos" | "resultados" | "simulacion";

const PESTANAS: Array<{ id: PestanaVoladura; numero: number; etiqueta: string }> = [
  { id: "malla", numero: 1, etiqueta: "Malla" },
  { id: "carguio", numero: 2, etiqueta: "Carguío" },
  { id: "retardos", numero: 3, etiqueta: "Retardos" },
  { id: "resultados", numero: 4, etiqueta: "Resultados" },
  { id: "simulacion", numero: 5, etiqueta: "Simulación" },
];

interface Props {
  proyecto: ProyectoVoladura;
  onVolver: () => void;
  onGuardarProyecto: (p: ProyectoVoladura) => void;
}

export default function TallerVoladura({ proyecto, onVolver, onGuardarProyecto }: Props) {
  const [pestana, setPestana] = useState<PestanaVoladura>("malla");
  const [config, setConfig] = useState<ConfigCarguio>(proyecto.config);
  const [patronIniciacion, setPatronIniciacion] = useState<PatronIniciacion>(proyecto.patronIniciacion);
  const [msPorMetroBurden, setMsPorMetroBurden] = useState(proyecto.msPorMetroBurden);
  const [msPorMetroEspaciamiento, setMsPorMetroEspaciamiento] = useState(proyecto.msPorMetroEspaciamiento);
  const [densidadRoca_tm3, setDensidadRoca_tm3] = useState(proyecto.densidadRoca_tm3);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [tiempoActual_ms, setTiempoActual_ms] = useState(0);

  const { snapshot } = proyecto;

  useEffect(() => {
    onGuardarProyecto({
      ...proyecto,
      config,
      patronIniciacion,
      msPorMetroBurden,
      msPorMetroEspaciamiento,
      densidadRoca_tm3,
      fechaModificacion: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, patronIniciacion, msPorMetroBurden, msPorMetroEspaciamiento, densidadRoca_tm3]);

  const carguio = useMemo(() => disenarCarguioVoladura(snapshot.taladros, config), [snapshot.taladros, config]);

  const explosivoRetardo = useMemo(() => {
    const base = config.produccion.cargar ? config.produccion.explosivo : config.arranque.explosivo;
    return { nombre: base.nombre, densidadGcm3: base.densidadGcm3, fuerzaRelativaANFO: (base.rwsPeso || 100) / 100 };
  }, [config]);

  const resultadoVoladura = useMemo(
    () =>
      disenarVoladura({
        taladros: snapshot.taladros,
        burden_m: snapshot.burden_m,
        espaciamiento_m: snapshot.espaciamiento_m,
        alturaBanco_m: snapshot.alturaBanco_m,
        explosivo: explosivoRetardo,
        patronIniciacion,
        msPorMetroBurden,
        msPorMetroEspaciamiento,
        esTunel: snapshot.esTunel,
      }),
    [snapshot, explosivoRetardo, patronIniciacion, msPorMetroBurden, msPorMetroEspaciamiento]
  );

  const rwsPromedio = useMemo(() => {
    const activos = Object.values(config).filter((c) => c.cargar);
    if (activos.length === 0) return 100;
    return activos.reduce((acc, c) => acc + (c.explosivo.rwsPeso || 100), 0) / activos.length;
  }, [config]);

  const evaluacion = useMemo(
    () =>
      evaluarResultadoVoladura({
        carguio,
        burden_m: snapshot.burden_m,
        espaciamiento_m: snapshot.espaciamiento_m,
        alturaBanco_m: snapshot.alturaBanco_m,
        densidadRoca_tm3,
        rwsPromedio,
      }),
    [carguio, snapshot, densidadRoca_tm3, rwsPromedio]
  );

  useEffect(() => {
    if (!reproduciendo) return;
    const DURACION_VISUAL_MS = 5000;
    const duracionReal_ms = Math.max(resultadoVoladura.duracionTotalSecuencia_ms, 1);
    const escala = duracionReal_ms / DURACION_VISUAL_MS;
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

  return (
    <div className="portal-mobile-wrapper">
      <div className="portal-container">
        <header className="taller-top-bar">
          <div className="taller-top-left">
            <button type="button" className="btn-taller-portal" onClick={onVolver} title="Volver al portal de Voladura">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Portal</span>
            </button>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff1f2" }}>Voladura · {proyecto.nombre}</div>
            <div style={{ fontSize: 10, color: "#fda4af" }}>Guardado automático activo</div>
          </div>
          <div className="taller-top-right" />
        </header>

        <nav
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "8px 2px",
          }}
        >
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              style={{
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: "nowrap",
                border: pestana === p.id ? "1px solid #fb7185" : "1px solid var(--borde)",
                background: pestana === p.id ? "linear-gradient(135deg,#f43f5e,#be123c)" : "rgba(15,23,42,0.6)",
                color: pestana === p.id ? "#fff" : "var(--texto-tenue)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: pestana === p.id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                }}
              >
                {p.numero}
              </span>
              {p.etiqueta}
            </button>
          ))}
        </nav>

        <main style={{ paddingBottom: 24 }}>
          {pestana === "malla" && <PanelMalla snapshot={snapshot} />}
          {pestana === "carguio" && (
            <PanelCarguio
              config={config}
              onCambiarConfig={setConfig}
              densidadRoca_tm3={densidadRoca_tm3}
              onCambiarDensidadRoca={setDensidadRoca_tm3}
            />
          )}
          {pestana === "retardos" && (
            <PanelRetardos
              esTunel={snapshot.esTunel}
              patronIniciacion={patronIniciacion}
              onCambiarPatron={setPatronIniciacion}
              msPorMetroBurden={msPorMetroBurden}
              onCambiarMsPorMetroBurden={setMsPorMetroBurden}
              msPorMetroEspaciamiento={msPorMetroEspaciamiento}
              onCambiarMsPorMetroEspaciamiento={setMsPorMetroEspaciamiento}
              resultadoVoladura={resultadoVoladura}
              cargasDetalladas={carguio.cargas}
            />
          )}
          {pestana === "resultados" && (
            <PanelResultados evaluacion={evaluacion} carguio={carguio} resultadoVoladura={resultadoVoladura} />
          )}
          {pestana === "simulacion" && (
            <PanelSimulacion
              taladros={snapshot.taladros}
              resultadoVoladura={resultadoVoladura}
              sobrerotura_cm={evaluacion.sobrerotura_cm}
              reproduciendo={reproduciendo}
              tiempoActual_ms={tiempoActual_ms}
              onPlay={handlePlay}
              onPausar={handlePausar}
              onReiniciar={handleReiniciar}
            />
          )}
        </main>
      </div>
    </div>
  );
}
