import { useMemo, useState } from "react";
import type { ResultadoVoladura, Taladro } from "@suite/core";

interface Props {
  taladros: Taladro[];
  resultadoVoladura: ResultadoVoladura;
  sobrerotura_cm: number;
  reproduciendo: boolean;
  tiempoActual_ms: number;
  onPlay: () => void;
  onPausar: () => void;
  onReiniciar: () => void;
}

function colorPorRetardo(tiempo_ms: number, duracionTotal: number): string {
  const t = Math.max(0, Math.min(1, tiempo_ms / Math.max(duracionTotal, 1)));
  if (tiempo_ms === 0) return "#38bdf8";
  if (t < 0.15) return "#ef4444";
  if (t < 0.35) return "#f97316";
  if (t < 0.6) return "#f59e0b";
  if (t < 0.8) return "#10b981";
  return "#a855f7";
}

const CANVAS_W = 320;
const CANVAS_H = 185;
const PAD_X = 26;
const PAD_Y = 22;

export default function PanelSimulacion({
  taladros,
  resultadoVoladura,
  sobrerotura_cm,
  reproduciendo,
  tiempoActual_ms,
  onPlay,
  onPausar,
  onReiniciar,
}: Props) {
  const [vista, setVista] = useState<"frente" | "corte">("frente");

  const mapaCollar = useMemo(() => new Map(taladros.map((t) => [t.id, t.collar])), [taladros]);
  const duracionTotal = Math.max(resultadoVoladura.duracionTotalSecuencia_ms, 1);

  const itemsProyectados = useMemo(() => {
    const items = resultadoVoladura.cargas.map((c) => {
      const collar = mapaCollar.get(c.taladroId);
      return {
        id: c.taladroId,
        x: collar ? collar.x : c.columna * 3,
        y: collar ? collar.y : c.fila * 3,
        tiempo_ms: c.tiempoDetonacion_ms,
        zona: c.zona,
        pesoExplosivo_kg: c.pesoExplosivo_kg,
      };
    });
    if (items.length === 0) return [];
    const xs = items.map((t) => t.x);
    const ys = items.map((t) => t.y);
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
    return items.map((t) => ({
      ...t,
      px: offX + (t.x - minX) * scale,
      py: CANVAS_H - offY - (t.y - minY) * scale,
    }));
  }, [resultadoVoladura.cargas, mapaCollar]);

  const detonadosCount = itemsProyectados.filter((t) => tiempoActual_ms >= t.tiempo_ms).length;
  const progresoCorte = Math.min(tiempoActual_ms / duracionTotal, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Simulación técnica</span>
          </div>
          <div style={{ display: "inline-flex", background: "rgba(15,23,42,0.7)", borderRadius: 6, padding: 2, border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              type="button"
              onClick={() => setVista("frente")}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 4,
                background: vista === "frente" ? "linear-gradient(135deg,#f43f5e,#be123c)" : "transparent",
                color: vista === "frente" ? "#fff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Frente 2D
            </button>
            <button
              type="button"
              onClick={() => setVista("corte")}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 4,
                background: vista === "corte" ? "linear-gradient(135deg,#f43f5e,#be123c)" : "transparent",
                color: vista === "corte" ? "#fff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Corte longitudinal
            </button>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados" style={{ marginBottom: 10 }}>
            <div className="dato">
              <span>Tiempo virtual</span>
              <b style={{ color: "#f97316" }}>{tiempoActual_ms.toFixed(0)} ms</b>
            </div>
            <div className="dato">
              <span>Detonados</span>
              <b>{detonadosCount} / {itemsProyectados.length}</b>
            </div>
            <div className="dato">
              <span>Sobre-rotura</span>
              <b style={{ color: "#f59e0b" }}>{sobrerotura_cm.toFixed(1)} cm</b>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              height: 185,
              background: "radial-gradient(ellipse at center, rgba(30,6,14,0.98) 0%, rgba(10,2,5,0.98) 100%)",
              border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} style={{ width: "100%", height: "100%", display: "block" }}>
              {vista === "frente" ? (
                itemsProyectados.map((t) => {
                  const detonado = tiempoActual_ms >= t.tiempo_ms;
                  const deltaTiempo = tiempoActual_ms - t.tiempo_ms;
                  const detonandoAhora = deltaTiempo >= 0 && deltaTiempo <= Math.max(duracionTotal * 0.08, 50);
                  const esAlivio = t.zona === "alivio" || t.pesoExplosivo_kg === 0;
                  const colorBase = colorPorRetardo(t.tiempo_ms, duracionTotal);
                  return (
                    <g key={t.id} transform={`translate(${t.px}, ${t.py})`}>
                      {detonandoAhora && !esAlivio && (
                        <circle r={13} fill="none" stroke="#ffffff" strokeWidth={1.4} opacity={0.9} />
                      )}
                      {esAlivio ? (
                        <circle r={5} fill="rgba(8,12,20,0.8)" stroke="#38bdf8" strokeWidth={1.2} strokeDasharray="2,2" />
                      ) : detonado ? (
                        <circle r={4.5} fill="#0f172a" stroke="#f97316" strokeWidth={1} />
                      ) : (
                        <circle r={4.5} fill="rgba(15,23,42,0.9)" stroke={colorBase} strokeWidth={1.2} />
                      )}
                    </g>
                  );
                })
              ) : (
                <>
                  {itemsProyectados.map((t, idx) => {
                    const x = 20 + idx * (280 / Math.max(itemsProyectados.length, 1));
                    const detonado = tiempoActual_ms >= t.tiempo_ms;
                    return (
                      <line
                        key={t.id}
                        x1={x}
                        y1={15}
                        x2={x}
                        y2={165}
                        stroke={detonado ? "#f97316" : colorPorRetardo(t.tiempo_ms, duracionTotal)}
                        strokeWidth={detonado ? 3 : 1.6}
                        opacity={detonado ? 0.95 : 0.5}
                      />
                    );
                  })}
                  <line
                    x1={20 + progresoCorte * 280}
                    y1={10}
                    x2={20 + progresoCorte * 280}
                    y2={175}
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </>
              )}
            </svg>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--texto-tenue)", marginBottom: 4 }}>
            <span>Progreso: {(progresoCorte * 100).toFixed(0)}%</span>
            <span>Tiempo: {tiempoActual_ms.toFixed(0)} / {resultadoVoladura.duracionTotalSecuencia_ms.toFixed(0)} ms</span>
          </div>
          <div className="barra-progreso" style={{ height: 8, borderRadius: 4, background: "rgba(15,23,42,0.8)", border: "1px solid var(--borde)", overflow: "hidden", marginBottom: 12 }}>
            <div
              style={{
                width: `${progresoCorte * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #38bdf8 0%, #f43f5e 100%)",
                transition: "width 0.1s linear",
              }}
            />
          </div>

          <div className="acciones">
            {!reproduciendo ? (
              <button className="btn btn-primario" type="button" onClick={onPlay}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>{tiempoActual_ms > 0 ? "Reanudar" : "Iniciar simulación"}</span>
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
            <button className="btn" type="button" onClick={onReiniciar} title="Repetir simulación">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>Repetir</span>
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 10, color: "var(--texto-tenue)", lineHeight: 1.4 }}>
            La animación no es un modelo FEM/DEM ni predice fracturas exactas. Visualiza el orden de detonación
            configurado en Retardos.
          </div>
        </div>
      </div>
    </div>
  );
}
