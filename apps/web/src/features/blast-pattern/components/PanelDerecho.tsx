import type { ResultadoMallaPerforacion } from "@suite/core";
import TablaTaladros from "./TablaTaladros.js";

interface Props {
  resultado: ResultadoMallaPerforacion;
  oculto?: boolean;
}

export default function PanelDerecho({ resultado, oculto }: Props) {
  return (
    <div className="panel-tabla panel-derecho" data-oculto={oculto}>
      <TablaTaladros resultado={resultado} />
    </div>
  );
}
