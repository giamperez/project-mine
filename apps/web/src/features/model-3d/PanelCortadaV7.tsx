import React from "react";
import type { Capa3DItem } from "./EspacioModelo3D.js";

export interface ResultadoEvaluacionCortada {
  nombreLabor: string;
  volumenTotalM3: number;
  tonelajeTotalT: number;
  tonelajeMineralT: number;
  tonelajeEsterilT: number;
  leyPromedioPct: number;
  bloquesCortados: number;
  rangos: {
    categoria: string;
    rango: string;
    tonelaje: number;
    porcentaje: number;
    leyMedia: number;
    color: string;
  }[];
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  capas: Capa3DItem[];
  hayBloquesCargados: boolean;
  laborSeleccionadaId: string;
  setLaborSeleccionadaId: (id: string) => void;
  densidad: string;
  setDensidad: (v: string) => void;
  resultado: ResultadoEvaluacionCortada | null;
  onEvaluarCortada: () => void;
}

export default function PanelCortadaV7({
  abierto,
  onCerrar,
  capas,
  hayBloquesCargados,
  laborSeleccionadaId,
  setLaborSeleccionadaId,
  densidad,
  setDensidad,
  resultado,
  onEvaluarCortada,
}: Props) {
  if (!abierto) return null;

  // Filtrar capas de labores o mallas generadas en V5 o importadas
  const laboresDisponibles = capas.filter(
    (c) => c.tipo === "galeria" || c.id.includes("diseno-v5") || c.nombre.toLowerCase().includes("labor") || c.nombre.toLowerCase().includes("rampa")
  );

  return (
    <div className="m3d-panel-v7">
      {/* 1. CABECERA CORTADA */}
      <div className="m3d-v7-header">
        <div className="m3d-v7-titles">
          <span className="m3d-v7-title">CORTADA Y LEYES</span>
          <span className="m3d-v7-sub">Tonelaje de la labor, mineral, estéril y leyes por rango.</span>
        </div>
        <button
          type="button"
          className="btn-m3d-v7-ocultar"
          onClick={onCerrar}
          title="Ocultar panel"
        >
          Ocultar
        </button>
      </div>

      <div className="m3d-panel-v7-divider" />

      {/* SECCIÓN 1: SELECCIONAR LABOR / SÓLIDO V5 */}
      <div className="m3d-v7-section">
        <span className="m3d-v7-sec-title">1) Seleccionar labor / sólido V5</span>
        <p className="m3d-v7-info-text">
          Usa la labor generada en V5: circular, herradura o cuadrangular. También acepta mallas sólidas.
        </p>

        {laboresDisponibles.length > 0 ? (
          <div className="m3d-v7-select-box">
            <select
              className="m3d-v7-select"
              value={laborSeleccionadaId}
              onChange={(e) => setLaborSeleccionadaId(e.target.value)}
            >
              <option value="">-- Selecciona una labor subterránea --</option>
              {laboresDisponibles.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.nombre} ({lab.tipo.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="m3d-v7-notice-warning">
            No hay labor o sólido tipo malla. Primero crea una labor en V5.
          </div>
        )}
      </div>

      <div className="m3d-panel-v7-divider" />

      {/* SECCIÓN 2: MODELO DE BLOQUES */}
      <div className="m3d-v7-section">
        <span className="m3d-v7-sec-title">2) Modelo de bloques</span>
        <p className="m3d-v7-info-text">
          Escoge el modelo de bloques o dominio IDW que se cruza con la cortada.
        </p>

        {hayBloquesCargados ? (
          <div className="m3d-v7-notice-success">
            ✓ Modelo de bloques activo en escena listo para estimación y cubicación.
          </div>
        ) : (
          <div className="m3d-v7-notice-warning">
            No hay modelo de bloques cargado.
          </div>
        )}
      </div>

      <div className="m3d-panel-v7-divider" />

      {/* SECCIÓN 3: PESO ESPECÍFICO */}
      <div className="m3d-v7-section">
        <span className="m3d-v7-sec-title">3) Peso específico</span>
        <div className="m3d-v7-input-box">
          <span className="m3d-v7-input-label">Densidad t/m³</span>
          <input
            type="text"
            className="m3d-v7-input-field"
            value={densidad}
            onChange={(e) => setDensidad(e.target.value)}
            placeholder="2.700"
          />
        </div>
        <p className="m3d-v7-hint-text">
          Tonelaje = Volumen × Peso específico. Puedes usar 2.7, 2.8, 3.0
        </p>
      </div>

      {/* BOTÓN DE EVALUACIÓN */}
      <button
        type="button"
        className="btn-m3d-v7-evaluate"
        onClick={onEvaluarCortada}
      >
        Evaluar cortada con modelo de bloques
      </button>

      {/* RESULTADOS DE EVALUACIÓN DE LA CORTADA */}
      {resultado && (
        <div className="m3d-v7-results-container">
          <span className="m3d-v7-results-title">
            Resultados de Cubicación: {resultado.nombreLabor}
          </span>

          <div className="m3d-v7-kpis-grid">
            <div className="m3d-v7-kpi-card">
              <span>Volumen total</span>
              <b>{resultado.volumenTotalM3.toLocaleString()} m³</b>
            </div>
            <div className="m3d-v7-kpi-card">
              <span>Tonelaje total</span>
              <b>{resultado.tonelajeTotalT.toLocaleString()} t</b>
            </div>
            <div className="m3d-v7-kpi-card" style={{ borderColor: "rgba(74, 222, 128, 0.4)" }}>
              <span>Mineral econ.</span>
              <b style={{ color: "#4ade80" }}>{resultado.tonelajeMineralT.toLocaleString()} t</b>
            </div>
            <div className="m3d-v7-kpi-card" style={{ borderColor: "rgba(248, 113, 113, 0.4)" }}>
              <span>Estéril / Desmonte</span>
              <b style={{ color: "#f87171" }}>{resultado.tonelajeEsterilT.toLocaleString()} t</b>
            </div>
          </div>

          <div className="m3d-v7-grade-badge">
            <span>Ley media ponderada:</span>
            <b>{resultado.leyPromedioPct.toFixed(2)} % Cu Eq</b>
          </div>

          {/* TABLA DE RANGOS DE LEY */}
          <span className="m3d-v7-sub-title" style={{ marginTop: "6px" }}>Distribución por rangos de ley</span>
          <div className="m3d-v7-table-wrapper">
            <table className="m3d-v7-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Rango</th>
                  <th>T (t)</th>
                  <th>Ley (%)</th>
                </tr>
              </thead>
              <tbody>
                {resultado.rangos.map((r) => (
                  <tr key={r.categoria}>
                    <td>
                      <span className="m3d-v7-dot" style={{ background: r.color }} />
                      {r.categoria}
                    </td>
                    <td>{r.rango}</td>
                    <td>{r.tonelaje.toLocaleString()}</td>
                    <td><b>{r.leyMedia.toFixed(2)}%</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
