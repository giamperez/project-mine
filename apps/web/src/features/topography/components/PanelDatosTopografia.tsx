import { useRef } from "react";
import type { PuntoTopografico } from "@suite/core";

interface Props {
  puntosActuales: PuntoTopografico[];
  puntosReferencia: PuntoTopografico[] | null;
  intervaloCurvas_m: number;
  resolucionGrilla_m: number;
  onImportarActual: (archivo: File) => void;
  onImportarReferencia: (archivo: File) => void;
  onQuitarReferencia: () => void;
  onCambiarIntervalo: (v: number) => void;
  onCambiarResolucion: (v: number) => void;
  oculto?: boolean;
}

function resumenCotas(puntos: PuntoTopografico[]) {
  if (puntos.length === 0) return null;
  const zs = puntos.map((p) => p.z);
  return { min: Math.min(...zs), max: Math.max(...zs) };
}

export default function PanelDatosTopografia({
  puntosActuales,
  puntosReferencia,
  intervaloCurvas_m,
  resolucionGrilla_m,
  onImportarActual,
  onImportarReferencia,
  onQuitarReferencia,
  onCambiarIntervalo,
  onCambiarResolucion,
  oculto,
}: Props) {
  const inputActualRef = useRef<HTMLInputElement>(null);
  const inputReferenciaRef = useRef<HTMLInputElement>(null);
  const cotas = resumenCotas(puntosActuales);

  return (
    <div className="panel-form" data-oculto={oculto}>
      <fieldset>
        <legend>Levantamiento (superficie actual)</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>
          Columnas x,y,z (estación total, GPS/GNSS o dron). Acepta CSV, Excel, KML/KMZ (puntos GPS de
          campo, se proyectan a UTM) o LAS/LAZ (nube de puntos de dron/LiDAR — se filtra a terreno y se
          decima automáticamente). Se muestra un terreno de ejemplo hasta que importes uno propio.
        </p>
        <button className="btn btn-archivo" type="button" onClick={() => inputActualRef.current?.click()}>
          Importar puntos
          <input
            ref={inputActualRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,.kml,.kmz,.las,.laz"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) onImportarActual(archivo);
              e.target.value = "";
            }}
          />
        </button>
        <div className="resultados" style={{ marginTop: 12 }}>
          <div className="dato">
            <span>Puntos</span>
            <b>{puntosActuales.length}</b>
          </div>
          <div className="dato">
            <span>Rango de cotas</span>
            <b>{cotas ? `${cotas.min.toFixed(1)} – ${cotas.max.toFixed(1)} m` : "—"}</b>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Superficie de referencia (opcional)</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>
          Para calcular corte/relleno: superficie de diseño u otro levantamiento a comparar.
        </p>
        <div className="acciones" style={{ marginBottom: 0 }}>
          <button className="btn btn-archivo" type="button" onClick={() => inputReferenciaRef.current?.click()}>
            Importar (CSV/Excel/KML/LAS/LAZ)
            <input
              ref={inputReferenciaRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.kml,.kmz,.las,.laz"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) onImportarReferencia(archivo);
                e.target.value = "";
              }}
            />
          </button>
          {puntosReferencia && (
            <button className="btn" type="button" onClick={onQuitarReferencia}>
              Quitar
            </button>
          )}
        </div>
        {puntosReferencia && (
          <p style={{ fontSize: 12, color: "var(--texto-tenue)", marginTop: 8 }}>
            {puntosReferencia.length} puntos cargados.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>Parámetros</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Intervalo curvas de nivel (m)</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={intervaloCurvas_m}
              onChange={(e) => onCambiarIntervalo(Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Resolución grilla volumen (m)</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={resolucionGrilla_m}
              onChange={(e) => onCambiarResolucion(Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
