import { useMemo, useState } from "react";
import type { RolCarguio } from "@suite/core";
import { asignarRolTaladro } from "@suite/core";
import type { SnapshotMallaVoladura } from "../proyectosVoladura.js";
import { ETIQUETAS_ROL_CARGUIO } from "@suite/core";

const COLOR_ROL: Record<RolCarguio, string> = {
  arranque: "#ef4444",
  produccion: "#f59e0b",
  contorno: "#a855f7",
  recorte: "#38bdf8",
  arrastres: "#10b981",
};

interface Props {
  snapshot: SnapshotMallaVoladura;
}

export default function PanelMalla({ snapshot }: Props) {
  const [vista, setVista] = useState<"2d" | "corte">("2d");
  const { taladros } = snapshot;

  const proyectados = useMemo(() => {
    if (taladros.length === 0) return { puntos: [], contexto: { minX: 0, maxX: 1, minY: 0, maxY: 1 } };
    const xs = taladros.map((t) => t.collar.x);
    const ys = taladros.map((t) => t.collar.y);
    const contexto = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    const CANVAS_W = 320;
    const CANVAS_H = 220;
    const PAD = 24;
    const spanX = Math.max(contexto.maxX - contexto.minX, 0.001);
    const spanY = Math.max(contexto.maxY - contexto.minY, 0.001);
    const availW = CANVAS_W - PAD * 2;
    const availH = CANVAS_H - PAD * 2;
    const scale = Math.min(availW / spanX, availH / spanY);
    const offX = PAD + (availW - spanX * scale) / 2;
    const offY = PAD + (availH - spanY * scale) / 2;

    const puntos = taladros.map((t) => {
      const rol = asignarRolTaladro(t, contexto);
      return {
        id: t.id,
        rol,
        px: offX + (t.collar.x - contexto.minX) * scale,
        py: CANVAS_H - (offY + (t.collar.y - contexto.minY) * scale),
        profundidad_m: t.profundidad_m,
      };
    });
    return { puntos, contexto, CANVAS_W, CANVAS_H };
  }, [taladros]);

  const conteoRoles = useMemo(() => {
    const conteo: Record<RolCarguio, number> = { arranque: 0, produccion: 0, contorno: 0, recorte: 0, arrastres: 0 };
    for (const p of proyectados.puntos) conteo[p.rol]++;
    return conteo;
  }, [proyectados]);

  const CANVAS_W = 320;
  const CANVAS_H = 220;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#f43f5e", background: "rgba(244,63,94,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </span>
            <span>Malla importada (solo lectura)</span>
          </div>
          <span className="panel-seccion-badge">{snapshot.esTunel ? "Túnel" : "Banco"}</span>
        </div>
        <div className="panel-seccion-body">
          <div style={{ fontSize: 11, color: "var(--texto-tenue)", lineHeight: 1.4, marginBottom: 10 }}>
            Malla importada en modo solo lectura desde <b>{snapshot.mallaNombre}</b>. Las coordenadas y taladros no se
            modifican desde Voladura.
          </div>
          <div className="resultados">
            <div className="dato">
              <span>Sección</span>
              <b>{snapshot.burden_m.toFixed(2)} × {snapshot.espaciamiento_m.toFixed(2)} m</b>
            </div>
            <div className="dato">
              <span>Altura / avance</span>
              <b>{snapshot.alturaBanco_m.toFixed(2)} m</b>
            </div>
            <div className="dato">
              <span>Taladros</span>
              <b>{taladros.length}</b>
            </div>
            <div className="dato">
              <span>Diámetro</span>
              <b>{snapshot.diametroMm} mm</b>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Vista de la malla</span>
          </div>
          <div style={{ display: "inline-flex", background: "rgba(15,23,42,0.7)", borderRadius: 6, padding: 2, border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              type="button"
              onClick={() => setVista("2d")}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 4,
                background: vista === "2d" ? "linear-gradient(135deg,#f43f5e,#be123c)" : "transparent",
                color: vista === "2d" ? "#fff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
              }}
            >
              2D Planta
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
              Corte
            </button>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 220,
              background: "radial-gradient(ellipse at center, rgba(30,6,14,0.98) 0%, rgba(10,2,5,0.98) 100%)",
              border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} style={{ width: "100%", height: "100%", display: "block" }}>
              {vista === "2d"
                ? proyectados.puntos.map((p) => (
                    <g key={p.id} transform={`translate(${p.px}, ${p.py})`}>
                      <circle r={5} fill="rgba(15,23,42,0.9)" stroke={COLOR_ROL[p.rol]} strokeWidth={1.4} />
                      <circle r={1.8} fill={COLOR_ROL[p.rol]} />
                    </g>
                  ))
                : proyectados.puntos.map((p, idx) => {
                    const x = 20 + idx * (280 / Math.max(proyectados.puntos.length, 1));
                    const yTope = 20;
                    const yFondo = 20 + Math.min(p.profundidad_m * 14, 180);
                    return (
                      <line
                        key={p.id}
                        x1={x}
                        y1={yTope}
                        x2={x}
                        y2={yFondo}
                        stroke={COLOR_ROL[p.rol]}
                        strokeWidth={2}
                        opacity={0.85}
                      />
                    );
                  })}
            </svg>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, fontSize: 10 }}>
            {(Object.keys(COLOR_ROL) as RolCarguio[]).map((rol) => (
              <div key={rol} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: COLOR_ROL[rol], display: "inline-block" }} />
                <span style={{ color: "var(--texto-tenue)" }}>
                  {ETIQUETAS_ROL_CARGUIO[rol]} ({conteoRoles[rol]})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
