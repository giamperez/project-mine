import { useState } from "react";
import { recortarPorCota, type PuntoCurvaLeyTonelaje } from "@suite/core";
import type { Bloque } from "@suite/core";

interface Props {
  curva: PuntoCurvaLeyTonelaje[];
  bloquesEstimados: number;
  bloquesTotal: number;
  onExportarCSV: () => void;
  bloques: Bloque[];
  volumenBloque_m3: number;
  densidad_ton_m3: number;
  oculto?: boolean;
}

export default function PanelResultadosModeloBloques({
  curva,
  bloquesEstimados,
  bloquesTotal,
  onExportarCSV,
  bloques,
  volumenBloque_m3,
  densidad_ton_m3,
  oculto,
}: Props) {
  const [cotaCorte, setCotaCorte] = useState(0);
  const [lado, setLado] = useState<"bajo" | "sobre">("bajo");
  const resumenCorte = recortarPorCota(bloques, cotaCorte, lado, volumenBloque_m3, densidad_ton_m3);

  return (
    <div className="panel-tabla" data-oculto={oculto}>
      <fieldset>
        <legend>Cobertura del modelo</legend>
        <div className="resultados">
          <div className="dato">
            <span>Bloques estimados</span>
            <b>{bloquesEstimados.toLocaleString()}</b>
          </div>
          <div className="dato">
            <span>Bloques totales</span>
            <b>{bloquesTotal.toLocaleString()}</b>
          </div>
        </div>
        {bloquesTotal > 0 && bloquesEstimados / bloquesTotal < 0.3 && (
          <div className="advertencias">
            <div className="advertencia">
              ⚠ Solo {((bloquesEstimados / bloquesTotal) * 100).toFixed(0)}% de los bloques cayó dentro del radio de búsqueda de algún
              composito. Aumenta el radio o agrega sondajes.
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Recortar por cota + tonelaje</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>
          Simplificación de "recortar por topografía" con un plano horizontal en vez de una superficie
          triangulada real (ese cruce con la superficie de Topografía queda para más adelante).
        </p>
        <div className="fila-dos">
          <div className="campo">
            <label>Cota de corte (m)</label>
            <input type="number" value={cotaCorte} onChange={(e) => setCotaCorte(Number(e.target.value))} />
          </div>
          <div className="campo">
            <label>Lado a conservar</label>
            <select value={lado} onChange={(e) => setLado(e.target.value as "bajo" | "sobre")}>
              <option value="bajo">Bajo la cota (z ≤ corte)</option>
              <option value="sobre">Sobre la cota (z ≥ corte)</option>
            </select>
          </div>
        </div>
        <div className="resultados">
          <div className="dato">
            <span>Bloques</span>
            <b>{resumenCorte.numeroBloques.toLocaleString()}</b>
          </div>
          <div className="dato">
            <span>Volumen</span>
            <b>{resumenCorte.volumen_m3.toLocaleString(undefined, { maximumFractionDigits: 0 })} m³</b>
          </div>
          <div className="dato">
            <span>Tonelaje</span>
            <b>{resumenCorte.tonelaje_ton.toLocaleString(undefined, { maximumFractionDigits: 0 })} t</b>
          </div>
          <div className="dato">
            <span>Ley media</span>
            <b>{resumenCorte.leyMedia.toFixed(3)}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Curva ley-tonelaje <span className="badge">{curva.length} cortes</span>
        </legend>
        <div style={{ overflowX: "auto" }}>
          <table className="tabla-taladros">
            <thead>
              <tr>
                <th>Ley de corte</th>
                <th>Tonelaje</th>
                <th>Ley media</th>
              </tr>
            </thead>
            <tbody>
              {curva.map((p) => (
                <tr key={p.leyCorte}>
                  <td>{p.leyCorte.toFixed(2)}</td>
                  <td>{p.tonelaje_ton.toLocaleString(undefined, { maximumFractionDigits: 0 })} t</td>
                  <td>{p.leyMedia.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="acciones">
          <button className="btn" type="button" onClick={onExportarCSV}>
            Exportar curva CSV
          </button>
        </div>
      </fieldset>
    </div>
  );
}
