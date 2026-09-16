import React from "react";
import { COLORES_CAD_V9 } from "./PanelCadModeladoV9.js";

interface Props {
  abierto: boolean;
  onCerrar: () => void;

  // 1. Plano visible de cota
  planoVisibleCota: boolean;
  setPlanoVisibleCota: (v: boolean | ((prev: boolean) => boolean)) => void;
  opacidadPlanoCota: number; // 0 a 100
  setOpacidadPlanoCota: (v: number) => void;
  colorPlanoCota: string;
  setColorPlanoCota: (c: string) => void;

  // 2. Curvas por intervalo
  curvasIntervaloActivo: boolean;
  setCurvasIntervaloActivo: (v: boolean | ((prev: boolean) => boolean)) => void;
  intervaloMetros: string;
  setIntervaloMetros: (v: string) => void;
  onAplicarCurvasNivel: () => void;

  // 3. Consulta de cota
  cotaResaltar: string;
  setCotaResaltar: (v: string) => void;
  cotaActivaInfo: string | null;
  onMarcarCota: () => void;
  onQuitarCota: () => void;

  // 4. Recortar modelo de bloques
  radioBusquedaBloques: string;
  setRadioBusquedaBloques: (v: string) => void;
  hayBloquesCargados: boolean;
  onRecortarBloques: () => void;

  // 5. Ubícate por coordenadas
  coordX: string;
  setCoordX: (v: string) => void;
  coordY: string;
  setCoordY: (v: string) => void;
  coordZ: string;
  setCoordZ: (v: string) => void;
  onMarcarCoordenada: () => void;
  onQuitarCoordenada: () => void;

  // 6. Envolvente mineral & Calcular sólido
  envolventeMineralActivo: boolean;
  setEnvolventeMineralActivo: (v: boolean | ((prev: boolean) => boolean)) => void;
  densidadMineral: string;
  setDensidadMineral: (v: string) => void;
  onCalcularYMostrarSolido: () => void;
}

export default function PanelHerramientasV4({
  abierto,
  onCerrar,
  planoVisibleCota,
  setPlanoVisibleCota,
  opacidadPlanoCota,
  setOpacidadPlanoCota,
  colorPlanoCota,
  setColorPlanoCota,
  curvasIntervaloActivo,
  setCurvasIntervaloActivo,
  intervaloMetros,
  setIntervaloMetros,
  onAplicarCurvasNivel,
  cotaResaltar,
  setCotaResaltar,
  cotaActivaInfo,
  onMarcarCota,
  onQuitarCota,
  radioBusquedaBloques,
  setRadioBusquedaBloques,
  hayBloquesCargados,
  onRecortarBloques,
  coordX,
  setCoordX,
  coordY,
  setCoordY,
  coordZ,
  setCoordZ,
  onMarcarCoordenada,
  onQuitarCoordenada,
  envolventeMineralActivo,
  setEnvolventeMineralActivo,
  densidadMineral,
  setDensidadMineral,
  onCalcularYMostrarSolido,
}: Props) {
  if (!abierto) return null;

  return (
    <div className="m3d-panel-v4">
      {/* 1. CABECERA HERRAMIENTAS */}
      <div className="m3d-v4-header">
        <div className="m3d-v4-titles">
          <span className="m3d-v4-title">HERRAMIENTAS 3D</span>
          <span className="m3d-v4-sub">Plano, cotas, ubicación y envolvente</span>
        </div>
        <button
          type="button"
          className="btn-m3d-v4-ocultar"
          onClick={onCerrar}
          title="Ocultar panel"
        >
          Ocultar
        </button>
      </div>

      <div className="m3d-panel-v4-divider" />

      {/* SECCIÓN 1: PLANO VISIBLE DE COTA */}
      <div className="m3d-v4-section">
        <div className="m3d-v4-toggle-row">
          <div className="m3d-v4-toggle-info">
            <span className="m3d-v4-toggle-title">Plano visible de cota</span>
            <span className="m3d-v4-toggle-sub">Color y opacidad del plano de corte.</span>
          </div>
          <div
            className={`m3d-toggle-switch ${planoVisibleCota ? "activo" : ""}`}
            onClick={() => setPlanoVisibleCota((prev) => !prev)}
            title="Activar o desactivar plano visible de cota"
          >
            <div className="m3d-toggle-thumb" />
          </div>
        </div>

        {/* Slider de opacidad */}
        <div className="m3d-v4-slider-item" style={{ marginTop: "4px" }}>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={opacidadPlanoCota}
            onChange={(e) => setOpacidadPlanoCota(parseInt(e.target.value, 10))}
            className="m3d-v4-range"
            style={{
              background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${opacidadPlanoCota}%, #381228 ${opacidadPlanoCota}%, #381228 100%)`,
            }}
          />
        </div>

        {/* Color del plano */}
        <span className="m3d-v4-sub-label" style={{ marginTop: "8px" }}>Color del plano</span>
        <div className="m3d-v9-colors-grid">
          {COLORES_CAD_V9.map((col) => {
            const esActivo = colorPlanoCota.toLowerCase() === col.toLowerCase();
            return (
              <button
                key={col}
                type="button"
                className={`btn-m3d-v9-color ${esActivo ? "activo" : ""}`}
                style={{ background: col }}
                onClick={() => setColorPlanoCota(col)}
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
        <p className="m3d-v4-help-text">
          El color se elige tocando la paleta; la opacidad se regula con el deslizador.
        </p>
      </div>

      <div className="m3d-panel-v4-divider" />

      {/* SECCIÓN 2: CURVAS POR INTERVALO */}
      <div className="m3d-v4-section">
        <div className="m3d-v4-toggle-row">
          <div className="m3d-v4-toggle-info">
            <span className="m3d-v4-toggle-title">Curvas por intervalo</span>
            <span className="m3d-v4-toggle-sub">
              Mantiene las líneas de cota sobre la topografía. El número exacto se consulta resaltando una cota, sin llenar la escena de textos.
            </span>
          </div>
          <div
            className={`m3d-toggle-switch ${curvasIntervaloActivo ? "activo" : ""}`}
            onClick={() => setCurvasIntervaloActivo((prev) => !prev)}
            title="Activar o desactivar curvas por intervalo"
          >
            <div className="m3d-toggle-thumb" />
          </div>
        </div>

        <div className="m3d-v4-input-box">
          <span className="m3d-v4-input-label">Cada cuántos metros</span>
          <input
            type="text"
            className="m3d-v4-input-field"
            value={intervaloMetros}
            onChange={(e) => setIntervaloMetros(e.target.value)}
            placeholder="5.000"
          />
        </div>

        <button
          type="button"
          className="btn-m3d-v4-primary"
          onClick={onAplicarCurvasNivel}
        >
          Aplicar curvas de nivel
        </button>
      </div>

      <div className="m3d-panel-v4-divider" />

      {/* SECCIÓN 3: CONSULTA DE COTA */}
      <div className="m3d-v4-section">
        <span className="m3d-v4-sec-title">Consulta de cota</span>
        <p className="m3d-v4-info-text">
          Escribe cualquier cota, incluso decimal. Si no coincide con el intervalo, la app crea esa curva exacta en dorado dentro de la misma herramienta.
        </p>

        <div className="m3d-v4-input-box">
          <input
            type="text"
            className="m3d-v4-input-field"
            value={cotaResaltar}
            onChange={(e) => setCotaResaltar(e.target.value)}
            placeholder="Cota a resaltar"
          />
        </div>

        <div className="m3d-v4-grid-2-btns">
          <button
            type="button"
            className="btn-m3d-v4-primary"
            onClick={onMarcarCota}
          >
            Marcar cota
          </button>
          <button
            type="button"
            className="btn-m3d-v4-secondary"
            onClick={onQuitarCota}
          >
            Quitar
          </button>
        </div>

        <p className="m3d-v4-status-note">
          {cotaActivaInfo || "Sin cota activa. Escribe una elevación y pulsa Marcar cota."}
        </p>
      </div>

      <div className="m3d-panel-v4-divider" />

      {/* SECCIÓN 4: RECORTAR MODELO DE BLOQUES POR TOPOGRAFÍA */}
      <div className="m3d-v4-section">
        <span className="m3d-v4-sec-title">Recortar modelo de bloques por topografía</span>
        <p className="m3d-v4-info-text">
          Crea una copia del modelo y elimina/ajusta los bloques que quedan por encima de la superficie. No borra el modelo original.
        </p>

        <div className="m3d-v4-block-status">
          <strong>Modelo de bloques</strong>
          <span>{hayBloquesCargados ? "Modelo de bloques cargado en escena." : "No hay modelos de bloques cargados."}</span>
        </div>

        <div className="m3d-v4-input-box" style={{ marginTop: "6px" }}>
          <span className="m3d-v4-input-label">Radio búsqueda superficie m</span>
          <input
            type="text"
            className="m3d-v4-input-field"
            value={radioBusquedaBloques}
            onChange={(e) => setRadioBusquedaBloques(e.target.value)}
            placeholder="30"
          />
        </div>

        <button
          type="button"
          className="btn-m3d-v4-dark"
          onClick={onRecortarBloques}
        >
          Recortar bloques bajo topografía
        </button>
      </div>

      <div className="m3d-panel-v4-divider" />

      {/* SECCIÓN 5: UBÍCATE POR COORDENADAS */}
      <div className="m3d-v4-section">
        <span className="m3d-v4-sec-title">Ubícate por coordenadas</span>
        <p className="m3d-v4-info-text">
          Inserta X/Y/Z y se marca con una silueta técnica.
        </p>

        <div className="m3d-v4-input-box">
          <input
            type="text"
            className="m3d-v4-input-field"
            value={coordX}
            onChange={(e) => setCoordX(e.target.value)}
            placeholder="X / Este"
          />
        </div>

        <div className="m3d-v4-input-box">
          <input
            type="text"
            className="m3d-v4-input-field"
            value={coordY}
            onChange={(e) => setCoordY(e.target.value)}
            placeholder="Y / Norte"
          />
        </div>

        <div className="m3d-v4-input-box">
          <input
            type="text"
            className="m3d-v4-input-field"
            value={coordZ}
            onChange={(e) => setCoordZ(e.target.value)}
            placeholder="Z / Cota"
          />
        </div>

        <div className="m3d-v4-grid-2-btns">
          <button
            type="button"
            className="btn-m3d-v4-primary"
            onClick={onMarcarCoordenada}
          >
            Marcar
          </button>
          <button
            type="button"
            className="btn-m3d-v4-secondary"
            onClick={onQuitarCoordenada}
          >
            Quitar
          </button>
        </div>
      </div>

      <div className="m3d-panel-v4-divider" />

      {/* SECCIÓN 6: ENVOLVENTE MINERAL & CALCULAR Y MOSTRAR SÓLIDO */}
      <div className="m3d-v4-section">
        <div className="m3d-v4-toggle-row">
          <div className="m3d-v4-toggle-info">
            <span className="m3d-v4-toggle-title">Envolvente mineral</span>
            <span className="m3d-v4-toggle-sub">
              Simulación visual preliminar con la variable y cut-off actuales.
            </span>
          </div>
          <div
            className={`m3d-toggle-switch ${envolventeMineralActivo ? "activo" : ""}`}
            onClick={() => setEnvolventeMineralActivo((prev) => !prev)}
            title="Activar o desactivar envolvente mineral"
          >
            <div className="m3d-toggle-thumb" />
          </div>
        </div>

        <div className="m3d-v4-input-box">
          <span className="m3d-v4-input-label">Peso específico / densidad</span>
          <input
            type="text"
            className="m3d-v4-input-field"
            value={densidadMineral}
            onChange={(e) => setDensidadMineral(e.target.value)}
            placeholder="2.700"
          />
        </div>

        {/* Botón final solicitado por el usuario: Calcular y mostrar sólido */}
        <button
          type="button"
          className="btn-m3d-v4-calculate"
          onClick={onCalcularYMostrarSolido}
        >
          Calcular y mostrar sólido
        </button>
      </div>
    </div>
  );
}
