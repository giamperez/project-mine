import React, { useState, useMemo } from "react";
import { usePersistedState } from "../../../hooks/usePersistedState.js";
import type { MallaFinalSnapshot, CapaCad } from "./EditorCadMalla.js";

interface Props {
  visible: boolean;
  onOcultar: () => void;
  nombreMallaFinal: string;
  onCambiarNombreMallaFinal: (nombre: string) => void;
  capas: CapaCad[];
  capasSeleccionadas: string[];
  onToggleCapaSeleccionada: (capaId: string) => void;
  onSeleccionarCapasMarcadas: () => void;
  onSeleccionarTodoVisible: () => void;
  onLimpiarSeleccion: () => void;
  modoSeleccion: "todo" | "ventana" | "poligono" | "capas";
  onCambiarModoSeleccion: (modo: "todo" | "ventana" | "poligono" | "capas") => void;
  totalEntidadesSeleccionadas: number;
  mallasGuardadas: MallaFinalSnapshot[];
  onPublicarSnapshot: () => void;
  onRestaurarSnapshot: (snap: MallaFinalSnapshot) => void;
  onEliminarSnapshot: (id: string) => void;
  onExportarCSV: (snapTaladros?: any[], nombreSnap?: string) => void;
  onExportarDXF: (snap?: MallaFinalSnapshot) => void;
}

export default function PanelMallaFinal({
  visible,
  onOcultar,
  nombreMallaFinal,
  onCambiarNombreMallaFinal,
  capas,
  capasSeleccionadas,
  onToggleCapaSeleccionada,
  onSeleccionarCapasMarcadas,
  onSeleccionarTodoVisible,
  onLimpiarSeleccion,
  modoSeleccion,
  onCambiarModoSeleccion,
  totalEntidadesSeleccionadas,
  mallasGuardadas,
  onPublicarSnapshot,
  onRestaurarSnapshot,
  onEliminarSnapshot,
  onExportarCSV,
  onExportarDXF,
}: Props) {
  const [minimizado, setMinimizado] = usePersistedState<boolean>(
    "cad:panelMallaFinal:minimizado",
    false
  );

  if (!visible) return null;

  // Lista de capas con desglose especializado por tipo de taladro y dibujo CAD
  const capasDiseno = [
    { id: "capa-dibujo", nombre: "Dibujo CAD", color: "#f97316" },
    { id: "capa-cotas", nombre: "Cotas y anotaciones", color: "#ffffff" },
    { id: "capa-base", nombre: "Malla editable", color: "#f97316" },
    { id: "capa-taladros-alivio", nombre: "Taladros · Alivio", color: "#06b6d4" },
    { id: "capa-taladros-cuadrante", nombre: "Taladros · Cuadrantes", color: "#a855f7" },
    { id: "capa-taladros-produccion", nombre: "Taladros · Producción", color: "#f97316" },
    { id: "capa-taladros-corona", nombre: "Taladros · Corona", color: "#10b981" },
    { id: "capa-taladros-hastial", nombre: "Taladros · Hastiales", color: "#ec4899" },
    { id: "capa-taladros-arrastre", nombre: "Taladros · Arrastre", color: "#eab308" },
  ];

  return (
    <div
      className={`cad-panel-malla-final-exact ${minimizado ? "panel-comprimido" : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {minimizado ? (
        <div className="panel-mini-strip">
          <div className="mini-coords-info">
            <strong style={{ color: "#f97316" }}>MALLA FINAL:</strong> {mallasGuardadas.length} snapshots
          </div>
          <div className="mini-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className="btn-mini-expand"
              onClick={() => setMinimizado(false)}
              title="Expandir panel"
            >
              ⤢ Expandir
            </button>
            <button
              type="button"
              className="btn-header-round-close"
              onClick={onOcultar}
              title="Cerrar panel (✕)"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header limpio: MALLA FINAL / Publica un snapshot... / − / ✕ */}
          <div className="panel-malla-final-header">
            <div className="panel-malla-final-title-col">
              <h2 className="panel-malla-final-title">MALLA FINAL</h2>
              <p className="panel-malla-final-subtitle">
                Publica un snapshot exacto; nunca regenera la geometría.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                className="btn-header-round-min"
                onClick={() => setMinimizado(true)}
                title="Minimizar panel (−)"
              >
                −
              </button>
              <button
                type="button"
                className="btn-header-round-close"
                onClick={onOcultar}
                title="Cerrar panel (✕)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Campo Nombre del diseño final */}
          <div className="panel-malla-final-field">
            <label htmlFor="input-malla-final-nombre" className="panel-malla-final-label">
              Nombre del diseño final
            </label>
            <input
              id="input-malla-final-nombre"
              type="text"
              className="panel-malla-final-input"
              value={nombreMallaFinal}
              onChange={(e) => onCambiarNombreMallaFinal(e.target.value)}
              placeholder="Ej. Malla final 1"
            />
          </div>

          {/* Sección 1: SELECCIONAR DISEÑO */}
          <div className="panel-malla-final-seccion">
            <span className="panel-malla-final-seccion-title">1 · SELECCIONAR DISEÑO</span>

            {/* Fila de modos de selección */}
            <div className="panel-malla-final-modos-row">
              <button
                type="button"
                className={`btn-modo-sel ${modoSeleccion === "ventana" ? "activo" : ""}`}
                onClick={() => onCambiarModoSeleccion("ventana")}
                title="Seleccionar haciendo clic en 2 esquinas opuestas en el lienzo"
              >
                Ventana
              </button>
              <button
                type="button"
                className={`btn-modo-sel ${modoSeleccion === "poligono" ? "activo" : ""}`}
                onClick={() => onCambiarModoSeleccion("poligono")}
                title="Seleccionar marcando varios puntos en el lienzo para delimitar un polígono"
              >
                Polígono
              </button>
              <button
                type="button"
                className={`btn-modo-sel ${modoSeleccion === "todo" ? "activo" : ""}`}
                onClick={() => {
                  onCambiarModoSeleccion("todo");
                  onSeleccionarTodoVisible();
                }}
                title="Seleccionar todo lo visible en pantalla"
              >
                Todo visible
              </button>
              <button
                type="button"
                className="btn-modo-sel"
                onClick={onLimpiarSeleccion}
                title="Limpiar selección actual"
              >
                Limpiar
              </button>
            </div>

            {/* Indicador de ayuda interactiva según el modo seleccionado */}
            {modoSeleccion === "ventana" && (
              <div
                style={{
                  fontSize: 10.5,
                  color: "#fdba74",
                  background: "rgba(249, 115, 22, 0.12)",
                  border: "1px solid rgba(249, 115, 22, 0.3)",
                  padding: "6px 10px",
                  borderRadius: 8,
                  lineHeight: 1.35,
                }}
              >
                📐 <strong>Modo Ventana:</strong> Toca la 1ª esquina en el lienzo CAD y luego la 2ª esquina opuesta para seleccionar todo lo contenido.
              </div>
            )}
            {modoSeleccion === "poligono" && (
              <div
                style={{
                  fontSize: 10.5,
                  color: "#fdba74",
                  background: "rgba(249, 115, 22, 0.12)",
                  border: "1px solid rgba(249, 115, 22, 0.3)",
                  padding: "6px 10px",
                  borderRadius: 8,
                  lineHeight: 1.35,
                }}
              >
                🔷 <strong>Modo Polígono:</strong> Toca puntos en el lienzo para trazar el polígono y pulsa <em>"Finalizar selección"</em> en la barra inferior.
              </div>
            )}

            {/* Subtítulo: Selección por capas */}
            <span className="panel-malla-final-subseccion-title">Selección por capas</span>

            {/* Lista de capas con scroll si supera altura */}
            <div className="panel-malla-final-capas-list" style={{ maxHeight: 150, overflowY: "auto" }}>
              {capasDiseno.map((c) => {
                const marcada = capasSeleccionadas.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className="panel-malla-final-capa-row"
                    onClick={() => onToggleCapaSeleccionada(c.id)}
                    title={`Marcar capa ${c.nombre} para selección`}
                  >
                    <div className="capa-row-left">
                      <span className="capa-color-dot" style={{ backgroundColor: c.color }} />
                      <span className="capa-nombre">{c.nombre}</span>
                    </div>
                    <div className={`circle-toggle-check ${marcada ? "marcada" : ""}`}>
                      {marcada && <div className="circle-toggle-inner" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón: SELECCIONAR CAPAS MARCADAS */}
            <button
              type="button"
              className="btn-seleccionar-capas-marcadas"
              onClick={onSeleccionarCapasMarcadas}
            >
              SELECCIONAR CAPAS MARCADAS
            </button>

            {/* Contador de entidades seleccionadas */}
            <div className="panel-malla-final-entidades-count">
              Entidades seleccionadas: {totalEntidadesSeleccionadas}
            </div>

            {/* Botones Principales: PUBLICAR MALLA FINAL y GUARDAR EN DXF */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
              <button
                type="button"
                className="btn-publicar-malla-snapshot"
                onClick={onPublicarSnapshot}
              >
                PUBLICAR MALLA FINAL
              </button>

              <button
                type="button"
                onClick={() => onExportarDXF()}
                style={{
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1.5px solid var(--acento, #f97316)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "var(--acento-suave, #fdba74)",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  transition: "all 0.15s ease",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.6)",
                }}
                title="Exportar selección o malla completa a formato DXF 3D (AutoCAD / Datamine / Deswik)"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>GUARDAR SELECCIÓN EN DXF</span>
              </button>
            </div>
          </div>

          {/* Sección 2: MALLAS GUARDADAS */}
          <div className="panel-malla-final-seccion">
            <span className="panel-malla-final-seccion-title">2 · MALLAS GUARDADAS</span>

            {mallasGuardadas.length === 0 ? (
              <div className="panel-malla-final-empty-card">
                Todavía no hay una Malla final publicada en este proyecto.
              </div>
            ) : (
              <div className="panel-malla-final-snapshots-list">
                {mallasGuardadas.map((snap) => (
                  <div
                    key={snap.id}
                    style={{
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(249, 115, 22, 0.3)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: 12, color: "#ffffff" }}>{snap.nombre}</strong>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{snap.fechaIso || ""}</span>
                    </div>

                    <div style={{ fontSize: 10.5, color: "#cbd5e1" }}>
                      {(snap.taladros || []).length} taladros · {(snap.lineasCad || []).length} líneas · {(snap.puntosCad || []).length} puntos
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => onRestaurarSnapshot(snap)}
                        style={{
                          background: "rgba(249, 115, 22, 0.15)",
                          border: "1px solid #f97316",
                          borderRadius: 6,
                          color: "#f97316",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "4px 8px",
                          cursor: "pointer",
                        }}
                      >
                        Restaurar
                      </button>

                      {(snap.taladros || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => onExportarCSV(snap.taladros, snap.nombre)}
                          style={{
                            background: "rgba(6, 182, 212, 0.15)",
                            border: "1px solid #06b6d4",
                            borderRadius: 6,
                            color: "#38bdf8",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "4px 8px",
                            cursor: "pointer",
                          }}
                        >
                          CSV
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onExportarDXF(snap)}
                        style={{
                          background: "rgba(249, 115, 22, 0.15)",
                          border: "1px solid #f97316",
                          borderRadius: 6,
                          color: "#fdba74",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "4px 8px",
                          cursor: "pointer",
                        }}
                        title="Exportar este snapshot en formato DXF 3D"
                      >
                        DXF
                      </button>

                      <button
                        type="button"
                        onClick={() => onEliminarSnapshot(snap.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 8px",
                          cursor: "pointer",
                          marginLeft: "auto",
                        }}
                        title="Eliminar este snapshot"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
