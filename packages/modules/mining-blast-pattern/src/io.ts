import { EscritorDXF, generarCSV, leerPrimeraPolilinea, type PuntoDxf } from "@suite/engine";
import type { ResultadoMallaPerforacion } from "@suite/core";

const CAPA_DXF_TALADROS = "TALADROS";
const CAPA_DXF_ETIQUETAS = "TALADROS-ID";

/** Exporta los taladros a DXF: un punto en el collar + una linea collar->fondo por taladro, con etiqueta. */
export function exportarTaladrosDXF(resultado: ResultadoMallaPerforacion): string {
  const dxf = new EscritorDXF();
  dxf.declararCapa({ nombre: CAPA_DXF_TALADROS, colorAci: 1 });
  dxf.declararCapa({ nombre: CAPA_DXF_ETIQUETAS, colorAci: 3 });

  for (const t of resultado.taladros) {
    dxf.punto(CAPA_DXF_TALADROS, t.collar);
    dxf.linea(CAPA_DXF_TALADROS, t.collar, t.fondo);
    dxf.texto(CAPA_DXF_ETIQUETAS, t.collar, t.id, Math.max(resultado.espaciamiento_m * 0.15, 0.2));
  }
  return dxf.generar();
}

/** Exporta la tabla de taladros a CSV (coordenadas de collar/fondo y parametros de diseno). */
export function exportarTaladrosCSV(resultado: ResultadoMallaPerforacion): string {
  const columnas = [
    "id",
    "fila",
    "columna",
    "collar_x",
    "collar_y",
    "collar_z",
    "fondo_x",
    "fondo_y",
    "fondo_z",
    "profundidad_m",
    "diametro_mm",
    "taco_m",
    "longitud_carga_m",
  ];
  const filas = resultado.taladros.map((t) => ({
    id: t.id,
    fila: String(t.fila),
    columna: String(t.columna),
    collar_x: t.collar.x,
    collar_y: t.collar.y,
    collar_z: t.collar.z,
    fondo_x: t.fondo.x,
    fondo_y: t.fondo.y,
    fondo_z: t.fondo.z,
    profundidad_m: t.profundidad_m,
    diametro_mm: String(t.diametroMm),
    taco_m: t.taco_m,
    longitud_carga_m: t.longitudCarga_m,
  }));
  return generarCSV(filas, columnas);
}

/**
 * Importa la cresta del banco desde un DXF: toma la primera polilinea encontrada
 * (opcionalmente filtrando por capa) y devuelve sus vertices XY mas la cota Z detectada
 * (promedio de los vertices, por si el DXF trae elevaciones variables).
 */
export function importarCrestaBancoDesdeDXF(
  textoDxf: string,
  capa?: string
): { poligonoCresta: Array<{ x: number; y: number }>; cotaDetectada: number } | null {
  const vertices: PuntoDxf[] | null = leerPrimeraPolilinea(textoDxf, capa);
  if (!vertices || vertices.length < 3) return null;
  const cotaDetectada = vertices.reduce((acc, v) => acc + (v.z ?? 0), 0) / vertices.length;
  return {
    poligonoCresta: vertices.map((v) => ({ x: v.x, y: v.y })),
    cotaDetectada,
  };
}
