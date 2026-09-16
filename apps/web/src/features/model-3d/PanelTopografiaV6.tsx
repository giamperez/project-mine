import React, { useMemo } from "react";
import { COLORES_CAD_V9 } from "./PanelCadModeladoV9.js";

export type TipoTopografiaV6 = "recta" | "poligono" | "infraestructura";
export type TipoInfraestructuraV6 = "plataforma" | "botadero" | "campamento" | "presa" | "acceso";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tipoActivo: TipoTopografiaV6;
  setTipoActivo: (t: TipoTopografiaV6) => void;
  etiquetaNombre: string;
  setEtiquetaNombre: (v: string) => void;
  colorTopografico: string;
  setColorTopografico: (c: string) => void;

  // Punto Inicial
  coordX1: string;
  setCoordX1: (v: string) => void;
  coordY1: string;
  setCoordY1: (v: string) => void;
  coordZ1: string;
  setCoordZ1: (v: string) => void;

  // Punto Final (para Recta)
  coordX2: string;
  setCoordX2: (v: string) => void;
  coordY2: string;
  setCoordY2: (v: string) => void;
  coordZ2: string;
  setCoordZ2: (v: string) => void;

  // Parámetros para Polígono
  verticesPoligono: string;
  setVerticesPoligono: (v: string) => void;
  cerrarPoligono: boolean;
  setCerrarPoligono: (v: boolean) => void;

  // Parámetros para Infraestructura
  tipoInfraestructura: TipoInfraestructuraV6;
  setTipoInfraestructura: (v: TipoInfraestructuraV6) => void;
  anchoInfra: string;
  setAnchoInfra: (v: string) => void;
  largoInfra: string;
  setLargoInfra: (v: string) => void;
  alturaInfra: string;
  setAlturaInfra: (v: string) => void;

  onDibujar: () => void;
}

export default function PanelTopografiaV6({
  abierto,
  onCerrar,
  tipoActivo,
  setTipoActivo,
  etiquetaNombre,
  setEtiquetaNombre,
  colorTopografico,
  setColorTopografico,
  coordX1,
  setCoordX1,
  coordY1,
  setCoordY1,
  coordZ1,
  setCoordZ1,
  coordX2,
  setCoordX2,
  coordY2,
  setCoordY2,
  coordZ2,
  setCoordZ2,
  verticesPoligono,
  setVerticesPoligono,
  cerrarPoligono,
  setCerrarPoligono,
  tipoInfraestructura,
  setTipoInfraestructura,
  anchoInfra,
  setAnchoInfra,
  largoInfra,
  setLargoInfra,
  alturaInfra,
  setAlturaInfra,
  onDibujar,
}: Props) {
  if (!abierto) return null;

  // Cálculo topográfico en tiempo real para Recta
  const calculoRecta = useMemo(() => {
    const x1 = parseFloat(coordX1);
    const y1 = parseFloat(coordY1);
    const z1 = parseFloat(coordZ1);
    const x2 = parseFloat(coordX2);
    const y2 = parseFloat(coordY2);
    const z2 = parseFloat(coordZ2);

    if (isNaN(x1) || isNaN(y1) || isNaN(z1) || isNaN(x2) || isNaN(y2) || isNaN(z2)) {
      return null;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    const distHorizontal = Math.sqrt(dx * dx + dy * dy);
    const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Azimut en grados (0° a 360° desde el Norte/Y hacia Este/X)
    let azimutRad = Math.atan2(dx, dy);
    if (azimutRad < 0) azimutRad += 2 * Math.PI;
    const azimutDeg = (azimutRad * 180) / Math.PI;

    // Rumbo cuadrantal
    let cuadrante = "";
    if (dx >= 0 && dy >= 0) {
      cuadrante = `N ${azimutDeg.toFixed(1)}° E`;
    } else if (dx >= 0 && dy < 0) {
      cuadrante = `S ${(180 - azimutDeg).toFixed(1)}° E`;
    } else if (dx < 0 && dy < 0) {
      cuadrante = `S ${(azimutDeg - 180).toFixed(1)}° O`;
    } else {
      cuadrante = `N ${(360 - azimutDeg).toFixed(1)}° O`;
    }

    const pendientePct = distHorizontal > 0 ? (dz / distHorizontal) * 100 : 0;
    const anguloInclinacion = (Math.atan2(dz, distHorizontal) * 180) / Math.PI;

    return {
      dist3D,
      distHorizontal,
      desnivel: dz,
      azimutDeg,
      cuadrante,
      pendientePct,
      anguloInclinacion,
    };
  }, [coordX1, coordY1, coordZ1, coordX2, coordY2, coordZ2]);

  return (
    <div className="m3d-panel-v6">
      {/* 1. CABECERA TOPOGRAFÍA */}
      <div className="m3d-v6-header">
        <div className="m3d-v6-titles">
          <span className="m3d-v6-title">TOPOGRAFÍA 3D</span>
          <span className="m3d-v6-sub">Rectas, polígonos e infraestructura</span>
        </div>
        <button
          type="button"
          className="btn-m3d-v6-ocultar"
          onClick={onCerrar}
          title="Ocultar panel"
        >
          Ocultar
        </button>
      </div>

      {/* 2. SELECTOR DE HERRAMIENTAS */}
      <div className="m3d-v6-tabs">
        <button
          type="button"
          className={`btn-m3d-v6-tab ${tipoActivo === "recta" ? "activo" : ""}`}
          onClick={() => setTipoActivo("recta")}
        >
          Recta
        </button>
        <button
          type="button"
          className={`btn-m3d-v6-tab ${tipoActivo === "poligono" ? "activo" : ""}`}
          onClick={() => setTipoActivo("poligono")}
        >
          Polígono
        </button>
        <button
          type="button"
          className={`btn-m3d-v6-tab ${tipoActivo === "infraestructura" ? "activo" : ""}`}
          onClick={() => setTipoActivo("infraestructura")}
        >
          Infraestructura
        </button>
      </div>

      {/* 3. INPUT ETIQUETA / NOMBRE */}
      <div className="m3d-v6-input-box">
        <input
          type="text"
          className="m3d-v6-input-field"
          value={etiquetaNombre}
          onChange={(e) => setEtiquetaNombre(e.target.value)}
          placeholder="Etiqueta / nombre"
        />
      </div>

      {/* 4. COLOR TOPOGRÁFICO */}
      <div className="m3d-v6-section">
        <span className="m3d-v6-sec-title">Color topográfico</span>
        <div className="m3d-v9-colors-grid">
          {COLORES_CAD_V9.map((col) => {
            const esActivo = colorTopografico.toLowerCase() === col.toLowerCase();
            return (
              <button
                key={col}
                type="button"
                className={`btn-m3d-v9-color ${esActivo ? "activo" : ""}`}
                style={{ background: col }}
                onClick={() => setColorTopografico(col)}
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

      {/* 5. PUNTO INICIAL */}
      <div className="m3d-v6-section">
        <span className="m3d-v6-sec-title">Punto inicial</span>
        <div className="m3d-v6-grid-2">
          <div className="m3d-v6-input-box">
            <input
              type="text"
              className="m3d-v6-input-field"
              value={coordX1}
              onChange={(e) => setCoordX1(e.target.value)}
              placeholder="X inicial"
            />
          </div>
          <div className="m3d-v6-input-box">
            <input
              type="text"
              className="m3d-v6-input-field"
              value={coordY1}
              onChange={(e) => setCoordY1(e.target.value)}
              placeholder="Y inicial"
            />
          </div>
        </div>
        <div className="m3d-v6-input-box">
          <input
            type="text"
            className="m3d-v6-input-field"
            value={coordZ1}
            onChange={(e) => setCoordZ1(e.target.value)}
            placeholder="Z inicial"
          />
        </div>
      </div>

      {/* 6. MODO RECTA: PUNTO FINAL Y CÁLCULO */}
      {tipoActivo === "recta" && (
        <>
          <div className="m3d-v6-section">
            <span className="m3d-v6-sec-title">Punto final</span>
            <div className="m3d-v6-grid-2">
              <div className="m3d-v6-input-box">
                <input
                  type="text"
                  className="m3d-v6-input-field"
                  value={coordX2}
                  onChange={(e) => setCoordX2(e.target.value)}
                  placeholder="X final"
                />
              </div>
              <div className="m3d-v6-input-box">
                <input
                  type="text"
                  className="m3d-v6-input-field"
                  value={coordY2}
                  onChange={(e) => setCoordY2(e.target.value)}
                  placeholder="Y final"
                />
              </div>
            </div>
            <div className="m3d-v6-input-box">
              <input
                type="text"
                className="m3d-v6-input-field"
                value={coordZ2}
                onChange={(e) => setCoordZ2(e.target.value)}
                placeholder="Z final"
              />
            </div>
          </div>

          {/* CARD DE RESULTADO DE RECTA */}
          <div className="m3d-v6-calc-card">
            <span className="m3d-v6-calc-title">Resultado de recta</span>
            {calculoRecta ? (
              <div className="m3d-v6-calc-results">
                <div className="m3d-v6-calc-row">
                  <span>Distancia 3D:</span>
                  <b>{calculoRecta.dist3D.toFixed(3)} m</b>
                </div>
                <div className="m3d-v6-calc-row">
                  <span>Dist. Horizontal:</span>
                  <b>{calculoRecta.distHorizontal.toFixed(3)} m</b>
                </div>
                <div className="m3d-v6-calc-row">
                  <span>Desnivel (ΔZ):</span>
                  <b style={{ color: calculoRecta.desnivel >= 0 ? "#4ade80" : "#f87171" }}>
                    {calculoRecta.desnivel >= 0 ? "+" : ""}{calculoRecta.desnivel.toFixed(3)} m
                  </b>
                </div>
                <div className="m3d-v6-calc-row">
                  <span>Azimut / Rumbo:</span>
                  <b>{calculoRecta.azimutDeg.toFixed(2)}° ({calculoRecta.cuadrante})</b>
                </div>
                <div className="m3d-v6-calc-row">
                  <span>Pendiente:</span>
                  <b>{calculoRecta.pendientePct.toFixed(2)}% ({calculoRecta.anguloInclinacion.toFixed(2)}°)</b>
                </div>
              </div>
            ) : (
              <p className="m3d-v6-calc-sub">
                Completa los dos puntos para calcular distancia, azimut y pendiente.
              </p>
            )}
          </div>
        </>
      )}

      {/* MODO POLÍGONO */}
      {tipoActivo === "poligono" && (
        <div className="m3d-v6-section">
          <span className="m3d-v6-sec-title">Vértices adicionales (X, Y, Z por línea)</span>
          <textarea
            className="m3d-v6-textarea"
            rows={3}
            value={verticesPoligono}
            onChange={(e) => setVerticesPoligono(e.target.value)}
            placeholder="Ej: 246700, 4310000, 10&#10;246750, 4310050, 12&#10;246800, 4310000, 10"
          />
          <label className="m3d-v6-checkbox-row">
            <input
              type="checkbox"
              checked={cerrarPoligono}
              onChange={(e) => setCerrarPoligono(e.target.checked)}
            />
            <span>Cerrar polígono automáticamente (crear superficie/plataforma)</span>
          </label>
        </div>
      )}

      {/* MODO INFRAESTRUCTURA */}
      {tipoActivo === "infraestructura" && (
        <div className="m3d-v6-section">
          <span className="m3d-v6-sec-title">Tipo de Infraestructura</span>
          <div className="m3d-v6-grid-2">
            <button
              type="button"
              className={`btn-m3d-v6-subtab ${tipoInfraestructura === "plataforma" ? "activo" : ""}`}
              onClick={() => setTipoInfraestructura("plataforma")}
            >
              Plataforma
            </button>
            <button
              type="button"
              className={`btn-m3d-v6-subtab ${tipoInfraestructura === "botadero" ? "activo" : ""}`}
              onClick={() => setTipoInfraestructura("botadero")}
            >
              Botadero
            </button>
            <button
              type="button"
              className={`btn-m3d-v6-subtab ${tipoInfraestructura === "campamento" ? "activo" : ""}`}
              onClick={() => setTipoInfraestructura("campamento")}
            >
              Campamento
            </button>
            <button
              type="button"
              className={`btn-m3d-v6-subtab ${tipoInfraestructura === "presa" ? "activo" : ""}`}
              onClick={() => setTipoInfraestructura("presa")}
            >
              Presa relaves
            </button>
          </div>

          <div className="m3d-v6-grid-3" style={{ marginTop: "4px" }}>
            <div className="m3d-v6-input-box">
              <span className="m3d-v6-input-label">Ancho (m)</span>
              <input
                type="text"
                className="m3d-v6-input-field"
                value={anchoInfra}
                onChange={(e) => setAnchoInfra(e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="m3d-v6-input-box">
              <span className="m3d-v6-input-label">Largo (m)</span>
              <input
                type="text"
                className="m3d-v6-input-field"
                value={largoInfra}
                onChange={(e) => setLargoInfra(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="m3d-v6-input-box">
              <span className="m3d-v6-input-label">Altura (m)</span>
              <input
                type="text"
                className="m3d-v6-input-field"
                value={alturaInfra}
                onChange={(e) => setAlturaInfra(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. BOTÓN PRINCIPAL */}
      <button
        type="button"
        className="btn-m3d-v6-create"
        onClick={onDibujar}
      >
        {tipoActivo === "recta"
          ? "Dibujar recta topográfica"
          : tipoActivo === "poligono"
          ? "Dibujar polígono topográfico"
          : "Dibujar infraestructura"}
      </button>
    </div>
  );
}
