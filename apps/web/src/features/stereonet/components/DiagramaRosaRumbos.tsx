import { useMemo } from "react";
import type { Discontinuidad } from "@suite/core";

interface Props {
  discontinuidades: Discontinuidad[];
  tamanoPx?: number;
}

interface SectorRosa {
  azimutInicio: number;
  azimutFin: number;
  azimutCentro: number;
  conteo: number;
  frecuenciaPct: number;
}

export default function DiagramaRosaRumbos({ discontinuidades, tamanoPx = 420 }: Props) {
  const pasoGrados = 15; // Sectores de 15°
  const total = discontinuidades.length;
  const centro = tamanoPx / 2;
  const radioMax = centro - 34;

  const { sectores, maxFreqPct, direccionModal } = useMemo(() => {
    const bins = new Array(360 / pasoGrados).fill(0);

    discontinuidades.forEach((d) => {
      // Rumbo geológico aparente (bidireccional: azimut y azimut + 180)
      const strike = (d.dipDirection_grados - 90 + 360) % 360;
      const idx1 = Math.floor(strike / pasoGrados) % bins.length;
      const idx2 = Math.floor(((strike + 180) % 360) / pasoGrados) % bins.length;
      bins[idx1]++;
      bins[idx2]++;
    });

    const totalConSimetria = total * 2;
    let maxConteo = 0;
    let modalIdx = 0;

    const calculados: SectorRosa[] = bins.map((conteo, i) => {
      if (conteo > maxConteo) {
        maxConteo = conteo;
        modalIdx = i;
      }
      const azimutInicio = i * pasoGrados;
      const azimutFin = azimutInicio + pasoGrados;
      const azimutCentro = azimutInicio + pasoGrados / 2;
      const frecuenciaPct = totalConSimetria > 0 ? (conteo / totalConSimetria) * 100 : 0;
      return { azimutInicio, azimutFin, azimutCentro, conteo, frecuenciaPct };
    });

    const maxPct = totalConSimetria > 0 ? (maxConteo / totalConSimetria) * 100 : 0;
    const dirModal = (modalIdx * pasoGrados + pasoGrados / 2) % 180;

    return {
      sectores: calculados,
      maxFreqPct: Math.max(10, Math.ceil(maxPct / 5) * 5),
      direccionModal: dirModal,
    };
  }, [discontinuidades, total]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {/* Header informativo */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        <span style={{ fontWeight: 700, color: "#38bdf8", letterSpacing: "0.03em" }}>
          DIAGRAMA DE ROSA DE RUMBOS (STRIKE ROSE)
        </span>
        <span style={{ fontFamily: "monospace", color: "#f1f5f9" }}>
          Orientación dominante: <b style={{ color: "#34d399" }}>N{Math.round(direccionModal)}°E</b>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${tamanoPx} ${tamanoPx}`}
        style={{ width: "100%", maxWidth: tamanoPx, aspectRatio: "1 / 1", display: "block" }}
      >
        <defs>
          <radialGradient id="rosaGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f1929" />
            <stop offset="100%" stopColor="#060a12" />
          </radialGradient>
        </defs>

        {/* Fondo circular */}
        <circle cx={centro} cy={centro} r={radioMax} fill="url(#rosaGrad)" stroke="rgba(56, 189, 248, 0.3)" strokeWidth={1.5} />

        {/* Círculos de frecuencia porcentual (25%, 50%, 75%, 100% de maxFreqPct) */}
        {[0.25, 0.5, 0.75, 1.0].map((frac) => {
          const r = radioMax * frac;
          const valPct = (maxFreqPct * frac).toFixed(0);
          return (
            <g key={`ring-${frac}`} pointerEvents="none">
              <circle cx={centro} cy={centro} r={r} fill="none" stroke="rgba(56, 189, 248, 0.12)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={centro + 4} y={centro - r + 9} fill="rgba(56, 189, 248, 0.4)" fontSize={8.5} fontFamily="monospace">
                {valPct}%
              </text>
            </g>
          );
        })}

        {/* Rayos cardinales y marcas de grado */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x2 = centro + radioMax * Math.sin(rad);
          const y2 = centro - radioMax * Math.cos(rad);
          const labelX = centro + (radioMax + 14) * Math.sin(rad);
          const labelY = centro - (radioMax + 14) * Math.cos(rad) + 3.5;
          const esCardinal = deg % 90 === 0;

          return (
            <g key={`rose-axis-${deg}`} pointerEvents="none">
              <line x1={centro} y1={centro} x2={x2} y2={y2} stroke={esCardinal ? "rgba(56, 189, 248, 0.3)" : "rgba(148, 163, 184, 0.1)"} strokeWidth={1} />
              <text
                x={labelX}
                y={labelY}
                fill={deg === 0 ? "#38bdf8" : "#94a3b8"}
                fontSize={9}
                fontWeight={esCardinal ? 800 : 500}
                textAnchor="middle"
                fontFamily="monospace"
              >
                {deg === 0 ? "N" : deg === 90 ? "E" : deg === 180 ? "S" : deg === 270 ? "W" : `${deg}°`}
              </text>
            </g>
          );
        })}

        {/* Pétalos / Sectores de la Rosa */}
        {sectores.map((s, idx) => {
          if (s.frecuenciaPct <= 0) return null;
          const r = (s.frecuenciaPct / maxFreqPct) * radioMax;
          const radInicio = (s.azimutInicio * Math.PI) / 180;
          const radFin = (s.azimutFin * Math.PI) / 180;

          const x1 = centro + r * Math.sin(radInicio);
          const y1 = centro - r * Math.cos(radInicio);
          const x2 = centro + r * Math.sin(radFin);
          const y2 = centro - r * Math.cos(radFin);

          const pathData = `M ${centro} ${centro} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

          return (
            <path
              key={`petal-${idx}`}
              d={pathData}
              fill="rgba(6, 182, 212, 0.45)"
              stroke="#06b6d4"
              strokeWidth={1.2}
            >
              <title>
                Sector {s.azimutInicio}°–{s.azimutFin}°: {s.conteo / 2} discontinuidad(es) ({s.frecuenciaPct.toFixed(1)}%)
              </title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}
