import { useMemo } from "react";
import type { CargaTaladroDetallada, PatronIniciacion, ResultadoVoladura } from "@suite/core";

const OPCIONES_INTERVALO_MS = [17, 25, 42, 50, 65];
const OPCIONES_MICRORETARDO_MS = [0, 3, 5, 8];

const OPCIONES_PATRON_BANCO: Array<{ valor: PatronIniciacion; etiqueta: string }> = [
  { valor: "fila_por_fila", etiqueta: "Fila por fila" },
  { valor: "echelon", etiqueta: "Echelon (diagonal)" },
  { valor: "v_corte", etiqueta: "Corte en V" },
];

const OPCIONES_PATRON_TUNEL: Array<{ valor: PatronIniciacion; etiqueta: string }> = [
  { valor: "tunel_concentrico", etiqueta: "Concéntrico estándar" },
  { valor: "tunel_secuencial_cuadrantes", etiqueta: "Cuadrantes MS/LP" },
  { valor: "tunel_espiral", etiqueta: "Espiral radial" },
];

interface Props {
  esTunel: boolean;
  patronIniciacion: PatronIniciacion;
  onCambiarPatron: (p: PatronIniciacion) => void;
  msPorMetroBurden: number;
  onCambiarMsPorMetroBurden: (v: number) => void;
  msPorMetroEspaciamiento: number;
  onCambiarMsPorMetroEspaciamiento: (v: number) => void;
  resultadoVoladura: ResultadoVoladura;
  cargasDetalladas: CargaTaladroDetallada[];
}

export default function PanelRetardos({
  esTunel,
  patronIniciacion,
  onCambiarPatron,
  msPorMetroBurden,
  onCambiarMsPorMetroBurden,
  msPorMetroEspaciamiento,
  onCambiarMsPorMetroEspaciamiento,
  resultadoVoladura,
  cargasDetalladas,
}: Props) {
  const mapaPeso = useMemo(() => new Map(cargasDetalladas.map((c) => [c.taladroId, c.pesoExplosivo_kg])), [cargasDetalladas]);

  const periodos = useMemo(() => {
    const grupos = new Map<number, { tiempo_ms: number; taladros: number; peso_kg: number; etiqueta?: string }>();
    for (const carga of resultadoVoladura.cargas) {
      const clave = Math.round(carga.tiempoDetonacion_ms);
      const existente = grupos.get(clave);
      const peso = mapaPeso.get(carga.taladroId) ?? 0;
      if (existente) {
        existente.taladros += 1;
        existente.peso_kg += peso;
      } else {
        grupos.set(clave, { tiempo_ms: clave, taladros: 1, peso_kg: peso, etiqueta: carga.serieDetonador });
      }
    }
    return Array.from(grupos.values()).sort((a, b) => a.tiempo_ms - b.tiempo_ms);
  }, [resultadoVoladura.cargas, mapaPeso]);

  const ultimaSalida_ms = periodos.length > 0 ? periodos[periodos.length - 1].tiempo_ms : 0;
  const cargados = resultadoVoladura.cargas.filter((c) => (mapaPeso.get(c.taladroId) ?? 0) > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Secuencia de iniciación</span>
          </div>
          <span className="panel-seccion-badge">{esTunel ? "Túnel" : "Banco"}</span>
        </div>
        <div className="panel-seccion-body">
          <div className="campo" style={{ marginBottom: 10 }}>
            <label>Patrón de amarre</label>
            <select value={patronIniciacion} onChange={(e) => onCambiarPatron(e.target.value as PatronIniciacion)}>
              {(esTunel ? OPCIONES_PATRON_TUNEL : OPCIONES_PATRON_BANCO).map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="campo" style={{ marginBottom: 8 }}>
            <label>Intervalo principal (ms/m burden)</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {OPCIONES_INTERVALO_MS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  className="btn"
                  data-activo={msPorMetroBurden === ms}
                  onClick={() => onCambiarMsPorMetroBurden(ms)}
                >
                  {ms} ms
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <label>Micro-retardo dentro de cada grupo (ms/m espaciamiento)</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {OPCIONES_MICRORETARDO_MS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  className="btn"
                  data-activo={msPorMetroEspaciamiento === ms}
                  disabled={patronIniciacion === "fila_por_fila"}
                  onClick={() => onCambiarMsPorMetroEspaciamiento(ms)}
                >
                  {ms} ms
                </button>
              ))}
            </div>
          </div>

          <div className="resultados" style={{ marginTop: 10 }}>
            <div className="dato">
              <span>Períodos</span>
              <b>{periodos.length}</b>
            </div>
            <div className="dato">
              <span>Última salida</span>
              <b style={{ color: "#38bdf8" }}>{ultimaSalida_ms.toFixed(0)} ms</b>
            </div>
            <div className="dato">
              <span>Cargados</span>
              <b>{cargados}</b>
            </div>
          </div>

          {resultadoVoladura.advertencias.length > 0 && (
            <div className="advertencias">
              {resultadoVoladura.advertencias.map((a, i) => (
                <div className="advertencia" key={i}>
                  ⚠ {a}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.3)",
              fontSize: 11,
              color: "#fde68a",
              lineHeight: 1.4,
            }}
          >
            ⚠ Los milisegundos mostrados son una secuencia de diseño para visualización. Deben adaptarse al detonador
            real, dispersión nominal, normativa, protocolo de conexión y evaluación del responsable de voladura.
          </div>
        </div>
      </div>

      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Línea de tiempo</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {periodos.map((p) => (
              <div
                key={p.tiempo_ms}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(15,23,42,0.6)",
                  border: "1px solid var(--borde)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#fb7185", fontSize: 12 }}>{p.tiempo_ms} ms</div>
                  <div style={{ fontSize: 10, color: "var(--texto-tenue)" }}>{p.taladros} taladro(s){p.etiqueta ? ` · ${p.etiqueta}` : ""}</div>
                </div>
                <b style={{ fontSize: 12, color: "#38bdf8" }}>{p.peso_kg.toFixed(2)} kg</b>
              </div>
            ))}
            {periodos.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Sin taladros para secuenciar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
