import { generarCSV } from "@suite/engine";
import type { ResultadoVoladura } from "@suite/core";

/** Exporta la secuencia de iniciacion (para programar detonadores o llevar a terreno). */
export function exportarSecuenciaCSV(resultado: ResultadoVoladura): string {
  const columnas = ["taladroId", "fila", "columna", "peso_explosivo_kg", "tiempo_detonacion_ms"];
  const filas = [...resultado.cargas]
    .sort((a, b) => a.tiempoDetonacion_ms - b.tiempoDetonacion_ms)
    .map((c) => ({
      taladroId: c.taladroId,
      fila: String(c.fila),
      columna: String(c.columna),
      peso_explosivo_kg: c.pesoExplosivo_kg,
      tiempo_detonacion_ms: c.tiempoDetonacion_ms,
    }));
  return generarCSV(filas, columnas);
}
