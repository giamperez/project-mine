import type { ResultadoAcarreo } from "@suite/core";

interface Props {
  resultado: ResultadoAcarreo;
  oculto?: boolean;
}

function minSeg(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PanelResultadosAcarreo({ resultado, oculto }: Props) {
  const colorMF = resultado.matchFactor < 0.85 || resultado.matchFactor > 1.15 ? "var(--acento)" : "var(--ok)";

  return (
    <div className="panel-tabla" data-oculto={oculto}>
      <fieldset>
        <legend>Velocidades y resistencias</legend>
        <div className="resultados">
          <div className="dato">
            <span>Resistencia rodadura</span>
            <b>{resultado.resistenciaRodadura_pct.toFixed(1)}%</b>
          </div>
          <div className="dato">
            <span>Resist. total cargado</span>
            <b>{resultado.resistenciaTotalCargado_pct.toFixed(1)}%</b>
          </div>
          <div className="dato">
            <span>Velocidad cargado</span>
            <b>{resultado.velocidadCargado_kmh.toFixed(1)} km/h</b>
          </div>
          <div className="dato">
            <span>Velocidad vacío</span>
            <b>{resultado.velocidadVacio_kmh.toFixed(1)} km/h</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ciclo del camión</legend>
        <div className="resultados">
          <div className="dato">
            <span>Baldadas por camión</span>
            <b>{resultado.numeroBaldesPorCamion}</b>
          </div>
          <div className="dato">
            <span>Tiempo de carga</span>
            <b>{minSeg(resultado.tiempoCarga_s)}</b>
          </div>
          <div className="dato">
            <span>Acarreo cargado</span>
            <b>{minSeg(resultado.tiempoAcarreoCargado_s)}</b>
          </div>
          <div className="dato">
            <span>Retorno vacío</span>
            <b>{minSeg(resultado.tiempoRetornoVacio_s)}</b>
          </div>
          <div className="dato">
            <span>Ciclo total</span>
            <b>{minSeg(resultado.tiempoCicloCamion_s)}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Flota <span className="badge" style={{ color: colorMF }}>MF = {resultado.matchFactor.toFixed(2)}</span>
        </legend>
        <div className="resultados">
          <div className="dato">
            <span>Productividad/camión</span>
            <b>{resultado.productividadCamion_tph.toFixed(0)} t/h</b>
          </div>
          <div className="dato">
            <span>Camiones (óptimo)</span>
            <b>{resultado.numeroCamionesOptimo}</b>
          </div>
          <div className="dato">
            <span>Camiones usados</span>
            <b>{resultado.numeroCamionesUsado}</b>
          </div>
          <div className="dato">
            <span>Producción de flota</span>
            <b>{resultado.produccionFlota_tph.toFixed(0)} t/h</b>
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
      </fieldset>
    </div>
  );
}
