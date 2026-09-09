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
      {subPestana === "voladura" ? (
        <PanelVoladura
          entrada={entradaVoladura}
          onCambiarEntrada={onCambiarEntradaVoladura}
          resultado={resultadoVoladura}
          resultadoMalla={resultado}
          taladros={resultado.taladros}
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
