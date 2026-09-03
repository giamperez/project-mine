import { useRef } from "react";
import type { MetodoInterpolacion, ModeloVariograma, PuntoVariogramaExperimental, TipoModeloVariograma } from "@suite/core";
import GraficoVariograma from "./GraficoVariograma.js";

export interface ParametrosModeloUI {
  longitudComposito_m: number;
  tamanoBloque_m: number;
  radioBusqueda_m: number;
  potencia: number;
  densidad_ton_m3: number;
  leyCorteVisor: number;
}

interface Props {
  parametros: ParametrosModeloUI;
  onCambiarParametros: (nuevos: ParametrosModeloUI) => void;
  numeroColares: number;
  numeroIntervalos: number;
  numeroCompositos: number;
  numeroBloquesTotal: number;
  onImportarColares: (archivo: File) => void;
  onImportarEnsayos: (archivo: File) => void;
  metodo: MetodoInterpolacion;
  onCambiarMetodo: (m: MetodoInterpolacion) => void;
  variograma: ModeloVariograma;
  onCambiarVariograma: (v: ModeloVariograma) => void;
  variogramaExperimental: PuntoVariogramaExperimental[];
  onAutoAjustarVariograma: () => void;
  oculto?: boolean;
}

const TIPOS_VARIOGRAMA: Array<{ valor: TipoModeloVariograma; etiqueta: string }> = [
  { valor: "esferico", etiqueta: "Esférico" },
  { valor: "exponencial", etiqueta: "Exponencial" },
  { valor: "gaussiano", etiqueta: "Gaussiano" },
];

export default function PanelDatosModeloBloques({
  parametros,
  onCambiarParametros,
  numeroColares,
  numeroIntervalos,
  numeroCompositos,
  numeroBloquesTotal,
  onImportarColares,
  onImportarEnsayos,
  metodo,
  onCambiarMetodo,
  variograma,
  onCambiarVariograma,
  variogramaExperimental,
  onAutoAjustarVariograma,
  oculto,
}: Props) {
  const inputColaresRef = useRef<HTMLInputElement>(null);
  const inputEnsayosRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ParametrosModeloUI>(campo: K, valor: ParametrosModeloUI[K]) =>
    onCambiarParametros({ ...parametros, [campo]: valor });

  const setVariograma = <K extends keyof ModeloVariograma>(campo: K, valor: ModeloVariograma[K]) =>
    onCambiarVariograma({ ...variograma, [campo]: valor });

  return (
    <div className="panel-form" data-oculto={oculto}>
      <fieldset>
        <legend>Sondajes</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>
          Collares: id,x,y,z,profundidad,azimut,inclinación. Ensayos: sondajeId,desde,hasta,ley.
          Acepta CSV o Excel (.xlsx/.xls, se toma la primera hoja). Se muestra un set de ejemplo hasta que importes el tuyo.
        </p>
        <div className="acciones" style={{ marginBottom: 0 }}>
          <button className="btn btn-archivo" type="button" onClick={() => inputColaresRef.current?.click()}>
            Importar collares
            <input
              ref={inputColaresRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => {
                const a = e.target.files?.[0];
                if (a) onImportarColares(a);
                e.target.value = "";
              }}
            />
          </button>
          <button className="btn btn-archivo" type="button" onClick={() => inputEnsayosRef.current?.click()}>
            Importar ensayos
            <input
              ref={inputEnsayosRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => {
                const a = e.target.files?.[0];
                if (a) onImportarEnsayos(a);
                e.target.value = "";
              }}
            />
          </button>
        </div>
        <div className="resultados" style={{ marginTop: 12 }}>
          <div className="dato">
            <span>Sondajes</span>
            <b>{numeroColares}</b>
          </div>
          <div className="dato">
            <span>Intervalos de ensayo</span>
            <b>{numeroIntervalos}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Compositación e interpolación</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Longitud de composito (m)</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={parametros.longitudComposito_m}
              onChange={(e) => set("longitudComposito_m", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Tamaño de bloque (m, cúbico)</label>
            <input
              type="number"
              min={1}
              value={parametros.tamanoBloque_m}
              onChange={(e) => set("tamanoBloque_m", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="campo">
          <label>Método de interpolación</label>
          <div className="editor2d-modos" style={{ marginTop: 4 }}>
            <button className="btn" type="button" data-activo={metodo === "idw"} onClick={() => onCambiarMetodo("idw")}>
              IDW
            </button>
            <button className="btn" type="button" data-activo={metodo === "kriging"} onClick={() => onCambiarMetodo("kriging")}>
              Kriging ordinario
            </button>
          </div>
        </div>

        <div className="fila-dos">
          <div className="campo">
            <label>Radio de búsqueda (m)</label>
            <input
              type="number"
              min={1}
              value={parametros.radioBusqueda_m}
              onChange={(e) => set("radioBusqueda_m", Number(e.target.value))}
            />
          </div>
          {metodo === "idw" && (
            <div className="campo">
              <label>Potencia IDW (p)</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={parametros.potencia}
                onChange={(e) => set("potencia", Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="resultados" style={{ marginTop: 4 }}>
          <div className="dato">
            <span>Compositos generados</span>
            <b>{numeroCompositos}</b>
          </div>
          <div className="dato">
            <span>Bloques en la grilla</span>
            <b>{numeroBloquesTotal}</b>
          </div>
        </div>
        {numeroBloquesTotal > 20000 && (
          <div className="advertencias">
            <div className="advertencia">
              ⚠ {numeroBloquesTotal.toLocaleString()} bloques: puede volverse lento. Considera un tamaño de bloque mayor.
            </div>
          </div>
        )}
      </fieldset>

      {metodo === "kriging" && (
        <fieldset>
          <legend>Variograma (kriging ordinario)</legend>
          <div className="campo">
            <label>Modelo</label>
            <select value={variograma.tipo} onChange={(e) => setVariograma("tipo", e.target.value as TipoModeloVariograma)}>
              {TIPOS_VARIOGRAMA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="fila-dos">
            <div className="campo">
              <label>Pepita (nugget)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={variograma.pepita}
                onChange={(e) => setVariograma("pepita", Number(e.target.value))}
              />
            </div>
            <div className="campo">
              <label>Meseta (sill)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={variograma.meseta}
                onChange={(e) => setVariograma("meseta", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="campo">
            <label>Alcance (m)</label>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={variograma.alcance_m}
              onChange={(e) => setVariograma("alcance_m", Number(e.target.value))}
            />
          </div>
          <div className="acciones" style={{ marginBottom: 10 }}>
            <button className="btn" type="button" onClick={onAutoAjustarVariograma} disabled={variogramaExperimental.length < 2}>
              🔧 Auto-ajustar desde compositos
            </button>
          </div>
          {variogramaExperimental.length >= 2 ? (
            <GraficoVariograma experimental={variogramaExperimental} modelo={variograma} />
          ) : (
            <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>
              Se necesitan compositos en al menos 2 rangos de distancia distintos para calcular el variograma experimental.
            </p>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>Recursos</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Densidad (t/m³)</label>
            <input
              type="number"
              min={0.5}
              step={0.05}
              value={parametros.densidad_ton_m3}
              onChange={(e) => set("densidad_ton_m3", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Ley de corte (vista 3D)</label>
            <input
              type="number"
              min={0}
              step={0.05}
              value={parametros.leyCorteVisor}
              onChange={(e) => set("leyCorteVisor", Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
