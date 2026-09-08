import { useEffect, useState, useCallback, useMemo } from "react";
import { CATALOGO_EXPLOSIVOS_PERU, type PropiedadesExplosivoMina, type PropiedadesExplosivo } from "@suite/core";
import { PREFIJO_ALMACENAMIENTO } from "./usePersistedState.js";

export interface EstadoExplosivoGlobal {
  id: string;
  nombre: string;
  fabricante: string;
  densidadGcm3: number;
  vodMs: number;
  presionDetonacionKbar: number;
  rwsPeso: number;
  fuerzaRelativaANFO: number;
  usoPrincipal: string;
}

const CLAVE_STORAGE = "cad:explosivoGlobal";
const EVENTO_UPDATE = "suite:explosivo-update";

export const EXPLOSIVO_DEFECTO: EstadoExplosivoGlobal = {
  id: "semexsa-65",
  nombre: "Semexsa 65",
  fabricante: "EXSA",
  densidadGcm3: 1.12,
  vodMs: 4200,
  presionDetonacionKbar: 117,
  rwsPeso: 92,
  fuerzaRelativaANFO: 0.92,
  usoPrincipal: "Producción y tajeo en roca media",
};

function normalizarDesdeCatalogo(item: PropiedadesExplosivoMina, overrides?: Partial<EstadoExplosivoGlobal>): EstadoExplosivoGlobal {
  const rws = item.rwsPeso || 100;
  return {
    id: item.id,
    nombre: item.nombre,
    fabricante: item.fabricante || "EXSA",
    densidadGcm3: overrides?.densidadGcm3 !== undefined && !isNaN(overrides.densidadGcm3) && overrides.densidadGcm3 > 0
      ? overrides.densidadGcm3
      : item.densidadGcm3,
    vodMs: item.vodMs,
    presionDetonacionKbar: item.presionDetonacionKbar,
    rwsPeso: rws,
    fuerzaRelativaANFO: overrides?.fuerzaRelativaANFO !== undefined && !isNaN(overrides.fuerzaRelativaANFO) && overrides.fuerzaRelativaANFO > 0
      ? overrides.fuerzaRelativaANFO
      : rws / 100,
    usoPrincipal: item.usoPrincipal || "",
  };
}

function leerExplosivoGuardado(): EstadoExplosivoGlobal {
  try {
    const raw = localStorage.getItem(PREFIJO_ALMACENAMIENTO + CLAVE_STORAGE);
    if (!raw) return EXPLOSIVO_DEFECTO;
    const parseado = JSON.parse(raw);
    const encontrado = CATALOGO_EXPLOSIVOS_PERU.find((e) => e.id === parseado.id);
    if (encontrado) {
      return normalizarDesdeCatalogo(encontrado, parseado);
    }
    return { ...EXPLOSIVO_DEFECTO, ...parseado };
  } catch {
    return EXPLOSIVO_DEFECTO;
  }
}

/**
 * Hook universal para acceder y modificar el explosivo activo de la mina.
 * Garantiza sincronización reactiva instantánea entre todas las páginas (Editor CAD, Taller 3D, Galerías, Resultados).
 */
export function useExplosivoGlobal() {
  const [explosivo, setExplosivo] = useState<EstadoExplosivoGlobal>(() => leerExplosivoGuardado());

  useEffect(() => {
    function onStorageEvent(e: StorageEvent) {
      if (e.key === PREFIJO_ALMACENAMIENTO + CLAVE_STORAGE) {
        setExplosivo(leerExplosivoGuardado());
      }
    }

    function onCustomUpdate() {
      setExplosivo(leerExplosivoGuardado());
    }

    window.addEventListener("storage", onStorageEvent);
    window.addEventListener(EVENTO_UPDATE, onCustomUpdate);
    return () => {
      window.removeEventListener("storage", onStorageEvent);
      window.removeEventListener(EVENTO_UPDATE, onCustomUpdate);
    };
  }, []);

  const guardar = useCallback((nuevo: EstadoExplosivoGlobal) => {
    setExplosivo(nuevo);
    try {
      localStorage.setItem(PREFIJO_ALMACENAMIENTO + CLAVE_STORAGE, JSON.stringify(nuevo));
      window.dispatchEvent(new CustomEvent(EVENTO_UPDATE, { detail: nuevo }));
    } catch {
      // noop
    }
  }, []);

  const seleccionarPorId = useCallback(
    (id: string) => {
      const encontrado = CATALOGO_EXPLOSIVOS_PERU.find((e) => e.id === id);
      if (encontrado) {
        const nuevo = normalizarDesdeCatalogo(encontrado);
        guardar(nuevo);
      }
    },
    [guardar]
  );

  const actualizarParametros = useCallback(
    (params: Partial<Pick<EstadoExplosivoGlobal, "densidadGcm3" | "fuerzaRelativaANFO">>) => {
      setExplosivo((prev) => {
        const actual = {
          ...prev,
          densidadGcm3: params.densidadGcm3 !== undefined && !isNaN(params.densidadGcm3) && params.densidadGcm3 > 0
            ? params.densidadGcm3
            : prev.densidadGcm3,
          fuerzaRelativaANFO: params.fuerzaRelativaANFO !== undefined && !isNaN(params.fuerzaRelativaANFO) && params.fuerzaRelativaANFO > 0
            ? params.fuerzaRelativaANFO
            : prev.fuerzaRelativaANFO,
        };
        try {
          localStorage.setItem(PREFIJO_ALMACENAMIENTO + CLAVE_STORAGE, JSON.stringify(actual));
          window.dispatchEvent(new CustomEvent(EVENTO_UPDATE, { detail: actual }));
        } catch {
          // noop
        }
        return actual;
      });
    },
    []
  );

  // Objeto compatible con la interface clásica PropiedadesExplosivo
  const propiedadesExplosivoCompat: PropiedadesExplosivo = useMemo(
    () => ({
      nombre: explosivo.nombre,
      densidadGcm3: explosivo.densidadGcm3,
      fuerzaRelativaANFO: explosivo.fuerzaRelativaANFO,
    }),
    [explosivo]
  );

  return {
    explosivo,
    catalogo: CATALOGO_EXPLOSIVOS_PERU,
    seleccionarPorId,
    actualizarParametros,
    propiedadesExplosivoCompat,
  };
}
