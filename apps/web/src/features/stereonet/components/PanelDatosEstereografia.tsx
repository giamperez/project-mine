import { useRef } from "react";
import type { Discontinuidad, TaludEstereografia } from "@suite/core";

interface Props {
  discontinuidades: Discontinuidad[];
  onCambiarDiscontinuidades: (nuevas: Discontinuidad[]) => void;
  talud: TaludEstereografia;
  onCambiarTalud: (nuevo: TaludEstereografia) => void;
  anguloFriccion_grados: number;
  onCambiarAnguloFriccion: (v: number) => void;
  toleranciaDireccion_grados: number;
  onCambiarTolerancia: (v: number) => void;
  onImportarCSV: (archivo: File) => void;
  onExportarCSV: () => void;
  oculto?: boolean;
}

let contadorId = 1000;

export default function PanelDatosEstereografia({
  discontinuidades,
  onCambiarDiscontinuidades,
  talud,
  onCambiarTalud,
  anguloFriccion_grados,
  onCambiarAnguloFriccion,
  toleranciaDireccion_grados,
  onCambiarTolerancia,
  onImportarCSV,
  onExportarCSV,
  oculto,
}: Props) {
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  function actualizarFila(id: string, campo: keyof Discontinuidad, valor: string | number) {
    onCambiarDiscontinuidades(discontinuidades.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  }

  function agregarFila() {
    contadorId++;
    onCambiarDiscontinuidades([
      ...discontinuidades,
      { id: `D-${contadorId}`, nombre: `D${discontinuidades.length + 1}`, dip_grados: 45, dipDirection_grados: 90 },
    ]);
  }

  function eliminarFila(id: string) {
    onCambiarDiscontinuidades(discontinuidades.filter((d) => d.id !== id));
  }

  return (
    <div className="panel-form" data-oculto={oculto}>
      <fieldset>
        <legend>Talud y fricción</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Dip cara del talud (°)</label>
            <input
              type="number"
              min={1}
              max={89}
              value={talud.dip_grados}
              onChange={(e) => onCambiarTalud({ ...talud, dip_grados: Number(e.target.value) })}
            />
          </div>
          <div className="campo">
            <label>Dirección de buzamiento (°)</label>
            <input
              type="number"
              min={0}
              max={360}
              value={talud.dipDirection_grados}
              onChange={(e) => onCambiarTalud({ ...talud, dipDirection_grados: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="fila-dos">
          <div className="campo">
            <label>Ángulo de fricción φ (°)</label>
            <input
              type="number"
              min={0}
              max={89}
              value={anguloFriccion_grados}
              onChange={(e) => onCambiarAnguloFriccion(Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Tolerancia dirección (°)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={toleranciaDireccion_grados}
              onChange={(e) => onCambiarTolerancia(Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Discontinuidades <span className="badge">{discontinuidades.length}</span>
        </legend>
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table className="tabla-taladros">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dip°</th>
                <th>DipDir°</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {discontinuidades.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      style={{ width: 64, background: "transparent", border: "none", color: "inherit" }}
                      value={d.nombre}
                      onChange={(e) => actualizarFila(d.id, "nombre", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 48, background: "transparent", border: "none", color: "inherit", textAlign: "right" }}
                      value={d.dip_grados}
                      onChange={(e) => actualizarFila(d.id, "dip_grados", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 52, background: "transparent", border: "none", color: "inherit", textAlign: "right" }}
                      value={d.dipDirection_grados}
                      onChange={(e) => actualizarFila(d.id, "dipDirection_grados", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <button className="btn" type="button" style={{ padding: "2px 8px", minHeight: 28 }} onClick={() => eliminarFila(d.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="acciones">
          <button className="btn" type="button" onClick={agregarFila}>
            + Agregar
          </button>
          <button className="btn btn-archivo" type="button" onClick={() => inputArchivoRef.current?.click()}>
            Importar (CSV/Excel)
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) onImportarCSV(archivo);
                e.target.value = "";
              }}
            />
          </button>
          <button className="btn" type="button" onClick={onExportarCSV}>
            Exportar CSV
          </button>
        </div>
      </fieldset>
    </div>
  );
}
