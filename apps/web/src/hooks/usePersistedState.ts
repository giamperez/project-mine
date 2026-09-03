import { useEffect, useState } from "react";

export const PREFIJO_ALMACENAMIENTO = "suite-mineria:";

function leerAlmacenado<T>(clave: string): T | undefined {
  try {
    const crudo = localStorage.getItem(PREFIJO_ALMACENAMIENTO + clave);
    return crudo ? (JSON.parse(crudo) as T) : undefined;
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
    const guardado = leerAlmacenado<T>(clave);
    return guardado !== undefined ? guardado : typeof valorInicial === "function" ? (valorInicial as () => T)() : valorInicial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFIJO_ALMACENAMIENTO + clave, JSON.stringify(estado));
    } catch {
      // localStorage lleno o no disponible (p.ej. modo privado de Safari) — no es critico, se ignora
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return [estado, setEstado] as const;
}
