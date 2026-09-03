import type { ResultadoMallaPerforacion } from "@suite/core";

export default function TablaTaladros({ resultado }: { resultado: ResultadoMallaPerforacion }) {
  return (
    <>
      <h2 style={{ fontSize: 13, color: "var(--texto-tenue)", margin: "0 0 10px", textTransform: "uppercase" }}>
        Coordenadas de taladros ({resultado.taladros.length})
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table className="tabla-taladros">
          <thead>
            <tr>
              <th>ID</th>
              <th>X collar</th>
              <th>Y collar</th>
              <th>Z collar</th>
              <th>Prof. (m)</th>
            </tr>
          </thead>
          <tbody>
            {resultado.taladros.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.collar.x.toFixed(2)}</td>
                <td>{t.collar.y.toFixed(2)}</td>
                <td>{t.collar.z.toFixed(2)}</td>
                <td>{t.profundidad_m.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {resultado.taladros.length === 0 && (
          <p style={{ color: "var(--texto-tenue)", fontSize: 13 }}>
            Aún no hay taladros generados. Ajusta la geometría del banco en la pestaña Diseño.
          </p>
        )}
      </div>
    </>
  );
}
