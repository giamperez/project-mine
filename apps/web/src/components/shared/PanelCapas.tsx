import { useEffect, useMemo, useState } from "react";
import type { EstadoCapa, LayerManager } from "@suite/engine";

interface Props {
  layers: LayerManager | null;
  /** Se incrementa cada vez que la escena pudo haber cambiado su lista de capas (nuevos datos, etc.) para forzar un refresco. */
  version?: number;
}

const ETIQUETA_TIPO: Record<string, string> = {
  general: "General",
  topografia: "Topografía",
  sondajes: "Sondajes",
  bloques: "Bloques",
  texto: "Textos",
  wireframe: "Wireframes",
};

/**
 * Panel de capas reutilizable: carpetas, búsqueda por nombre, filtro por tipo, visibilidad y
 * opacidad — inspirado en el panel "Escena y Capas" de referencia. A diferencia de la leyenda
 * simple que ya tenían los visores, este SI permite interactuar (ocultar/mostrar, opacidad).
 */
export default function PanelCapas({ layers, version }: Props) {
  const [capas, setCapas] = useState<EstadoCapa[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoActivo, setTipoActivo] = useState<string>("todos");

  useEffect(() => {
    setCapas(layers ? layers.listarCapas() : []);
  }, [layers, version]);

  function refrescar() {
    if (layers) setCapas(layers.listarCapas());
  }

  function handleToggleVisible(id: string) {
    layers?.toggleVisible(id);
    refrescar();
  }

  function handleOpacidad(id: string, valor: number) {
    layers?.setOpacidad(id, valor);
    refrescar();
  }

  const tiposPresentes = useMemo(() => Array.from(new Set(capas.map((c) => c.tipo))), [capas]);

  const capasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return capas.filter((c) => {
      if (tipoActivo !== "todos" && c.tipo !== tipoActivo) return false;
      if (q && !c.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [capas, busqueda, tipoActivo]);

  const porCarpeta = useMemo(() => {
    const mapa = new Map<string, EstadoCapa[]>();
    for (const c of capasFiltradas) {
      const lista = mapa.get(c.carpeta) ?? [];
      lista.push(c);
      mapa.set(c.carpeta, lista);
    }
    return mapa;
  }, [capasFiltradas]);

  if (!layers) return null;

  return (
    <div className="panel-capas">
      <input
        type="text"
        placeholder="Buscar capa…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{
          width: "100%",
          marginBottom: 8,
          minHeight: 34,
          background: "var(--bg-elevado)",
          border: "1px solid var(--borde)",
          borderRadius: 8,
          padding: "4px 10px",
          color: "inherit",
        }}
      />
      <div className="editor2d-modos" style={{ marginBottom: 8 }}>
        <button className="btn" type="button" data-activo={tipoActivo === "todos"} onClick={() => setTipoActivo("todos")}>
          Todos ({capas.length})
        </button>
        {tiposPresentes.map((tipo) => (
          <button key={tipo} className="btn" type="button" data-activo={tipoActivo === tipo} onClick={() => setTipoActivo(tipo)}>
            {ETIQUETA_TIPO[tipo] ?? tipo} ({capas.filter((c) => c.tipo === tipo).length})
          </button>
        ))}
      </div>

      {capasFiltradas.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--texto-tenue)" }}>No hay capas cargadas.</p>
      ) : (
        Array.from(porCarpeta.entries()).map(([carpeta, lista]) => (
          <div key={carpeta} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--texto-tenue)", textTransform: "uppercase", margin: "4px 0" }}>{carpeta}</div>
            {lista.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 4px",
                  borderBottom: "1px solid var(--borde)",
                }}
              >
                <span
                  style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flex: "0 0 auto" }}
                  aria-hidden
                />
                <span style={{ flex: "1 1 auto", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.nombre}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={c.opacidad}
                  onChange={(e) => handleOpacidad(c.id, Number(e.target.value))}
                  style={{ width: 60, flex: "0 0 auto" }}
                  aria-label={`Opacidad de ${c.nombre}`}
                />
                <button
                  className="btn"
                  type="button"
                  style={{ minHeight: 28, padding: "2px 8px", flex: "0 0 auto" }}
                  onClick={() => handleToggleVisible(c.id)}
                  aria-label={c.visible ? `Ocultar ${c.nombre}` : `Mostrar ${c.nombre}`}
                >
                  {c.visible ? "👁" : "🚫"}
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
