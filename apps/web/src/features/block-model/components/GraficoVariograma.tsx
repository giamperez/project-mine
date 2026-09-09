import { semivarianza } from "@suite/core";
import type { ModeloVariograma, PuntoVariogramaExperimental } from "@suite/core";

interface Props {
  experimental: PuntoVariogramaExperimental[];
  modelo: ModeloVariograma;
}

const ANCHO = 320;
const ALTO = 180;
const MARGEN = { izq: 42, der: 10, arriba: 10, abajo: 26 };

/** Grafico simple del variograma experimental (puntos, tamaño ~ numero de pares) contra el modelo teorico ajustado (linea). */
export default function GraficoVariograma({ experimental, modelo }: Props) {
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;

  const distanciaMaxDatos = experimental.length > 0 ? Math.max(...experimental.map((p) => p.distancia_m)) : 0;
  const distanciaMax = Math.max(distanciaMaxDatos, modelo.alcance_m * 1.2, 1);
  const semivarianzaMax = Math.max(modelo.meseta, ...experimental.map((p) => p.semivarianza), 1e-6) * 1.15;

  const px = (d: number) => MARGEN.izq + (d / distanciaMax) * anchoUtil;
  const py = (g: number) => MARGEN.arriba + altoUtil - (g / semivarianzaMax) * altoUtil;

  const NUM_PUNTOS_CURVA = 60;
  const curva = Array.from({ length: NUM_PUNTOS_CURVA + 1 }, (_, i) => {
    const d = (i / NUM_PUNTOS_CURVA) * distanciaMax;
    return { x: px(d), y: py(semivarianza(modelo, d)) };
  });

  const maxPares = Math.max(...experimental.map((p) => p.numeroPares), 1);

  return (
    <svg width="100%" viewBox={`0 0 ${ANCHO} ${ALTO}`} style={{ display: "block", background: "var(--bg-elevado)", borderRadius: 8 }}>
      <line x1={MARGEN.izq} y1={py(0)} x2={ANCHO - MARGEN.der} y2={py(0)} stroke="var(--borde)" strokeWidth={1} />
      <line x1={MARGEN.izq} y1={MARGEN.arriba} x2={MARGEN.izq} y2={ALTO - MARGEN.abajo} stroke="var(--borde)" strokeWidth={1} />

      <line
        x1={px(0)}
        y1={py(modelo.meseta)}
        x2={px(distanciaMax)}
        y2={py(modelo.meseta)}
        stroke="var(--texto-tenue)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text x={ANCHO - MARGEN.der} y={py(modelo.meseta) - 4} fill="var(--texto-tenue)" fontSize={9} textAnchor="end">
        meseta
      </text>

      <polyline points={curva.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--acento)" strokeWidth={2} />

      {experimental.map((p, i) => (
        <circle
          key={i}
          cx={px(p.distancia_m)}
          cy={py(p.semivarianza)}
          r={3 + 2 * (p.numeroPares / maxPares)}
          fill="#38bdf8"
          opacity={0.85}
        />
      ))}

      <text x={MARGEN.izq} y={ALTO - 6} fill="var(--texto-tenue)" fontSize={10}>
        0
      </text>
      <text x={ANCHO - MARGEN.der} y={ALTO - 6} fill="var(--texto-tenue)" fontSize={10} textAnchor="end">
        {distanciaMax.toFixed(0)} m
      </text>
      <text x={4} y={MARGEN.arriba + 8} fill="var(--texto-tenue)" fontSize={10}>
        γ(h)
      </text>
    </svg>
  );
}
