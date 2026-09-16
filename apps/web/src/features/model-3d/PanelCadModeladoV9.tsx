import React from "react";

export type HerramientaCad = "linea" | "polilinea" | "rectangulo" | "circulo";
export type PlanoTrabajoCad = "xy" | "ns" | "ew";

export const COLORES_CAD_V9 = [
  "#ec4899", // Rosa neón
  "#f472b6", // Rosa suave
  "#fbbf24", // Amarillo / Oro
  "#fb923c", // Naranja
  "#38bdf8", // Azul celeste
  "#2dd4bf", // Verde esmeralda / Teal
  "#4ade80", // Verde claro
  "#a78bfa", // Lavanda / Púrpura
  "#cffafe", // Blanco azulado / Hielo
  "#ffffff", // Blanco puro
  "#94a3b8", // Gris pizarra
  "#1e1b2e", // Carbón / Negro
];

interface Props {
  abierto: boolean;
  minimizado: boolean;
  onCerrar: () => void;
  onMinimizar: () => void;
  onRestaurar: () => void;
  herramienta: HerramientaCad;
  onCambiarHerramienta: (h: HerramientaCad) => void;
  planoTrabajo: PlanoTrabajoCad;
  onCambiarPlano: (p: PlanoTrabajoCad) => void;
  origenX: string;
  setOrigenX: (v: string) => void;
  origenY: string;
  setOrigenY: (v: string) => void;
  origenZ: string;
  setOrigenZ: (v: string) => void;
  pasoSnap: string;
  setPasoSnap: (v: string) => void;
  puntosCount: number;
  segmentosCount: number;
  finalizarAbierta: boolean;
  setFinalizarAbierta: (v: boolean | ((prev: boolean) => boolean)) => void;
  nombreCapa: string;
  setNombreCapa: (v: string) => void;
  colorSeleccionado: string;
  setColorSeleccionado: (c: string) => void;
  onGuardar: () => void;
}

export default function PanelCadModeladoV9({
  abierto,
  minimizado,
  onCerrar,
  onMinimizar,
  onRestaurar,
  herramienta,
  onCambiarHerramienta,
  planoTrabajo,
  onCambiarPlano,
  origenX,
  setOrigenX,
  origenY,
  setOrigenY,
  origenZ,
  setOrigenZ,
  pasoSnap,
  setPasoSnap,
  segmentosCount,
  finalizarAbierta,
  setFinalizarAbierta,
  nombreCapa,
  setNombreCapa,
  colorSeleccionado,
  setColorSeleccionado,
  onGuardar,
}: Props) {
  if (!abierto) return null;

  // Si está minimizado, mostrar píldora flotante compacta para permitir dibujar en pantalla completa
  if (minimizado) {
    return (
      <div
        className="m3d-v9-minimized-pill"
        onClick={onRestaurar}
        title="Clic para expandir el panel CAD / MODELADO"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        <span>V9 · {herramienta.toUpperCase()} ({segmentosCount} seg)</span>
        <span style={{ color: "#ec4899", fontSize: "12px", marginLeft: "4px" }}>▲</span>
      </div>
    );
  }

  // Textos contextuales según herramienta
  let descripcionHerramienta = "Toca cada vértice. Usa SNAP existentes o los puntos cian del plano. Luego crea la polilínea.";
  if (herramienta === "linea") {
    descripcionHerramienta = "Toca el punto inicial y el punto final. Usa SNAP del plano o geometría existente.";
  } else if (herramienta === "rectangulo") {
    descripcionHerramienta = "Toca dos esquinas opuestas sobre el plano de trabajo para trazar el rectángulo.";
  } else if (herramienta === "circulo") {
    descripcionHerramienta = "Toca el centro y luego un punto del radio en el plano de trabajo para crear el círculo.";
  }

  // Texto del botón de guardado según herramienta y estado
  let textoBotonGuardar = `Guardar ${herramienta === "polilinea" ? (finalizarAbierta ? "polilínea abierta" : "polilínea cerrada") : herramienta}`;
  if (herramienta === "linea") textoBotonGuardar = "Guardar línea";
  if (herramienta === "rectangulo") textoBotonGuardar = "Guardar rectángulo";
  if (herramienta === "circulo") textoBotonGuardar = "Guardar círculo";

  const botonHabilitado = segmentosCount > 0;

  return (
    <div className="m3d-panel-v9">
      {/* 1. CABECERA V9 · CAD / MODELADO */}
      <div className="m3d-v9-header">
        <div className="m3d-v9-header-left">
          <div className="m3d-v9-header-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className="m3d-v9-titles">
            <span className="m3d-v9-title">V9 · CAD / MODELADO</span>
            <span className="m3d-v9-sub">
              Dibujo por SNAP + plano de trabajo. Genera líneas y mallas compatibles con el motor actual.
            </span>
          </div>
        </div>

        <div className="m3d-v9-header-right">
          <span className="m3d-v9-chevron">&gt;</span>
          <button
            type="button"
            className="btn-m3d-v9-ocultar"
            onClick={onMinimizar}
            title="Minimizar panel"
          >
            Ocultar
          </button>
        </div>
      </div>

      {/* BANNER TIP / MINIMIZAR */}
      <div className="m3d-v9-tip-card">
        → minimiza el panel sin salir de la herramienta. Puedes seguir tocando SNAP y dibujando con toda la pantalla.
      </div>

      {/* 2. SECCIÓN: HERRAMIENTA */}
      <div className="m3d-v9-section">
        <span className="m3d-v9-sec-title">Herramienta</span>
        <div className="m3d-v9-tools-grid">
          <button
            type="button"
            className={`btn-m3d-v9-tool ${herramienta === "linea" ? "activo" : ""}`}
            onClick={() => onCambiarHerramienta("linea")}
          >
            Línea
          </button>
          <button
            type="button"
            className={`btn-m3d-v9-tool ${herramienta === "polilinea" ? "activo" : ""}`}
            onClick={() => onCambiarHerramienta("polilinea")}
          >
            Polilínea
          </button>
          <button
            type="button"
            className={`btn-m3d-v9-tool ${herramienta === "rectangulo" ? "activo" : ""}`}
            onClick={() => onCambiarHerramienta("rectangulo")}
          >
            Rectángulo
          </button>
          <button
            type="button"
            className={`btn-m3d-v9-tool ${herramienta === "circulo" ? "activo" : ""}`}
            onClick={() => onCambiarHerramienta("circulo")}
          >
            Círculo
          </button>
        </div>

        <div className="m3d-v9-desc-box">{descripcionHerramienta}</div>
      </div>

      {/* 3. SECCIÓN: PLANO DE TRABAJO / SNAP */}
      <div className="m3d-v9-section">
        <span className="m3d-v9-sec-title">Plano de trabajo / SNAP</span>
        <div className="m3d-v9-planes-row">
          <button
            type="button"
            className={`btn-m3d-v9-plane ${planoTrabajo === "xy" ? "activo" : ""}`}
            onClick={() => onCambiarPlano("xy")}
          >
            Planta XY
          </button>
          <button
            type="button"
            className={`btn-m3d-v9-plane ${planoTrabajo === "ns" ? "activo" : ""}`}
            onClick={() => onCambiarPlano("ns")}
          >
            Sección N-S
          </button>
          <button
            type="button"
            className={`btn-m3d-v9-plane ${planoTrabajo === "ew" ? "activo" : ""}`}
            onClick={() => onCambiarPlano("ew")}
          >
            Sección E-W
          </button>
        </div>

        <div className="m3d-v9-coords-3col">
          <div className="m3d-v9-input-box">
            <span className="m3d-v9-input-label">Origen X</span>
            <input
              type="text"
              className="m3d-v9-input-field"
              value={origenX}
              onChange={(e) => setOrigenX(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="m3d-v9-input-box">
            <span className="m3d-v9-input-label">Origen Y</span>
            <input
              type="text"
              className="m3d-v9-input-field"
              value={origenY}
              onChange={(e) => setOrigenY(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="m3d-v9-input-box">
            <span className="m3d-v9-input-label">Origen Z</span>
            <input
              type="text"
              className="m3d-v9-input-field"
              value={origenZ}
              onChange={(e) => setOrigenZ(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="m3d-v9-input-box">
          <span className="m3d-v9-input-label">Paso SNAP m</span>
          <input
            type="text"
            className="m3d-v9-input-field"
            value={pasoSnap}
            onChange={(e) => setPasoSnap(e.target.value)}
            placeholder="10"
          />
        </div>

        <p className="m3d-v9-note-text">
          Los mini-cruces cian son referencias temporales. Si tocas geometría existente, sus vértices/extremos/puntos medios tienen prioridad sobre el plano.
        </p>
      </div>

      {/* 4. SECCIÓN: VISTA PREVIA ACTIVA */}
      <div className="m3d-v9-preview-card">
        <span className="m3d-v9-preview-header">
          Vista previa activa · {segmentosCount} {segmentosCount === 1 ? "segmento" : "segmentos"}
        </span>
        <p className="m3d-v9-preview-desc">
          Cada nuevo SNAP se dibuja inmediatamente en el visor. Todavía no se guarda como capa hasta que pulses el botón final.
        </p>

        {herramienta === "polilinea" && (
          <div className="m3d-v9-toggle-row">
            <div className="m3d-v9-toggle-info">
              <span className="m3d-v9-toggle-title">
                {finalizarAbierta ? "Finalizar abierta" : "Finalizar cerrada"}
              </span>
              <span className="m3d-v9-toggle-sub">
                {finalizarAbierta
                  ? "La polilínea queda exactamente como la estás trazando."
                  : "Cierra automáticamente el contorno uniendo con el 1er vértice."}
              </span>
            </div>

            <div
              className={`m3d-toggle-switch ${!finalizarAbierta ? "activo" : ""}`}
              onClick={() => setFinalizarAbierta((prev) => !prev)}
              title="Alternar polilínea abierta / cerrada"
            >
              <div className="m3d-toggle-thumb" />
            </div>
          </div>
        )}

        {/* Campo Nombre / capa */}
        <input
          type="text"
          className="m3d-v9-layer-input"
          value={nombreCapa}
          onChange={(e) => setNombreCapa(e.target.value)}
          placeholder="Nombre / capa"
        />

        {/* 5. SECCIÓN: COLOR */}
        <div className="m3d-v9-section">
          <span className="m3d-v9-sec-title" style={{ fontSize: "11px" }}>Color</span>
          <div className="m3d-v9-colors-grid">
            {COLORES_CAD_V9.map((col) => {
              const esActivo = colorSeleccionado.toLowerCase() === col.toLowerCase();
              return (
                <button
                  key={col}
                  type="button"
                  className={`btn-m3d-v9-color ${esActivo ? "activo" : ""}`}
                  style={{ background: col }}
                  onClick={() => setColorSeleccionado(col)}
                  title={col}
                >
                  {esActivo && (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botón Guardar */}
        <button
          type="button"
          className={`btn-m3d-v9-save ${botonHabilitado ? "habilitado" : ""}`}
          onClick={onGuardar}
          disabled={!botonHabilitado}
        >
          {textoBotonGuardar}
        </button>
      </div>
    </div>
  );
}
