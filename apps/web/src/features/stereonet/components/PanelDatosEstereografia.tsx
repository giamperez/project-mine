import { useRef } from "react";
import { FORMATO_IMPORTACION_DISCONTINUIDADES } from "@suite/mining-stereonet";
import type { Discontinuidad, Hemisferio, ModoDensidad, ModoElementos, TaludEstereografia, TipoProyeccion } from "@suite/core";
import { Chip, Deslizador, PillGroup, StepperInput, Tarjeta } from "./uiEstereografia.js";
import { IconoTalud, IconoBrujula, IconoFamilias, IconoTabla } from "./IconosEstereonet.js";

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
  proyeccion: TipoProyeccion;
  onCambiarProyeccion: (v: TipoProyeccion) => void;
  hemisferio: Hemisferio;
  onCambiarHemisferio: (v: Hemisferio) => void;
  elementos: ModoElementos;
  onCambiarElementos: (v: ModoElementos) => void;
  modoDensidad: ModoDensidad;
  onCambiarModoDensidad: (v: ModoDensidad) => void;
  radioConteo_grados: number;
  onCambiarRadioConteo: (v: number) => void;
  densidadMaxima_pct: number;
  numeroFamilias: number;
  onCambiarNumeroFamilias: (v: number) => void;
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
  proyeccion,
  onCambiarProyeccion,
  hemisferio,
  onCambiarHemisferio,
  elementos,
  onCambiarElementos,
  modoDensidad,
  onCambiarModoDensidad,
  radioConteo_grados,
  onCambiarRadioConteo,
  densidadMaxima_pct,
  numeroFamilias,
  onCambiarNumeroFamilias,
}: Props) {
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  function actualizarFila(id: string, campo: keyof Discontinuidad, valor: string | number) {
    onCambiarDiscontinuidades(discontinuidades.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  }

  function agregarFila() {
    contadorId++;
    onCambiarDiscontinuidades([
      ...discontinuidades,
      { id: `D-${contadorId}`, nombre: `J${discontinuidades.length + 1}`, dip_grados: 45, dipDirection_grados: 90 },
    ]);
  }

  function eliminarFila(id: string) {
    onCambiarDiscontinuidades(discontinuidades.filter((d) => d.id !== id));
  }

  function cargarPresetMinero() {
    onCambiarTalud({ dip_grados: 60, dipDirection_grados: 180 });
    onCambiarAnguloFriccion(30);
    onCambiarTolerancia(20);
    onCambiarDiscontinuidades([
      { id: "D-1", nombre: "J1", dip_grados: 40, dipDirection_grados: 185 },
      { id: "D-2", nombre: "J2", dip_grados: 65, dipDirection_grados: 260 },
      { id: "D-3", nombre: "J3", dip_grados: 75, dipDirection_grados: 10 },
      { id: "D-4", nombre: "J4", dip_grados: 55, dipDirection_grados: 150 },
    ]);
  }

  function cargarPresetVial() {
    onCambiarTalud({ dip_grados: 75, dipDirection_grados: 90 });
    onCambiarAnguloFriccion(35);
    onCambiarTolerancia(20);
    onCambiarDiscontinuidades([
      { id: "D-1", nombre: "Falla-A", dip_grados: 70, dipDirection_grados: 275 },
      { id: "D-2", nombre: "Junta-1", dip_grados: 50, dipDirection_grados: 85 },
      { id: "D-3", nombre: "Junta-2", dip_grados: 45, dipDirection_grados: 140 },
    ]);
  }

  return (
    <>
      {/* Botones de presets rápidos para pruebas instantáneas */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "2px 2px 4px",
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Casos de Prueba:
        </span>
        <button
          type="button"
          onClick={cargarPresetMinero}
          style={{
            background: "rgba(6, 182, 212, 0.12)",
            border: "1px solid rgba(6, 182, 212, 0.35)",
            color: "#38bdf8",
            fontSize: 10.5,
            fontWeight: 700,
            borderRadius: 7,
            padding: "4px 8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Talud Minero (4 Familias)
        </button>
        <button
          type="button"
          onClick={cargarPresetVial}
          style={{
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            color: "#34d399",
            fontSize: 10.5,
            fontWeight: 700,
            borderRadius: 7,
            padding: "4px 8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Talud Vial (3 Familias)
        </button>
      </div>

      {/* Tarjeta 1: Geometría del Talud y Propiedades Geomecánicas */}
      <Tarjeta
        icono={<IconoTalud />}
        titulo="Talud y Fricción"
        subtitulo="Geometría del corte y resistencia al corte"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Dip cara talud
            </label>
            <StepperInput
              min={1}
              max={89}
              step={1}
              valor={talud.dip_grados}
              onCambiar={(val) => onCambiarTalud({ ...talud, dip_grados: val })}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Dirección buzamiento
            </label>
            <StepperInput
              min={0}
              max={360}
              step={5}
              valor={talud.dipDirection_grados}
              onCambiar={(val) => onCambiarTalud({ ...talud, dipDirection_grados: val })}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Ángulo de fricción φ
            </label>
            <StepperInput
              min={0}
              max={89}
              step={1}
              valor={anguloFriccion_grados}
              onCambiar={onCambiarAnguloFriccion}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Límite lateral (±)
            </label>
            <StepperInput
              min={1}
              max={90}
              step={1}
              valor={toleranciaDireccion_grados}
              onCambiar={onCambiarTolerancia}
            />
          </div>
        </div>

        <p style={{ fontSize: 10.5, color: "#64748b", margin: 0, lineHeight: 1.35 }}>
          Límite lateral respecto a la dirección crítica de cada mecanismo — default 20° (Norrish &amp; Wyllie, 1996).
        </p>
      </Tarjeta>

      {/* Tarjeta 2: Configuración de la Red Estereográfica */}
      <Tarjeta
        icono={<IconoBrujula />}
        titulo="Vista de la Red"
        subtitulo="Tipo de proyección, hemisferio y densidad"
      >
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Proyección</label>
          <PillGroup
            opciones={[
              { value: "schmidt", label: "Schmidt (Área igual)" },
              { value: "wulff", label: "Wulff (Ángulo igual)" },
            ]}
            valor={proyeccion}
            onCambiar={onCambiarProyeccion}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Hemisferio</label>
          <PillGroup
            opciones={[
              { value: "inferior", label: "Inferior" },
              { value: "superior", label: "Superior" },
            ]}
            valor={hemisferio}
            onCambiar={onCambiarHemisferio}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Elementos visibles</label>
          <PillGroup
            columnas={3}
            opciones={[
              { value: "polos", label: "Polos" },
              { value: "planos", label: "Planos" },
              { value: "polos_y_planos", label: "Ambos" },
            ]}
            valor={elementos}
            onCambiar={onCambiarElementos}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Densidad de polos</label>
          <PillGroup
            columnas={3}
            opciones={[
              { value: "ninguna", label: "Sin densidad" },
              { value: "mapa", label: "Mapa" },
              { value: "contornos", label: "Contornos" },
            ]}
            valor={modoDensidad}
            onCambiar={onCambiarModoDensidad}
          />
        </div>

        {modoDensidad !== "ninguna" && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              <span>Radio círculo de conteo</span>
              <Chip color="#38bdf8">{radioConteo_grados}°</Chip>
            </div>
            <Deslizador valor={radioConteo_grados} min={5} max={45} onCambiar={onCambiarRadioConteo} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
              <span>Densidad máxima calculada</span>
              <b style={{ color: "#38bdf8", fontSize: 13, fontFamily: "monospace" }}>{densidadMaxima_pct.toFixed(1)}%</b>
            </div>
          </div>
        )}
      </Tarjeta>

      {/* Tarjeta 3: Familias Estructurales */}
      <Tarjeta
        icono={<IconoFamilias />}
        titulo="Familias Automáticas"
        subtitulo="Agrupamiento k-means esférico sobre polos"
        extra={<Chip color="#38bdf8">{numeroFamilias} Clusters</Chip>}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
          <span>Número de familias (k)</span>
          <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{numeroFamilias}</span>
        </div>
        <Deslizador valor={numeroFamilias} min={1} max={8} onCambiar={onCambiarNumeroFamilias} />
      </Tarjeta>

      {/* Tarjeta 4: Tabla de Discontinuidades */}
      <Tarjeta
        icono={<IconoTabla />}
        titulo="Discontinuidades"
        subtitulo="Juntas, fallas, estratos y diaclasas"
        extra={<Chip color="#10b981">{discontinuidades.length} registros</Chip>}
      >
        <div className="estereo-table-wrap" style={{ marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>
          <table className="estereo-table">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Nombre</th>
                <th style={{ width: "26%", textAlign: "right" }}>Dip°</th>
                <th style={{ width: "28%", textAlign: "right" }}>DipDir°</th>
                <th style={{ width: "14%", textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {discontinuidades.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: 4,
                        color: "#f1f5f9",
                        fontWeight: 600,
                        padding: "2px 4px",
                        outline: "none",
                      }}
                      value={d.nombre}
                      onChange={(e) => actualizarFila(d.id, "nombre", e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      style={{
                        width: 48,
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 4,
                        color: "#38bdf8",
                        fontWeight: 700,
                        padding: "2px 4px",
                        textAlign: "right",
                        outline: "none",
                      }}
                      value={d.dip_grados}
                      onChange={(e) => actualizarFila(d.id, "dip_grados", Number(e.target.value))}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      style={{
                        width: 52,
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 4,
                        color: "#34d399",
                        fontWeight: 700,
                        padding: "2px 4px",
                        textAlign: "right",
                        outline: "none",
                      }}
                      value={d.dipDirection_grados}
                      onChange={(e) => actualizarFila(d.id, "dipDirection_grados", Number(e.target.value))}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => eliminarFila(d.id)}
                      title="Eliminar discontinuidad"
                      style={{
                        padding: "3px 7px",
                        borderRadius: 6,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.12)",
                        color: "#f87171",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {discontinuidades.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: "16px 8px" }}>
                    Sin datos registrados. Haz clic en "+ Agregar" o toca la red.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Acciones principales de tabla */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            onClick={agregarFila}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #10b981",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.15))",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 11.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              gridColumn: "span 2",
              boxShadow: "0 2px 10px rgba(16, 185, 129, 0.2)",
            }}
          >
            <span>+</span> Agregar Discontinuidad
          </button>

          <button
            type="button"
            onClick={() => inputArchivoRef.current?.click()}
            style={{
              position: "relative",
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(15, 23, 42, 0.7)",
              color: "#cbd5e1",
              fontWeight: 600,
              fontSize: 11,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            Importar CSV
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) onImportarCSV(archivo);
                e.target.value = "";
              }}
            />
          </button>

          <button
            type="button"
            onClick={onExportarCSV}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(15, 23, 42, 0.7)",
              color: "#cbd5e1",
              fontWeight: 600,
              fontSize: 11,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            Exportar CSV
          </button>
        </div>

        <p style={{ fontSize: 10, color: "#64748b", margin: 0, lineHeight: 1.3 }}>
          {FORMATO_IMPORTACION_DISCONTINUIDADES}
        </p>
      </Tarjeta>
    </>
  );
}
