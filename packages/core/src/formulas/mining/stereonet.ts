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
  CeldaDensidad,
  ContornoDensidad,
  Discontinuidad,
  DetalleCinematicoCuna,
  DetalleCinematicoPlanar,
  DetalleCinematicoVolcamiento,
  DetalleCinematicoVolcamientoDirecto,
  EntradaEstereografia,
  EntradaSMR,
  FamiliaEstructural,
  Hemisferio,
  MecanismoCinematico,
  ParametrosCinematicos,
  PuntoProyectado,
  ResultadoAgrupamiento,
  ResultadoCinematicoCompleto,
  ResultadoDensidad,
  ResultadoEstereografia,
  ResultadoMecanismo,
  ResultadoSMR,
  TaludEstereografia,
  TipoProyeccion,
} from "../../domain/stereonet.js";
import { F4_POR_METODO } from "../../domain/stereonet.js";

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
        analizarCuna(entrada.discontinuidades[i], entrada.discontinuidades[j], entrada.talud, entrada.anguloFriccion_grados, tolerancia)
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

// =================================================================================================
// PROYECCIONES: Wulff (equiangular) y hemisferio, ademas de Schmidt (equiareal) ya definida arriba.
// =================================================================================================

/**
 * Proyeccion equiangular de Wulff (estereografica): preserva angulos (util para construcciones
 * clasicas regla-y-compas), pero distorsiona el area — por eso NO se usa para contar densidad de
 * polos (Schmidt es el estandar ahi). r = tan((90-plunge)/2).
 */
export function proyeccionEstereografica(trendGrados: number, plungeGrados: number): PuntoProyectado {
  const r = Math.tan(gr(90 - plungeGrados) / 2);
  return { x: r * Math.sin(gr(trendGrados)), y: r * Math.cos(gr(trendGrados)) };
}

/** Inversa de proyeccionEstereografica. null si cae fuera de la red primitiva. */
export function trendPlungeDesdeProyeccionEstereografica(xNorm: number, yNorm: number): TrendPlunge | null {
  const r = Math.hypot(xNorm, yNorm);
  if (r > 1 + 1e-9) return null;
  const plunge = 90 - 2 * grados(Math.atan(r));
  const trend = normalizarAzimut(grados(Math.atan2(xNorm, yNorm)));
  return { trend_grados: trend, plunge_grados: plunge };
}

/**
 * Proyecta una linea segun el tipo de red y el hemisferio elegidos. El hemisferio "superior" se
 * obtiene reflejando el punto por el centro de la red (x,y)->(-x,-y): proyectar el vector antipodal
 * (misma linea, sentido opuesto) rota el trend 180° y por construccion de ambas formulas (que solo
 * dependen de sin/cos del trend) eso equivale exactamente a negar (x,y).
 */
export function proyectarLinea(
  trendGrados: number,
  plungeGrados: number,
  proyeccion: TipoProyeccion = "schmidt",
  hemisferio: Hemisferio = "inferior"
): PuntoProyectado {
  const base =
    proyeccion === "wulff" ? proyeccionEstereografica(trendGrados, plungeGrados) : proyeccionEquiareal(trendGrados, plungeGrados);
  return hemisferio === "superior" ? { x: -base.x, y: -base.y } : base;
}

/** Inversa de proyectarLinea. null si el punto cae fuera de la red primitiva. */
export function lineaDesdeProyeccion(
  xNorm: number,
  yNorm: number,
  proyeccion: TipoProyeccion = "schmidt",
  hemisferio: Hemisferio = "inferior"
): TrendPlunge | null {
  const x = hemisferio === "superior" ? -xNorm : xNorm;
  const y = hemisferio === "superior" ? -yNorm : yNorm;
  return proyeccion === "wulff" ? trendPlungeDesdeProyeccionEstereografica(x, y) : trendPlungeDesdeProyeccion(x, y);
}

/** Direccion de buzamiento a partir del rumbo (strike) por la regla de la mano derecha (RHR):
 * apuntando el pulgar derecho a lo largo del rumbo, los dedos se curvan hacia el buzamiento, 90° a
 * la derecha del rumbo. Convencion estandar cuando los datos de campo vienen como rumbo+buzamiento
 * en vez de direccion de buzamiento+buzamiento (Priest, 1985). */
export function direccionBuzamientoDesdeRumboRHR(rumboGrados: number): number {
  return normalizarAzimut(rumboGrados + 90);
}

// =================================================================================================
// AGRUPAMIENTO EN FAMILIAS: k-means esferico sobre los polos + parametro de concentracion de Fisher
// =================================================================================================

function productoPuntoNED(a: VectorNED, b: VectorNED): number {
  return a.n * b.n + a.e * b.e + a.d * b.d;
}

/**
 * Agrupa discontinuidades en familias estructurales mediante k-means esferico sobre sus polos
 * (hemisferio inferior): asigna cada polo al centroide de maximo producto punto (= minima distancia
 * angular) y recalcula cada centroide como la direccion resultante (vector suma normalizado) de sus
 * miembros — el equivalente esferico del promedio aritmetico, y la direccion media de una
 * distribucion de Fisher (Fisher, 1953). Semillas deterministas tipo k-means++ (maximiza la distancia
 * angular minima a los centroides ya elegidos) para que el resultado sea reproducible.
 *
 * Fisher K (parametro de concentracion) por familia: kappa = (N-1)/(N-R), con R = |suma de vectores|
 * y N = miembros de la familia (Fisher, 1953; formula reproducida en Allmendinger, Cardozo & Fisher,
 * 2012, "Structural Geology Algorithms: Vectors and Tensors", Cambridge Univ. Press — el estimador
 * estandar en software de estereografia estructural). kappa=0 si N<2 (dispersion indefinida con un
 * solo dato); se acota a 1000 para evitar +Infinity cuando todos los polos de la familia coinciden.
 */
export function agruparFamiliasEsfericas(
  discontinuidades: Discontinuidad[],
  numeroFamilias: number,
  maxIteraciones = 50
): ResultadoAgrupamiento {
  const n = discontinuidades.length;
  if (n === 0) return { familias: [], iteraciones: 0 };
  const k = Math.max(1, Math.min(Math.round(numeroFamilias), n));

  const vectores = discontinuidades.map((d) => {
    const polo = poloDelPlano(d.dip_grados, d.dipDirection_grados);
    return direccionAVector(polo.trend_grados, polo.plunge_grados);
  });

  const indicesCentroides: number[] = [0];
  while (indicesCentroides.length < k) {
    let mejorIdx = -1;
    let mejorDistanciaMin = -Infinity;
    for (let i = 0; i < n; i++) {
      if (indicesCentroides.includes(i)) continue;
      const productoMax = Math.max(...indicesCentroides.map((ci) => productoPuntoNED(vectores[i], vectores[ci])));
      const distanciaAngular = -productoMax; // menor producto punto = mayor distancia angular
      if (distanciaAngular > mejorDistanciaMin) {
        mejorDistanciaMin = distanciaAngular;
        mejorIdx = i;
      }
    }
    indicesCentroides.push(mejorIdx);
  }
  let centroides: VectorNED[] = indicesCentroides.map((i) => ({ ...vectores[i] }));

  let asignacion: number[] = new Array(n).fill(-1);
  let iteracion = 0;
  for (; iteracion < maxIteraciones; iteracion++) {
    const nuevaAsignacion = vectores.map((v) => {
      let mejorC = 0;
      let mejorProd = -Infinity;
      centroides.forEach((c, ci) => {
        const p = productoPuntoNED(v, c);
        if (p > mejorProd) {
          mejorProd = p;
          mejorC = ci;
        }
      });
      return mejorC;
    });
    const cambio = nuevaAsignacion.some((c, i) => c !== asignacion[i]);
    asignacion = nuevaAsignacion;

    const sumas: VectorNED[] = centroides.map(() => ({ n: 0, e: 0, d: 0 }));
    const conteos: number[] = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = asignacion[i];
      sumas[c] = { n: sumas[c].n + vectores[i].n, e: sumas[c].e + vectores[i].e, d: sumas[c].d + vectores[i].d };
      conteos[c]++;
    }
    let reasignoVacio = false;
    for (let c = 0; c < k; c++) {
      if (conteos[c] === 0) {
        // Cluster vacio: reubicar su centroide en el punto mas alejado (angularmente) de todos los
        // centroides actuales, para que no quede "muerto" el resto de las iteraciones.
        let peorIdx = 0;
        let peorProdMax = Infinity;
        for (let i = 0; i < n; i++) {
          const prodMax = Math.max(...centroides.map((ct) => productoPuntoNED(vectores[i], ct)));
          if (prodMax < peorProdMax) {
            peorProdMax = prodMax;
            peorIdx = i;
          }
        }
        centroides[c] = { ...vectores[peorIdx] };
        reasignoVacio = true;
        continue;
      }
      const largo = Math.hypot(sumas[c].n, sumas[c].e, sumas[c].d) || 1;
      centroides[c] = { n: sumas[c].n / largo, e: sumas[c].e / largo, d: sumas[c].d / largo };
    }
    if (!cambio && !reasignoVacio) {
      iteracion++;
      break;
    }
  }

  const familias: FamiliaEstructural[] = [];
  for (let c = 0; c < k; c++) {
    const miembros = asignacion.reduce<number[]>((acc, asigC, i) => (asigC === c ? [...acc, i] : acc), []);
    if (miembros.length === 0) continue;
    let sn = 0,
      se = 0,
      sd = 0;
    for (const i of miembros) {
      sn += vectores[i].n;
      se += vectores[i].e;
      sd += vectores[i].d;
    }
    const r = Math.hypot(sn, se, sd);
    const nMiembros = miembros.length;
    const kappa = nMiembros < 2 ? 0 : Math.min((nMiembros - 1) / Math.max(nMiembros - r, 1e-9), 1000);
    const largo = r || 1;
    const medioTP = vectorATrendPlunge({ n: sn / largo, e: se / largo, d: sd / largo });
    const plano = planoDesdePolo(medioTP.trend_grados, medioTP.plunge_grados);
    familias.push({
      id: familias.length + 1,
      miembrosIds: miembros.map((i) => discontinuidades[i].id),
      planoMedio: plano,
      participacion_pct: Math.round((nMiembros / n) * 1000) / 10,
      fisherK: Math.round(kappa * 10) / 10,
    });
  }
  familias.sort((a, b) => b.participacion_pct - a.participacion_pct);
  familias.forEach((f, idx) => (f.id = idx + 1));

  return { familias, iteraciones: iteracion };
}

// =================================================================================================
// DENSIDAD DE POLOS: circulo de conteo de Kalsbeek (1963) + contornos por marching squares
// =================================================================================================

/**
 * Densidad de polos por el metodo clasico del circulo de conteo (Kalsbeek, 1963): en cada punto de
 * una grilla sobre la red, cuenta que fraccion del total de polos cae dentro de un circulo angular
 * de radio `radioConteo_grados` centrado en ese punto; densidad(%) = conteo/N*100. Es el mismo
 * principio que usan los contadores fisicos de Kalsbeek/Schmidt superpuestos a mano, y el que
 * reproducen software como Stereonet/Dips/OpenStereo para heatmaps y contornos de densidad. La
 * densidad maxima tambien se evalua exactamente en cada polo de dato (ademas de la grilla), que es
 * donde tipicamente ocurre el pico.
 */
export function calcularDensidadPolos(
  discontinuidades: Discontinuidad[],
  radioConteo_grados = 24,
  proyeccion: TipoProyeccion = "schmidt",
  hemisferio: Hemisferio = "inferior",
  resolucion = 41
): ResultadoDensidad {
  const n = discontinuidades.length;
  const grid: CeldaDensidad[] = [];
  let densidadMaxima = 0;
  if (n === 0) {
    return { grid, resolucion, densidadMaxima_pct: 0, radioConteo_grados };
  }

  const vectores = discontinuidades.map((d) => {
    const polo = poloDelPlano(d.dip_grados, d.dipDirection_grados);
    return direccionAVector(polo.trend_grados, polo.plunge_grados);
  });
  const cosRadio = Math.cos(gr(radioConteo_grados));
  const paso = 2 / (resolucion - 1);

  for (let iy = 0; iy < resolucion; iy++) {
    const y = -1 + iy * paso;
    for (let ix = 0; ix < resolucion; ix++) {
      const x = -1 + ix * paso;
      if (x * x + y * y > 1) continue;
      const tp = lineaDesdeProyeccion(x, y, proyeccion, hemisferio);
      if (!tp) continue;
      const v = direccionAVector(tp.trend_grados, tp.plunge_grados);
      let cuenta = 0;
      for (const pv of vectores) if (productoPuntoNED(v, pv) >= cosRadio) cuenta++;
      const pct = (cuenta / n) * 100;
      grid.push({ x, y, densidad_pct: pct });
      if (pct > densidadMaxima) densidadMaxima = pct;
    }
  }
  for (const pv of vectores) {
    let cuenta = 0;
    for (const pv2 of vectores) if (productoPuntoNED(pv, pv2) >= cosRadio) cuenta++;
    const pct = (cuenta / n) * 100;
    if (pct > densidadMaxima) densidadMaxima = pct;
  }

  return { grid, resolucion, densidadMaxima_pct: Math.round(densidadMaxima * 10) / 10, radioConteo_grados };
}

/**
 * Extrae lineas de contorno (marching squares) de la grilla de densidad para cada nivel pedido.
 * Ambiguedad de "silla" (casos 5/10, esquinas opuestas del mismo lado del nivel): se resuelve con el
 * valor promedio de las 4 esquinas de la celda, criterio estandar de marching squares — no afecta
 * ningun resultado numerico reportado (factor de seguridad, cinematica, SMR), solo la topologia de
 * lineas dibujadas en celdas de silla, que son raras y puramente esteticas.
 */
export function calcularContornosDensidad(resultado: ResultadoDensidad, niveles_pct: number[]): ContornoDensidad[] {
  const { grid, resolucion } = resultado;
  if (grid.length === 0) return niveles_pct.map((nivel) => ({ nivel_pct: nivel, polilineas: [] }));

  const paso = 2 / (resolucion - 1);
  const valores: number[] = new Array(resolucion * resolucion).fill(NaN);
  const idxDe = (ix: number, iy: number) => iy * resolucion + ix;
  for (const celda of grid) {
    const ix = Math.round((celda.x + 1) / paso);
    const iy = Math.round((celda.y + 1) / paso);
    if (ix >= 0 && ix < resolucion && iy >= 0 && iy < resolucion) valores[idxDe(ix, iy)] = celda.densidad_pct;
  }
  const xDe = (ix: number) => -1 + ix * paso;
  const yDe = (iy: number) => -1 + iy * paso;

  function interp(nivel: number, v0: number, v1: number, p0: number, p1: number): number {
    if (v0 === v1) return (p0 + p1) / 2;
    const f = Math.max(0, Math.min(1, (nivel - v0) / (v1 - v0)));
    return p0 + f * (p1 - p0);
  }

  return niveles_pct.map((nivel) => {
    const polilineas: Array<Array<{ x: number; y: number }>> = [];
    const agregar = (a: { x: number; y: number }, b: { x: number; y: number }) => polilineas.push([a, b]);

    for (let iy = 0; iy < resolucion - 1; iy++) {
      for (let ix = 0; ix < resolucion - 1; ix++) {
        const v0 = valores[idxDe(ix, iy)]; // inferior-izquierda
        const v1 = valores[idxDe(ix + 1, iy)]; // inferior-derecha
        const v2 = valores[idxDe(ix + 1, iy + 1)]; // superior-derecha
        const v3 = valores[idxDe(ix, iy + 1)]; // superior-izquierda
        if (![v0, v1, v2, v3].every(Number.isFinite)) continue;

        const caso = (v0 >= nivel ? 1 : 0) | (v1 >= nivel ? 2 : 0) | (v2 >= nivel ? 4 : 0) | (v3 >= nivel ? 8 : 0);
        if (caso === 0 || caso === 15) continue;

        const x0 = xDe(ix),
          x1 = xDe(ix + 1),
          y0 = yDe(iy),
          y1 = yDe(iy + 1);
        const pAbajo = { x: interp(nivel, v0, v1, x0, x1), y: y0 };
        const pDerecha = { x: x1, y: interp(nivel, v1, v2, y0, y1) };
        const pArriba = { x: interp(nivel, v3, v2, x0, x1), y: y1 };
        const pIzquierda = { x: x0, y: interp(nivel, v0, v3, y0, y1) };
        const centro = (v0 + v1 + v2 + v3) / 4;

        switch (caso) {
          case 1:
          case 14:
            agregar(pIzquierda, pAbajo);
            break;
          case 2:
          case 13:
            agregar(pAbajo, pDerecha);
            break;
          case 3:
          case 12:
            agregar(pIzquierda, pDerecha);
            break;
          case 4:
          case 11:
            agregar(pDerecha, pArriba);
            break;
          case 6:
          case 9:
            agregar(pAbajo, pArriba);
            break;
          case 7:
          case 8:
            agregar(pIzquierda, pArriba);
            break;
          case 5: // silla: v0,v2 >= nivel; v1,v3 < nivel
            if (centro >= nivel) {
              agregar(pAbajo, pDerecha);
              agregar(pArriba, pIzquierda);
            } else {
              agregar(pIzquierda, pAbajo);
              agregar(pDerecha, pArriba);
            }
            break;
          case 10: // silla: v1,v3 >= nivel; v0,v2 < nivel
            if (centro >= nivel) {
              agregar(pIzquierda, pAbajo);
              agregar(pDerecha, pArriba);
            } else {
              agregar(pAbajo, pDerecha);
              agregar(pArriba, pIzquierda);
            }
            break;
        }
      }
    }
    return { nivel_pct: nivel, polilineas };
  });
}

// =================================================================================================
// ANALISIS CINEMATICO DE LOS 4 MECANISMOS (Markland/Hoek & Bray/Goodman & Bray/Hudson & Harrison)
// =================================================================================================

/**
 * Falla planar (Markland, en Hoek & Bray, 1981, "Rock Slope Engineering"): factible si la
 * discontinuidad "mira" hacia el talud (direccion de buzamiento dentro de ±limiteLateral de la del
 * talud), aflora en la cara (buza menos que el talud) y es mas empinada que el angulo de friccion.
 */
export function analizarPlanarCinematico(d: Discontinuidad, params: ParametrosCinematicos): DetalleCinematicoPlanar {
  const { talud, anguloFriccion_grados: phi, limiteLateral_grados: limite } = params;
  const diferenciaDireccion = diferenciaAngular(d.dipDirection_grados, talud.dipDirection_grados);
  const cumpleDireccion = diferenciaDireccion <= limite;
  const cumpleAfloramiento = d.dip_grados < talud.dip_grados;
  const cumpleFriccion = d.dip_grados > phi;
  return {
    discontinuidadId: d.id,
    factible: cumpleDireccion && cumpleAfloramiento && cumpleFriccion,
    diferenciaDireccion_grados: diferenciaDireccion,
    cumpleDireccion,
    cumpleAfloramiento,
    cumpleFriccion,
  };
}

/**
 * Volcamiento flexural (Goodman & Bray, 1976): la discontinuidad debe buzar en sentido contrario al
 * talud (±limiteLateral de 180° de diferencia — capas que buzan "hacia adentro" del macizo) y lo
 * bastante empinada para que las capas puedan deslizar entre si: dip > 90 - dip_talud + phi (criterio
 * 2D original de Goodman & Bray, (90-dip)+phi<dip_talud, reordenado). El limite lateral usado por
 * defecto (±20°) sigue a Norrish & Wyllie (1996) / Rocscience Dips; Goodman & Bray (1976) usaron
 * ±10° y Goodman (1980) hasta ±30°, todos dentro del rango configurable aqui.
 */
export function analizarVolcamientoFlexuralCinematico(
  d: Discontinuidad,
  params: ParametrosCinematicos
): DetalleCinematicoVolcamiento {
  const { talud, anguloFriccion_grados: phi, limiteLateral_grados: limite } = params;
  const diferenciaDireccion = diferenciaAngular(d.dipDirection_grados, talud.dipDirection_grados + 180);
  const cumpleDireccion = diferenciaDireccion <= limite;
  const dipMinimoRequerido = 90 - talud.dip_grados + phi;
  const cumpleDipMinimo = d.dip_grados > dipMinimoRequerido;
  return {
    discontinuidadId: d.id,
    factible: cumpleDireccion && cumpleDipMinimo,
    diferenciaDireccion_grados: diferenciaDireccion,
    cumpleDireccion,
    cumpleDipMinimo,
    dipMinimoRequerido_grados: dipMinimoRequerido,
  };
}

/** Cuña (Markland): igual que analizarCuna pero con el desglose de las 3 condiciones y el limite
 * lateral cinematico compartido con los demas mecanismos, para la vista "Cinemática". */
export function analizarCunaCinematico(a: Discontinuidad, b: Discontinuidad, params: ParametrosCinematicos): DetalleCinematicoCuna {
  const base = analizarCuna(a, b, params.talud, params.anguloFriccion_grados, params.limiteLateral_grados);
  const cumpleDireccion = base.trendInterseccion_grados !== undefined
    ? diferenciaAngular(base.trendInterseccion_grados, params.talud.dipDirection_grados) <= params.limiteLateral_grados
    : false;
  const cumpleAfloramiento = base.plungeInterseccion_grados < params.talud.dip_grados;
  const cumpleFriccion = base.plungeInterseccion_grados > params.anguloFriccion_grados;
  return {
    idA: a.id,
    idB: b.id,
    trendInterseccion_grados: base.trendInterseccion_grados,
    plungeInterseccion_grados: base.plungeInterseccion_grados,
    factible: cumpleDireccion && cumpleAfloramiento && cumpleFriccion,
    cumpleDireccion,
    cumpleAfloramiento,
    cumpleFriccion,
  };
}

/**
 * Volcamiento directo/en bloques (Hudson & Harrison, 1997; ver Rocscience Dips, doc. "Direct
 * Toppling"): version simplificada por pares, analoga a la cuña pero para bloques que se forman con
 * la linea de interseccion de dos discontinuidades empinadas. Factible si esa linea es casi vertical
 * — plunge > 90 - dip_talud (limite circular de "angulo de cono = angulo del talud" de Dips, medido
 * desde el eje vertical) — y buza hacia el macizo (±limiteLateral de 180° respecto al talud, igual
 * criterio antipodal que el volcamiento flexural). Simplificacion declarada: no reproduce las zonas
 * 1-3 del cono de friccion completo de Goodman & Bray para volcamiento oblicuo.
 */
export function analizarVolcamientoDirectoCinematico(
  a: Discontinuidad,
  b: Discontinuidad,
  params: ParametrosCinematicos
): DetalleCinematicoVolcamientoDirecto {
  const poloA = poloDelPlano(a.dip_grados, a.dipDirection_grados);
  const poloB = poloDelPlano(b.dip_grados, b.dipDirection_grados);
  const va = direccionAVector(poloA.trend_grados, poloA.plunge_grados);
  const vb = direccionAVector(poloB.trend_grados, poloB.plunge_grados);
  const cruz: VectorNED = { n: va.e * vb.d - va.d * vb.e, e: va.d * vb.n - va.n * vb.d, d: va.n * vb.e - va.e * vb.n };
  const largo = Math.hypot(cruz.n, cruz.e, cruz.d) || 1;
  const interseccion = vectorATrendPlunge({ n: cruz.n / largo, e: cruz.e / largo, d: cruz.d / largo });
  const diferenciaDireccion = diferenciaAngular(interseccion.trend_grados, params.talud.dipDirection_grados + 180);
  const cumpleDireccion = diferenciaDireccion <= params.limiteLateral_grados;
  const cumpleVerticalidad = interseccion.plunge_grados > 90 - params.talud.dip_grados;
  return {
    idA: a.id,
    idB: b.id,
    trendInterseccion_grados: interseccion.trend_grados,
    plungeInterseccion_grados: interseccion.plunge_grados,
    factible: cumpleDireccion && cumpleVerticalidad,
    cumpleDireccion,
    cumpleVerticalidad,
  };
}

/** Orquesta los 4 mecanismos cinematicos sobre el set completo de discontinuidades. */
export function analizarCinematicaCompleta(
  discontinuidades: Discontinuidad[],
  params: ParametrosCinematicos
): ResultadoCinematicoCompleto {
  const planarDetalle = discontinuidades.map((d) => analizarPlanarCinematico(d, params));
  const volcFlexDetalle = discontinuidades.map((d) => analizarVolcamientoFlexuralCinematico(d, params));
  const cunaDetalle: DetalleCinematicoCuna[] = [];
  const volcDirDetalle: DetalleCinematicoVolcamientoDirecto[] = [];
  for (let i = 0; i < discontinuidades.length; i++) {
    for (let j = i + 1; j < discontinuidades.length; j++) {
      cunaDetalle.push(analizarCunaCinematico(discontinuidades[i], discontinuidades[j], params));
      volcDirDetalle.push(analizarVolcamientoDirectoCinematico(discontinuidades[i], discontinuidades[j], params));
    }
  }

  function empaquetar<T extends { factible: boolean }>(mecanismo: MecanismoCinematico, detalle: T[]): ResultadoMecanismo<T> {
    const criticos = detalle.filter((x) => x.factible).length;
    return {
      mecanismo,
      detalle,
      criticos,
      total: detalle.length,
      porcentajeAdmisible: detalle.length > 0 ? Math.round((criticos / detalle.length) * 1000) / 10 : 0,
    };
  }

  return {
    planar: empaquetar("planar", planarDetalle),
    cuna: empaquetar("cuna", cunaDetalle),
    volcamientoFlexural: empaquetar("volcamiento_flexural", volcFlexDetalle),
    volcamientoDirecto: empaquetar("volcamiento_directo", volcDirDetalle),
  };
}

// =================================================================================================
// SMR — Slope Mass Rating (Romana, 1985; tablas verificadas en Romana, Tomas & Seron, 2015,
// "Slope Mass Rating (SMR) geomechanics classification: thirty years review", ISRM Congress 2015)
// =================================================================================================

function f1DeSMR(aGrados: number): number {
  if (aGrados > 30) return 0.15;
  if (aGrados > 20) return 0.4;
  if (aGrados > 10) return 0.7;
  if (aGrados > 5) return 0.85;
  return 1.0;
}

function f2DeSMR(bGrados: number, esVolcamiento: boolean): number {
  if (esVolcamiento) return 1.0; // F2 = 1.0 para volcamiento (Tabla 1, Romana 1985)
  if (bGrados < 20) return 0.15;
  if (bGrados < 30) return 0.4;
  if (bGrados < 35) return 0.7;
  if (bGrados < 45) return 0.85;
  return 1.0;
}

function f3DeSMR(cGrados: number, esVolcamiento: boolean): number {
  if (esVolcamiento) {
    if (cGrados < 110) return 0;
    if (cGrados <= 120) return -6;
    return -25;
  }
  if (cGrados > 10) return 0;
  if (Math.abs(cGrados) < 1e-9) return -25; // C=0°: categoria singular de la Tabla 1 (Romana 1985)
  if (cGrados > 0) return -6;
  if (cGrados > -10) return -50;
  return -60;
}

/**
 * Slope Mass Rating (Romana, 1985): SMR = RMRb + (F1·F2·F3) + F4. Vincula el RMR basico (modulo
 * mining.geomechanics) con la geometria cinematica de una discontinuidad frente al talud (la misma
 * geometria que ya usa este modulo para planar/vuelco), usando las tablas discretas originales de
 * Romana (Tabla 1: F1 por paralelismo A, F2 por buzamiento B, F3 por relacion de buzamientos C;
 * Tabla 2: F4 por metodo de excavacion; Tabla 3: clases I-V).
 */
export function calcularSMR(entrada: EntradaSMR): ResultadoSMR {
  const { rmrBasico, discontinuidad: d, talud, tipoFalla, metodoExcavacion } = entrada;
  const esVolcamiento = tipoFalla === "volcamiento";

  const aGrados = esVolcamiento
    ? diferenciaAngular(d.dipDirection_grados, talud.dipDirection_grados + 180)
    : diferenciaAngular(d.dipDirection_grados, talud.dipDirection_grados);
  const bGrados = d.dip_grados;
  const cGrados = esVolcamiento ? d.dip_grados + talud.dip_grados : d.dip_grados - talud.dip_grados;

  const f1 = f1DeSMR(aGrados);
  const f2 = f2DeSMR(bGrados, esVolcamiento);
  const f3 = f3DeSMR(cGrados, esVolcamiento);
  const f4 = F4_POR_METODO[metodoExcavacion];

  const smr = Math.round((rmrBasico + f1 * f2 * f3 + f4) * 10) / 10;
  const smrAcotado = Math.max(0, Math.min(100, smr));

  let clase: ResultadoSMR["clase"];
  let descripcion: string;
  let estabilidad: string;
  let probabilidadFalla: number;
  if (smrAcotado > 80) {
    clase = "I";
    descripcion = "Muy buena";
    estabilidad = "Completamente estable";
    probabilidadFalla = 0;
  } else if (smrAcotado > 60) {
    clase = "II";
    descripcion = "Buena";
    estabilidad = "Estable";
    probabilidadFalla = 0.2;
  } else if (smrAcotado > 40) {
    clase = "III";
    descripcion = "Normal";
    estabilidad = "Parcialmente estable";
    probabilidadFalla = 0.4;
  } else if (smrAcotado > 20) {
    clase = "IV";
    descripcion = "Mala";
    estabilidad = "Inestable";
    probabilidadFalla = 0.6;
  } else {
    clase = "V";
    descripcion = "Muy mala";
    estabilidad = "Completamente inestable";
    probabilidadFalla = 0.9;
  }

  return {
    rmrBasico,
    a_grados: aGrados,
    b_grados: bGrados,
    c_grados: cGrados,
    f1,
    f2,
    f3,
    f4,
    smr,
    clase,
    descripcion,
    estabilidad,
    probabilidadFalla,
  };
}
