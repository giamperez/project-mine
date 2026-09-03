import { useMemo, useState } from "react";
import { longitudPoligono_m, type Punto2D } from "@suite/core";
import EditorPoligono2D from "./EditorPoligono2D.js";

export interface PuntoRuta extends Punto2D {
  id: string;
  /** Cota (elevacion), m. */
  z: number;
}

interface Props {
  ruta: PuntoRuta[];
  onCambiarRuta: (nuevos: PuntoRuta[]) => void;
  onAplicar: (distancia_m: number, pendiente_pct: number) => void;
}

let contadorPuntoNuevo = 0;

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
 * Calcula distancia horizontal total y pendiente promedio de la ruta trazada. La pendiente usa
 * el desnivel neto (cota del ultimo punto - cota del primero) sobre la distancia total, para que
 * el signo coincida con la convencion de EntradaAcarreo: positiva = subida en el sentido cargado
 * (primer punto = punto de carguio, ultimo punto = punto de descarga).
 */
function resumenRuta(ruta: PuntoRuta[]): { distancia_m: number; pendiente_pct: number } {
  if (ruta.length < 2) return { distancia_m: 0, pendiente_pct: 0 };
  const distancia_m = longitudPoligono_m(ruta, false);
  const desnivel_m = ruta[ruta.length - 1].z - ruta[0].z;
  const pendiente_pct = distancia_m > 0 ? (desnivel_m / distancia_m) * 100 : 0;
  return { distancia_m, pendiente_pct };
}

/**
 * Adaptador sobre EditorPoligono2D en modo "abierto" (polilinea sin cerrar): cada toque agrega el
 * siguiente punto de la ruta de acarreo (con la cota elegida arriba), en orden desde el punto de
 * carguio hasta el de descarga. La distancia y pendiente promedio resultantes se pueden aplicar
 * directamente a los datos de entrada del modulo con un boton, igual que en Topografia.
 */
export default function EditorRutaAcarreo({ ruta, onCambiarRuta, onAplicar }: Props) {
  const [cotaPorDefecto, setCotaPorDefecto] = useState(() => (ruta.length > 0 ? ruta[ruta.length - 1].z : 0));

  const resumen = useMemo(() => resumenRuta(ruta), [ruta]);

  function crearPuntoRuta(x: number, y: number): PuntoRuta {
    contadorPuntoNuevo++;
    return { id: `P${contadorPuntoNuevo}`, x, y, z: cotaPorDefecto };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="editor2d-toolbar">
        <div className="editor2d-modos" style={{ alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Cota del próximo punto (m)</label>
          <input type="number" style={estiloInput} value={cotaPorDefecto} onChange={(e) => setCotaPorDefecto(Number(e.target.value))} />
        </div>
        <div className="editor2d-modos" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--texto-tenue)" }}>
            {resumen.distancia_m.toFixed(0)} m · pendiente {resumen.pendiente_pct.toFixed(1)}%
          </span>
          <button
            className="btn"
            type="button"
            disabled={ruta.length < 2}
            onClick={() => onAplicar(resumen.distancia_m, resumen.pendiente_pct)}
          >
            Aplicar a datos
          </button>
        </div>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <EditorPoligono2D<PuntoRuta>
          puntos={ruta}
          onCambiarPuntos={onCambiarRuta}
          crearPunto={crearPuntoRuta}
          conectado="abierto"
          etiquetaPunto={(p) => `${p.id} (${p.z.toFixed(0)}m)`}
        />
      </div>
    </div>
  );
}
