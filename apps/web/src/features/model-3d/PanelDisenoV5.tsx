import React from "react";
import { COLORES_CAD_V9 } from "./PanelCadModeladoV9.js";

export type TipoDisenoV5 = "punto" | "linea" | "texto" | "rampa" | "labores" | "topografia";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tipoActivo: TipoDisenoV5;
  setTipoActivo: (t: TipoDisenoV5) => void;
  etiquetaNombre: string;
  setEtiquetaNombre: (v: string) => void;
  colorDiseno: string;
  setColorDiseno: (c: string) => void;

  // Coordenadas iniciales
  coordX: string;
  setCoordX: (v: string) => void;
  coordY: string;
  setCoordY: (v: string) => void;
  coordZ: string;
  setCoordZ: (v: string) => void;

  // Parámetros para Línea
  coordX2: string;
  setCoordX2: (v: string) => void;
  coordY2: string;
  setCoordY2: (v: string) => void;
  coordZ2: string;
  setCoordZ2: (v: string) => void;

  // Parámetros para Texto
  textoRotulo: string;
  setTextoRotulo: (v: string) => void;
  tamanoTexto: string;
  setTamanoTexto: (v: string) => void;

  // Parámetros para Rampa
  pendienteRampa: string;
  setPendienteRampa: (v: string) => void;
  anchoRampa: string;
  setAnchoRampa: (v: string) => void;
  radioGiroRampa: string;
  setRadioGiroRampa: (v: string) => void;
  cotaFinalRampa: string;
  setCotaFinalRampa: (v: string) => void;

  // Parámetros para Labores
  seccionLabor: "arco" | "baul" | "rectangular";
  setSeccionLabor: (v: "arco" | "baul" | "rectangular") => void;
  anchoLabor: string;
  setAnchoLabor: (v: string) => void;
  altoLabor: string;
  setAltoLabor: (v: string) => void;
  longitudLabor: string;
  setLongitudLabor: (v: string) => void;

  // Acción
  onCrearElemento: () => void;
}

export default function PanelDisenoV5({
  abierto,
  onCerrar,
  tipoActivo,
  setTipoActivo,
  etiquetaNombre,
  setEtiquetaNombre,
  colorDiseno,
  setColorDiseno,
  coordX,
  setCoordX,
  coordY,
  setCoordY,
  coordZ,
  setCoordZ,
  coordX2,
  setCoordX2,
  coordY2,
  setCoordY2,
  coordZ2,
  setCoordZ2,
  textoRotulo,
  setTextoRotulo,
  tamanoTexto,
  setTamanoTexto,
  pendienteRampa,
  setPendienteRampa,
  anchoRampa,
  setAnchoRampa,
  radioGiroRampa,
  setRadioGiroRampa,
  cotaFinalRampa,
  setCotaFinalRampa,
  seccionLabor,
  setSeccionLabor,
  anchoLabor,
  setAnchoLabor,
  altoLabor,
  setAltoLabor,
  longitudLabor,
  setLongitudLabor,
  onCrearElemento,
}: Props) {
  if (!abierto) return null;

  return (
    <div className="m3d-panel-v5">
      {/* 1. CABECERA DISEÑO */}
      <div className="m3d-v5-header">
        <div className="m3d-v5-titles">
          <span className="m3d-v5-title">DISEÑO 3D</span>
          <span className="m3d-v5-sub">Puntos, líneas, textos, rampas, labores y topografía XYZ</span>
        </div>
        <button
          type="button"
          className="btn-m3d-v5-ocultar"
          onClick={onCerrar}
          title="Ocultar panel"
        >
          Ocultar
        </button>
      </div>

      {/* 2. SELECTOR DE HERRAMIENTAS / TIPOS DE DISEÑO */}
      <div className="m3d-v5-tabs-scroll">
        <button
          type="button"
          className={`btn-m3d-v5-tab ${tipoActivo === "punto" ? "activo" : ""}`}
          onClick={() => setTipoActivo("punto")}
        >
          Punto
        </button>
        <button
          type="button"
          className={`btn-m3d-v5-tab ${tipoActivo === "linea" ? "activo" : ""}`}
          onClick={() => setTipoActivo("linea")}
        >
          Línea
        </button>
        <button
          type="button"
          className={`btn-m3d-v5-tab ${tipoActivo === "texto" ? "activo" : ""}`}
          onClick={() => setTipoActivo("texto")}
        >
          Texto
        </button>
        <button
          type="button"
          className={`btn-m3d-v5-tab ${tipoActivo === "rampa" ? "activo" : ""}`}
          onClick={() => setTipoActivo("rampa")}
        >
          Rampa
        </button>
        <button
          type="button"
          className={`btn-m3d-v5-tab ${tipoActivo === "labores" ? "activo" : ""}`}
          onClick={() => setTipoActivo("labores")}
        >
          Labores
        </button>
        <button
          type="button"
          className={`btn-m3d-v5-tab ${tipoActivo === "topografia" ? "activo" : ""}`}
          onClick={() => setTipoActivo("topografia")}
        >
          Topografía XYZ
        </button>
      </div>

      {/* BANNER INFORMATIVO */}
      <div className="m3d-v5-info-card">
        Botón ↑: importa CSV/XYZ, Excel XLSX/XLSM o KML/KMZ. Primero previsualizas, eliges hoja/columnas o superficie de apoyo y recién después decides qué enviar al proyecto.
      </div>

      {/* 3. INPUT ETIQUETA / NOMBRE */}
      <div className="m3d-v5-input-box">
        <input
          type="text"
          className="m3d-v5-input-field"
          value={etiquetaNombre}
          onChange={(e) => setEtiquetaNombre(e.target.value)}
          placeholder="Etiqueta / nombre"
        />
      </div>

      {/* 4. COLOR DE DISEÑO */}
      <div className="m3d-v5-section">
        <span className="m3d-v5-sec-title">Color de diseño</span>
        <div className="m3d-v9-colors-grid">
          {COLORES_CAD_V9.map((col) => {
            const esActivo = colorDiseno.toLowerCase() === col.toLowerCase();
            return (
              <button
                key={col}
                type="button"
                className={`btn-m3d-v9-color ${esActivo ? "activo" : ""}`}
                style={{ background: col }}
                onClick={() => setColorDiseno(col)}
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

      {/* 5. COORDENADA INICIAL */}
      <div className="m3d-v5-section">
        <span className="m3d-v5-sec-title">Coordenada inicial</span>
        <div className="m3d-v5-grid-2">
          <div className="m3d-v5-input-box">
            <input
              type="text"
              className="m3d-v5-input-field"
              value={coordX}
              onChange={(e) => setCoordX(e.target.value)}
              placeholder="X / Este"
            />
          </div>
          <div className="m3d-v5-input-box">
            <input
              type="text"
              className="m3d-v5-input-field"
              value={coordY}
              onChange={(e) => setCoordY(e.target.value)}
              placeholder="Y / Norte"
            />
          </div>
        </div>

        <div className="m3d-v5-input-box">
          <input
            type="text"
            className="m3d-v5-input-field"
            value={coordZ}
            onChange={(e) => setCoordZ(e.target.value)}
            placeholder="Z / Cota"
          />
        </div>
      </div>

      {/* PARÁMETROS ESPECÍFICOS SEGÚN HERRAMIENTA */}
      {tipoActivo === "linea" && (
        <div className="m3d-v5-section">
          <span className="m3d-v5-sec-title">Coordenada final</span>
          <div className="m3d-v5-grid-2">
            <div className="m3d-v5-input-box">
              <input
                type="text"
                className="m3d-v5-input-field"
                value={coordX2}
                onChange={(e) => setCoordX2(e.target.value)}
                placeholder="X2 / Este"
              />
            </div>
            <div className="m3d-v5-input-box">
              <input
                type="text"
                className="m3d-v5-input-field"
                value={coordY2}
                onChange={(e) => setCoordY2(e.target.value)}
                placeholder="Y2 / Norte"
              />
            </div>
          </div>
          <div className="m3d-v5-input-box">
            <input
              type="text"
              className="m3d-v5-input-field"
              value={coordZ2}
              onChange={(e) => setCoordZ2(e.target.value)}
              placeholder="Z2 / Cota final"
            />
          </div>
        </div>
      )}

      {tipoActivo === "texto" && (
        <div className="m3d-v5-section">
          <span className="m3d-v5-sec-title">Parámetros del rótulo 3D</span>
          <div className="m3d-v5-input-box">
            <input
              type="text"
              className="m3d-v5-input-field"
              value={textoRotulo}
              onChange={(e) => setTextoRotulo(e.target.value)}
              placeholder="Texto de la anotación 3D"
            />
          </div>
          <div className="m3d-v5-input-box">
            <span className="m3d-v5-input-label">Tamaño relativo (m)</span>
            <input
              type="text"
              className="m3d-v5-input-field"
              value={tamanoTexto}
              onChange={(e) => setTamanoTexto(e.target.value)}
              placeholder="3.0"
            />
          </div>
        </div>
      )}

      {tipoActivo === "rampa" && (
        <div className="m3d-v5-section">
          <span className="m3d-v5-sec-title">Diseño de rampa minera</span>
          <div className="m3d-v5-grid-2">
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Pendiente (%)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={pendienteRampa}
                onChange={(e) => setPendienteRampa(e.target.value)}
                placeholder="10.0"
              />
            </div>
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Ancho de vía (m)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={anchoRampa}
                onChange={(e) => setAnchoRampa(e.target.value)}
                placeholder="5.0"
              />
            </div>
          </div>
          <div className="m3d-v5-grid-2">
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Radio de giro (m)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={radioGiroRampa}
                onChange={(e) => setRadioGiroRampa(e.target.value)}
                placeholder="15.0"
              />
            </div>
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Cota objetivo (m)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={cotaFinalRampa}
                onChange={(e) => setCotaFinalRampa(e.target.value)}
                placeholder="-15.0"
              />
            </div>
          </div>
        </div>
      )}

      {tipoActivo === "labores" && (
        <div className="m3d-v5-section">
          <span className="m3d-v5-sec-title">Sección y trazado de labor / galería</span>
          <div className="m3d-v5-grid-3">
            <button
              type="button"
              className={`btn-m3d-v5-tab ${seccionLabor === "baul" ? "activo" : ""}`}
              onClick={() => setSeccionLabor("baul")}
            >
              Baúl
            </button>
            <button
              type="button"
              className={`btn-m3d-v5-tab ${seccionLabor === "arco" ? "activo" : ""}`}
              onClick={() => setSeccionLabor("arco")}
            >
              Herradura
            </button>
            <button
              type="button"
              className={`btn-m3d-v5-tab ${seccionLabor === "rectangular" ? "activo" : ""}`}
              onClick={() => setSeccionLabor("rectangular")}
            >
              Rectangular
            </button>
          </div>
          <div className="m3d-v5-grid-3" style={{ marginTop: "4px" }}>
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Ancho (m)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={anchoLabor}
                onChange={(e) => setAnchoLabor(e.target.value)}
                placeholder="3.5"
              />
            </div>
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Alto (m)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={altoLabor}
                onChange={(e) => setAltoLabor(e.target.value)}
                placeholder="3.5"
              />
            </div>
            <div className="m3d-v5-input-box">
              <span className="m3d-v5-input-label">Largo (m)</span>
              <input
                type="text"
                className="m3d-v5-input-field"
                value={longitudLabor}
                onChange={(e) => setLongitudLabor(e.target.value)}
                placeholder="25.0"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. BOTÓN PRINCIPAL DE CREACIÓN */}
      <button
        type="button"
        className="btn-m3d-v5-create"
        onClick={onCrearElemento}
      >
        Crear {tipoActivo.toUpperCase()} y añadir al modelo 3D
      </button>
    </div>
  );
}
