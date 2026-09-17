import type { Taladro } from "@suite/core";
import { PREFIJO_ALMACENAMIENTO } from "../../hooks/usePersistedState.js";
import type { SnapshotMallaVoladura } from "./proyectosVoladura.js";

interface ItemMallaGuardada {
  id: string;
  nombre: string;
  detalles: string;
  fecha: string;
}

function leer<T>(clave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIJO_ALMACENAMIENTO + clave);
    if (!raw || raw === "null" || raw === "undefined") return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Construye una instantánea de solo lectura de una malla ya diseñada (geometría + taladros
 * efectivos), sin volver a leer ni modificar el proyecto de Malla original. */
export function construirSnapshotDesdeMalla(mallaId: string, mallaNombre: string): SnapshotMallaVoladura | null {
  const esLegacy = mallaId === "malla-1";

  const entrada = leer<any>(`malla.${mallaId}.entrada`, null) ?? (esLegacy ? leer<any>("malla.entrada", null) : null);
  const taladrosManuales =
    leer<Taladro[] | null>(`malla.${mallaId}.taladrosManuales`, null) ??
    (esLegacy ? leer<Taladro[] | null>("malla.taladrosManuales", null) : null);
  const taladrosTunel =
    leer<Taladro[]>(`malla.${mallaId}.tunel.taladros`, []) ?? (esLegacy ? leer<Taladro[]>("malla.tunel.taladros", []) : []);
  const modoDiseno = leer<string>(`malla.${mallaId}.modoDiseno`, "") || (esLegacy ? leer<string>("malla.modoDiseno", "banco") : "banco");

  const esTunel = modoDiseno === "tunel" && taladrosTunel.length > 0;
  const taladros = esTunel ? taladrosTunel : taladrosManuales ?? [];

  if (!entrada || taladros.length === 0) return null;

  const xs = taladros.map((t) => t.collar.x);
  const ys = taladros.map((t) => t.collar.y);
  const burden_m = xs.length > 1 ? Math.max((Math.max(...xs) - Math.min(...xs)) / Math.max(new Set(taladros.map((t) => t.columna)).size - 1, 1), 1) : 3;
  const espaciamiento_m = ys.length > 1 ? Math.max((Math.max(...ys) - Math.min(...ys)) / Math.max(new Set(taladros.map((t) => t.fila)).size - 1, 1), 1) : 3;

  return {
    mallaId,
    mallaNombre,
    esTunel,
    poligonoCresta: entrada.poligonoCresta ?? [],
    cotaCresta: entrada.cotaCresta ?? 4500,
    alturaBanco_m: entrada.alturaBanco_m ?? 10,
    diametroMm: entrada.diametroMm ?? 89,
    densidadRocaGcm3: entrada.densidadRocaGcm3 ?? 2.7,
    burden_m,
    espaciamiento_m,
    taladros,
  };
}

interface Props {
  onVolver: () => void;
  onMallaSeleccionada: (snapshot: SnapshotMallaVoladura) => void;
}

export default function SeleccionMallaVoladura({ onVolver, onMallaSeleccionada }: Props) {
  const proyectosMalla = leer<ItemMallaGuardada[]>("malla.listaProyectos", [
    { id: "malla-1", nombre: "Malla 1", detalles: "Diseño de perforación", fecha: "" },
  ]);

  function handleSeleccionar(item: ItemMallaGuardada) {
    const snapshot = construirSnapshotDesdeMalla(item.id, item.nombre);
    if (!snapshot) {
      alert(`"${item.nombre}" todavía no tiene taladros diseñados. Abre el módulo de Malla y termina el diseño antes de cargarla aquí.`);
      return;
    }
    onMallaSeleccionada(snapshot);
  }

  return (
    <div className="portal-mobile-wrapper">
      <div className="portal-container">
        <header className="portal-nav-header">
          <button type="button" className="btn-portal-back" onClick={onVolver}>
            <span className="arrow-back">←</span> Cargar malla
          </button>
        </header>

        <div style={{ padding: "0 2px 12px" }}>
          <h1 className="portal-module-title" style={{ fontSize: 20, marginBottom: 4 }}>
            Cargar malla
          </h1>
          <p className="portal-module-sub" style={{ margin: 0 }}>
            Selecciona un diseño de perforación guardado
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            background: "rgba(56,189,248,0.08)",
            border: "1px solid rgba(56,189,248,0.3)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 14,
            fontSize: 12,
            color: "#7dd3fc",
            lineHeight: 1.4,
          }}
        >
          <span>ℹ️</span>
          <span>
            Voladura copiará una instantánea de la geometría y abrirá únicamente sus vistas de Malla,
            Carguío, Retardos, Resultados y Simulación. No modificará la malla original.
          </span>
        </div>

        <section className="portal-recientes-section">
          {proyectosMalla.map((p) => {
            const snapshotPreview = construirSnapshotDesdeMalla(p.id, p.nombre);
            return (
              <div
                key={p.id}
                className="portal-project-card"
                onClick={() => handleSeleccionar(p)}
                title="Tocar para cargar esta malla"
              >
                <div className="portal-project-card-header">
                  <h3 style={{ margin: 0 }}>{p.nombre}</h3>
                </div>
                <div className="portal-project-state-badge">
                  <span className="state-mono">
                    {snapshotPreview
                      ? `${snapshotPreview.esTunel ? "Túnel" : "Banco"} · ${snapshotPreview.taladros.length} taladros`
                      : "Sin taladros diseñados todavía"}
                  </span>
                </div>
                <div className="portal-project-actions-row">
                  <span className="actions-label">TOCAR PARA CARGAR →</span>
                </div>
              </div>
            );
          })}

          {proyectosMalla.length === 0 && (
            <div className="portal-empty-card">
              <p style={{ margin: "0 0 6px 0", color: "#94a3b8", fontSize: "13px", fontWeight: 600 }}>
                No tienes mallas diseñadas todavía.
              </p>
              <span style={{ color: "#64748b", fontSize: "11px" }}>
                Abre el módulo "Diseño de Malla" y crea una antes de diseñar la voladura.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
