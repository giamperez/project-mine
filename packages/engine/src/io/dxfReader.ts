import DxfParser from "dxf-parser";
import type { IEntity } from "dxf-parser/dist/entities/geomtry";
import type { ILwpolylineEntity } from "dxf-parser/dist/entities/lwpolyline";
import type { IPolylineEntity } from "dxf-parser/dist/entities/polyline";
import type { PuntoDxf } from "./dxfWriter.js";

type EntidadPolilinea = ILwpolylineEntity | IPolylineEntity;

function esPolilineaConVertices(e: IEntity): e is EntidadPolilinea {
  return (e.type === "LWPOLYLINE" || e.type === "POLYLINE") && Array.isArray((e as EntidadPolilinea).vertices);
}

/**
 * Lee un DXF y devuelve los vertices de la primera polilinea encontrada
 * (LWPOLYLINE o POLYLINE), opcionalmente filtrando por nombre de capa.
 * Uso tipico: importar la cresta de un banco dibujada en AutoCAD.
 */
export function leerPrimeraPolilinea(textoDxf: string, capa?: string): PuntoDxf[] | null {
  const parser = new DxfParser();
  const doc = parser.parseSync(textoDxf);
  if (!doc) return null;
  const candidata = doc.entities.find(
    (e) => esPolilineaConVertices(e) && (!capa || e.layer === capa) && e.vertices.length > 0
  ) as EntidadPolilinea | undefined;
  if (!candidata) return null;
  return candidata.vertices.map((v) => ({ x: v.x, y: v.y, z: v.z ?? 0 }));
}

/** Lista los nombres de capa presentes en las entidades del DXF (utilidad para el selector de import). */
export function listarCapasDxf(textoDxf: string): string[] {
  const parser = new DxfParser();
  const doc = parser.parseSync(textoDxf);
  if (!doc) return [];
  const nombres = new Set<string>();
  for (const e of doc.entities) {
    if (e.layer) nombres.add(e.layer);
  }
  return Array.from(nombres);
}
