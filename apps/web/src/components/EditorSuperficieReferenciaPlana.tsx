import type { Punto2D } from "@suite/core";
import EditorPoligono2D from "./EditorPoligono2D.js";

interface Props {
  poligono: Punto2D[];
  onCambiarPoligono: (nuevos: Punto2D[]) => void;
  elevacion_m: number;
  onCambiarElevacion: (v: number) => void;
  onAplicar: () => void;
}

/**
 * Adaptador delgado sobre EditorPoligono2D (que es generico, X/Y puro): agrega una cota unica y
 * un boton "Aplicar" para convertir el poligono dibujado en una superficie de referencia plana
 * (cada vertice -> {x,y,z=elevacion}), util para comparar un diseno/limite propuesto contra el
 * levantamiento real en mining.topography.
 */
export default function EditorSuperficieReferenciaPlana({
  poligono,
  onCambiarPoligono,
  elevacion_m,
  onCambiarElevacion,
  onAplicar,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="editor2d-toolbar">
        <div className="editor2d-modos" style={{ alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Cota de la superficie (m)</label>
          <input
            type="number"
            style={{
              width: 90,
              minHeight: 34,
              background: "var(--bg-elevado)",
              border: "1px solid var(--borde)",
              borderRadius: 8,
              padding: "4px 8px",
              color: "inherit",
            }}
            value={elevacion_m}
            onChange={(e) => onCambiarElevacion(Number(e.target.value))}
          />
        </div>
        <button className="btn btn-primario" type="button" onClick={onAplicar} disabled={poligono.length < 3}>
          ✓ Aplicar como referencia
        </button>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <EditorPoligono2D puntos={poligono} onCambiarPuntos={onCambiarPoligono} />
      </div>
    </div>
  );
}
