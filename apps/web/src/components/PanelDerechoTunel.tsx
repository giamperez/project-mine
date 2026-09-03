import type { TaladroTunel } from "@suite/core";
import type { SubPestanaDerecha } from "./PanelDerecho.js";

interface Props {
  subPestana: SubPestanaDerecha;
  onCambiarSubPestana: (p: SubPestanaDerecha) => void;
  taladros: TaladroTunel[];
  oculto?: boolean;
}

/** Panel derecho del modo Túnel — mismo slot de layout (.panel-tabla) que PanelDerecho en modo Banco, para no romper las 3 columnas del layout de escritorio. */
export default function PanelDerechoTunel({ subPestana, onCambiarSubPestana, taladros, oculto }: Props) {
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
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", padding: 14 }}>
          El cálculo de carga explosiva y secuencia de iniciación para rounds subterráneos todavía no está
          implementado — por ahora esta sección solo cubre el diseño geométrico del arranque (Holmberg) y la
          distribución de taladros por zona.
        </p>
      ) : (
        <div style={{ padding: 14, overflowX: "auto" }}>
          <legend style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
            Taladros del frente — {taladros.length}
          </legend>
          {taladros.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>
              Todavía no hay taladros. Andá a la pestaña "Frente" y tocá para agregar.
            </p>
          ) : (
            <table className="tabla-taladros">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Zona</th>
                  <th>X (m)</th>
                  <th>Y (m)</th>
                </tr>
              </thead>
              <tbody>
                {taladros.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.zona}</td>
                    <td>{t.x.toFixed(2)}</td>
                    <td>{t.y.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
