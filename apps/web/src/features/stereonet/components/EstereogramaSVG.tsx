import { useMemo, useState, useRef } from "react";
import {
  lineaDesdeProyeccion,
  planoDesdePolo,
  planoDesdePuntoEnRed,
  poloDelPlano,
  proyectarLinea,
  trayectoriaCirculoMayor,
} from "@suite/core";
import type {
  AnalisisPlanarVuelco,
  CeldaDensidad,
  ContornoDensidad,
  Discontinuidad,
  FamiliaEstructural,
  Hemisferio,
  ModoElementos,
  TaludEstereografia,
  TipoProyeccion,
} from "@suite/core";

interface Props {
  discontinuidades: Discontinuidad[];
  talud: TaludEstereografia;
  anguloFriccion_grados: number;
  analisis: AnalisisPlanarVuelco[];
  tamanoPx?: number;
  /** Si se da, tocar dentro de la red agrega una discontinuidad cuyo POLO queda en ese punto (como en DIPS). */
  onTocarRed?: (dip_grados: number, dipDirection_grados: number) => void;
  proyeccion?: TipoProyeccion;
  hemisferio?: Hemisferio;
  elementos?: ModoElementos;
  contornos?: ContornoDensidad[];
  densidadGrid?: CeldaDensidad[];
  familias?: FamiliaEstructural[];
  mostrarEtiquetas?: boolean;
}

interface MarcaAzimut {
  deg: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  esMayor: boolean;
  esMedio: boolean;
  labelX: number | null;
  labelY: number | null;
}

function aSvg(xNorm: number, yNorm: number, radioPx: number): { x: number; y: number } {
  // Norte (trend=0) proyecta a y=+1 en el sistema matematico; en SVG, y crece hacia abajo,
  // asi que invertimos para que Norte quede arriba de la pantalla.
  return { x: xNorm * radioPx, y: -yNorm * radioPx };
}

// Colores consistentes y de alto contraste para cinemática
function colorPolo(a?: AnalisisPlanarVuelco): { fondo: string; halo: string; texto: string } {
  if (!a) return { fondo: "#94a3b8", halo: "rgba(148, 163, 184, 0.4)", texto: "Estable" };
  if (a.planarFactible) return { fondo: "#ef4444", halo: "rgba(239, 68, 68, 0.6)", texto: "Riesgo Planar" };
  if (a.vuelcoFactible) return { fondo: "#f59e0b", halo: "rgba(245, 158, 11, 0.6)", texto: "Riesgo Vuelco" };
  return { fondo: "#10b981", halo: "rgba(16, 185, 129, 0.4)", texto: "Estable" };
}

const COLORES_FAMILIA = ["#34d399", "#22d3ee", "#f472b6", "#fb923c", "#c084fc", "#facc15", "#60a5fa", "#a3e635"];

export default function EstereogramaSVG({
  discontinuidades,
  talud,
  anguloFriccion_grados,
  analisis,
  tamanoPx = 500,
  onTocarRed,
  proyeccion = "schmidt",
  hemisferio = "inferior",
  elementos = "polos",
  contornos,
  densidadGrid,
  familias,
  mostrarEtiquetas = true,
}: Props) {
  // Coordenadas SVG base
  const svgSize = 520;
  const centro = svgSize / 2;
  const radioPx = centro - 42; // margen para el dial azimutal exterior

  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorPos, setCursorPos] = useState<{ xNorm: number; yNorm: number; xSvg: number; ySvg: number } | null>(null);
  const [toqueRipple, setToqueRipple] = useState<{ x: number; y: number } | null>(null);

  const proyLinea = (trend: number, plunge: number) => proyectarLinea(trend, plunge, proyeccion, hemisferio);

  // Traza de la cara del talud
  const trazaTalud = useMemo(() => {
    return trayectoriaCirculoMayor(talud.dip_grados, talud.dipDirection_grados, 64).map((p) => {
      const n = proyLinea(p.trend_grados, p.plunge_grados);
      return aSvg(n.x, n.y, radioPx);
    });
  }, [talud.dip_grados, talud.dipDirection_grados, proyeccion, hemisferio, radioPx]);

  const puntoTrazaTalud = useMemo(() => {
    return trazaTalud.map((p) => `${(p.x + centro).toFixed(2)},${(p.y + centro).toFixed(2)}`).join(" ");
  }, [trazaTalud, centro]);

  // Radio del cono de fricción interna (círculo a plunge = angulo de friccion)
  const radioFriccion = useMemo(() => {
    const test = proyLinea(0, anguloFriccion_grados);
    return Math.hypot(test.x, test.y) * radioPx;
  }, [anguloFriccion_grados, proyeccion, hemisferio, radioPx]);

  // Punta indicadora de buzamiento del talud
  const puntaTaludSvg = useMemo(() => {
    const punta = proyLinea(talud.dipDirection_grados, 0);
    return aSvg(punta.x, punta.y, radioPx * 1.04);
  }, [talud.dipDirection_grados, proyeccion, hemisferio, radioPx]);

  // Anillos de inmersión (plunge rings) de referencia a 30° y 60°
  const radioPlunge30 = useMemo(() => {
    const p = proyLinea(0, 30);
    return Math.hypot(p.x, p.y) * radioPx;
  }, [proyeccion, hemisferio, radioPx]);

  const radioPlunge60 = useMemo(() => {
    const p = proyLinea(0, 60);
    return Math.hypot(p.x, p.y) * radioPx;
  }, [proyeccion, hemisferio, radioPx]);

  // Cálculos para la escala azimutal graduada (cada 5° y 10°, etiquetas cada 30°)
  const marcasAzimut = useMemo(() => {
    const marcas: MarcaAzimut[] = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const esMayor = deg % 30 === 0;
      const esMedio = deg % 10 === 0 && !esMayor;
      const rInner = radioPx + (esMayor ? 4 : esMedio ? 6 : 8);
      const rOuter = radioPx + 12;
      const x1 = centro + rInner * Math.sin(rad);
      const y1 = centro - rInner * Math.cos(rad);
      const x2 = centro + rOuter * Math.sin(rad);
      const y2 = centro - rOuter * Math.cos(rad);

      marcas.push({
        deg,
        x1,
        y1,
        x2,
        y2,
        esMayor,
        esMedio,
        labelX: esMayor ? centro + (radioPx + 24) * Math.sin(rad) : null,
        labelY: esMayor ? centro - (radioPx + 24) * Math.cos(rad) + 3.5 : null,
      });
    }
    return marcas;
  }, [centro, radioPx]);

  // Cálculos de coordenadas del cursor para HUD interactivo
  const cursorInfo = useMemo(() => {
    if (!cursorPos) return null;
    const { xNorm, yNorm } = cursorPos;
    const r = Math.hypot(xNorm, yNorm);
    if (r > 1.02) return null;

    const polo =
      proyeccion === "schmidt" && hemisferio === "inferior"
        ? planoDesdePuntoEnRed(xNorm, yNorm)
        : (() => {
            const tp = lineaDesdeProyeccion(xNorm, yNorm, proyeccion, hemisferio);
            return tp ? planoDesdePolo(tp.trend_grados, tp.plunge_grados) : null;
          })();

    if (!polo) return null;

    const azimutCursor = (Math.atan2(xNorm, yNorm) * 180) / Math.PI;
    const azimutNorm = (azimutCursor + 360) % 360;

    return {
      dip: Math.round(polo.dip_grados),
      dipDir: Math.round(polo.dipDirection_grados),
      azimut: Math.round(azimutNorm),
    };
  }, [cursorPos, proyeccion, hemisferio]);

  function manejarPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const escala = svgSize / rect.width;
    const svgX = (e.clientX - rect.left) * escala;
    const svgY = (e.clientY - rect.top) * escala;
    const xNorm = (svgX - centro) / radioPx;
    const yNorm = -(svgY - centro) / radioPx;

    setCursorPos({ xNorm, yNorm, xSvg: svgX, ySvg: svgY });
  }

  function manejarPointerLeave() {
    setCursorPos(null);
  }

  function manejarToqueRed(e: React.PointerEvent<SVGCircleElement>) {
    if (!onTocarRed) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const escalaPx = svgSize / rect.width;
    const svgX = (e.clientX - rect.left) * escalaPx;
    const svgY = (e.clientY - rect.top) * escalaPx;
    const xNorm = (svgX - centro) / radioPx;
    const yNorm = -(svgY - centro) / radioPx;

    const plano =
      proyeccion === "schmidt" && hemisferio === "inferior"
        ? planoDesdePuntoEnRed(xNorm, yNorm)
        : (() => {
            const tp = lineaDesdeProyeccion(xNorm, yNorm, proyeccion, hemisferio);
            return tp ? planoDesdePolo(tp.trend_grados, tp.plunge_grados) : null;
          })();

    if (plano) {
      setToqueRipple({ x: svgX, y: svgY });
      setTimeout(() => setToqueRipple(null), 500);
      onTocarRed(plano.dip_grados, plano.dipDirection_grados);
    }
  }

  function colorDensidad(pct: number, maxPct: number): string {
    const t = maxPct > 0 ? Math.min(1, pct / maxPct) : 0;
    if (t < 0.33) {
      const u = t / 0.33;
      return `rgb(${Math.round(6 + u * 10)}, ${Math.round(78 + u * 60)}, ${Math.round(59 + u * 70)})`;
    }
    if (t < 0.66) {
      const u = (t - 0.33) / 0.33;
      return `rgb(${Math.round(16 + u * 180)}, ${Math.round(185 + u * 20)}, ${Math.round(129 - u * 100)})`;
    }
    const u = (t - 0.66) / 0.34;
    return `rgb(${Math.round(239 + u * 16)}, ${Math.round(68 - u * 30)}, ${Math.round(68 - u * 30)})`;
  }

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Live HUD Header: Proyección, Hemisferio y Coordenadas del Cursor */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 8px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "#94a3b8",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 6,
              background: "rgba(16, 185, 129, 0.16)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.05em",
            }}
          >
            {proyeccion === "wulff" ? "WULFF · ÁNGULO IGUAL" : "SCHMIDT · ÁREA IGUAL"}
          </span>
          <span style={{ color: "#64748b" }}>|</span>
          <span style={{ color: "#cbd5e1" }}>{hemisferio === "inferior" ? "Hemisferio Inferior" : "Hemisferio Superior"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {cursorInfo ? (
            <span
              style={{
                background: "rgba(16, 185, 129, 0.18)",
                color: "#6ee7b7",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                padding: "2px 8px",
                borderRadius: 6,
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Plano: {cursorInfo.dip}° / {cursorInfo.dipDir}° (Az {cursorInfo.azimut}°)
            </span>
          ) : (
            <span style={{ color: "#64748b", fontSize: 10 }}>
              {onTocarRed ? "Toca la red para registrar polo" : "Mueve el cursor sobre la red"}
            </span>
          )}
        </div>
      </div>

      {/* Canvas SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        role="img"
        aria-label={`Estereograma ${proyeccion === "wulff" ? "equiangular (Wulff)" : "equiareal (Schmidt)"}`}
        onPointerMove={manejarPointerMove}
        onPointerLeave={manejarPointerLeave}
        style={{
          width: "100%",
          maxWidth: tamanoPx,
          aspectRatio: "1 / 1",
          display: "block",
          userSelect: "none",
          touchAction: onTocarRed ? "none" : "pan-y",
        }}
      >
        <defs>
          {/* Filtros de brillo neón esmeralda para polos */}
          <filter id="estereoGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="estereoFondoGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#08221b" />
            <stop offset="70%" stopColor="#051411" />
            <stop offset="100%" stopColor="#020806" />
          </radialGradient>

          <radialGradient id="friccionZoneGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245, 158, 11, 0.03)" />
            <stop offset="85%" stopColor="rgba(245, 158, 11, 0.12)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.22)" />
          </radialGradient>
        </defs>

        {/* Anillo exterior decorativo de radar / brújula */}
        <circle
          cx={centro}
          cy={centro}
          r={radioPx + 16}
          fill="none"
          stroke="rgba(16, 185, 129, 0.18)"
          strokeWidth={1}
        />
        <circle
          cx={centro}
          cy={centro}
          r={radioPx + 3}
          fill="none"
          stroke="rgba(16, 185, 129, 0.35)"
          strokeWidth={1}
        />

        {/* Graduación azimutal perimetral (cada 5°, 10° y 30°) */}
        <g pointerEvents="none">
          {marcasAzimut.map((m) => (
            <g key={`mark-${m.deg}`}>
              <line
                x1={m.x1}
                y1={m.y1}
                x2={m.x2}
                y2={m.y2}
                stroke={m.esMayor ? "#34d399" : m.esMedio ? "rgba(16, 185, 129, 0.6)" : "rgba(148, 163, 184, 0.3)"}
                strokeWidth={m.esMayor ? 1.5 : 1}
              />
              {m.esMayor && m.labelX !== null && m.labelY !== null && (
                <text
                  x={m.labelX}
                  y={m.labelY}
                  fill={m.deg === 0 ? "#34d399" : "#94a3b8"}
                  fontSize={10}
                  fontWeight={m.deg === 0 ? 800 : 600}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {m.deg === 0 ? "N" : m.deg === 90 ? "E" : m.deg === 180 ? "S" : m.deg === 270 ? "W" : `${m.deg}°`}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* Círculo primitivo de la red estereográfica (plunge = 0°, borde exterior) */}
        <circle
          cx={centro}
          cy={centro}
          r={radioPx}
          fill="url(#estereoFondoGrad)"
          stroke="#10b981"
          strokeWidth={2}
          onPointerDown={manejarToqueRed}
          style={{ cursor: onTocarRed ? "crosshair" : "default" }}
        />

        {/* Rejilla estereográfica: Círculos concéntricos de inmersión (plunge 30° y 60°) */}
        <g pointerEvents="none">
          <circle
            cx={centro}
            cy={centro}
            r={radioPlunge30}
            fill="none"
            stroke="rgba(52, 211, 153, 0.14)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={centro + radioPlunge30 - 2}
            y={centro - 4}
            fill="rgba(52, 211, 153, 0.45)"
            fontSize={8}
            textAnchor="end"
            fontFamily="monospace"
          >
            30°
          </text>

          <circle
            cx={centro}
            cy={centro}
            r={radioPlunge60}
            fill="none"
            stroke="rgba(52, 211, 153, 0.14)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={centro + radioPlunge60 - 2}
            y={centro - 4}
            fill="rgba(52, 211, 153, 0.45)"
            fontSize={8}
            textAnchor="end"
            fontFamily="monospace"
          >
            60°
          </text>

          {/* Radios azimutales cada 30° */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = centro + radioPx * Math.sin(rad);
            const y2 = centro - radioPx * Math.cos(rad);
            const esPrincipal = deg % 90 === 0;
            return (
              <line
                key={`spoke-${deg}`}
                x1={centro}
                y1={centro}
                x2={x2}
                y2={y2}
                stroke={esPrincipal ? "rgba(52, 211, 153, 0.28)" : "rgba(148, 163, 184, 0.1)"}
                strokeWidth={esPrincipal ? 1 : 0.75}
              />
            );
          })}
        </g>

        {/* Mapa de calor de densidad (grid de polos) */}
        {densidadGrid && densidadGrid.length > 0 && (() => {
          const maxPct = densidadGrid.reduce((m, c) => Math.max(m, c.densidad_pct), 0);
          const paso = radioPx * (2 / (Math.sqrt(densidadGrid.length) || 1));
          return (
            <g pointerEvents="none">
              {densidadGrid.map((c, i) => {
                const p = aSvg(c.x, c.y, radioPx);
                return (
                  <rect
                    key={i}
                    x={p.x + centro - paso / 1.7}
                    y={p.y + centro - paso / 1.7}
                    width={paso / 0.85}
                    height={paso / 0.85}
                    fill={colorDensidad(c.densidad_pct, maxPct)}
                    opacity={0.55}
                  />
                );
              })}
            </g>
          );
        })()}

        {/* Contornos de densidad (isolíneas) */}
        {contornos && contornos.length > 0 && (
          <g pointerEvents="none">
            {contornos.map((nivel) =>
              nivel.polilineas.map((seg, i) => {
                const a = aSvg(seg[0].x, seg[0].y, radioPx);
                const b = aSvg(seg[1].x, seg[1].y, radioPx);
                return (
                  <line
                    key={`${nivel.nivel_pct}-${i}`}
                    x1={a.x + centro}
                    y1={a.y + centro}
                    x2={b.x + centro}
                    y2={b.y + centro}
                    stroke="#facc15"
                    strokeWidth={1.5}
                    opacity={0.8}
                  />
                );
              })
            )}
          </g>
        )}

        {/* Cono de fricción interna (φ): límite cinemático de fricción */}
        <g pointerEvents="none">
          <circle
            cx={centro}
            cy={centro}
            r={Math.max(radioFriccion, 0)}
            fill="url(#friccionZoneGrad)"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <text
            x={centro}
            y={centro - radioFriccion - 4}
            fill="#fbbf24"
            fontSize={9.5}
            fontWeight={700}
            textAnchor="middle"
            fontFamily="monospace"
          >
            Cono de Fricción φ={anguloFriccion_grados}°
          </text>
        </g>

        {/* Gran círculo de la cara del talud (Slope Face) en Esmeralda Brillante */}
        <g pointerEvents="none">
          <polyline
            points={puntoTrazaTalud}
            fill="none"
            stroke="#10b981"
            strokeWidth={2.8}
            filter="drop-shadow(0 0 6px rgba(16, 185, 129, 0.7))"
          />
          {/* Flecha indicadora de buzamiento del talud */}
          <polygon
            points={`${puntaTaludSvg.x + centro},${puntaTaludSvg.y + centro - 6} ${puntaTaludSvg.x + centro - 6},${puntaTaludSvg.y + centro + 6} ${puntaTaludSvg.x + centro + 6},${puntaTaludSvg.y + centro + 6}`}
            fill="#10b981"
            transform={`rotate(${talud.dipDirection_grados}, ${puntaTaludSvg.x + centro}, ${puntaTaludSvg.y + centro})`}
            filter="drop-shadow(0 0 4px rgba(16, 185, 129, 0.8))"
          />
        </g>

        {/* Planos (círculos mayores) de cada discontinuidad */}
        {(elementos === "planos" || elementos === "polos_y_planos") &&
          discontinuidades.map((d) => {
            const traza = trayectoriaCirculoMayor(d.dip_grados, d.dipDirection_grados, 64).map((pt) => {
              const n = proyLinea(pt.trend_grados, pt.plunge_grados);
              return aSvg(n.x, n.y, radioPx);
            });
            const puntos = traza.map((pt) => `${(pt.x + centro).toFixed(2)},${(pt.y + centro).toFixed(2)}`).join(" ");
            const a = analisis.find((x) => x.discontinuidadId === d.id);
            const estilo = colorPolo(a);
            return (
              <polyline
                key={`plano-${d.id}`}
                points={puntos}
                fill="none"
                stroke={estilo.fondo}
                strokeWidth={1.5}
                opacity={0.85}
                pointerEvents="none"
              />
            );
          })}

        {/* Planos medios de las familias estructurales agrupadas (k-means) */}
        {familias &&
          familias
            .filter((f) => f.miembrosIds.length > 0)
            .map((f, idx) => {
              const traza = trayectoriaCirculoMayor(f.planoMedio.dip_grados, f.planoMedio.dipDirection_grados, 64).map((pt) => {
                const n = proyLinea(pt.trend_grados, pt.plunge_grados);
                return aSvg(n.x, n.y, radioPx);
              });
              const puntos = traza.map((pt) => `${(pt.x + centro).toFixed(2)},${(pt.y + centro).toFixed(2)}`).join(" ");
              return (
                <polyline
                  key={`familia-${f.id}`}
                  points={puntos}
                  fill="none"
                  stroke={COLORES_FAMILIA[idx % COLORES_FAMILIA.length]}
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  opacity={0.9}
                  pointerEvents="none"
                />
              );
            })}

        {/* Polos de las discontinuidades con halo luminoso y tooltip */}
        {(elementos === "polos" || elementos === "polos_y_planos") &&
          discontinuidades.map((d) => {
            const polo = poloDelPlano(d.dip_grados, d.dipDirection_grados);
            const n = proyLinea(polo.trend_grados, polo.plunge_grados);
            const p = aSvg(n.x, n.y, radioPx);
            const a = analisis.find((x) => x.discontinuidadId === d.id);
            const estilo = colorPolo(a);
            const cx = p.x + centro;
            const cy = p.y + centro;

            return (
              <g key={d.id} pointerEvents="none">
                {/* Halo pulsante */}
                <circle cx={cx} cy={cy} r={10} fill={estilo.halo} />
                {/* Borde oscuro */}
                <circle cx={cx} cy={cy} r={6} fill="#051411" stroke={estilo.fondo} strokeWidth={2} />
                {/* Núcleo de color con brillo */}
                <circle cx={cx} cy={cy} r={4} fill={estilo.fondo} filter="url(#estereoGlow)" />

                {/* Etiqueta flotante para legibilidad */}
                {mostrarEtiquetas && (
                  <g>
                    <rect
                      x={cx + 8}
                      y={cy - 10}
                      width={d.nombre.length * 7 + 10}
                      height={16}
                      rx={4}
                      fill="rgba(4, 16, 13, 0.9)"
                      stroke={estilo.fondo}
                      strokeWidth={0.8}
                    />
                    <text
                      x={cx + 13}
                      y={cy + 2}
                      fill="#ffffff"
                      fontSize={9.5}
                      fontWeight={700}
                      fontFamily="ui-monospace, monospace"
                    >
                      {d.nombre}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        {/* Retícula y mira interactiva cuando el cursor está dentro de la red */}
        {cursorPos && Math.hypot(cursorPos.xNorm, cursorPos.yNorm) <= 1.01 && (
          <g pointerEvents="none">
            {/* Anillo de la mira */}
            <circle
              cx={cursorPos.xSvg}
              cy={cursorPos.ySvg}
              r={onTocarRed ? 14 : 9}
              fill="none"
              stroke={onTocarRed ? "#ec4899" : "#34d399"}
              strokeWidth={1.5}
              strokeDasharray={onTocarRed ? "3 3" : undefined}
            />
            {/* Punto central */}
            <circle
              cx={cursorPos.xSvg}
              cy={cursorPos.ySvg}
              r={2.5}
              fill={onTocarRed ? "#ec4899" : "#34d399"}
            />
            {/* Líneas cruzadas de puntería */}
            <line
              x1={cursorPos.xSvg - 18}
              y1={cursorPos.ySvg}
              x2={cursorPos.xSvg + 18}
              y2={cursorPos.ySvg}
              stroke={onTocarRed ? "#ec4899" : "#34d399"}
              strokeWidth={1}
              opacity={0.7}
            />
            <line
              x1={cursorPos.xSvg}
              y1={cursorPos.ySvg - 18}
              x2={cursorPos.xSvg}
              y2={cursorPos.ySvg + 18}
              stroke={onTocarRed ? "#ec4899" : "#34d399"}
              strokeWidth={1}
              opacity={0.7}
            />
          </g>
        )}

        {/* Efecto de onda al tocar/registrar un punto */}
        {toqueRipple && (
          <circle
            cx={toqueRipple.x}
            cy={toqueRipple.y}
            r={24}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            opacity={0.8}
          >
            <animate attributeName="r" from="6" to="36" dur="0.4s" begin="0s" repeatCount="1" />
            <animate attributeName="opacity" from="1" to="0" dur="0.4s" begin="0s" repeatCount="1" />
          </circle>
        )}
      </svg>
    </div>
  );
}
