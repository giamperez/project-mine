import type {
  EntradaArranqueHolmberg,
  GeometriaFrenteTunel,
  ResultadoArranqueHolmberg,
  ResultadoGeometriaFrente,
  TaladroTunel,
  TipoSeccionTunel,
  ZonaTaladroTunel,
} from "@suite/core";
import { ETIQUETAS_ZONA_TUNEL } from "@suite/core";

interface Props {
  geometria: GeometriaFrenteTunel;
  onCambiarGeometria: (g: GeometriaFrenteTunel) => void;
  entradaArranque: EntradaArranqueHolmberg;
  onCambiarEntradaArranque: (e: EntradaArranqueHolmberg) => void;
  resultadoGeometria: ResultadoGeometriaFrente;
  resultadoArranque: ResultadoArranqueHolmberg;
  taladros: TaladroTunel[];
  oculto?: boolean;
}

const ORDEN_ZONAS: ZonaTaladroTunel[] = [
  "alivio",
  "cuadrante1",
  "cuadrante2",
  "cuadrante3",
  "cuadrante4",
  "produccion",
  "cuadrador",
  "corona",
  "recorte",
  "arrastre",
];

export default function PanelDisenoTunel({
  geometria,
  onCambiarGeometria,
  entradaArranque,
  onCambiarEntradaArranque,
  resultadoGeometria,
  resultadoArranque,
  taladros,
  oculto,
}: Props) {
  const setGeometria = <K extends keyof GeometriaFrenteTunel>(campo: K, valor: GeometriaFrenteTunel[K]) =>
    onCambiarGeometria({ ...geometria, [campo]: valor });
  const setArranque = <K extends keyof EntradaArranqueHolmberg>(campo: K, valor: EntradaArranqueHolmberg[K]) =>
    onCambiarEntradaArranque({ ...entradaArranque, [campo]: valor });

  const volumenPorAvance_m3 = resultadoGeometria.area_m2 * entradaArranque.avance_m;
  const conteoZonas = ORDEN_ZONAS.map((zona) => ({ zona, n: taladros.filter((t) => t.zona === zona).length }));

  return (
    <div className="panel-form" data-oculto={oculto}>
      {/* 1. Sección del Frente */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#38bdf8", background: "rgba(56,189,248,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 21h18M5 21V7l7-4 7 4v14" />
                <path d="M9 10a3 3 0 0 1 6 0v11H9V10z" />
              </svg>
            </span>
            <span>Sección del Frente / Galería</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="fila-dos">
            <div className="campo">
              <label>Forma</label>
              <select value={geometria.tipo} onChange={(e) => setGeometria("tipo", e.target.value as TipoSeccionTunel)}>
                <option value="herradura">Herradura (hastiales + corona semicircular)</option>
                <option value="rectangular">Rectangular</option>
              </select>
            </div>
          </div>
          <div className="fila-dos">
            <div className="campo">
              <label>Ancho (m)</label>
              <input type="number" min={0.5} step={0.1} value={geometria.ancho_m} onChange={(e) => setGeometria("ancho_m", Number(e.target.value))} />
            </div>
            <div className="campo">
              <label>Alto total (m)</label>
              <input type="number" min={0.5} step={0.1} value={geometria.alto_m} onChange={(e) => setGeometria("alto_m", Number(e.target.value))} />
            </div>
          </div>
          <div className="resultados" style={{ marginTop: 4 }}>
            <div className="dato dato-destacado">
              <span>Área</span>
              <b style={{ color: "#38bdf8" }}>{resultadoGeometria.area_m2.toFixed(2)} m²</b>
            </div>
            <div className="dato dato-destacado">
              <span>Perímetro</span>
              <b style={{ color: "#f97316" }}>{resultadoGeometria.perimetro_m.toFixed(2)} m</b>
            </div>
            {geometria.tipo === "herradura" && (
              <>
                <div className="dato">
                  <span>Altura de corona</span>
                  <b>{resultadoGeometria.alturaCorona_m.toFixed(2)} m</b>
                </div>
                <div className="dato">
                  <span>Altura de hastial</span>
                  <b>{resultadoGeometria.alturaHastial_m.toFixed(2)} m</b>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Perforación y Alivios */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#f97316", background: "rgba(249,115,22,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </span>
            <span>Perforación y Alivios (Holmberg)</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <p style={{ fontSize: 11, color: "var(--texto-tenue)", margin: "0 0 6px", lineHeight: 1.4 }}>
            Método de Jimeno et al. cap. 22 · Holmberg / Olofsson. Diámetro equivalente De = D_indiv × √N.
          </p>
          <div className="fila-dos">
            <div className="campo">
              <label>N° taladros alivio</label>
              <input
                type="number"
                min={1}
                value={entradaArranque.numeroTaladrosAlivio}
                onChange={(e) => setArranque("numeroTaladrosAlivio", Number(e.target.value))}
              />
            </div>
            <div className="campo">
              <label>Diám. alivio (mm)</label>
              <input
                type="number"
                min={1}
                value={entradaArranque.diametroIndividualAlivio_mm}
                onChange={(e) => setArranque("diametroIndividualAlivio_mm", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="campo">
            <label>Avance objetivo (m)</label>
            <input type="number" min={0.1} step={0.1} value={entradaArranque.avance_m} onChange={(e) => setArranque("avance_m", Number(e.target.value))} />
          </div>
          <div className="resultados" style={{ marginTop: 4 }}>
            <div className="dato">
              <span>Diámetro equivalente</span>
              <b style={{ color: "#38bdf8" }}>{resultadoArranque.diametroEquivalente_mm.toFixed(1)} mm</b>
            </div>
            <div className="dato">
              <span>Volumen por avance</span>
              <b style={{ color: "#10b981" }}>{volumenPorAvance_m3.toFixed(2)} m³</b>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Arranque - Secciones */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#10b981", background: "rgba(16,185,129,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <span>Arranque — Secciones B/E</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          {resultadoArranque.secciones.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: 0 }}>Ingresá diámetro y número de taladros de alivio para calcular.</p>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--borde)", background: "rgba(10,14,24,0.6)" }}>
              <table className="tabla-taladros">
                <thead>
                  <tr>
                    <th>Sección</th>
                    <th>Burden (m)</th>
                    <th>Espaciamiento (m)</th>
                    <th>Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadoArranque.secciones.map((s) => (
                    <tr key={s.numero}>
                      <td style={{ fontWeight: 700, color: "#38bdf8" }}>S-{s.numero}</td>
                      <td>{s.burden_m.toFixed(3)}</td>
                      <td>{s.espaciamiento_m.toFixed(3)}</td>
                      <td style={{ color: "#f97316", fontWeight: 600 }}>{s.factor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Distribución por Zonas */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#a855f7", background: "rgba(168,85,247,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 10 10H12V2z" />
              </svg>
            </span>
            <span>Distribución por Zonas</span>
          </div>
          <span className="panel-seccion-badge" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
            {taladros.length} taladros
          </span>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            {conteoZonas.map(({ zona, n }) => (
              <div className="dato" key={zona}>
                <span>{ETIQUETAS_ZONA_TUNEL[zona]}</span>
                <b>{n}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
