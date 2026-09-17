import type { TaladroTunel, ResultadoGeometriaFrente, EntradaArranqueHolmberg } from "@suite/core";

interface Props {
  taladros: TaladroTunel[];
  resultadoGeometria?: ResultadoGeometriaFrente;
  entradaArranque?: EntradaArranqueHolmberg;
  oculto?: boolean;
}

/** Panel derecho del modo Túnel / Galería subterránea — tabla de taladros del frente. */
export default function PanelDerechoTunel({ taladros, oculto }: Props) {
  return (
    <div className="panel-tabla panel-derecho" data-oculto={oculto}>
      <div style={{ padding: 14, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Taladros del frente
          </span>
          <span className="panel-seccion-badge">
            {taladros.length} taladros
          </span>
        </div>
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
    </div>
  );
}
