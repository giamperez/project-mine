import { useState } from "react";
import { MOTORES_TOPOGRAFICOS, type TipoMotorTopo } from "./motoresTopograficos.js";
import { IconoMotor, IconoVolver, IconoPlus } from "./components/IconosTopograficos.js";

export { IconoMotor };

interface ModalNuevoProyectoTopoProps {
  onVolver: () => void;
  onCrearProyecto: (nombre: string, motorId: TipoMotorTopo) => void;
}

export default function ModalNuevoProyectoTopo({ onVolver, onCrearProyecto }: ModalNuevoProyectoTopoProps) {
  const [nombre, setNombre] = useState("");
  const [motorSeleccionado, setMotorSeleccionado] = useState<TipoMotorTopo>("POL");

  const motorActual = MOTORES_TOPOGRAFICOS.find((m) => m.id === motorSeleccionado) || MOTORES_TOPOGRAFICOS[0];

  function handleSubmit() {
    const nombreFinal = nombre.trim() || `Proyecto ${motorActual.abreviatura}`;
    onCrearProyecto(nombreFinal, motorSeleccionado);
  }

  return (
    <div className="topo-modal-container">
      {/* Header */}
      <header className="topo-header">
        <button className="topo-btn-back" onClick={onVolver} title="Volver al catálogo">
          <IconoVolver size={18} />
        </button>
        <div className="topo-header-text">
          <h1 className="topo-header-title">Nuevo Proyecto Topográfico</h1>
          <p className="topo-header-subtitle">Selecciona el motor de ingeniería y cálculo geodésico</p>
        </div>
      </header>

      <div className="topo-modal-content">
        {/* Card Identificación */}
        <section className="topo-card topo-card-identificacion">
          <div className="topo-card-tag monochrome">IDENTIFICACIÓN</div>
          <h2 className="topo-card-title">Datos del proyecto</h2>
          <p className="topo-card-desc">El nombre puede modificarse en cualquier momento. El cálculo y geometría se preservan en tiempo real.</p>

          <div className="topo-field-group">
            <input
              type="text"
              className="topo-input-text"
              placeholder="Ejemplo: Poligonal subterránea · Galería 4200"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
            <span className="topo-field-hint">Referencia de campo, nivel o frente de trabajo</span>
          </div>
        </section>

        {/* Sección Motores Disponibles */}
        <section className="topo-section-motores">
          <div className="topo-section-header">
            <span className="topo-section-tag monochrome">MOTORES TOPOGRÁFICOS</span>
            <h2 className="topo-section-title">Módulo de cálculo especializado</h2>
            <p className="topo-section-desc">Entradas paramétricas, tolerancias de campo, compensación rigurosa y visualización técnica 2D/3D.</p>
          </div>

          <div className="topo-grid-motores">
            {MOTORES_TOPOGRAFICOS.map((m) => {
              const isSelected = m.id === motorSeleccionado;
              return (
                <div
                  key={m.id}
                  className={`topo-motor-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setMotorSeleccionado(m.id)}
                >
                  <div className="topo-motor-card-header">
                    <div className="topo-motor-icon-wrap">
                      <IconoMotor id={m.id} size={24} />
                    </div>
                    <span className={`topo-motor-badge ${isSelected ? "active" : ""}`}>
                      {m.abreviatura}
                    </span>
                  </div>

                  <h3 className="topo-motor-name">{m.nombre}</h3>
                  <p className="topo-motor-sub">{m.subtitulo}</p>

                  <div className="topo-motor-card-footer">
                    {isSelected ? (
                      <span className="topo-motor-status-selected">● SELECCIONADO</span>
                    ) : (
                      <span className="topo-motor-status-action">SELECCIONAR</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Resumen inferior y CTA */}
        <section className="topo-bottom-action-card">
          <div className="topo-bottom-summary">
            <div className="topo-bottom-icon">
              <IconoMotor id={motorActual.id} size={22} />
            </div>
            <div className="topo-bottom-text">
              <h4>{motorActual.nombre}</h4>
              <p>{motorActual.subtitulo}</p>
            </div>
          </div>

          <button className="topo-btn-crear-abrir" onClick={handleSubmit}>
            <IconoPlus size={16} /> CREAR Y ABRIR TALLER
          </button>
        </section>
      </div>
    </div>
  );
}
