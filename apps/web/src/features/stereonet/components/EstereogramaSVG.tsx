import { planoDesdePuntoEnRed, poloDelPlano, proyeccionEquiareal, trayectoriaCirculoMayor } from "@suite/core";
import type { AnalisisPlanarVuelco, Discontinuidad, TaludEstereografia } from "@suite/core";

interface Props {
  discontinuidades: Discontinuidad[];
  talud: TaludEstereografia;
  anguloFriccion_grados: number;
  analisis: AnalisisPlanarVuelco[];
  tamanoPx?: number;
  /** Si se da, tocar dentro de la red agrega una discontinuidad cuyo POLO queda en ese punto (como en DIPS). */
  onTocarRed?: (dip_grados: number, dipDirection_grados: number) => void;
}

function aSvg(xNorm: number, yNorm: number, radioPx: number): { x: number; y: number } {
  // Norte (trend=0) proyecta a y=+1 en el sistema matematico; en SVG, y crece hacia abajo,
  // asi que invertimos para que Norte quede arriba de la pantalla.
  return { x: xNorm * radioPx, y: -yNorm * radioPx };
}

// Misma paleta apta para daltonismo (Okabe & Ito 2008) que mining.geomechanics: vermellon/ambar en
// vez de rojo/amarillo puros, para mantener un unico lenguaje de "riesgo" consistente en la suite.
function colorPolo(a?: AnalisisPlanarVuelco): string {
  if (!a) return "#94a3b8";
  if (a.planarFactible) return "#d55e00"; // vermellon: falla planar cinematicamente factible
  if (a.vuelcoFactible) return "#e69f00"; // ambar: vuelco factible
  return "#94a3b8";
}

export default function EstereogramaSVG({
  discontinuidades,
  talud,
  anguloFriccion_grados,
  analisis,
  tamanoPx = 380,
  onTocarRed,
}: Props) {
  const radioPx = tamanoPx / 2 - 24;
  const centro = tamanoPx / 2;

  const trazaTalud = trayectoriaCirculoMayor(talud.dip_grados, talud.dipDirection_grados, 48).map((p) => {
    const n = proyeccionEquiareal(p.trend_grados, p.plunge_grados);
    return aSvg(n.x, n.y, radioPx);
  });
  const puntoTrazaTalud = trazaTalud.map((p) => `${(p.x + centro).toFixed(2)},${(p.y + centro).toFixed(2)}`).join(" ");

  const radioFriccion = (Math.sqrt(2) * Math.sin(((90 - anguloFriccion_grados) * Math.PI) / 180 / 2)) * radioPx;

  const puntaTalud = proyeccionEquiareal(talud.dipDirection_grados, 0);
  const puntaTaludSvg = aSvg(puntaTalud.x, puntaTalud.y, radioPx * 1.09);

  function manejarToqueRed(e: React.PointerEvent<SVGCircleElement>) {
    if (!onTocarRed) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const escalaPx = tamanoPx / rect.width;
    const svgX = (e.clientX - rect.left) * escalaPx;
    const svgY = (e.clientY - rect.top) * escalaPx;
    const xNorm = (svgX - centro) / radioPx;
    const yNorm = -(svgY - centro) / radioPx;
    const plano = planoDesdePuntoEnRed(xNorm, yNorm);
    if (plano) onTocarRed(plano.dip_grados, plano.dipDirection_grados);
  }

  return (
    <svg width={tamanoPx} height={tamanoPx} viewBox={`0 0 ${tamanoPx} ${tamanoPx}`} role="img" aria-label="Estereograma equiareal">
      <circle
        cx={centro}
        cy={centro}
        r={radioPx}
        fill="#0b0f16"
        stroke="#334155"
        strokeWidth={1.5}
        onPointerDown={manejarToqueRed}
        style={{ cursor: onTocarRed ? "crosshair" : "default", touchAction: onTocarRed ? "none" : undefined }}
      />
      <line x1={centro - radioPx} y1={centro} x2={centro + radioPx} y2={centro} stroke="#1e293b" strokeWidth={1} pointerEvents="none" />
      <line x1={centro} y1={centro - radioPx} x2={centro} y2={centro + radioPx} stroke="#1e293b" strokeWidth={1} pointerEvents="none" />
      <text x={centro} y={centro - radioPx - 8} fill="#94a3b8" fontSize={11} textAnchor="middle" pointerEvents="none">N</text>
      <text x={centro + radioPx + 10} y={centro + 4} fill="#94a3b8" fontSize={11} textAnchor="middle" pointerEvents="none">E</text>
      <text x={centro} y={centro + radioPx + 16} fill="#94a3b8" fontSize={11} textAnchor="middle" pointerEvents="none">S</text>
      <text x={centro - radioPx - 10} y={centro + 4} fill="#94a3b8" fontSize={11} textAnchor="middle" pointerEvents="none">O</text>

      {/* cono de friccion: circulo concentrico a plunge = angulo de friccion */}
      <circle
        cx={centro}
        cy={centro}
        r={Math.max(radioFriccion, 0)}
        fill="none"
        stroke="#e69f00"
        strokeWidth={1}
        strokeDasharray="4 3"
        pointerEvents="none"
      />

      {/* circulo mayor de la cara del talud */}
      <polyline points={puntoTrazaTalud} fill="none" stroke="#38bdf8" strokeWidth={2} pointerEvents="none" />
      <polygon
        points={`${puntaTaludSvg.x + centro},${puntaTaludSvg.y + centro - 5} ${puntaTaludSvg.x + centro - 5},${puntaTaludSvg.y + centro + 5} ${puntaTaludSvg.x + centro + 5},${puntaTaludSvg.y + centro + 5}`}
        fill="#38bdf8"
        transform={`rotate(${talud.dipDirection_grados}, ${puntaTaludSvg.x + centro}, ${puntaTaludSvg.y + centro})`}
        pointerEvents="none"
      />

      {/* polos de las discontinuidades */}
      {discontinuidades.map((d) => {
        const polo = poloDelPlano(d.dip_grados, d.dipDirection_grados);
        const n = proyeccionEquiareal(polo.trend_grados, polo.plunge_grados);
        const p = aSvg(n.x, n.y, radioPx);
        const a = analisis.find((x) => x.discontinuidadId === d.id);
        return (
          <circle
            key={d.id}
            cx={p.x + centro}
            cy={p.y + centro}
            r={5}
            fill={colorPolo(a)}
            stroke="#0b0f16"
            strokeWidth={1}
            pointerEvents="none"
          >
            <title>
              {d.nombre}: dip {d.dip_grados}° / dirección {d.dipDirection_grados}°
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
