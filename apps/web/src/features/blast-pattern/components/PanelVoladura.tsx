import { useMemo, useState, useEffect, useRef } from "react";
import type { PatronIniciacion, ResultadoMallaPerforacion, ResultadoVoladura, Taladro } from "@suite/core";
import { SceneManager, LayerManager } from "@suite/engine";
import { construirEscenaMalla } from "@suite/mining-blast-pattern";
import { construirEscenaSecuencia, SecuenciaAnimador } from "@suite/mining-blasting";

export interface EntradaVoladuraUI {
  patronIniciacion: PatronIniciacion;
  msPorMetroBurden: number;
  msPorMetroEspaciamiento: number;
}

interface Props {
  entrada: EntradaVoladuraUI;
  onCambiarEntrada: (nueva: EntradaVoladuraUI) => void;
  resultado: ResultadoVoladura;
  resultadoMalla?: ResultadoMallaPerforacion;
  taladros?: Taladro[];
  reproduciendo: boolean;
  tiempoActual_ms: number;
  onPlay: () => void;
  onPausar: () => void;
  onReiniciar: () => void;
  onExportarCSV: () => void;
}

function MiniVisor3DVoladura({
  resultadoVoladura,
  taladros,
  resultadoMalla,
  tiempoActual_ms,
}: {
  resultadoVoladura: ResultadoVoladura;
  taladros?: Taladro[];
  resultadoMalla?: ResultadoMallaPerforacion;
  tiempoActual_ms: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<{ scene: SceneManager; layers: LayerManager; encuadrado: boolean } | null>(null);
  const animadorRef = useRef<SecuenciaAnimador | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new SceneManager({ contenedor: containerRef.current });
    const layers = new LayerManager(scene.escena);
    managerRef.current = { scene, layers, encuadrado: false };
    scene.iniciarLoop();
    return () => {
      scene.destruir();
      managerRef.current = null;
      animadorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (resultadoMalla && resultadoMalla.taladros.length > 0) {
      const xs = resultadoMalla.taladros.map((t) => t.collar.x);
      const ys = resultadoMalla.taladros.map((t) => t.collar.y);
      const minX = Math.min(...xs) - 4;
      const maxX = Math.max(...xs) + 4;
      const minY = Math.min(...ys) - 4;
      const maxY = Math.max(...ys) + 4;
      const poligonoCresta = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      construirEscenaMalla(manager.layers, resultadoMalla, {
        poligonoCresta,
        cotaCresta: resultadoMalla.taladros[0]?.collar.z ?? 100,
        alturaBanco_m: 10,
      });
      if (!manager.encuadrado) {
        const capaBanco = manager.layers.obtenerCapa("layer.mining.blast-pattern.bench");
        if (capaBanco) {
          manager.scene.encuadrarObjeto(capaBanco.grupo);
          manager.encuadrado = true;
        }
      }
    }
  }, [resultadoMalla]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !resultadoVoladura) return;
    animadorRef.current = construirEscenaSecuencia(manager.layers, resultadoVoladura, taladros ?? []);
    if (!manager.encuadrado) {
      manager.scene.encuadrarObjeto(manager.scene.escena);
      manager.encuadrado = true;
    }
  }, [resultadoVoladura, taladros]);

  useEffect(() => {
    animadorRef.current?.actualizarTiempo(tiempoActual_ms);
  }, [tiempoActual_ms]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        cursor: "grab",
      }}
    />
  );
}

const NOMBRES_PATRON: Record<PatronIniciacion, string> = {
  fila_por_fila: "Fila por fila",
  echelon: "Echelon (diagonal desde esquina)",
  v_corte: "V (diagonal desde el centro)",
};

function colorPorRetardo(tiempo_ms: number, duracionTotal_ms: number): string {
  const t = Math.max(0, Math.min(1, tiempo_ms / Math.max(duracionTotal_ms, 1)));
  if (t < 0.2) return "#06b6d4"; // cyan eléctrico (detonación inicial)
  if (t < 0.4) return "#10b981"; // esmeralda
  if (t < 0.7) return "#f59e0b"; // ambar
  return "#f97316"; // naranja fuego
}

export default function PanelVoladura({
  entrada,
  onCambiarEntrada,
  resultado,
  resultadoMalla,
  taladros,
  reproduciendo,
  tiempoActual_ms,
  onPlay,
  onPausar,
  onReiniciar,
  onExportarCSV,
}: Props) {
  const [modoVista, setModoVista] = useState<"3d" | "2d">("3d");
  const set = <K extends keyof EntradaVoladuraUI>(campo: K, valor: EntradaVoladuraUI[K]) =>
    onCambiarEntrada({ ...entrada, [campo]: valor });

  const duracionTotal = Math.max(resultado.duracionTotalSecuencia_ms, 1);
  const progreso = Math.min(tiempoActual_ms / duracionTotal, 1);

  // Mapear taladros con posiciones 2D reales y tiempos de detonación
  const itemsTaladros = useMemo(() => {
    if (!resultado.cargas || resultado.cargas.length === 0) return [];
    const mapaCollar = new Map(taladros?.map((t) => [t.id, t.collar]));

    return resultado.cargas.map((carga, idx) => {
      const collar = mapaCollar.get(carga.taladroId);
      const x = collar ? collar.x : carga.columna * 3;
      const y = collar ? collar.y : carga.fila * 3;
      return {
        id: carga.taladroId,
        x,
        y,
        tiempo_ms: carga.tiempoDetonacion_ms,
        fila: carga.fila,
        columna: carga.columna,
        indice: idx + 1,
      };
    });
  }, [resultado.cargas, taladros]);

  const CANVAS_W = 320;
  const CANVAS_H = 150;
  const PAD_X = 28;
  const PAD_Y = 24;

  // Proyectar coordenadas a píxeles exactos dentro del lienzo 320x150
  const taladrosProyectados = useMemo(() => {
    if (itemsTaladros.length === 0) return [];
    const xs = itemsTaladros.map((t) => t.x);
    const ys = itemsTaladros.map((t) => t.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 0.001);
    const spanY = Math.max(maxY - minY, 0.001);

    const availW = CANVAS_W - PAD_X * 2;
    const availH = CANVAS_H - PAD_Y * 2;

    const scale = Math.min(availW / spanX, availH / spanY);
    const offX = PAD_X + (availW - spanX * scale) / 2;
    const offY = PAD_Y + (availH - spanY * scale) / 2;

    return itemsTaladros.map((t) => {
      const px = offX + (t.x - minX) * scale;
      const py = CANVAS_H - offY - (t.y - minY) * scale;
      return {
        ...t,
        px,
        py,
      };
    });
  }, [itemsTaladros]);

  // Líneas de enlace de iniciación (amarre en secuencia)
  const lineasAmarreProyectadas = useMemo(() => {
    if (taladrosProyectados.length < 2) return [];
    const ordenados = [...taladrosProyectados].sort((a, b) => a.tiempo_ms - b.tiempo_ms);
    const enlaces: { x1: number; y1: number; x2: number; y2: number; tiempo: number }[] = [];
    for (let i = 0; i < ordenados.length - 1; i++) {
      enlaces.push({
        x1: ordenados[i].px,
        y1: ordenados[i].py,
        x2: ordenados[i + 1].px,
        y2: ordenados[i + 1].py,
        tiempo: ordenados[i + 1].tiempo_ms,
      });
    }
    return enlaces;
  }, [taladrosProyectados]);

  const detonadosCount = itemsTaladros.filter((t) => tiempoActual_ms >= t.tiempo_ms).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* 1. Secuencia de Iniciación */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#f97316", background: "rgba(249,115,22,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span>Secuencia de Iniciación</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="campo">
            <label>Patrón de amarre</label>
            <select
              value={entrada.patronIniciacion}
              onChange={(e) => set("patronIniciacion", e.target.value as PatronIniciacion)}
            >
              {Object.entries(NOMBRES_PATRON).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="fila-dos">
            <div className="campo">
              <label>Retardo entre filas (ms/m)</label>
              <input
                type="number"
                step={0.5}
                min={0}
                value={entrada.msPorMetroBurden}
                onChange={(e) => set("msPorMetroBurden", Number(e.target.value))}
              />
            </div>
            <div className="campo">
              <label>Retardo entre taladros (ms/m)</label>
              <input
                type="number"
                step={0.5}
                min={0}
                disabled={entrada.patronIniciacion === "fila_por_fila"}
                value={entrada.msPorMetroEspaciamiento}
                onChange={(e) => set("msPorMetroEspaciamiento", Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Carga y Factor de Carga */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#10b981", background: "rgba(16,185,129,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </span>
            <span>Carga y Factor de Carga</span>
          </div>
          <span className="panel-seccion-badge" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
            {resultado.cargas.length} cargas
          </span>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato dato-destacado">
              <span>Factor de carga</span>
              <b style={{ color: "#10b981" }}>{resultado.factorCarga_kgm3.toFixed(2)} kg/m³</b>
            </div>
            <div className="dato dato-destacado">
              <span>Peso total explosivo</span>
              <b style={{ color: "#f97316" }}>{resultado.pesoExplosivoTotal_kg.toFixed(0)} kg</b>
            </div>
            <div className="dato">
              <span>Carga lineal</span>
              <b>{resultado.cargaLineal_kgm.toFixed(2)} kg/m</b>
            </div>
            <div className="dato">
              <span>Volumen roca total</span>
              <b>{resultado.volumenRocaTotal_m3.toFixed(0)} m³</b>
            </div>
            <div className="dato">
              <span>Retardo entre filas</span>
              <b>{resultado.retardoEntreFilas_ms.toFixed(0)} ms</b>
            </div>
            <div className="dato">
              <span>Retardo entre taladros</span>
              <b>{resultado.retardoEntreTaladros_ms.toFixed(0)} ms</b>
            </div>
            <div className="dato">
              <span>Duración secuencia</span>
              <b style={{ color: "#38bdf8" }}>{resultado.duracionTotalSecuencia_ms.toFixed(0)} ms</b>
            </div>
          </div>
          {resultado.advertencias.length > 0 && (
            <div className="advertencias">
              {resultado.advertencias.map((a, i) => (
                <div className="advertencia" key={i}>
                  ⚠ {a}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Simulación Interactiva 3D/2D de Secuencia */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#f97316", background: "rgba(249,115,22,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <span>Simulación de Secuencia</span>
          </div>

          {/* Selector de modo 3D / 2D */}
          <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(15,23,42,0.7)", borderRadius: "6px", padding: "2px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              type="button"
              onClick={() => setModoVista("3d")}
              style={{
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 700,
                borderRadius: "4px",
                background: modoVista === "3d" ? "linear-gradient(135deg, #f97316, #ea580c)" : "transparent",
                color: modoVista === "3d" ? "#ffffff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
                boxShadow: modoVista === "3d" ? "0 2px 6px rgba(249,115,22,0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              🧊 3D Colapso
            </button>
            <button
              type="button"
              onClick={() => setModoVista("2d")}
              style={{
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 700,
                borderRadius: "4px",
                background: modoVista === "2d" ? "linear-gradient(135deg, #0284c7, #0369a1)" : "transparent",
                color: modoVista === "2d" ? "#ffffff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
                boxShadow: modoVista === "2d" ? "0 2px 6px rgba(2,132,199,0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              2D Planta
            </button>
          </div>
        </div>

        <div className="panel-seccion-body">
          {modoVista === "3d" ? (
            /* Mini Visor 3D Interactivo de Voladura y Colapso */
            <div
              className="simulacion-3d-container"
              style={{
                position: "relative",
                width: "100%",
                height: "190px",
                background: "#080c14",
                border: "1px solid rgba(249, 115, 22, 0.4)",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "10px",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.9), 0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              {/* HUD Superior 3D */}
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 10,
                  right: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94a3b8",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fb923c" }}>
                  <span className="pulse-dot" style={{ background: "#fb923c", width: 6, height: 6 }} />
                  3D FÍSICA: {tiempoActual_ms.toFixed(0)} ms
                </span>
                <span
                  style={{
                    background: "rgba(15,23,42,0.8)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(249,115,22,0.3)",
                    color: "#f97316",
                  }}
                >
                  {detonadosCount} / {itemsTaladros.length} Colapsados
                </span>
              </div>

              {/* HUD Inferior - Instrucción de cámara 3D */}
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 10,
                  fontSize: 9,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.4)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                🖱 Arrastra para rotar cámara 3D
              </div>

              <MiniVisor3DVoladura
                resultadoVoladura={resultado}
                resultadoMalla={resultadoMalla}
                taladros={taladros}
                tiempoActual_ms={tiempoActual_ms}
              />
            </div>
          ) : (
            /* Lienzo 2D Interactivo de la Detonación */
            <div
              className="simulacion-2d-container"
              style={{
                position: "relative",
                width: "100%",
                height: "165px",
                background: "radial-gradient(ellipse at center, rgba(14,22,38,0.98) 0%, rgba(6,10,18,0.98) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "10px",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8), 0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              {/* HUD de Telemetría sobre el Lienzo 2D */}
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 10,
                  right: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94a3b8",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#38bdf8" }}>
                  <span className="pulse-dot" style={{ background: "#38bdf8", width: 5, height: 5 }} />
                  FRENTE: {tiempoActual_ms.toFixed(0)} ms
                </span>
                <span style={{ color: "#38bdf8" }}>
                  ONDA: {((progreso * 100)).toFixed(0)}%
                </span>
              </div>

              <svg
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              >
                <defs>
                  {/* Cuadrícula de fondo */}
                  <pattern id="grid-voladura-mini" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
                  </pattern>
                  {/* Gradiente de onda expansiva */}
                  <radialGradient id="grad-onda-mini">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="35%" stopColor="#ffedd5" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#f97316" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <rect
                  x="0"
                  y="0"
                  width={CANVAS_W}
                  height={CANVAS_H}
                  fill="url(#grid-voladura-mini)"
                />

                {/* 1. Líneas de Amarre / Cuerdas de detonación */}
                {lineasAmarreProyectadas.map((lin, idx) => {
                  const encendida = tiempoActual_ms >= lin.tiempo;
                  return (
                    <line
                      key={`amarre-${idx}`}
                      x1={lin.x1}
                      y1={lin.y1}
                      x2={lin.x2}
                      y2={lin.y2}
                      stroke={encendida ? "#fb923c" : "rgba(255,255,255,0.12)"}
                      strokeWidth={encendida ? 1.5 : 1}
                      strokeDasharray={encendida ? undefined : "3,3"}
                      opacity={encendida ? 0.9 : 0.4}
                    />
                  );
                })}

                {/* 2. Taladros con estados interactivos de detonación */}
                {taladrosProyectados.map((t) => {
                  const colorBase = colorPorRetardo(t.tiempo_ms, duracionTotal);
                  const detonado = tiempoActual_ms >= t.tiempo_ms;
                  const deltaTiempo = tiempoActual_ms - t.tiempo_ms;
                  const detonandoAhora = deltaTiempo >= 0 && deltaTiempo <= Math.max(duracionTotal * 0.08, 50);

                  // Si ya detonó y pasó la onda, desvanecer y desaparecer suavemente
                  const opacidadRestante = detonado ? Math.max(0, 1 - deltaTiempo / 140) : 1;
                  if (opacidadRestante <= 0 && !detonandoAhora) {
                    return null;
                  }

                  return (
                    <g
                      key={t.id}
                      transform={`translate(${t.px}, ${t.py})`}
                      style={{ opacity: opacidadRestante, transition: "opacity 0.12s ease-out" }}
                    >
                      {/* Anillo de Onda Expansiva (Flash de detonación) */}
                      {detonandoAhora && (
                        <>
                          <circle
                            r={14}
                            fill="url(#grad-onda-mini)"
                            opacity={0.9}
                          />
                          <circle
                            r={11}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={1.2}
                            opacity={0.95}
                          />
                        </>
                      )}

                      {/* Cuerpo del Taladro */}
                      {detonado ? (
                        <>
                          <circle
                            r={4.5}
                            fill="#0f172a"
                            stroke="#f97316"
                            strokeWidth={1}
                          />
                          <circle
                            r={1.8}
                            fill="#ea580c"
                          />
                        </>
                      ) : (
                        <>
                          <circle
                            r={4.8}
                            fill="rgba(15, 23, 42, 0.9)"
                            stroke={colorBase}
                            strokeWidth={1.2}
                          />
                          <circle
                            r={2}
                            fill={colorBase}
                          />
                        </>
                      )}

                      {/* Etiqueta compacta con Retardo en ms (redondeada a entero) */}
                      {!detonado && (
                        <text
                          y={-6.5}
                          textAnchor="middle"
                          fontSize="6.8"
                          fontWeight="700"
                          fill={colorBase}
                          style={{ userSelect: "none", pointerEvents: "none" }}
                        >
                          {Math.round(t.tiempo_ms)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Barra de progreso y Controles */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--texto-tenue)", marginBottom: 4 }}>
            <span>Progreso: {(progreso * 100).toFixed(0)}%</span>
            <span>Tiempo: {tiempoActual_ms.toFixed(0)} / {resultado.duracionTotalSecuencia_ms.toFixed(0)} ms</span>
          </div>
          <div className="barra-progreso" style={{ height: 8, borderRadius: 4, background: "rgba(15,23,42,0.8)", border: "1px solid var(--borde)", overflow: "hidden", marginBottom: 12 }}>
            <div
              className="barra-progreso-relleno"
              style={{
                width: `${progreso * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #38bdf8 0%, #f97316 100%)",
                boxShadow: "0 0 8px rgba(249,115,22,0.6)",
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <div className="acciones" style={{ marginBottom: 0 }}>
            {!reproduciendo ? (
              <button className="btn btn-primario" type="button" onClick={onPlay}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Reproducir</span>
              </button>
            ) : (
              <button className="btn btn-primario" type="button" onClick={onPausar}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                <span>Pausar</span>
              </button>
            )}
            <button className="btn" type="button" onClick={onReiniciar} title="Reiniciar animación">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>Reiniciar</span>
            </button>
            <button className="btn" type="button" onClick={onExportarCSV} title="Exportar secuencia en CSV">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
