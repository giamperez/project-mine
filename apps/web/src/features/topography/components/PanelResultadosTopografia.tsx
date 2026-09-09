import type { ResultadoVolumenCorteRelleno } from "@suite/core";

interface Props {
  resultadoVolumen: ResultadoVolumenCorteRelleno | null;
  numeroCurvas: number;
  onExportarCurvasDXF: () => void;
  onExportarSuperficieDXF: () => void;
  oculto?: boolean;
}

export default function PanelResultadosTopografia({
  resultadoVolumen,
  numeroCurvas,
  onExportarCurvasDXF,
  onExportarSuperficieDXF,
  oculto,
}: Props) {
  return (
    <div className="panel-tabla" data-oculto={oculto}>
      <fieldset>
        <legend>
          Curvas de nivel <span className="badge">{numeroCurvas} segmentos</span>
        </legend>
        <button className="btn" type="button" onClick={onExportarCurvasDXF}>
          Exportar curvas DXF
        </button>
      </fieldset>

      <fieldset>
        <legend>Volumen corte / relleno</legend>
        {resultadoVolumen ? (
          <>
            <div className="resultados">
              <div className="dato">
                <span>Área común</span>
                <b>{resultadoVolumen.areaComun_m2.toFixed(0)} m²</b>
              </div>
              <div className="dato">
                <span>Celdas muestreadas</span>
                <b>{resultadoVolumen.celdasMuestreadas}</b>
              </div>
              <div className="dato">
                <span>Volumen de corte</span>
                <b>{resultadoVolumen.volumenCorte_m3.toFixed(0)} m³</b>
              </div>
              <div className="dato">
                <span>Volumen de relleno</span>
                <b>{resultadoVolumen.volumenRelleno_m3.toFixed(0)} m³</b>
              </div>
              <div className="dato">
                <span>Volumen neto</span>
                <b>{resultadoVolumen.volumenNeto_m3.toFixed(0)} m³</b>
              </div>
            </div>
            {resultadoVolumen.advertencias.length > 0 && (
              <div className="advertencias">
                {resultadoVolumen.advertencias.map((a, i) => (
                  <div className="advertencia" key={i}>
                    ⚠ {a}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>
            Carga una superficie de referencia en la pestaña "Datos" para calcular corte/relleno.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>Superficie</legend>
        <button className="btn" type="button" onClick={onExportarSuperficieDXF}>
          Exportar superficie DXF (3DFACE)
        </button>
      </fieldset>
    </div>
  );
}
