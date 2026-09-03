import { generarCSV } from "@suite/engine";
import type { ColarSondaje, IntervaloEnsayo, PuntoCurvaLeyTonelaje } from "@suite/core";

/** Importa collares desde CSV: id,x,y,z,profundidad,azimut,inclinacion (azimut/inclinacion opcionales -> vertical). */
export function importarColaresDesdeCSV(texto: string): ColarSondaje[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const colares: ColarSondaje[] = [];
  for (const linea of lineas) {
    const p = linea.split(",").map((x) => x.trim());
    if (p.length < 4) continue;
    const [x, y, z, profundidad] = [Number(p[1]), Number(p[2]), Number(p[3]), Number(p[4])];
    if ([x, y, z, profundidad].some((v) => Number.isNaN(v))) continue;
    colares.push({
      id: p[0],
      x,
      y,
      z,
      profundidadTotal_m: profundidad,
      azimut_grados: p[5] !== undefined && p[5] !== "" ? Number(p[5]) : 0,
      inclinacion_grados: p[6] !== undefined && p[6] !== "" ? Number(p[6]) : -90,
    });
  }
  return colares;
}

/** Importa intervalos de ensayo desde CSV: sondajeId,desde,hasta,ley. */
export function importarEnsayosDesdeCSV(texto: string): IntervaloEnsayo[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const intervalos: IntervaloEnsayo[] = [];
  for (const linea of lineas) {
    const p = linea.split(",").map((x) => x.trim());
    if (p.length < 4) continue;
    const [desde, hasta, ley] = [Number(p[1]), Number(p[2]), Number(p[3])];
    if ([desde, hasta, ley].some((v) => Number.isNaN(v))) continue;
    intervalos.push({ sondajeId: p[0], desde_m: desde, hasta_m: hasta, ley });
  }
  return intervalos;
}

export function exportarCurvaLeyTonelajeCSV(curva: PuntoCurvaLeyTonelaje[]): string {
  const columnas = ["leyCorte", "tonelaje_ton", "leyMedia"];
  const filas = curva.map((p) => ({ leyCorte: p.leyCorte, tonelaje_ton: p.tonelaje_ton, leyMedia: p.leyMedia }));
  return generarCSV(filas, columnas);
}
