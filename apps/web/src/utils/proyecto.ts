import { PREFIJO_ALMACENAMIENTO } from "../hooks/usePersistedState.js";

function clavesDelProyecto(): string[] {
  const claves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const clave = localStorage.key(i);
    if (clave && clave.startsWith(PREFIJO_ALMACENAMIENTO)) claves.push(clave);
  }
  return claves;
}

/** Junta todo lo guardado (todas las claves de esta app en localStorage) en un solo JSON exportable. */
export function exportarProyectoJSON(): string {
  const datos: Record<string, unknown> = {};
  for (const clave of clavesDelProyecto()) {
    try {
      datos[clave] = JSON.parse(localStorage.getItem(clave)!);
    } catch {
      // entrada corrupta — se omite del export en vez de romperlo entero
    }
  }
  return JSON.stringify({ formato: "suite-mineria-proyecto", version: 1, exportado: new Date().toISOString(), datos }, null, 2);
}

/** Escribe un JSON exportado previamente de vuelta a localStorage (reemplaza lo que hubiera). */
export function importarProyectoJSON(json: string): { ok: boolean; mensaje: string } {
  let parseado: unknown;
  try {
    parseado = JSON.parse(json);
  } catch {
    return { ok: false, mensaje: "El archivo no es JSON válido." };
  }
  const obj = parseado as { formato?: string; datos?: Record<string, unknown> };
  if (!obj || typeof obj !== "object" || !obj.datos || typeof obj.datos !== "object") {
    return { ok: false, mensaje: "El archivo no tiene el formato de un proyecto exportado desde esta app." };
  }
  let escritas = 0;
  for (const [clave, valor] of Object.entries(obj.datos)) {
    if (!clave.startsWith(PREFIJO_ALMACENAMIENTO)) continue; // solo acepta claves propias de esta app
    localStorage.setItem(clave, JSON.stringify(valor));
    escritas++;
  }
  if (escritas === 0) {
    return { ok: false, mensaje: "El archivo no contenía datos reconocibles." };
  }
  return { ok: true, mensaje: `${escritas} campo(s) importados. Recargando…` };
}

/** Borra todo el proyecto guardado localmente (vuelve cada módulo a sus valores de ejemplo). */
export function limpiarProyectoLocal(): void {
  clavesDelProyecto().forEach((clave) => localStorage.removeItem(clave));
}
