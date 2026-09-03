import type {
  AlteracionJunta,
  CondicionAgua,
  CondicionDiscontinuidad,
  FactorAgua,
  FactorEsfuerzos,
  NumeroFamiliasJuntas,
  OrientacionRespectoTalud,
  RugosidadJunta,
} from "@suite/core";

export const OPCIONES_CONDICION_DISCONTINUIDAD: Array<{ valor: CondicionDiscontinuidad; etiqueta: string }> = [
  { valor: "muy_rugosa_sana", etiqueta: "Muy rugosa, sin separación, pared sana (30)" },
  { valor: "rugosa_poco_meteorizada", etiqueta: "Rugosa, separación <1mm, pared poco meteorizada (25)" },
  { valor: "rugosa_muy_meteorizada", etiqueta: "Rugosa, separación <1mm, pared muy meteorizada (20)" },
  { valor: "espejo_o_relleno_delgado", etiqueta: "Espejo de falla o relleno <5mm (10)" },
  { valor: "relleno_blando_grueso", etiqueta: "Relleno blando >5mm o separación >5mm (0)" },
];

export const OPCIONES_AGUA_RMR: Array<{ valor: CondicionAgua; etiqueta: string }> = [
  { valor: "seco", etiqueta: "Completamente seco (15)" },
  { valor: "humedo", etiqueta: "Húmedo (10)" },
  { valor: "mojado", etiqueta: "Mojado (7)" },
  { valor: "goteando", etiqueta: "Goteando (4)" },
  { valor: "fluyendo", etiqueta: "Flujo de agua (0)" },
];

export const OPCIONES_ORIENTACION: Array<{ valor: OrientacionRespectoTalud; etiqueta: string }> = [
  { valor: "muy_favorable", etiqueta: "Muy favorable (0)" },
  { valor: "favorable", etiqueta: "Favorable (-5)" },
  { valor: "regular", etiqueta: "Regular (-25)" },
  { valor: "desfavorable", etiqueta: "Desfavorable (-50)" },
  { valor: "muy_desfavorable", etiqueta: "Muy desfavorable (-60)" },
];

export const OPCIONES_JN: Array<{ valor: NumeroFamiliasJuntas; etiqueta: string }> = [
  { valor: "masiva", etiqueta: "Roca masiva, sin juntas (0.5)" },
  { valor: "una_familia", etiqueta: "Una familia de juntas (2)" },
  { valor: "una_familia_mas_aleatorias", etiqueta: "Una familia + aleatorias (3)" },
  { valor: "dos_familias", etiqueta: "Dos familias (4)" },
  { valor: "dos_familias_mas_aleatorias", etiqueta: "Dos familias + aleatorias (6)" },
  { valor: "tres_familias", etiqueta: "Tres familias (9)" },
  { valor: "tres_familias_mas_aleatorias", etiqueta: "Tres familias + aleatorias (12)" },
  { valor: "cuatro_o_mas", etiqueta: "Cuatro o más familias (15)" },
  { valor: "triturada", etiqueta: "Roca triturada, tipo terrones (20)" },
];

export const OPCIONES_JR: Array<{ valor: RugosidadJunta; etiqueta: string }> = [
  { valor: "discontinua", etiqueta: "Juntas discontinuas (4)" },
  { valor: "rugosa_ondulada", etiqueta: "Rugosa/irregular ondulada (3)" },
  { valor: "lisa_ondulada", etiqueta: "Lisa ondulada (2)" },
  { valor: "rugosa_planar", etiqueta: "Rugosa/irregular planar (1.5)" },
  { valor: "lisa_planar", etiqueta: "Lisa planar (1)" },
  { valor: "espejo_planar", etiqueta: "Espejo de falla planar (0.5)" },
];

export const OPCIONES_JA: Array<{ valor: AlteracionJunta; etiqueta: string }> = [
  { valor: "sana_dura", etiqueta: "Junta sellada, dura, sin ablandamiento (0.75)" },
  { valor: "paredes_sanas", etiqueta: "Paredes sanas, solo manchas de oxidación (1)" },
  { valor: "paredes_ligeramente_alteradas", etiqueta: "Paredes ligeramente alteradas (2)" },
  { valor: "recubrimiento_limoso", etiqueta: "Recubrimiento limoso o arenoso (3)" },
  { valor: "recubrimiento_arcilloso_duro", etiqueta: "Recubrimiento arcilloso duro (4)" },
  { valor: "relleno_arcilloso_blando_delgado", etiqueta: "Relleno arcilloso blando delgado (8)" },
  { valor: "relleno_arcilloso_blando_grueso", etiqueta: "Relleno arcilloso blando grueso (12)" },
];

export const OPCIONES_JW: Array<{ valor: FactorAgua; etiqueta: string }> = [
  { valor: "excavacion_seca", etiqueta: "Excavación seca o flujo menor (1.0)" },
  { valor: "flujo_medio", etiqueta: "Flujo medio, lava el relleno ocasionalmente (0.66)" },
  { valor: "flujo_alto_presion_baja", etiqueta: "Flujo alto, presión baja, juntas sin relleno (0.5)" },
  { valor: "flujo_alto_lavado", etiqueta: "Flujo alto, lava rellenos (0.33)" },
  { valor: "flujo_excepcional", etiqueta: "Flujo excepcionalmente alto (0.1)" },
];

export const OPCIONES_SRF: Array<{ valor: FactorEsfuerzos; etiqueta: string }> = [
  { valor: "esfuerzo_medio", etiqueta: "Esfuerzo medio, condición favorable (1)" },
  { valor: "esfuerzo_bajo_superficial", etiqueta: "Esfuerzo bajo, cerca de superficie (2.5)" },
  { valor: "zona_debil_unica", etiqueta: "Zona de debilidad única (5)" },
  { valor: "zonas_debiles_multiples", etiqueta: "Zonas de debilidad múltiples (7.5)" },
  { valor: "roca_suelta", etiqueta: "Roca suelta / muy fracturada (5)" },
  { valor: "rockburst_leve", etiqueta: "Rockburst leve (5)" },
  { valor: "rockburst_severo", etiqueta: "Rockburst severo (15)" },
];
