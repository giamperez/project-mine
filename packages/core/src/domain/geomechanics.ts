/** Tipos de dominio del modulo mining.geomechanics (Geomecánica). */

export type CondicionDiscontinuidad =
  | "muy_rugosa_sana"
  | "rugosa_poco_meteorizada"
  | "rugosa_muy_meteorizada"
  | "espejo_o_relleno_delgado"
  | "relleno_blando_grueso";

export type CondicionAgua = "seco" | "humedo" | "mojado" | "goteando" | "fluyendo";

export type OrientacionRespectoTalud = "muy_favorable" | "favorable" | "regular" | "desfavorable" | "muy_desfavorable";

export interface EntradaRMR {
  resistenciaUCS_MPa: number;
  rqd_pct: number;
  espaciamientoDiscontinuidades_mm: number;
  condicionDiscontinuidad: CondicionDiscontinuidad;
  condicionAgua: CondicionAgua;
  orientacion: OrientacionRespectoTalud;
}

export interface ResultadoRMR {
  puntajes: {
    resistencia: number;
    rqd: number;
    espaciamiento: number;
    condicion: number;
    agua: number;
    orientacion: number;
  };
  rmr: number;
  clase: 1 | 2 | 3 | 4 | 5;
  descripcionClase: string;
}

export type NumeroFamiliasJuntas =
  | "masiva"
  | "una_familia"
  | "una_familia_mas_aleatorias"
  | "dos_familias"
  | "dos_familias_mas_aleatorias"
  | "tres_familias"
  | "tres_familias_mas_aleatorias"
  | "cuatro_o_mas"
  | "triturada";

export type RugosidadJunta =
  | "discontinua"
  | "rugosa_ondulada"
  | "lisa_ondulada"
  | "rugosa_planar"
  | "lisa_planar"
  | "espejo_planar";

export type AlteracionJunta =
  | "sana_dura"
  | "paredes_sanas"
  | "paredes_ligeramente_alteradas"
  | "recubrimiento_limoso"
  | "recubrimiento_arcilloso_duro"
  | "relleno_arcilloso_blando_delgado"
  | "relleno_arcilloso_blando_grueso";

export type FactorAgua = "excavacion_seca" | "flujo_medio" | "flujo_alto_presion_baja" | "flujo_alto_lavado" | "flujo_excepcional";

export type FactorEsfuerzos =
  | "esfuerzo_medio"
  | "esfuerzo_bajo_superficial"
  | "zona_debil_unica"
  | "zonas_debiles_multiples"
  | "roca_suelta"
  | "rockburst_leve"
  | "rockburst_severo";

export interface EntradaQ {
  rqd_pct: number;
  jn: NumeroFamiliasJuntas;
  jr: RugosidadJunta;
  ja: AlteracionJunta;
  jw: FactorAgua;
  srf: FactorEsfuerzos;
}

export interface ResultadoQ {
  valores: { rqd: number; jn: number; jr: number; ja: number; jw: number; srf: number };
  q: number;
  clase: string;
}

export interface EntradaHoekBrown {
  gsi: number;
  /** Constante del material para roca intacta (mi). Tipico 5 (roca muy blanda) a 33 (roca muy dura/ignea). */
  mi: number;
  /** Resistencia a compresion uniaxial de la roca intacta, sigma_ci, MPa. */
  resistenciaUCS_MPa: number;
  /** Factor de perturbacion D: 0 (no perturbado) a 1 (muy perturbado por voladura/alivio de esfuerzos). */
  factorPerturbacion: number;
  /** Peso unitario de la roca, kN/m3 (tipico 25-27). */
  pesoUnitarioRoca_kNm3: number;
  /** Altura del talud, m — usada para estimar sigma'3max (Hoek et al. 2002, ec. 19). */
  alturaTalud_m: number;
}

export interface ResultadoHoekBrown {
  mb: number;
  s: number;
  a: number;
  /** Resistencia a compresion uniaxial del macizo rocoso, sigma_c = sigma_ci * s^a (ec. 6). */
  resistenciaMacizoUCS_MPa: number;
  /** Resistencia global del macizo, sigma'cm (ec. 17). */
  resistenciaGlobalMacizo_MPa: number;
  /** Esfuerzo de confinamiento maximo para taludes, sigma'3max (ec. 19). */
  sigma3max_MPa: number;
  /** Cohesion equivalente de Mohr-Coulomb, c' (ec. 13), MPa. */
  cohesionEquivalente_MPa: number;
  /** Angulo de friccion equivalente de Mohr-Coulomb, phi' (ec. 12), grados. */
  anguloFriccionEquivalente_grados: number;
}

export interface EntradaEstabilidadPlanar {
  alturaTalud_m: number;
  /** Angulo de la cara del talud medido desde la horizontal, grados (psi_f). */
  anguloCaraTalud_grados: number;
  /** Angulo (buzamiento) del plano de falla medido desde la horizontal, grados (psi_p). */
  anguloPlanoFalla_grados: number;
  cohesion_kPa: number;
  anguloFriccion_grados: number;
  pesoUnitarioRoca_kNm3: number;
}

export interface ResultadoEstabilidadPlanar {
  longitudPlanoFalla_m: number;
  /** Area del plano de falla por metro de ancho de talud, m2. */
  areaPlanoFalla_m2: number;
  /** Peso del bloque deslizante por metro de ancho de talud, kN. */
  peso_kN: number;
  fuerzaResistente_kN: number;
  fuerzaActuante_kN: number;
  factorSeguridad: number;
  /** Condicion cinematica minima (psi_f > psi_p > phi) para que la falla planar sea geometricamente posible. */
  cinematicamenteFactible: boolean;
  advertencias: string[];
}
