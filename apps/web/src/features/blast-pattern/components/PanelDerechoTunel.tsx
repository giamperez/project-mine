import type { TaladroTunel, ResultadoGeometriaFrente, EntradaArranqueHolmberg } from "@suite/core";
import type { SubPestanaDerecha } from "./PanelDerecho.js";
import { useExplosivoGlobal } from "../../../hooks/useExplosivoGlobal.js";

interface Props {
  subPestana: SubPestanaDerecha;
  onCambiarSubPestana: (p: SubPestanaDerecha) => void;
  taladros: TaladroTunel[];
  resultadoGeometria?: ResultadoGeometriaFrente;
  entradaArranque?: EntradaArranqueHolmberg;
  oculto?: boolean;
}

/** Panel derecho del modo Túnel / Galería subterránea — gestión de taladros y balance de voladura */
export default function PanelDerechoTunel({
  subPestana,
  onCambiarSubPestana,
  taladros,
  resultadoGeometria,
  entradaArranque,
  oculto,
}: Props) {
  const { explosivo } = useExplosivoGlobal();

  const area_m2 = resultadoGeometria?.area_m2 || 16.5;
  const avance_m = entradaArranque?.avance_m || 3.2;
  const volumenRonda_m3 = area_m2 * avance_m;
  const densidadRoca = 2.7; // t/m³
  const tonelajeRonda_t = volumenRonda_m3 * densidadRoca;

  const totalTaladros = taladros.length > 0 ? taladros.length : 38;
  const taladrosAlivio = taladros.filter((t) => t.zona === "alivio").length;
  const taladrosCargados = Math.max(1, totalTaladros - taladrosAlivio);

  // Carga estimada por taladro con cartucho estándar de 1 1/4" (32mm)
  const diamCartucho_m = 0.032;
  const cargaLineal_kgm = (Math.PI / 4) * Math.pow(diamCartucho_m, 2) * (explosivo.densidadGcm3 * 1000);
  const longitudCarga_m = Math.max(1.0, avance_m * 0.78);
  const taco_m = Math.max(0.4, avance_m - longitudCarga_m);
  const pesoPorTaladro_kg = cargaLineal_kgm * longitudCarga_m;
  const pesoExplosivoTotal_kg = taladrosCargados * pesoPorTaladro_kg;

  const factorCarga_kgm3 = volumenRonda_m3 > 0 ? pesoExplosivoTotal_kg / volumenRonda_m3 : 1.35;
  const factorPotencia_kgt = tonelajeRonda_t > 0 ? pesoExplosivoTotal_kg / tonelajeRonda_t : 0.5;
  const cartuchosTotales = Math.round(pesoExplosivoTotal_kg / 0.1); // ~100g por cartucho estándar de 7/8" o 1 1/8"

  return (
    <div className="panel-tabla panel-derecho" data-oculto={oculto}>
      {subPestana === "voladura" ? (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Tarjeta de Explosivo Activo */}
          <div
            style={{
              background: "rgba(249, 115, 22, 0.07)",
              border: "1px solid rgba(249, 115, 22, 0.35)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>
                {explosivo.nombre}
              </span>
              <span style={{ fontSize: 10, color: "#cbd5e1", background: "#1e293b", padding: "2px 6px", borderRadius: 4 }}>
                {explosivo.fabricante}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              {explosivo.usoPrincipal || "Explosivo industrial para galería subterránea"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
              <div>VOD: <b style={{ color: "#38bdf8" }}>{explosivo.vodMs} m/s</b></div>
              <div>Densidad: <b style={{ color: "#ffffff" }}>{explosivo.densidadGcm3} g/cm³</b></div>
              <div>P. Det.: <b style={{ color: "#ffffff" }}>{explosivo.presionDetonacionKbar} kbar</b></div>
              <div>Potencia RWS: <b style={{ color: "#10b981" }}>{explosivo.rwsPeso}% ANFO</b></div>
            </div>
          </div>

          {/* Balance del Disparo de Galería */}
          <div className="panel-seccion-card" style={{ margin: 0 }}>
            <div className="panel-seccion-header">
              <div className="panel-seccion-title">
                <span className="seccion-icon-pill" style={{ color: "#10b981", background: "rgba(16,185,129,0.15)" }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </span>
                <span>Balance del Disparo</span>
              </div>
              <span className="panel-seccion-badge" style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }}>
                {area_m2.toFixed(1)} m²
              </span>
            </div>
            <div className="panel-seccion-body">
              <div className="resultados">
                <div className="dato">
                  <span>Volumen por round</span>
                  <b>{volumenRonda_m3.toFixed(1)} m³</b>
                </div>
                <div className="dato">
                  <span>Tonelaje de roca</span>
                  <b>{tonelajeRonda_t.toFixed(1)} t</b>
                </div>
                <div className="dato">
                  <span>Taladros cargados</span>
                  <b>{taladrosCargados} de {totalTaladros}</b>
                </div>
                <div className="dato">
                  <span>Carga por taladro</span>
                  <b>{pesoPorTaladro_kg.toFixed(2)} kg</b>
                </div>
                <div className="dato">
                  <span>Long. carga / Taco</span>
                  <b>{longitudCarga_m.toFixed(2)}m / {taco_m.toFixed(2)}m</b>
                </div>
                <div className="dato">
                  <span>Peso total explosivo</span>
                  <b style={{ color: "#f97316" }}>{pesoExplosivoTotal_kg.toFixed(1)} kg</b>
                </div>
                <div className="dato">
                  <span>Factor de carga (q)</span>
                  <b style={{ color: "#10b981" }}>{factorCarga_kgm3.toFixed(2)} kg/m³</b>
                </div>
                <div className="dato">
                  <span>Factor de potencia</span>
                  <b>{factorPotencia_kgt.toFixed(2)} kg/t</b>
                </div>
                <div className="dato" style={{ gridColumn: "1 / -1" }}>
                  <span>Cartuchos aprox. (~100g)</span>
                  <b>{cartuchosTotales} cartuchos de {explosivo.nombre}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 14, overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Taladros del frente
            </span>
            <span className="panel-seccion-badge">
              {taladros.length} taladros
            </span>
          </div>
          {taladros.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>
              Todavía no hay taladros. Andá a la pestaña "Frente" y tocá para agregar.
            </p>
          ) : (
            <table className="tabla-taladros">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Zona</th>
                  <th>X (m)</th>
                  <th>Y (m)</th>
                </tr>
              </thead>
              <tbody>
                {taladros.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.zona}</td>
                    <td>{t.x.toFixed(2)}</td>
                    <td>{t.y.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

