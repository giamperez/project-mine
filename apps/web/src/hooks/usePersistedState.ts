import { useEffect, useState } from "react";

export const PREFIJO_ALMACENAMIENTO = "suite-mineria:";

function leerAlmacenado<T>(clave: string): T | undefined {
  try {
    const crudo = localStorage.getItem(PREFIJO_ALMACENAMIENTO + clave);
    if (!crudo || crudo === "null" || crudo === "undefined") return undefined;
    const parseado = JSON.parse(crudo) as T;
    if (parseado === null || parseado === undefined) return undefined;
    return parseado;
  } catch {
    return undefined; // JSON corrupto o localStorage no disponible — se ignora, se usa el default
  }
}

/**
 * Como useState, pero autoguarda en localStorage en cada cambio y recupera el ultimo valor
 * guardado al montar — asi el trabajo del usuario (mallas dibujadas, sondajes importados,
 * discontinuidades agregadas, etc.) sobrevive a un refresh o a cerrar la pestaña.
 *
 * Reservado solo para el DATO de un modulo (lo que el usuario realmente construyo), no para
 * estado de UI efimero (pestaña activa, capas del visor, mensajes de aviso) — ese sigue en
 * useState normal.
 */
export function usePersistedState<T>(clave: string, valorInicial: T | (() => T)) {
  const [estado, setEstado] = useState<T>(() => {
    const inicial = typeof valorInicial === "function" ? (valorInicial as () => T)() : valorInicial;
    const guardado = leerAlmacenado<T>(clave);
    if (guardado === undefined || guardado === null) return inicial;

    // Si el valor inicial es array, asegurar que el guardado sea array válido
    if (Array.isArray(inicial) && !Array.isArray(guardado)) {
      return inicial;
    }
    // Si el valor inicial es objeto no-array, asegurar que guardado sea objeto válido
    if (inicial !== null && typeof inicial === "object" && !Array.isArray(inicial)) {
      if (typeof guardado !== "object" || Array.isArray(guardado) || guardado === null) {
        return inicial;
      }
    }

    return guardado;
  });

  useEffect(() => {
    try {
      if (estado !== undefined) {
        localStorage.setItem(PREFIJO_ALMACENAMIENTO + clave, JSON.stringify(estado));
      }
    } catch {
      // localStorage lleno o no disponible (p.ej. modo privado de Safari) — no es critico, se ignora
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return [estado, setEstado] as const;
}

