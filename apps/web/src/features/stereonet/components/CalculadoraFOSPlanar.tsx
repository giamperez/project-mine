import { useState, useMemo } from "react";
import type { TaludEstereografia } from "@suite/core";
import { StepperInput, Tarjeta, RiskBadge } from "./uiEstereografia.js";
import { IconoCalculadora } from "./IconosEstereonet.js";

interface Props {
  talud: TaludEstereografia;
  anguloFriccion_grados: number;
  dipCriticoSugerido?: number;
}

export default function CalculadoraFOSPlanar({
  talud,
  anguloFriccion_grados,
  dipCriticoSugerido = 45,
}: Props) {
  const [alturaTalud_m, setAlturaTalud] = useState(15);
  const [cohesion_kPa, setCohesion] = useState(25);
  const [friccion_grados, setFriccion] = useState(anguloFriccion_grados);
  const [dipPlano_grados, setDipPlano] = useState(dipCriticoSugerido);
  const [pesoUnitario_kNm3, setPesoUnitario] = useState(26); // Peso específico típico roca
  const [saturacionAgua_pct, setSaturacionAgua] = useState(0); // 0% seco, 100% saturado

  const calculo = useMemo(() => {
    const psi_f = (talud.dip_grados * Math.PI) / 180;
    const psi_p = (dipPlano_grados * Math.PI) / 180;
    const phi = (friccion_grados * Math.PI) / 180;

    // Si dip plano >= dip talud, la cuña/bloque no aflora cinemáticamente
    if (dipPlano_grados >= talud.dip_grados) {
      return { fs: 999, estado: "no_aflora" as const, mensaje: "Plano no aflora en la cara del talud (Dip plano ≥ Dip talud)." };
    }
    if (dipPlano_grados <= 5) {
      return { fs: 999, estado: "subhorizontal" as const, mensaje: "Plano subhorizontal, no hay componente desestabilizadora." };
    }

    const H = alturaTalud_m;
    const gamma = pesoUnitario_kNm3;
    const c = cohesion_kPa;

    // Área del plano de falla por metro lineal de talud
    const A = (H / Math.sin(psi_p)) * (1 - Math.sin(psi_p) / Math.sin(psi_f));
    const areaEfectiva = Math.max(A, 0.1);

    // Peso del bloque deslizante
    const W = (0.5 * gamma * Math.pow(H, 2)) * ((1 / Math.tan(psi_p)) - (1 / Math.tan(psi_f)));
    const pesoEfectivo = Math.max(W, 1);

    // Presión de poros por agua (U)
    const gamma_w = 9.81;
    const factorSaturacion = saturacionAgua_pct / 100;
    const U = 0.25 * gamma_w * Math.pow(H, 2) * factorSaturacion;

    // Fuerzas resistentes y actuantes
    const fuerzaResistente = c * areaEfectiva + Math.max(0, pesoEfectivo * Math.cos(psi_p) - U) * Math.tan(phi);
    const fuerzaActuante = pesoEfectivo * Math.sin(psi_p);

    const fs = fuerzaActuante > 0 ? fuerzaResistente / fuerzaActuante : 999;

    let estado: "estable" | "critico" | "inestable" = "estable";
    if (fs < 1.0) estado = "inestable";
    else if (fs < 1.3) estado = "critico";

    return {
      fs: Math.min(fs, 99.9),
      estado,
      pesoEfectivo,
      areaEfectiva,
      mensaje:
        estado === "inestable"
          ? "Falla inminente (FS < 1.0). Se requiere sostenimiento o retaluzado."
          : estado === "critico"
          ? "Condición marginal (1.0 ≤ FS < 1.3). Sensible a sismos y saturación."
          : "Condición estable (FS ≥ 1.3) según estándar minero.",
    };
  }, [talud.dip_grados, dipPlano_grados, friccion_grados, alturaTalud_m, pesoUnitario_kNm3, cohesion_kPa, saturacionAgua_pct]);

  const colorFs =
    calculo.estado === "inestable"
      ? "#ef4444"
      : calculo.estado === "critico"
      ? "#f59e0b"
      : "#10b981";

  return (
    <Tarjeta
      icono={<IconoCalculadora />}
      titulo="Factor de Seguridad Planar (FOS)"
      subtitulo="Equilibrio límite 2D según Hoek &amp; Bray (1981)"
      extra={
        calculo.estado === "inestable" ? (
          <RiskBadge tipo="critico" texto="FS < 1.0" />
        ) : calculo.estado === "critico" ? (
          <RiskBadge tipo="advertencia" texto="1.0 ≤ FS < 1.3" />
        ) : (
          <RiskBadge tipo="seguro" texto="FS ≥ 1.3" />
        )
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
            Altura del banco / talud (m)
          </label>
          <StepperInput min={2} max={100} step={1} sufijo="m" valor={alturaTalud_m} onCambiar={setAlturaTalud} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
            Dip plano de falla (°)
          </label>
          <StepperInput min={10} max={85} step={1} valor={dipPlano_grados} onCambiar={setDipPlano} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
            Cohesión de junta c (kPa)
          </label>
          <StepperInput min={0} max={200} step={5} sufijo="kPa" valor={cohesion_kPa} onCambiar={setCohesion} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
            Fricción φ junta (°)
          </label>
          <StepperInput min={10} max={60} step={1} valor={friccion_grados} onCambiar={setFriccion} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
          <span>Presión de agua (Saturación)</span>
          <span style={{ color: saturacionAgua_pct > 0 ? "#38bdf8" : "#94a3b8", fontWeight: 700 }}>
            {saturacionAgua_pct === 0 ? "Seco (0%)" : `${saturacionAgua_pct}% saturado`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={saturacionAgua_pct}
          onChange={(e) => setSaturacionAgua(Number(e.target.value))}
          style={{
            width: "100%",
            accentColor: "#06b6d4",
            height: 6,
            borderRadius: 999,
            cursor: "pointer",
          }}
        />
      </div>

      {/* KPI Display del Factor de Seguridad */}
      <div
        style={{
          marginTop: 10,
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${colorFs}55`,
          background: `linear-gradient(135deg, ${colorFs}18 0%, rgba(15, 23, 42, 0.7) 100%)`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
            Factor de Seguridad (FS)
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: colorFs, fontFamily: "ui-monospace, monospace", lineHeight: 1.1 }}>
            {calculo.fs.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "right", maxWidth: "55%" }}>
          <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>{calculo.mensaje}</div>
        </div>
      </div>
    </Tarjeta>
  );
}
