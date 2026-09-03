/**
 * Conversiones de unidades SI <-> imperial.
 * El nucleo trabaja internamente en SI (metros, mm, kg/dm3); algunas formulas
 * historicas (Ash, OSMRE) se definieron en pies/pulgadas y se convierten aqui
 * para no perder precision de las constantes empiricas originales.
 */

export const M_PER_FT = 0.3048;
export const MM_PER_IN = 25.4;
export const FT_PER_M = 1 / M_PER_FT;
export const IN_PER_MM = 1 / MM_PER_IN;

export function metersToFeet(m: number): number {
  return m * FT_PER_M;
}

export function feetToMeters(ft: number): number {
  return ft * M_PER_FT;
}

export function mmToInches(mm: number): number {
  return mm * IN_PER_MM;
}

export function inchesToMm(inch: number): number {
  return inch * MM_PER_IN;
}
