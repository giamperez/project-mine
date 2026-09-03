import type { PropiedadesExplosivo, TipoRoca } from "@suite/core";

/**
 * Valores tipicos de referencia — deben calibrarse con datos de sitio (ver caveats del plan:
 * las formulas de voladura son empiricas y sitio-especificas).
 */
export const EXPLOSIVOS_PRESET: PropiedadesExplosivo[] = [
  { nombre: "ANFO", densidadGcm3: 0.85, fuerzaRelativaANFO: 1.0 },
  { nombre: "Emulsion bombeable", densidadGcm3: 1.15, fuerzaRelativaANFO: 1.15 },
  { nombre: "Dinamita gelatina", densidadGcm3: 1.4, fuerzaRelativaANFO: 1.3 },
  { nombre: "Hidrogel / Watergel", densidadGcm3: 1.2, fuerzaRelativaANFO: 0.9 },
];

export const TIPOS_ROCA: Array<{ valor: TipoRoca; etiqueta: string }> = [
  { valor: "muy_blanda", etiqueta: "Muy blanda (c≈0.30)" },
  { valor: "blanda", etiqueta: "Blanda (c≈0.35)" },
  { valor: "media", etiqueta: "Media (c≈0.40)" },
  { valor: "dura", etiqueta: "Dura (c≈0.45)" },
  { valor: "muy_dura", etiqueta: "Muy dura (c≈0.50)" },
];
