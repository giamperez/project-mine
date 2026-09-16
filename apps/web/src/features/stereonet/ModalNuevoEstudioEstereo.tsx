import { useState } from "react";
import {
  ESCENARIOS_ESTEREOGRAFIA,
  type TipoEscenarioEstereo,
} from "./proyectosEstereografia.js";

interface ModalNuevoEstudioEstereoProps {
  onVolver: () => void;
  onCrearProyecto: (nombre: string, escenarioId: TipoEscenarioEstereo) => void;
}

export default function ModalNuevoEstudioEstereo({
  onVolver,
  onCrearProyecto,
}: ModalNuevoEstudioEstereoProps) {
  const [nombre, setNombre] = useState("");
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<TipoEscenarioEstereo>("MIN");

  const escActual =
    ESCENARIOS_ESTEREOGRAFIA.find((e) => e.id === escenarioSeleccionado) || ESCENARIOS_ESTEREOGRAFIA[0];

  function handleSubmit() {
    const nombreFinal = nombre.trim() || `Estudio ${escActual.nombre}`;
    onCrearProyecto(nombreFinal, escenarioSeleccionado);
  }

  return (
    <div className="topo-modal-container">
      {/* Header */}
      <header className="topo-header" style={{ borderColor: "rgba(16, 185, 129, 0.25)" }}>
        <button
          className="topo-btn-back"
          onClick={onVolver}
          title="Volver al catálogo"
          style={{ borderColor: "rgba(16, 185, 129, 0.3)", color: "#34d399" }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="topo-header-text">
          <h1 className="topo-header-title" style={{ color: "#f0fdf4" }}>Nuevo Estudio Estructural</h1>
          <p className="topo-header-subtitle" style={{ color: "#a7f3d0" }}>
            Selecciona el escenario de cálculo geomecánico y geometría del talud
          </p>
        </div>
      </header>

      <div className="topo-modal-content">
        {/* Card Identificación */}
        <section
          className="topo-card topo-card-identificacion"
          style={{ borderColor: "rgba(16, 185, 129, 0.25)", background: "rgba(6, 28, 22, 0.85)" }}
        >
          <div className="topo-card-tag" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.35)" }}>
            IDENTIFICACIÓN
          </div>
          <h2 className="topo-card-title" style={{ color: "#f0fdf4" }}>Datos del estudio</h2>
          <p className="topo-card-desc">
            Asigna un nombre descriptivo para identificar el banco, corte o frente estructural en el proyecto.
          </p>

          <div className="topo-field-group">
            <input
              type="text"
              className="topo-input-text"
              style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(3, 18, 14, 0.8)" }}
              placeholder="Ejemplo: Talud Sur Banco 4200 · Fase 2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
            <span className="topo-field-hint">Referencia de banco, rampa, fase o nivel estructural</span>
          </div>
        </section>

        {/* Sección Escenarios Disponibles */}
        <section className="topo-section-motores">
          <div className="topo-section-header">
            <span className="topo-section-tag" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.35)" }}>
              ESCENARIOS GEOMECÁNICOS
            </span>
            <h2 className="topo-section-title" style={{ color: "#f0fdf4" }}>Plantilla y Geometría Predefinida</h2>
            <p className="topo-section-desc">
              Carga parámetros geométricos iniciales (dip, dip direction, ángulo de fricción y familias).
            </p>
          </div>

          <div className="topo-grid-motores">
            {ESCENARIOS_ESTEREOGRAFIA.map((esc) => {
              const isSelected = esc.id === escenarioSeleccionado;
              return (
                <div
                  key={esc.id}
                  className={`topo-motor-card ${isSelected ? "selected" : ""}`}
                  style={{
                    borderColor: isSelected ? "#10b981" : "rgba(16, 185, 129, 0.18)",
                    background: isSelected ? "rgba(16, 185, 129, 0.12)" : "rgba(4, 20, 16, 0.6)",
                  }}
                  onClick={() => setEscenarioSeleccionado(esc.id)}
                >
                  <div className="topo-motor-card-header">
                    <span
                      className={`topo-motor-badge ${isSelected ? "active" : ""}`}
                      style={{
                        background: isSelected ? "#10b981" : "rgba(16, 185, 129, 0.2)",
                        color: isSelected ? "#022c22" : "#34d399",
                      }}
                    >
                      {esc.abreviatura}
                    </span>
                  </div>

                  <h3 className="topo-motor-name" style={{ color: "#f0fdf4" }}>{esc.nombre}</h3>
                  <p className="topo-motor-sub" style={{ color: "#94a3b8" }}>{esc.subtitulo}</p>

                  <div className="topo-motor-card-footer">
                    {isSelected ? (
                      <span className="topo-motor-status-selected" style={{ color: "#34d399" }}>
                        ● SELECCIONADO
                      </span>
                    ) : (
                      <span className="topo-motor-status-action" style={{ color: "#64748b" }}>
                        SELECCIONAR
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Resumen inferior y CTA */}
        <section
          className="topo-bottom-action-card"
          style={{
            borderColor: "rgba(16, 185, 129, 0.35)",
            background: "linear-gradient(135deg, rgba(6, 28, 22, 0.95), rgba(3, 16, 12, 0.98))",
          }}
        >
          <div className="topo-bottom-summary">
            <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Escenario listo: {escActual.nombre}
            </span>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
              Talud: Dip {escActual.taludDefecto.dip_grados}° / Dir {escActual.taludDefecto.dipDirection_grados}° · {escActual.discontinuidadesDefecto.length} Familias iniciales
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <button
              type="button"
              className="topo-btn-crear"
              style={{
                flex: 1,
                padding: "13px 20px",
                borderRadius: "14px",
                border: "none",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#022c22",
                fontWeight: 800,
                fontSize: "13px",
                letterSpacing: "0.03em",
                boxShadow: "0 6px 20px rgba(16, 185, 129, 0.35)",
                cursor: "pointer",
              }}
              onClick={handleSubmit}
            >
              CREAR Y ABRIR TALLER 2D →
            </button>
            <button
              type="button"
              onClick={onVolver}
              style={{
                padding: "13px 18px",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#cbd5e1",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
