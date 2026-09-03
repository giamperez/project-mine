import type { ResultadoEstabilidadPlanar, ResultadoHoekBrown, ResultadoQ, ResultadoRMR } from "@suite/core";

interface Props {
  rmr: ResultadoRMR;
  q: ResultadoQ;
  hoekBrown: ResultadoHoekBrown;
  estabilidad: ResultadoEstabilidadPlanar;
  oculto?: boolean;
}

export default function PanelResultadosGeomecanica({ rmr, q, hoekBrown, estabilidad, oculto }: Props) {
  const colorFS = estabilidad.factorSeguridad < 1 ? "var(--peligro)" : estabilidad.factorSeguridad < 1.3 ? "var(--acento)" : "var(--ok)";

  return (
    <div className="panel-tabla" data-oculto={oculto}>
      <fieldset>
        <legend>
          RMR <span className="badge">Clase {rmr.clase} — {rmr.descripcionClase}</span>
        </legend>
        <div className="resultados">
          <div className="dato">
            <span>RMR</span>
            <b>{rmr.rmr}</b>
          </div>
          <div className="dato">
            <span>GSI (RMR-5)</span>
            <b>{rmr.rmr - 5}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Q <span className="badge">{q.clase}</span>
        </legend>
        <div className="resultados">
          <div className="dato">
            <span>Q</span>
            <b>{q.q.toFixed(2)}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Hoek-Brown</legend>
        <div className="resultados">
          <div className="dato">
            <span>mb</span>
            <b>{hoekBrown.mb.toFixed(3)}</b>
          </div>
          <div className="dato">
            <span>s</span>
            <b>{hoekBrown.s.toExponential(2)}</b>
          </div>
          <div className="dato">
            <span>a</span>
            <b>{hoekBrown.a.toFixed(3)}</b>
          </div>
          <div className="dato">
            <span>UCS macizo</span>
            <b>{hoekBrown.resistenciaMacizoUCS_MPa.toFixed(2)} MPa</b>
          </div>
          <div className="dato">
            <span>Cohesión equiv. c'</span>
            <b>{(hoekBrown.cohesionEquivalente_MPa * 1000).toFixed(0)} kPa</b>
          </div>
          <div className="dato">
            <span>Fricción equiv. φ'</span>
            <b>{hoekBrown.anguloFriccionEquivalente_grados.toFixed(1)}°</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Estabilidad (falla planar) <span className="badge" style={{ color: colorFS }}>FS = {estabilidad.factorSeguridad.toFixed(2)}</span>
        </legend>
        <div className="resultados">
          <div className="dato">
            <span>Factible cinemáticamente</span>
            <b>{estabilidad.cinematicamenteFactible ? "Sí" : "No"}</b>
          </div>
          <div className="dato">
            <span>Long. plano de falla</span>
            <b>{estabilidad.longitudPlanoFalla_m.toFixed(1)} m</b>
          </div>
          <div className="dato">
            <span>Peso de la cuña</span>
            <b>{estabilidad.peso_kN.toFixed(0)} kN/m</b>
          </div>
          <div className="dato">
            <span>Fuerza resistente</span>
            <b>{estabilidad.fuerzaResistente_kN.toFixed(0)} kN/m</b>
          </div>
          <div className="dato">
            <span>Fuerza actuante</span>
            <b>{estabilidad.fuerzaActuante_kN.toFixed(0)} kN/m</b>
          </div>
        </div>
        {estabilidad.advertencias.length > 0 && (
          <div className="advertencias">
            {estabilidad.advertencias.map((a, i) => (
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
