import { exportarProyectoJSON, importarProyectoJSON } from "./proyecto.js";

export interface ProyectoGuardado {
  nombre: string;
  actualizado: string; // ISO
  json: string;
}

// Prefijo DISTINTO de PREFIJO_ALMACENAMIENTO ("suite-mineria:") a proposito: si la lista de
// proyectos guardados quedara adentro de ese prefijo, cada "Guardar como" incluiria una copia de
// la lista completa DENTRO de si misma (exportarProyectoJSON barre todas las claves con ese
// prefijo) — crecimiento exponencial con cada guardado.
const CLAVE_LISTA = "suite-mineria-meta:proyectos-guardados";

function leerLista(): ProyectoGuardado[] {
  try {
    const crudo = localStorage.getItem(CLAVE_LISTA);
    if (!crudo) return [];
    const lista = JSON.parse(crudo);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribirLista(lista: ProyectoGuardado[]): void {
  localStorage.setItem(CLAVE_LISTA, JSON.stringify(lista));
}

/** Proyectos guardados, mas reciente primero. */
export function listarProyectosGuardados(): ProyectoGuardado[] {
  return leerLista().sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

/** Guarda una foto del proyecto ACTIVO ahora mismo bajo un nombre. Si ya existia ese nombre, lo sobrescribe. */
export function guardarProyectoComo(nombre: string): void {
  const lista = leerLista().filter((p) => p.nombre !== nombre);
  lista.push({ nombre, actualizado: new Date().toISOString(), json: exportarProyectoJSON() });
  escribirLista(lista);
}

/**
 * Carga un proyecto guardado, REEMPLAZANDO el que este activo ahora mismo. No pregunta
 * confirmacion — el proyecto activo no respaldado se pierde; el llamador debe confirmar antes.
 */
export function cargarProyectoGuardado(nombre: string): { ok: boolean; mensaje: string } {
  const proyecto = leerLista().find((p) => p.nombre === nombre);
  if (!proyecto) return { ok: false, mensaje: "No se encontró ese proyecto guardado." };
  return importarProyectoJSON(proyecto.json);
}

export function eliminarProyectoGuardado(nombre: string): void {
  escribirLista(leerLista().filter((p) => p.nombre !== nombre));
}
