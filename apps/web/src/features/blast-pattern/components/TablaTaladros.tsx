import type { ResultadoMallaPerforacion } from "@suite/core";

export default function TablaTaladros({ resultado }: { resultado: ResultadoMallaPerforacion }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px", flexShrink: 0 }}>
        <h2 style={{ fontSize: 11, color: "#94a3b8", margin: 0, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
          Coordenadas de Taladros
        </h2>
        <span className="badge" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", margin: 0 }}>
          {resultado.taladros.length} taladros
        </span>
      </div>
      <div
        style={{
          flex: "1 1 auto",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "calc(100vh - 210px)",
          borderRadius: 8,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(7, 11, 20, 0.75)",
        }}
      >
        <table className="tabla-taladros">
          <thead>
            <tr>
              <th style={{ width: "28%" }}>ID</th>
              <th style={{ width: "18%" }}>X (m)</th>
              <th style={{ width: "18%" }}>Y (m)</th>
              <th style={{ width: "18%" }}>Z (m)</th>
              <th style={{ width: "18%" }}>Prof. (m)</th>
            </tr>
          </thead>
          <tbody>
            {resultado.taladros.map((t) => (
              <tr key={t.id}>
                <td>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#f97316",
                      background: "rgba(249,115,22,0.12)",
                      padding: "2px 5px",
                      borderRadius: 4,
                      fontSize: 10.5,
                      display: "inline-block",
                    }}
                  >
                    {t.id}
                  </span>
                </td>
                <td>{t.collar.x.toFixed(2)}</td>
                <td>{t.collar.y.toFixed(2)}</td>
                <td>{t.collar.z.toFixed(2)}</td>
                <td style={{ color: "#38bdf8", fontWeight: 600 }}>{t.profundidad_m.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {resultado.taladros.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--texto-tenue)", fontSize: 13 }}>
            <p style={{ margin: "0 0 6px" }}>⚡ Aún no hay taladros generados.</p>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Ajusta la geometría del banco en la pestaña Diseño.</p>
          </div>
        )}
      </div>
    </div>
  );
}
