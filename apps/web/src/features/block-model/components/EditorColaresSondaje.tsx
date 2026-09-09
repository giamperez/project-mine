import { useState } from "react";
import type { ColarSondaje } from "@suite/core";
import { EditorPoligono2D } from "../../../components/shared/index.js";

interface Props {
  colares: ColarSondaje[];
  onCambiarColares: (nuevos: ColarSondaje[]) => void;
}

let contadorColarNuevo = 1000;

const estiloInput: React.CSSProperties = {
  width: 90,
  minHeight: 34,
  background: "var(--bg-elevado)",
  border: "1px solid var(--borde)",
  borderRadius: 8,
  padding: "4px 8px",
  color: "inherit",
};

/**
 * Adaptador delgado sobre EditorPoligono2D en modo "puntos libres" (conectado=false): cada toque
 * coloca un collar de sondaje nuevo (vertical, con la cota/profundidad por defecto elegidas
 * arriba); arrastrar mueve solo el X/Y del collar — profundidad/azimut/inclinacion se conservan
 * intactos gracias a que el editor trabaja directamente con el objeto ColarSondaje completo.
 */
export default function EditorColaresSondaje({ colares, onCambiarColares }: Props) {
  const [cotaPorDefecto, setCotaPorDefecto] = useState(() => (colares.length > 0 ? colares[0].z : 100));
  const [profundidadPorDefecto, setProfundidadPorDefecto] = useState(() =>
    colares.length > 0 ? colares[0].profundidadTotal_m : 60
  );

  function crearColar(x: number, y: number): ColarSondaje {
    contadorColarNuevo++;
    return {
      id: `DH-${contadorColarNuevo}`,
      x,
      y,
      z: cotaPorDefecto,
      profundidadTotal_m: profundidadPorDefecto,
      azimut_grados: 0,
      inclinacion_grados: -90,
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="editor2d-toolbar">
        <div className="editor2d-modos" style={{ alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Cota collar nuevo (m)</label>
          <input type="number" style={estiloInput} value={cotaPorDefecto} onChange={(e) => setCotaPorDefecto(Number(e.target.value))} />
          <label style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Profundidad (m)</label>
          <input
            type="number"
            style={estiloInput}
            value={profundidadPorDefecto}
            onChange={(e) => setProfundidadPorDefecto(Number(e.target.value))}
          />
        </div>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <EditorPoligono2D<ColarSondaje>
          puntos={colares}
          onCambiarPuntos={onCambiarColares}
          crearPunto={crearColar}
          conectado={false}
          etiquetaPunto={(c) => c.id}
        />
      </div>
    </div>
  );
}
