/**
 * Motor de calculo del modulo `mining.geomechanics` (Geomecánica): clasificacion del macizo
 * rocoso (RMR, Q), criterio de rotura de Hoek-Brown con su equivalente Mohr-Coulomb, y factor de
 * seguridad de falla planar.
 *
 * Fuentes:
 * - RMR (Bieniawski, Z.T. 1989. "Engineering Rock Mass Classifications", John Wiley): suma de 6
 *   parametros (resistencia UCS, RQD, espaciamiento, condicion de discontinuidades, agua,
 *   orientacion). Clases I-V (0-100). El ajuste por orientacion usado aqui corresponde a taludes.
 * - Q (Barton, Lien & Lunde, 1974): Q = (RQD/Jn) x (Jr/Ja) x (Jw/SRF).
 * - GSI = RMR89 - 5 (Hoek, 1994; solo valido con RMR de 1989).
 * - Hoek-Brown generalizado y su equivalente Mohr-Coulomb: Hoek, E., Carranza-Torres, C. &
 *   Corkum, B. (2002). "Hoek-Brown failure criterion - 2002 Edition". Proc. NARMS-TAC Conference.
 *   Ecuaciones citadas por numero tal como aparecen en el paper original:
 *     mb = mi * exp((GSI-100)/(28-14D))                                    (ec. 3)
 *     s  = exp((GSI-100)/(9-3D))                                           (ec. 4)
 *     a  = 1/2 + (1/6)(e^(-GSI/15) - e^(-20/3))                            (ec. 5)
 *     sigma_c = sigma_ci * s^a                                             (ec. 6)
 *     sigma'cm = sigma_ci*(mb+4s-a(mb-8s))*(mb/4+s)^(a-1) / (2(1+a)(2+a))   (ec. 17)
 *     sigma'3max/sigma'cm = 0.72*(sigma'cm/(gamma*H))^-0.91  [taludes]      (ec. 19)
 *     phi' = asin[ 6a*mb*(s+mb*s3n)^(a-1) / (2(1+a)(2+a) + 6a*mb*(s+mb*s3n)^(a-1)) ]  (ec. 12)
 *     c' = sigma_ci*[(1+2a)s+(1-a)mb*s3n]*(s+mb*s3n)^(a-1) /
 *          [(1+a)(2+a)*sqrt(1 + 6a*mb*(s+mb*s3n)^(a-1)/((1+a)(2+a)))]              (ec. 13)
 *     con s3n = sigma'3max / sigma_ci.
 * - Falla planar (geometria de cuna sin grieta de tension, cresta horizontal, y formula de
 *   equilibrio limite en seco): geometria derivada de Rocscience, "RocPlane Theory Manual —
 *   Factor of Safety Calculations, Planar Failures" (2022), caso "No Tension Crack" con banco
 *   superior horizontal; resistencia al corte de Mohr-Coulomb (Hoek & Bray, "Rock Slope
 *   Engineering"). FS = [c*A + W*cos(psi_p)*tan(phi)] / [W*sin(psi_p)], caso seco (sin presion de
 *   agua) — ver advertencias del resultado para el efecto (adverso) del agua, no incluido en v1.
 */

import type {
  AlteracionJunta,
  CondicionAgua,
  CondicionDiscontinuidad,
  EntradaEstabilidadPlanar,
  EntradaHoekBrown,
  EntradaQ,
  EntradaRMR,
  FactorAgua,
  FactorEsfuerzos,
  NumeroFamiliasJuntas,
  OrientacionRespectoTalud,
  ResultadoEstabilidadPlanar,
  ResultadoHoekBrown,
  ResultadoQ,
  ResultadoRMR,
  RugosidadJunta,
} from "../../domain/geomechanics.js";

const gr = (deg: number) => (deg * Math.PI) / 180;
const grados = (rad: number) => (rad * 180) / Math.PI;

// ---------------------------------------------------------------------------------------------
// RMR (Bieniawski 1989)
// ---------------------------------------------------------------------------------------------

function puntajeResistencia(ucsMPa: number): number {
  if (ucsMPa > 250) return 15;
  if (ucsMPa > 100) return 12;
  if (ucsMPa > 50) return 7;
  if (ucsMPa > 25) return 4;
  if (ucsMPa > 5) return 2;
  if (ucsMPa > 1) return 1;
  return 0;
}

function puntajeRQD(rqdPct: number): number {
  if (rqdPct > 90) return 20;
  if (rqdPct > 75) return 17;
  if (rqdPct > 50) return 13;
  if (rqdPct > 25) return 8;
  return 3;
}

function puntajeEspaciamiento(mm: number): number {
  if (mm > 2000) return 20;
  if (mm > 600) return 15;
  if (mm > 200) return 10;
  if (mm > 60) return 8;
  return 5;
}

const PUNTAJE_CONDICION: Record<CondicionDiscontinuidad, number> = {
  muy_rugosa_sana: 30,
  rugosa_poco_meteorizada: 25,
  rugosa_muy_meteorizada: 20,
  espejo_o_relleno_delgado: 10,
  relleno_blando_grueso: 0,
};

const PUNTAJE_AGUA: Record<CondicionAgua, number> = {
  seco: 15,
  humedo: 10,
  mojado: 7,
  goteando: 4,
  fluyendo: 0,
};

/** Ajuste por orientacion para TALUDES (Bieniawski 1989); distinto del ajuste para tuneles/cimentaciones. */
const AJUSTE_ORIENTACION_TALUD: Record<OrientacionRespectoTalud, number> = {
  muy_favorable: 0,
  favorable: -5,
  regular: -25,
  desfavorable: -50,
  muy_desfavorable: -60,
};

export function calcularRMR(entrada: EntradaRMR): ResultadoRMR {
  const puntajes = {
    resistencia: puntajeResistencia(entrada.resistenciaUCS_MPa),
    rqd: puntajeRQD(entrada.rqd_pct),
    espaciamiento: puntajeEspaciamiento(entrada.espaciamientoDiscontinuidades_mm),
    condicion: PUNTAJE_CONDICION[entrada.condicionDiscontinuidad],
    agua: PUNTAJE_AGUA[entrada.condicionAgua],
    orientacion: AJUSTE_ORIENTACION_TALUD[entrada.orientacion],
  };
  const rmr =
    puntajes.resistencia + puntajes.rqd + puntajes.espaciamiento + puntajes.condicion + puntajes.agua + puntajes.orientacion;

  let clase: ResultadoRMR["clase"];
  let descripcionClase: string;
  if (rmr > 80) {
    clase = 1;
    descripcionClase = "Muy buena";
  } else if (rmr > 60) {
    clase = 2;
    descripcionClase = "Buena";
  } else if (rmr > 40) {
    clase = 3;
    descripcionClase = "Regular";
  } else if (rmr > 20) {
    clase = 4;
    descripcionClase = "Pobre";
  } else {
    clase = 5;
    descripcionClase = "Muy pobre";
  }

  return { puntajes, rmr, clase, descripcionClase };
}

// ---------------------------------------------------------------------------------------------
// Q-system (Barton, Lien & Lunde 1974)
// ---------------------------------------------------------------------------------------------

const VALOR_JN: Record<NumeroFamiliasJuntas, number> = {
  masiva: 0.5,
  una_familia: 2,
  una_familia_mas_aleatorias: 3,
  dos_familias: 4,
  dos_familias_mas_aleatorias: 6,
  tres_familias: 9,
  tres_familias_mas_aleatorias: 12,
  cuatro_o_mas: 15,
  triturada: 20,
};

const VALOR_JR: Record<RugosidadJunta, number> = {
  discontinua: 4,
  rugosa_ondulada: 3,
  lisa_ondulada: 2,
  rugosa_planar: 1.5,
  lisa_planar: 1,
  espejo_planar: 0.5,
};

const VALOR_JA: Record<AlteracionJunta, number> = {
  sana_dura: 0.75,
  paredes_sanas: 1,
  paredes_ligeramente_alteradas: 2,
  recubrimiento_limoso: 3,
  recubrimiento_arcilloso_duro: 4,
  relleno_arcilloso_blando_delgado: 8,
  relleno_arcilloso_blando_grueso: 12,
};

const VALOR_JW: Record<FactorAgua, number> = {
  excavacion_seca: 1,
  flujo_medio: 0.66,
  flujo_alto_presion_baja: 0.5,
  flujo_alto_lavado: 0.33,
  flujo_excepcional: 0.1,
};

const VALOR_SRF: Record<FactorEsfuerzos, number> = {
  esfuerzo_medio: 1,
  esfuerzo_bajo_superficial: 2.5,
  zona_debil_unica: 5,
  zonas_debiles_multiples: 7.5,
  roca_suelta: 5,
  rockburst_leve: 5,
  rockburst_severo: 15,
};

function claseQ(q: number): string {
  if (q < 0.01) return "Excepcionalmente pobre";
  if (q < 0.1) return "Extremadamente pobre";
  if (q < 1) return "Muy pobre";
  if (q < 4) return "Pobre";
  if (q < 10) return "Regular";
  if (q < 40) return "Buena";
  if (q < 100) return "Muy buena";
  if (q < 400) return "Extremadamente buena";
  return "Excepcionalmente buena";
}

export function calcularQ(entrada: EntradaQ): ResultadoQ {
  const valores = {
    rqd: entrada.rqd_pct,
    jn: VALOR_JN[entrada.jn],
    jr: VALOR_JR[entrada.jr],
    ja: VALOR_JA[entrada.ja],
    jw: VALOR_JW[entrada.jw],
    srf: VALOR_SRF[entrada.srf],
  };
  const q = (valores.rqd / valores.jn) * (valores.jr / valores.ja) * (valores.jw / valores.srf);
  return { valores, q, clase: claseQ(q) };
}

/** GSI = RMR89 - 5 (Hoek, 1994). Solo valido con RMR de 1989; para otros casos, estimar GSI desde cartas de campo. */
export function gsiDesdeRMR89(rmr89: number): number {
  return rmr89 - 5;
}

// ---------------------------------------------------------------------------------------------
// Hoek-Brown generalizado + equivalente Mohr-Coulomb (Hoek, Carranza-Torres & Corkum, 2002)
// ---------------------------------------------------------------------------------------------

export function calcularHoekBrown(entrada: EntradaHoekBrown): ResultadoHoekBrown {
  const { gsi, mi, resistenciaUCS_MPa: sci, factorPerturbacion: D, pesoUnitarioRoca_kNm3: gammaKNm3, alturaTalud_m: H } = entrada;

  const mb = mi * Math.exp((gsi - 100) / (28 - 14 * D)); // ec. 3
  const s = Math.exp((gsi - 100) / (9 - 3 * D)); // ec. 4
  const a = 0.5 + (1 / 6) * (Math.exp(-gsi / 15) - Math.exp(-20 / 3)); // ec. 5

  const resistenciaMacizoUCS_MPa = sci * Math.pow(s, a); // ec. 6

  // ec. 17: resistencia global del macizo (ajuste sobre 0 <= sigma3' <= sigma_ci/4)
  const resistenciaGlobalMacizo_MPa =
    (sci * (mb + 4 * s - a * (mb - 8 * s)) * Math.pow(mb / 4 + s, a - 1)) / (2 * (1 + a) * (2 + a));

  // ec. 19: sigma'3max para taludes. gamma en MN/m3 (= kN/m3 / 1000) para que sigma'3max quede en MPa.
  const gammaMNm3 = gammaKNm3 / 1000;
  const sigmaCmSobreGammaH = resistenciaGlobalMacizo_MPa / (gammaMNm3 * H);
  const sigma3max_MPa = resistenciaGlobalMacizo_MPa * 0.72 * Math.pow(sigmaCmSobreGammaH, -0.91);

  const s3n = sigma3max_MPa / sci;
  const base = Math.pow(s + mb * s3n, a - 1);
  const numFriccion = 6 * a * mb * base;
  const denFriccion = 2 * (1 + a) * (2 + a) + numFriccion;
  const anguloFriccionEquivalente_grados = grados(Math.asin(numFriccion / denFriccion));

  const numCohesion = sci * ((1 + 2 * a) * s + (1 - a) * mb * s3n) * base;
  const denCohesion = (1 + a) * (2 + a) * Math.sqrt(1 + (6 * a * mb * base) / ((1 + a) * (2 + a)));
  const cohesionEquivalente_MPa = numCohesion / denCohesion;

  return {
    mb,
    s,
    a,
    resistenciaMacizoUCS_MPa,
    resistenciaGlobalMacizo_MPa,
    sigma3max_MPa,
    cohesionEquivalente_MPa,
    anguloFriccionEquivalente_grados,
  };
}

// ---------------------------------------------------------------------------------------------
// Estabilidad de falla planar (equilibrio limite, sin grieta de tension, banco superior horizontal, en seco)
// ---------------------------------------------------------------------------------------------

export function calcularEstabilidadPlanar(entrada: EntradaEstabilidadPlanar): ResultadoEstabilidadPlanar {
  const advertencias: string[] = [];
  const { alturaTalud_m: H, anguloCaraTalud_grados: psiF, anguloPlanoFalla_grados: psiP, anguloFriccion_grados: phi } = entrada;

  const cinematicamenteFactible = psiF > psiP && psiP > phi;
  if (!cinematicamenteFactible) {
    advertencias.push(
      "No se cumple la condicion cinematica minima para falla planar (angulo de cara > angulo del plano > angulo de friccion). El resultado numerico igual se calcula, pero la falla planar no es geometricamente factible con esta geometria."
    );
  }

  const psiFr = gr(psiF);
  const psiPr = gr(psiP);

  const longitudPlanoFalla_m = H / Math.sin(psiPr); // ec. derivada de RocPlane (caso sin grieta, banco horizontal)
  const areaPlanoFalla_m2 = longitudPlanoFalla_m; // por metro de ancho de talud
  const areaCuna_m2 = (H * H * (1 / Math.tan(psiPr) - 1 / Math.tan(psiFr))) / 2;
  const peso_kN = entrada.pesoUnitarioRoca_kNm3 * areaCuna_m2; // por metro de ancho

  const cohesion_kNm2 = entrada.cohesion_kPa; // kPa == kN/m2
  const fuerzaResistente_kN = cohesion_kNm2 * areaPlanoFalla_m2 + peso_kN * Math.cos(psiPr) * Math.tan(gr(phi));
  const fuerzaActuante_kN = peso_kN * Math.sin(psiPr);

  const factorSeguridad = fuerzaActuante_kN > 0 ? fuerzaResistente_kN / fuerzaActuante_kN : Infinity;

  if (factorSeguridad < 1) {
    advertencias.push(`FS = ${factorSeguridad.toFixed(2)} < 1: talud inestable en las condiciones analizadas (en seco, sin sostenimiento).`);
  } else if (factorSeguridad < 1.3) {
    advertencias.push(`FS = ${factorSeguridad.toFixed(2)} esta por debajo del rango tipicamente aceptable (1.3-1.5). Revisa con un ingeniero geotecnico.`);
  }
  advertencias.push(
    "Calculo en seco (sin presion de agua) y sin grieta de tension: la presencia de agua reduce el FS de forma significativa y no esta incluida en esta version."
  );

  return {
    longitudPlanoFalla_m,
    areaPlanoFalla_m2,
    peso_kN,
    fuerzaResistente_kN,
    fuerzaActuante_kN,
    factorSeguridad,
    cinematicamenteFactible,
    advertencias,
  };
}
