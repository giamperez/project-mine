import type { ResultadoCarguioVoladura, ResultadoEvaluacionVoladura, ResultadoVoladura } from "@suite/core";

interface Props {
  evaluacion: ResultadoEvaluacionVoladura;
  carguio: ResultadoCarguioVoladura;
  resultadoVoladura: ResultadoVoladura;
}

const COLOR_ESTADO: Record<ResultadoEvaluacionVoladura["estado"], string> = {
  Apto: "#10b981",
  Revisar: "#f59e0b",
  "No apto": "#ef4444",
};

const COLOR_RIESGO: Record<ResultadoEvaluacionVoladura["riesgo"], string> = {
  Bajo: "#10b981",
  Moderado: "#f59e0b",
  Alto: "#ef4444",
};

export default function PanelResultados({ evaluacion, carguio, resultadoVoladura }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Evaluación general</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato dato-destacado">
              <span>Puntaje</span>
              <b style={{ color: COLOR_ESTADO[evaluacion.estado] }}>{evaluacion.puntaje}/100</b>
            </div>
            <div className="dato dato-destacado">
              <span>Estado</span>
              <b style={{ color: COLOR_ESTADO[evaluacion.estado] }}>{evaluacion.estado}</b>
            </div>
            <div className="dato dato-destacado">
              <span>Riesgo</span>
              <b style={{ color: COLOR_RIESGO[evaluacion.riesgo] }}>{evaluacion.riesgo}</b>
            </div>
          </div>
          <div className="barra-progreso" style={{ height: 8, borderRadius: 4, background: "rgba(15,23,42,0.8)", border: "1px solid var(--borde)", overflow: "hidden", marginTop: 10 }}>
            <div
              style={{
                width: `${evaluacion.puntaje}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${COLOR_ESTADO[evaluacion.estado]}, #fb7185)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Consumo y roca rota</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato">
              <span>Explosivo</span>
              <b style={{ color: "#f97316" }}>{carguio.pesoExplosivoTotal_kg.toFixed(2)} kg</b>
            </div>
            <div className="dato">
              <span>Volumen</span>
              <b>{evaluacion.volumenRoca_m3.toFixed(2)} m³</b>
            </div>
            <div className="dato">
              <span>Tonelaje</span>
              <b>{evaluacion.tonelaje_t.toFixed(2)} t</b>
            </div>
            <div className="dato">
              <span>Factor de carga</span>
              <b style={{ color: "#10b981" }}>{evaluacion.factorCarga_kgm3.toFixed(3)} kg/m³</b>
            </div>
            <div className="dato">
              <span>Factor de potencia</span>
              <b>{evaluacion.factorPotencia_kgt.toFixed(3)} kg/t</b>
            </div>
            <div className="dato">
              <span>Carga lineal prom.</span>
              <b>{carguio.cargaLinealPromedio_kgm.toFixed(2)} kg/m</b>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Desempeño estimado</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato">
              <span>Avance diseño</span>
              <b>{evaluacion.avanceDiseno_m.toFixed(2)} m</b>
            </div>
            <div className="dato">
              <span>Avance estimado</span>
              <b style={{ color: "#38bdf8" }}>{evaluacion.avanceEstimado_m.toFixed(2)} m</b>
            </div>
            <div className="dato">
              <span>Eficiencia</span>
              <b>{evaluacion.eficiencia_pct.toFixed(1)} %</b>
            </div>
            <div className="dato">
              <span>P80 estimado</span>
              <b>{evaluacion.p80_mm.toFixed(0)} mm</b>
            </div>
            <div className="dato">
              <span>Sobre-rotura</span>
              <b style={{ color: "#f59e0b" }}>{evaluacion.sobrerotura_cm.toFixed(1)} cm</b>
            </div>
            <div className="dato">
              <span>Riesgo</span>
              <b style={{ color: COLOR_RIESGO[evaluacion.riesgo] }}>{evaluacion.riesgo}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Distribución de carga</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato">
              <span>Taladros</span>
              <b>{carguio.cargas.length}</b>
            </div>
            <div className="dato">
              <span>Cargados</span>
              <b style={{ color: "#10b981" }}>{carguio.taladrosCargados}</b>
            </div>
            <div className="dato">
              <span>Vacíos</span>
              <b style={{ color: carguio.taladrosVacios > 0 ? "#f59e0b" : undefined }}>{carguio.taladrosVacios}</b>
            </div>
            <div className="dato">
              <span>Cebos</span>
              <b>{carguio.cebosTotal}</b>
            </div>
            <div className="dato">
              <span>Cartuchos</span>
              <b>{carguio.cartuchosTotal}</b>
            </div>
            <div className="dato">
              <span>Retardo final</span>
              <b style={{ color: "#38bdf8" }}>{resultadoVoladura.duracionTotalSecuencia_ms.toFixed(0)} ms</b>
            </div>
          </div>
        </div>
      </div>

      {evaluacion.advertencias.length > 0 && (
        <div className="panel-seccion-card">
          <div className="panel-seccion-header">
            <div className="panel-seccion-title">
              <span>Advertencias técnicas</span>
            </div>
          </div>
          <div className="panel-seccion-body">
            <div className="advertencias">
              {evaluacion.advertencias.map((a, i) => (
                <div className="advertencia" key={i}>
                  ⚠ {a}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          margin: "10px 2px 0",
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.3)",
          fontSize: 11,
          color: "#93c5fd",
          lineHeight: 1.4,
        }}
      >
        Estos indicadores son un modelo de apoyo y visualización. No sustituyen pruebas de campo, control de
        desviación, fichas técnicas vigentes, normativa, evaluación geomecánica ni la aprobación del responsable
        autorizado de voladura.
      </div>
    </div>
  );
}
