import type { PatronIniciacion, ResultadoVoladura } from "@suite/core";

export interface EntradaVoladuraUI {
  patronIniciacion: PatronIniciacion;
  msPorMetroBurden: number;
  msPorMetroEspaciamiento: number;
}

interface Props {
  entrada: EntradaVoladuraUI;
  onCambiarEntrada: (nueva: EntradaVoladuraUI) => void;
  resultado: ResultadoVoladura;
  reproduciendo: boolean;
  tiempoActual_ms: number;
  onPlay: () => void;
  onPausar: () => void;
  onReiniciar: () => void;
  onExportarCSV: () => void;
}

const NOMBRES_PATRON: Record<PatronIniciacion, string> = {
  fila_por_fila: "Fila por fila",
  echelon: "Echelon (diagonal desde esquina)",
  v_corte: "V (diagonal desde el centro)",
};

export default function PanelVoladura({
  entrada,
  onCambiarEntrada,
  resultado,
  reproduciendo,
  tiempoActual_ms,
  onPlay,
  onPausar,
  onReiniciar,
  onExportarCSV,
}: Props) {
  const set = <K extends keyof EntradaVoladuraUI>(campo: K, valor: EntradaVoladuraUI[K]) =>
    onCambiarEntrada({ ...entrada, [campo]: valor });

  const progreso =
    resultado.duracionTotalSecuencia_ms > 0
      ? Math.min(tiempoActual_ms / resultado.duracionTotalSecuencia_ms, 1)
      : 0;

  return (
    <>
      <fieldset>
        <legend>Secuencia de iniciación</legend>
        <div className="campo">
          <label>Patrón</label>
          <select
            value={entrada.patronIniciacion}
            onChange={(e) => set("patronIniciacion", e.target.value as PatronIniciacion)}
          >
            {Object.entries(NOMBRES_PATRON).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="fila-dos">
          <div className="campo">
            <label>Retardo entre filas (ms/m burden)</label>
            <input
              type="number"
              step={0.5}
              min={0}
              value={entrada.msPorMetroBurden}
              onChange={(e) => set("msPorMetroBurden", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Retardo entre taladros (ms/m esp.)</label>
            <input
              type="number"
              step={0.5}
              min={0}
              disabled={entrada.patronIniciacion === "fila_por_fila"}
              value={entrada.msPorMetroEspaciamiento}
              onChange={(e) => set("msPorMetroEspaciamiento", Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Carga y factor de carga <span className="badge">{resultado.cargas.length} cargas</span>
        </legend>
        <div className="resultados">
          <div className="dato">
            <span>Carga lineal</span>
            <b>{resultado.cargaLineal_kgm.toFixed(2)} kg/m</b>
          </div>
          <div className="dato">
            <span>Peso total explosivo</span>
            <b>{resultado.pesoExplosivoTotal_kg.toFixed(0)} kg</b>
          </div>
          <div className="dato">
            <span>Volumen roca total</span>
            <b>{resultado.volumenRocaTotal_m3.toFixed(0)} m³</b>
          </div>
          <div className="dato">
            <span>Factor de carga</span>
            <b>{resultado.factorCarga_kgm3.toFixed(2)} kg/m³</b>
          </div>
          <div className="dato">
            <span>Retardo entre filas</span>
            <b>{resultado.retardoEntreFilas_ms.toFixed(0)} ms</b>
          </div>
          <div className="dato">
            <span>Retardo entre taladros</span>
            <b>{resultado.retardoEntreTaladros_ms.toFixed(0)} ms</b>
          </div>
          <div className="dato">
            <span>Duración de la secuencia</span>
            <b>{resultado.duracionTotalSecuencia_ms.toFixed(0)} ms</b>
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

      <fieldset>
        <legend>Reproducir secuencia (vista 3D)</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>
          Animación a escala visual (~5 s), no en tiempo real. Los marcadores sobre cada taladro se
          colorean de azul (temprano) a rojo (tardío) según su orden de salida — revisa la pestaña
          "Vista 3D" para verla.
        </p>
        <div className="barra-progreso">
          <div className="barra-progreso-relleno" style={{ width: `${progreso * 100}%` }} />
        </div>
        <div className="acciones">
          {!reproduciendo ? (
            <button className="btn btn-primario" type="button" onClick={onPlay}>
              ▶ Reproducir
            </button>
          ) : (
            <button className="btn btn-primario" type="button" onClick={onPausar}>
              ⏸ Pausar
            </button>
          )}
          <button className="btn" type="button" onClick={onReiniciar}>
            ⟲ Reiniciar
          </button>
          <button className="btn" type="button" onClick={onExportarCSV}>
            Exportar secuencia CSV
          </button>
        </div>
      </fieldset>
    </>
  );
}
