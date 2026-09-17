import {
  NOMBRE_MECANISMO,
  type Discontinuidad,
  type MetodoExcavacionSMR,
  type ResultadoAgrupamiento,
  type ResultadoCinematicoCompleto,
  type ResultadoEstereografia,
  type ResultadoSMR,
  type TaludEstereografia,
  type TipoFallaSMR,
} from "@suite/core";
import { BarraProgreso, Chip, PillGroup, RiskBadge, Tarjeta } from "./uiEstereografia.js";
import {
  IconoCinematica,
  IconoTalud,
  IconoFamilias,
  IconoEscudoSeguro,
  IconoPeligro,
} from "./IconosEstereonet.js";
import CalculadoraFOSPlanar from "./CalculadoraFOSPlanar.js";

interface Props {
  discontinuidades: Discontinuidad[];
  resultado: ResultadoEstereografia;
  agrupamiento: ResultadoAgrupamiento;
  cinematica: ResultadoCinematicoCompleto;
  smr: ResultadoSMR | null;
  rmrBasicoSMR: number;
  onCambiarRmrBasicoSMR: (v: number) => void;
  discontinuidadSmrId: string | null;
  onCambiarDiscontinuidadSmrId: (id: string) => void;
  tipoFallaSMR: TipoFallaSMR;
  onCambiarTipoFallaSMR: (v: TipoFallaSMR) => void;
  metodoExcavacionSMR: MetodoExcavacionSMR;
  onCambiarMetodoExcavacionSMR: (v: MetodoExcavacionSMR) => void;
  talud?: TaludEstereografia;
  anguloFriccion_grados?: number;
}

function nombreDe(discontinuidades: Discontinuidad[], id: string): string {
  return discontinuidades.find((d) => d.id === id)?.nombre ?? id;
}

const COLOR_CLASE_SMR: Record<ResultadoSMR["clase"], string> = {
  I: "#10b981",
  II: "#84cc16",
  III: "#f59e0b",
  IV: "#f97316",
  V: "#ef4444",
};

const COLORES_FAMILIA = ["#34d399", "#22d3ee", "#f472b6", "#fb923c", "#c084fc", "#facc15", "#60a5fa", "#a3e635"];

function TarjetaEstadistica({
  etiqueta,
  valor,
  color,
  estado,
}: {
  etiqueta: string;
  valor: number | string;
  color: string;
  estado?: "critico" | "seguro" | "neutro";
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(8, 28, 22, 0.9) 0%, rgba(4, 16, 13, 0.96) 100%)",
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: "10px 12px",
        minHeight: 74,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: `0 4px 14px rgba(0,0,0,0.3), inset 0 0 10px ${color}11`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, lineHeight: 1.25 }}>
          {etiqueta}
        </span>
        {estado && estado !== "neutro" && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: estado === "critico" ? "#ef4444" : "#10b981",
              boxShadow: `0 0 6px ${estado === "critico" ? "#ef4444" : "#10b981"}`,
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 4, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
        {valor}
      </div>
    </div>
  );
}

export default function PanelResultadosEstereografia({
  discontinuidades,
  resultado,
  agrupamiento,
  cinematica,
  smr,
  rmrBasicoSMR,
  onCambiarRmrBasicoSMR,
  discontinuidadSmrId,
  onCambiarDiscontinuidadSmrId,
  tipoFallaSMR,
  onCambiarTipoFallaSMR,
  metodoExcavacionSMR,
  onCambiarMetodoExcavacionSMR,
  talud,
  anguloFriccion_grados = 30,
}: Props) {
  const cunasOrdenadas = [...resultado.analisisCunas].sort((a, b) => Number(b.factible) - Number(a.factible));
  const mecanismos = [cinematica.planar, cinematica.cuna, cinematica.volcamientoFlexural, cinematica.volcamientoDirecto];
  const colorSmr = smr ? COLOR_CLASE_SMR[smr.clase] : "#94a3b8";

  const tieneRiesgo =
    resultado.resumen.riesgoPlanar > 0 ||
    resultado.resumen.riesgoVuelco > 0 ||
    resultado.resumen.cunasFactibles > 0;

  return (
    <>
      {/* Banner de Diagnóstico Cinemático Rápido */}
      <div
        style={{
          background: tieneRiesgo
            ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.15))"
            : "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))",
          border: `1px solid ${tieneRiesgo ? "rgba(239, 68, 68, 0.45)" : "rgba(16, 185, 129, 0.45)"}`,
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: `0 4px 16px ${tieneRiesgo ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)"}`,
        }}
      >
        <span style={{ color: tieneRiesgo ? "#ef4444" : "#34d399", display: "flex", alignItems: "center" }}>
          {tieneRiesgo ? <IconoPeligro width={22} height={22} /> : <IconoEscudoSeguro width={22} height={22} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: tieneRiesgo ? "#fca5a5" : "#6ee7b7", letterSpacing: "0.02em" }}>
            {tieneRiesgo ? "MECANISMOS CINEMÁTICOS DETECTADOS" : "CONDICIÓN CINEMÁTICA ESTABLE"}
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2, lineHeight: 1.3 }}>
            {tieneRiesgo
              ? `${resultado.resumen.riesgoPlanar} Planar · ${resultado.resumen.riesgoVuelco} Vuelco · ${resultado.resumen.cunasFactibles} Cuña(s) factibles.`
              : "No se identifican discontinuidades críticas frente a la orientación del talud."}
          </div>
        </div>
      </div>

      {/* Tarjeta 1: Resumen Cinemático con Grid 2x2 para evitar truncamiento */}
      <Tarjeta
        icono={<IconoCinematica />}
        titulo="Resumen Cinemático"
        subtitulo="Conteo de fallas factibles según Markland"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, width: "100%" }}>
          <TarjetaEstadistica
            etiqueta="Discontinuidades"
            valor={resultado.resumen.totalDiscontinuidades}
            color="#34d399"
            estado="neutro"
          />
          <TarjetaEstadistica
            etiqueta="Riesgo Planar"
            valor={resultado.resumen.riesgoPlanar}
            color={resultado.resumen.riesgoPlanar > 0 ? "#ef4444" : "#10b981"}
            estado={resultado.resumen.riesgoPlanar > 0 ? "critico" : "seguro"}
          />
          <TarjetaEstadistica
            etiqueta="Riesgo Vuelco"
            valor={resultado.resumen.riesgoVuelco}
            color={resultado.resumen.riesgoVuelco > 0 ? "#f59e0b" : "#10b981"}
            estado={resultado.resumen.riesgoVuelco > 0 ? "critico" : "seguro"}
          />
          <TarjetaEstadistica
            etiqueta="Cuñas Factibles"
            valor={resultado.resumen.cunasFactibles}
            color={resultado.resumen.cunasFactibles > 0 ? "#ef4444" : "#10b981"}
            estado={resultado.resumen.cunasFactibles > 0 ? "critico" : "seguro"}
          />
        </div>
      </Tarjeta>

      {/* Tarjeta 2: Análisis por Discontinuidad */}
      <Tarjeta
        icono={<IconoTalud />}
        titulo="Por Discontinuidad"
        subtitulo="Evaluación individual de deslizamiento y vuelco"
      >
        <div className="estereo-table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
          <table className="estereo-table">
            <thead>
              <tr>
                <th>Plano</th>
                <th style={{ textAlign: "center" }}>Planar</th>
                <th style={{ textAlign: "center" }}>Vuelco</th>
                <th style={{ textAlign: "right" }}>Δ Dir°</th>
              </tr>
            </thead>
            <tbody>
              {resultado.analisisPlanoVuelco.map((a) => (
                <tr key={a.discontinuidadId}>
                  <td style={{ fontWeight: 700, color: "#f1f5f9" }}>
                    {nombreDe(discontinuidades, a.discontinuidadId)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {a.planarFactible ? (
                      <RiskBadge tipo="critico" texto="Sí" />
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {a.vuelcoFactible ? (
                      <RiskBadge tipo="advertencia" texto="Sí" />
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#94a3b8" }}>
                    {a.diferenciaDireccion_grados.toFixed(0)}°
                  </td>
                </tr>
              ))}
              {resultado.analisisPlanoVuelco.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                    Sin datos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* Tarjeta 3: Análisis de Cuñas (Pares) */}
      <Tarjeta
        icono={<IconoCinematica />}
        titulo="Análisis de Cuñas (Pares)"
        subtitulo="Líneas de intersección entre discontinuidades"
        extra={<Chip color="#34d399">{resultado.resumen.cunasFactibles} críticas</Chip>}
      >
        <div className="estereo-table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
          <table className="estereo-table">
            <thead>
              <tr>
                <th>Par</th>
                <th style={{ textAlign: "right" }}>Trend</th>
                <th style={{ textAlign: "right" }}>Plunge</th>
                <th style={{ textAlign: "center" }}>Factible</th>
              </tr>
            </thead>
            <tbody>
              {cunasOrdenadas.map((c) => (
                <tr key={`${c.idA}-${c.idB}`}>
                  <td style={{ fontWeight: 700, color: "#f1f5f9" }}>
                    {nombreDe(discontinuidades, c.idA)}–{nombreDe(discontinuidades, c.idB)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#34d399" }}>
                    {c.trendInterseccion_grados.toFixed(0)}°
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#6ee7b7" }}>
                    {c.plungeInterseccion_grados.toFixed(0)}°
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {c.factible ? (
                      <RiskBadge tipo="critico" texto="Factible" />
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {cunasOrdenadas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "#64748b", textAlign: "center", padding: 12 }}>
                    Se necesitan al menos 2 discontinuidades para formar cuñas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* Tarjeta 4: Familias Estructurales */}
      <Tarjeta
        icono={<IconoFamilias />}
        titulo="Familias Estructurales"
        subtitulo="Clusters k-means y parámetro de dispersión Fisher K"
        extra={<Chip color="#34d399">{agrupamiento.familias.length} clusters</Chip>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {agrupamiento.familias.map((f, idx) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(6, 22, 17, 0.75)",
                border: "1px solid rgba(16, 185, 129, 0.15)",
                borderLeft: `4px solid ${COLORES_FAMILIA[idx % COLORES_FAMILIA.length]}`,
                fontSize: 11.5,
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div>
                <b style={{ color: COLORES_FAMILIA[idx % COLORES_FAMILIA.length] }}>FAM {f.id}</b>
                <span style={{ color: "#94a3b8", marginLeft: 6 }}>({f.miembrosIds.length} polos)</span>
                <div style={{ color: "#f1f5f9", fontWeight: 600, marginTop: 2, fontFamily: "monospace" }}>
                  Plano medio: {f.planoMedio.dip_grados.toFixed(0)}° / {f.planoMedio.dipDirection_grados.toFixed(0)}°
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Chip color={COLORES_FAMILIA[idx % COLORES_FAMILIA.length]}>
                  {f.participacion_pct.toFixed(0)}%
                </Chip>
                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2, fontFamily: "monospace" }}>
                  Fisher K: {f.fisherK.toFixed(1)}
                </div>
              </div>
            </div>
          ))}
          {agrupamiento.familias.length === 0 && (
            <span style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 8 }}>
              Agrega discontinuidades para calcular familias.
            </span>
          )}
        </div>
      </Tarjeta>

      {/* Tarjeta 5: Cinemática — 4 Mecanismos */}
      <Tarjeta
        icono={<IconoCinematica />}
        titulo="Cinemática — 4 Mecanismos"
        subtitulo="Verificación de admisibilidad según Markland y Goodman"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mecanismos.map((m) => (
            <div
              key={m.mecanismo}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(6, 22, 17, 0.7)",
                border: "1px solid rgba(16, 185, 129, 0.12)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{NOMBRE_MECANISMO[m.mecanismo]}</span>
                  <span style={{ color: m.criticos > 0 ? "#ef4444" : "#34d399", fontWeight: 800, fontFamily: "monospace" }}>
                    {m.criticos}/{m.total} · {m.porcentajeAdmisible.toFixed(0)}%
                  </span>
                </div>
                <BarraProgreso pct={m.porcentajeAdmisible} color={m.criticos > 0 ? "#ef4444" : "#10b981"} />
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>

      {/* Tarjeta 6: SMR — Slope Mass Rating */}
      <Tarjeta
        icono={<IconoCinematica />}
        titulo="SMR — Slope Mass Rating"
        subtitulo="Clasificación geomecánica de taludes (Romana, 1985)"
        extra={<Chip color="#10b981">Romana, 1985</Chip>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              RMR básico
            </label>
            <input
              type="number"
              min={0}
              max={100}
              style={{
                width: "100%",
                background: "rgba(4, 16, 13, 0.85)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: 8,
                color: "#ffffff",
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 700,
                outline: "none",
              }}
              value={rmrBasicoSMR}
              onChange={(e) => onCambiarRmrBasicoSMR(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
              Discontinuidad
            </label>
            <select
              style={{
                width: "100%",
                background: "rgba(4, 16, 13, 0.85)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: 8,
                color: "#ffffff",
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
              }}
              value={discontinuidadSmrId ?? ""}
              onChange={(e) => onCambiarDiscontinuidadSmrId(e.target.value)}
            >
              {discontinuidades.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre} ({d.dip_grados}°/{d.dipDirection_grados}°)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Tipo de falla</label>
          <PillGroup
            opciones={[
              { value: "planar", label: "Planar" },
              { value: "volcamiento", label: "Volcamiento" },
            ]}
            valor={tipoFallaSMR}
            onCambiar={onCambiarTipoFallaSMR}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Método de excavación</label>
          <PillGroup
            columnas={2}
            opciones={[
              { value: "presplitting", label: "Precorte" },
              { value: "voladura_suave", label: "Voladura suave" },
              { value: "voladura_o_mecanico", label: "Normal / Mecánico" },
              { value: "talud_natural", label: "Talud natural" },
            ]}
            valor={metodoExcavacionSMR}
            onCambiar={onCambiarMetodoExcavacionSMR}
          />
        </div>

        {smr && (
          <div
            style={{
              marginTop: 12,
              padding: "14px 16px",
              borderRadius: 14,
              border: `1px solid ${colorSmr}`,
              background: `linear-gradient(135deg, ${colorSmr}22 0%, rgba(6, 22, 17, 0.8) 100%)`,
              boxShadow: `0 4px 18px ${colorSmr}22`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                  Puntaje SMR
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: colorSmr, lineHeight: 1, fontFamily: "ui-monospace, monospace" }}>
                  {smr.smr.toFixed(1)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 800,
                    color: colorSmr,
                    background: `${colorSmr}25`,
                    border: `1px solid ${colorSmr}77`,
                    borderRadius: 999,
                    padding: "3px 10px",
                    marginBottom: 4,
                  }}
                >
                  Clase {smr.clase} · {smr.descripcion}
                </span>
                <div style={{ fontSize: 11.5, color: "#cbd5e1", fontWeight: 600 }}>{smr.estabilidad}</div>
              </div>
            </div>

            {/* Barra de segmentación de Clases I a V */}
            <div className="estereo-smr-bar">
              <div className={`estereo-smr-segment ${smr.clase === "V" ? "activo" : ""}`} style={{ background: "#ef4444" }} title="Clase V: Muy malo (0-20)" />
              <div className={`estereo-smr-segment ${smr.clase === "IV" ? "activo" : ""}`} style={{ background: "#f97316" }} title="Clase IV: Malo (21-40)" />
              <div className={`estereo-smr-segment ${smr.clase === "III" ? "activo" : ""}`} style={{ background: "#f59e0b" }} title="Clase III: Regular (41-60)" />
              <div className={`estereo-smr-segment ${smr.clase === "II" ? "activo" : ""}`} style={{ background: "#84cc16" }} title="Clase II: Bueno (61-80)" />
              <div className={`estereo-smr-segment ${smr.clase === "I" ? "activo" : ""}`} style={{ background: "#10b981" }} title="Clase I: Muy bueno (81-100)" />
            </div>

            {/* Factores F1 a F4 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10 }}>
              {[
                ["F1 (Paralelismo)", smr.f1.toFixed(2)],
                ["F2 (Buzamiento)", smr.f2.toFixed(2)],
                ["F3 (Relación)", smr.f3.toFixed(0)],
                ["F4 (Excavación)", smr.f4.toFixed(0)],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    background: "rgba(4, 16, 13, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 8,
                    padding: "6px 4px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 8.5, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {k}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, textAlign: "center" }}>
              Probabilidad estimada de falla: <b style={{ color: colorSmr }}>{(smr.probabilidadFalla * 100).toFixed(0)}%</b>
            </div>
          </div>
        )}
      </Tarjeta>

      {/* Tarjeta 7: Calculadora Complementaria de Factor de Seguridad Planar (FOS) */}
      <CalculadoraFOSPlanar
        talud={talud ?? { dip_grados: 60, dipDirection_grados: 180 }}
        anguloFriccion_grados={anguloFriccion_grados}
      />
    </>
  );
}
