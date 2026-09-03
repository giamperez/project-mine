import { generarCSV } from "@suite/engine";
import type { Discontinuidad } from "@suite/core";

/** Importa discontinuidades desde CSV (columnas nombre,dip,dipdirection; ignora encabezados u otras filas invalidas). */
export function importarDiscontinuidadesDesdeCSV(texto: string): Discontinuidad[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const discontinuidades: Discontinuidad[] = [];
  let contador = 1;
  for (const linea of lineas) {
    const partes = linea.split(",").map((p) => p.trim());
    if (partes.length < 3) continue;
    const dip = Number(partes[1]);
    const dipDir = Number(partes[2]);
    if (Number.isNaN(dip) || Number.isNaN(dipDir)) continue;
    discontinuidades.push({ id: `D-${contador}`, nombre: partes[0] || `D-${contador}`, dip_grados: dip, dipDirection_grados: dipDir });
    contador++;
  }
  return discontinuidades;
}

export function exportarDiscontinuidadesCSV(discontinuidades: Discontinuidad[]): string {
  const columnas = ["nombre", "dip_grados", "dipDirection_grados"];
  const filas = discontinuidades.map((d) => ({
    nombre: d.nombre,
    dip_grados: d.dip_grados,
    dipDirection_grados: d.dipDirection_grados,
  }));
  return generarCSV(filas, columnas);
}
