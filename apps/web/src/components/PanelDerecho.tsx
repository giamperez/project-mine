import type { ResultadoMallaPerforacion, ResultadoVoladura } from "@suite/core";
import TablaTaladros from "./TablaTaladros.js";
import PanelVoladura, { type EntradaVoladuraUI } from "./PanelVoladura.js";

export type SubPestanaDerecha = "tabla" | "voladura";

interface Props {
  subPestana: SubPestanaDerecha;
  onCambiarSubPestana: (p: SubPestanaDerecha) => void;
  resultado: ResultadoMallaPerforacion;
  resultadoVoladura: ResultadoVoladura;
  entradaVoladura: EntradaVoladuraUI;
  onCambiarEntradaVoladura: (nueva: EntradaVoladuraUI) => void;
  reproduciendo: boolean;
  tiempoActual_ms: number;
  onPlay: () => void;
  onPausar: () => void;
  onReiniciar: () => void;
  onExportarSecuenciaCSV: () => void;
  oculto?: boolean;
}

export default function PanelDerecho({
  subPestana,
  onCambiarSubPestana,
  resultado,
  resultadoVoladura,
  entradaVoladura,
  onCambiarEntradaVoladura,
  reproduciendo,
  tiempoActual_ms,
  onPlay,
  onPausar,
  onReiniciar,
  onExportarSecuenciaCSV,
  oculto,
}: Props) {
  return (
    <div className="panel-tabla panel-derecho" data-oculto={oculto}>
      <div className="tabs-panel-derecho">
        <button type="button" data-activo={subPestana === "tabla"} onClick={() => onCambiarSubPestana("tabla")}>
          Taladros
        </button>
        <button type="button" data-activo={subPestana === "voladura"} onClick={() => onCambiarSubPestana("voladura")}>
          Voladura
        </button>
      </div>

      {subPestana === "voladura" ? (
        <PanelVoladura
          entrada={entradaVoladura}
          onCambiarEntrada={onCambiarEntradaVoladura}
          resultado={resultadoVoladura}
          reproduciendo={reproduciendo}
          tiempoActual_ms={tiempoActual_ms}
          onPlay={onPlay}
          onPausar={onPausar}
          onReiniciar={onReiniciar}
          onExportarCSV={onExportarSecuenciaCSV}
        />
      ) : (
        <TablaTaladros resultado={resultado} />
      )}
    </div>
  );
}
