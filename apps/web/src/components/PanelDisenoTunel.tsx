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
      <fieldset>
        <legend>Sección del frente</legend>
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
          <div className="dato">
            <span>Área</span>
            <b>{resultadoGeometria.area_m2.toFixed(2)} m²</b>
          </div>
          <div className="dato">
            <span>Perímetro</span>
            <b>{resultadoGeometria.perimetro_m.toFixed(2)} m</b>
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
      </fieldset>

      <fieldset>
        <legend>Perforación y alivios (arranque Holmberg)</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>
          Método simplificado de Jimeno et al. (1995) cap. 22, Tabla 22.2 — citando a Holmberg (1982) y
          Olofsson (1990). Diámetro equivalente De = D_individual × √N.
        </p>
        <div className="fila-dos">
          <div className="campo">
            <label>N° taladros de alivio</label>
            <input
              type="number"
              min={1}
              value={entradaArranque.numeroTaladrosAlivio}
              onChange={(e) => setArranque("numeroTaladrosAlivio", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Diámetro individual de alivio (mm)</label>
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
            <b>{resultadoArranque.diametroEquivalente_mm.toFixed(1)} mm</b>
          </div>
          <div className="dato">
            <span>Volumen por avance</span>
            <b>{volumenPorAvance_m3.toFixed(2)} m³</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Arranque — secciones B/E</legend>
        {resultadoArranque.secciones.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Ingresá diámetro y número de taladros de alivio para calcular.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
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
                    <td>{s.numero}</td>
                    <td>{s.burden_m.toFixed(3)}</td>
                    <td>{s.espaciamiento_m.toFixed(3)}</td>
                    <td>{s.factor.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Distribución por zonas — {taladros.length} taladros dibujados</legend>
        <div className="resultados">
          {conteoZonas.map(({ zona, n }) => (
            <div className="dato" key={zona}>
              <span>{ETIQUETAS_ZONA_TUNEL[zona]}</span>
              <b>{n}</b>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
