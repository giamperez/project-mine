import { EscritorDXF } from "@suite/engine";
import type { PuntoTopografico, SegmentoCurvaNivel, SuperficieTIN } from "@suite/core";

/** Importa puntos de levantamiento desde CSV (columnas x,y,z; ignora encabezados u otras filas no numericas). */
export function importarPuntosDesdeCSV(texto: string): PuntoTopografico[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const puntos: PuntoTopografico[] = [];
  for (const linea of lineas) {
    const partes = linea.split(",").map((p) => p.trim());
    if (partes.length < 3) continue;
    const [x, y, z] = partes.map(Number);
    if ([x, y, z].some((v) => Number.isNaN(v))) continue;
    puntos.push({ x, y, z });
  }
  return puntos;
}

/** Exporta las curvas de nivel a DXF (una capa "CURVAS_NIVEL", una LINE por segmento, en su cota real). */
export function exportarCurvasNivelDXF(segmentos: SegmentoCurvaNivel[]): string {
  const dxf = new EscritorDXF();
  dxf.declararCapa({ nombre: "CURVAS_NIVEL", colorAci: 4 });
  for (const s of segmentos) {
    dxf.linea("CURVAS_NIVEL", { x: s.a.x, y: s.a.y, z: s.cota }, { x: s.b.x, y: s.b.y, z: s.cota });
  }
  return dxf.generar();
}

/** Exporta la superficie TIN a DXF como malla de entidades 3DFACE (leible en AutoCAD/Civil 3D). */
export function exportarSuperficieDXF(superficie: SuperficieTIN): string {
  const dxf = new EscritorDXF();
  dxf.declararCapa({ nombre: "SUPERFICIE_TIN", colorAci: 2 });
  for (let i = 0; i < superficie.indices.length; i += 3) {
    const a = superficie.puntos[superficie.indices[i]];
    const b = superficie.puntos[superficie.indices[i + 1]];
    const c = superficie.puntos[superficie.indices[i + 2]];
    dxf.cara3D("SUPERFICIE_TIN", a, b, c);
  }
  return dxf.generar();
}
