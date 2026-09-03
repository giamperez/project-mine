/**
 * Motor de calculo del modulo `mining.stereonet` (Proyección Estereográfica): conversión
 * dip/dirección de buzamiento -> polo, trazado de círculos máximos, proyección equiareal
 * (Schmidt, hemisferio inferior) y análisis cinemático de falla planar/cuña/vuelco.
 *
 * Convención: sistema Norte-Este-Abajo (NED), mano derecha (Norte x Este = Abajo). Todas las
 * rotaciones y productos cruz usan esta convención de forma consistente (verificado: el polo
 * obtenido por producto cruz de los vectores de rumbo y buzamiento de un plano coincide
 * exactamente con la formula clasica trend=dipdir+180, plunge=90-dip).
 *
 * Fuentes:
 * - Proyección equiareal de Lambert (red de Schmidt), estándar en geología estructural para
 *   graficar polos sin distorsión de densidad (a diferencia de la red de Wulff/equiangular):
 *   r = sqrt(2) * sin((90-plunge)/2), x = r*sin(trend), y = r*cos(trend).
 * - Convención de polo de un plano (hemisferio inferior): trend = dipDirection + 180°,
 *   plunge = 90° - dip (Priest, S.D. 1985. "Hydrogeological Rock Mechanics"; Goodman, R.E.
 *   "Introduction to Rock Mechanics").
 * - Criterios cinemáticos simplificados (planar/cuña/vuelco): ver Hoek & Bray, "Rock Slope
 *   Engineering", y la sección de estereografía del plan del proyecto — falla planar si
 *   dip_junta < dip_talud, dip_junta > phi, y direcciones alineadas (~±20°); vuelco si la
 *   discontinuidad buza en sentido contrario al talud (~±20° de 180° de diferencia) y es lo
 *   bastante empinada (dip > 90-phi); cuña si la línea de intersección de dos planos aflora
 *   (plunge < dip_talud) y plunge > phi.
 */

import type {
  AnalisisCuna,
  AnalisisPlanarVuelco,
  Discontinuidad,
  EntradaEstereografia,
  PuntoProyectado,
  ResultadoEstereografia,
  TaludEstereografia,
} from "../../domain/stereonet.js";

const gr = (deg: number) => (deg * Math.PI) / 180;
const grados = (rad: number) => (rad * 180) / Math.PI;

export interface VectorNED {
  n: number;
  e: number;
  d: number;
}

export interface TrendPlunge {
  trend_grados: number;
  plunge_grados: number;
}

function normalizarAzimut(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Vector unitario NED (Norte, Este, Abajo) para una línea de trend/plunge (plunge positivo = hacia abajo). */
export function direccionAVector(trendGrados: number, plungeGrados: number): VectorNED {
  const t = gr(trendGrados);
  const p = gr(plungeGrados);
  return { n: Math.cos(p) * Math.cos(t), e: Math.cos(p) * Math.sin(t), d: Math.sin(p) };
}

/** Trend/plunge (0-360, 0-90) de un vector NED, tomando siempre la mitad hacia el hemisferio inferior (d>=0). */
export function vectorATrendPlunge(v: VectorNED): TrendPlunge {
  const signo = v.d < 0 ? -1 : 1; // si apunta hacia arriba, usar el vector antipodal (misma línea, hemisferio inferior)
  const n = v.n * signo;
  const e = v.e * signo;
  const d = v.d * signo;
  const plunge = grados(Math.asin(Math.max(-1, Math.min(1, d))));
  const trend = normalizarAzimut(grados(Math.atan2(e, n)));
  return { trend_grados: trend, plunge_grados: plunge };
}

/** Polo de un plano (dip/dirección de buzamiento) como línea trend/plunge, hemisferio inferior. */
export function poloDelPlano(dipGrados: number, dipDirGrados: number): TrendPlunge {
  return { trend_grados: normalizarAzimut(dipDirGrados + 180), plunge_grados: 90 - dipGrados };
}

/**
 * Proyección equiareal (Schmidt) de una línea trend/plunge a coordenadas normalizadas de la red
 * (-1..1, centro = plunge 90° hacia abajo, borde = horizontal).
 */
export function proyeccionEquiareal(trendGrados: number, plungeGrados: number): PuntoProyectado {
  const r = Math.sqrt(2) * Math.sin(gr(90 - plungeGrados) / 2);
  return { x: r * Math.sin(gr(trendGrados)), y: r * Math.cos(gr(trendGrados)) };
}

/** Inversa de proyeccionEquiareal: de un punto normalizado (-1..1) de la red a su trend/plunge. null si cae fuera de la red primitiva. */
export function trendPlungeDesdeProyeccion(xNorm: number, yNorm: number): TrendPlunge | null {
  const r = Math.hypot(xNorm, yNorm);
  if (r > 1 + 1e-9) return null;
  const plunge = 90 - 2 * grados(Math.asin(Math.min(r / Math.SQRT2, 1)));
  const trend = normalizarAzimut(grados(Math.atan2(xNorm, yNorm)));
  return { trend_grados: trend, plunge_grados: plunge };
}

/** Inversa de poloDelPlano: del trend/plunge de un polo, recupera el dip/dirección de buzamiento del plano. */
export function planoDesdePolo(trendPoloGrados: number, plungePoloGrados: number): { dip_grados: number; dipDirection_grados: number } {
  return { dip_grados: 90 - plungePoloGrados, dipDirection_grados: normalizarAzimut(trendPoloGrados + 180) };
}

/** Toca la red en un punto normalizado (-1..1, mismo sistema que proyeccionEquiareal) e interpreta ese punto como el POLO de un plano. null si esta fuera de la red. */
export function planoDesdePuntoEnRed(xNorm: number, yNorm: number): { dip_grados: number; dipDirection_grados: number } | null {
  const polo = trendPlungeDesdeProyeccion(xNorm, yNorm);
  if (!polo) return null;
  return planoDesdePolo(polo.trend_grados, polo.plunge_grados);
}

/** Puntos (trend/plunge) a lo largo de la traza del círculo máximo de un plano, del rumbo a rumbo pasando por el buzamiento real. */
export function trayectoriaCirculoMayor(dipGrados: number, dipDirGrados: number, nPuntos = 60): TrendPlunge[] {
  const u = direccionAVector(normalizarAzimut(dipDirGrados - 90), 0); // vector de rumbo (horizontal)
  const v = direccionAVector(dipDirGrados, dipGrados); // vector de buzamiento real
  const puntos: TrendPlunge[] = [];
  for (let i = 0; i <= nPuntos; i++) {
    const t = (Math.PI * i) / nPuntos; // 0..pi: barre todo el semicirculo inferior
    const vec: VectorNED = {
      n: Math.cos(t) * u.n + Math.sin(t) * v.n,
      e: Math.cos(t) * u.e + Math.sin(t) * v.e,
      d: Math.cos(t) * u.d + Math.sin(t) * v.d,
    };
    puntos.push(vectorATrendPlunge(vec));
  }
  return puntos;
}

function diferenciaAngular(a: number, b: number): number {
  const diff = Math.abs(normalizarAzimut(a) - normalizarAzimut(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Analiza el riesgo de falla planar y de vuelco de UNA discontinuidad frente al talud. */
export function analizarPlanarVuelco(
  discontinuidad: Discontinuidad,
  talud: TaludEstereografia,
  anguloFriccionGrados: number,
  toleranciaGrados = 20
): AnalisisPlanarVuelco {
  const diferenciaDireccion = diferenciaAngular(discontinuidad.dipDirection_grados, talud.dipDirection_grados);

  const planarFactible =
    discontinuidad.dip_grados < talud.dip_grados &&
    discontinuidad.dip_grados > anguloFriccionGrados &&
    diferenciaDireccion <= toleranciaGrados;

  const diferenciaVuelco = diferenciaAngular(discontinuidad.dipDirection_grados, talud.dipDirection_grados + 180);
  const vuelcoFactible = diferenciaVuelco <= toleranciaGrados && discontinuidad.dip_grados > 90 - anguloFriccionGrados;

  return {
    discontinuidadId: discontinuidad.id,
    planarFactible,
    vuelcoFactible,
    diferenciaDireccion_grados: diferenciaDireccion,
  };
}

/** Analiza la línea de intersección de dos discontinuidades y su factibilidad como falla en cuña. */
export function analizarCuna(
  a: Discontinuidad,
  b: Discontinuidad,
  talud: TaludEstereografia,
  anguloFriccionGrados: number,
  toleranciaDireccionGrados = 90
): AnalisisCuna {
  const poloA = poloDelPlano(a.dip_grados, a.dipDirection_grados);
  const poloB = poloDelPlano(b.dip_grados, b.dipDirection_grados);
  const va = direccionAVector(poloA.trend_grados, poloA.plunge_grados);
  const vb = direccionAVector(poloB.trend_grados, poloB.plunge_grados);

  // La linea de interseccion de los dos planos es perpendicular a ambos polos.
  const cruz: VectorNED = {
    n: va.e * vb.d - va.d * vb.e,
    e: va.d * vb.n - va.n * vb.d,
    d: va.n * vb.e - va.e * vb.n,
  };
  const largo = Math.hypot(cruz.n, cruz.e, cruz.d) || 1;
  const interseccion = vectorATrendPlunge({ n: cruz.n / largo, e: cruz.e / largo, d: cruz.d / largo });

  const diferenciaDireccion = diferenciaAngular(interseccion.trend_grados, talud.dipDirection_grados);
  const factible =
    interseccion.plunge_grados < talud.dip_grados &&
    interseccion.plunge_grados > anguloFriccionGrados &&
    diferenciaDireccion <= toleranciaDireccionGrados;

  return {
    idA: a.id,
    idB: b.id,
    trendInterseccion_grados: interseccion.trend_grados,
    plungeInterseccion_grados: interseccion.plunge_grados,
    factible,
  };
}

/** Orquesta el análisis cinemático completo: planar/vuelco por discontinuidad + cuñas por cada par. */
export function analizarEstereografia(entrada: EntradaEstereografia): ResultadoEstereografia {
  const tolerancia = entrada.toleranciaDireccion_grados ?? 20;

  const analisisPlanoVuelco = entrada.discontinuidades.map((d) =>
    analizarPlanarVuelco(d, entrada.talud, entrada.anguloFriccion_grados, tolerancia)
  );

  const analisisCunas: AnalisisCuna[] = [];
  for (let i = 0; i < entrada.discontinuidades.length; i++) {
    for (let j = i + 1; j < entrada.discontinuidades.length; j++) {
      analisisCunas.push(
        analizarCuna(entrada.discontinuidades[i], entrada.discontinuidades[j], entrada.talud, entrada.anguloFriccion_grados)
      );
    }
  }

  return {
    analisisPlanoVuelco,
    analisisCunas,
    resumen: {
      totalDiscontinuidades: entrada.discontinuidades.length,
      riesgoPlanar: analisisPlanoVuelco.filter((a) => a.planarFactible).length,
      riesgoVuelco: analisisPlanoVuelco.filter((a) => a.vuelcoFactible).length,
      cunasFactibles: analisisCunas.filter((c) => c.factible).length,
    },
  };
}
