import type { Discontinuidad, ResultadoEstereografia } from "@suite/core";

interface Props {
  discontinuidades: Discontinuidad[];
  resultado: ResultadoEstereografia;
  oculto?: boolean;
}

function nombreDe(discontinuidades: Discontinuidad[], id: string): string {
  return discontinuidades.find((d) => d.id === id)?.nombre ?? id;
}

export default function PanelResultadosEstereografia({ discontinuidades, resultado, oculto }: Props) {
  const cunasOrdenadas = [...resultado.analisisCunas].sort((a, b) => Number(b.factible) - Number(a.factible));

  return (
    <div className="panel-tabla" data-oculto={oculto}>
      <fieldset>
        <legend>Resumen cinemático</legend>
        <div className="resultados">
          <div className="dato">
            <span>Discontinuidades</span>
            <b>{resultado.resumen.totalDiscontinuidades}</b>
          </div>
          <div className="dato">
            <span>Riesgo planar</span>
            <b style={{ color: resultado.resumen.riesgoPlanar > 0 ? "var(--peligro)" : "var(--ok)" }}>{resultado.resumen.riesgoPlanar}</b>
          </div>
          <div className="dato">
            <span>Riesgo vuelco</span>
            <b style={{ color: resultado.resumen.riesgoVuelco > 0 ? "var(--acento)" : "var(--ok)" }}>{resultado.resumen.riesgoVuelco}</b>
          </div>
          <div className="dato">
            <span>Cuñas factibles</span>
            <b style={{ color: resultado.resumen.cunasFactibles > 0 ? "var(--peligro)" : "var(--ok)" }}>{resultado.resumen.cunasFactibles}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Por discontinuidad</legend>
        <div style={{ overflowX: "auto" }}>
          <table className="tabla-taladros">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Planar</th>
                <th>Vuelco</th>
                <th>Δ dirección</th>
              </tr>
            </thead>
            <tbody>
              {resultado.analisisPlanoVuelco.map((a) => (
                <tr key={a.discontinuidadId}>
                  <td>{nombreDe(discontinuidades, a.discontinuidadId)}</td>
                  <td style={{ color: a.planarFactible ? "var(--peligro)" : "inherit" }}>{a.planarFactible ? "Sí" : "—"}</td>
                  <td style={{ color: a.vuelcoFactible ? "var(--acento)" : "inherit" }}>{a.vuelcoFactible ? "Sí" : "—"}</td>
                  <td>{a.diferenciaDireccion_grados.toFixed(0)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset>
        <legend>Análisis de cuñas (pares)</legend>
        <div style={{ overflowX: "auto" }}>
          <table className="tabla-taladros">
            <thead>
              <tr>
                <th>Par</th>
                <th>Trend</th>
                <th>Plunge</th>
                <th>Factible</th>
              </tr>
            </thead>
            <tbody>
              {cunasOrdenadas.map((c) => (
                <tr key={`${c.idA}-${c.idB}`}>
                  <td>
                    {nombreDe(discontinuidades, c.idA)}–{nombreDe(discontinuidades, c.idB)}
                  </td>
                  <td>{c.trendInterseccion_grados.toFixed(0)}°</td>
                  <td>{c.plungeInterseccion_grados.toFixed(0)}°</td>
                  <td style={{ color: c.factible ? "var(--peligro)" : "inherit" }}>{c.factible ? "Sí" : "—"}</td>
                </tr>
              ))}
              {cunasOrdenadas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--texto-tenue)" }}>
                    Se necesitan al menos 2 discontinuidades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  );
}
