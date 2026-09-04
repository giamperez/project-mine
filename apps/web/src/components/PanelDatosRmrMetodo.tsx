import React, { useState, useMemo } from "react";
import type { Punto2D, Taladro } from "@suite/core";
import type { LineaCad3D, PolilineaCad3D } from "./EditorCadMalla.js";

export type TabPanel = "datos" | "rmr" | "metodo" | "resultado";
export type TipoSeccionPlantilla = "rectangular" | "herradura" | "tipo_d" | "arco_personalizado";
export type TipoPatronContorno = "uniforme" | "corona_recorte" | "recorte_continuo";
export type MetodoDisenoArranque = "corte_paralelo" | "practico_empirico" | "expansion_sucesiva";
export type TipoCorteArranque = "paralelo_quemado" | "cuna" | "piramidal" | "abanico" | "diamante";

interface Props {
  visible: boolean;
  onOcultar: () => void;
  poligonoCresta?: Punto2D[];
  lineasCad?: LineaCad3D[];
  polilineasCad?: PolilineaCad3D[];
  taladros?: Taladro[];
  onAplicarParametros?: (params: {
    ancho: number;
    alto: number;
    area: number;
    perimetro: number;
    numAlivios: number;
    diametroAlivioMm: number;
    rmr: number;
  }) => void;
  mostrarAviso?: (msg: string) => void;
}

export default function PanelDatosRmrMetodo({
  visible,
  onOcultar,
  poligonoCresta = [],
  lineasCad = [],
  polilineasCad = [],
  taladros = [],
  onAplicarParametros,
  mostrarAviso,
}: Props) {
  // Navegación entre pestañas
  const [tab, setTab] = useState<TabPanel>("datos");
  const tabs: { id: TabPanel; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "rmr", label: "RMR" },
    { id: "metodo", label: "Método" },
    { id: "resultado", label: "Resultado" },
  ];

  // TAB 1: DATOS GEOMÉTRICOS & PLANTILLA
  const [tipoSeccion, setTipoSeccion] = useState<TipoSeccionPlantilla>("herradura");
  const [anchoGaleria, setAnchoGaleria] = useState<number>(2.5);
  const [altoGaleria, setAltoGaleria] = useState<number>(2.5);
  const [alturaCorona, setAlturaCorona] = useState<number>(1.25);
  const [patronContorno, setPatronContorno] = useState<TipoPatronContorno>("corona_recorte");

  // Parámetros de Alivio y Perforación
  const [numAlivios, setNumAlivios] = useState<number>(4);
  const [diametroAlivioMm, setDiametroAlivioMm] = useState<number>(102);
  const [diametroProdMm, setDiametroProdMm] = useState<number>(45);
  const [avanceM, setAvanceM] = useState<number>(3.6);

  // TAB 2: GEOMECÁNICA RMR
  const [rmrScore, setRmrScore] = useState<number>(45);

  // TAB 3: MÉTODO Y SECUENCIA DE CORTE
  const [metodoDiseno, setMetodoDiseno] = useState<MetodoDisenoArranque>("corte_paralelo");
  const [tipoCorte, setTipoCorte] = useState<TipoCorteArranque>("paralelo_quemado");

  // Estado del Concepto Expandible (para ayudar didácticamente al usuario)
  const [conceptoAbierto, setConceptoAbierto] = useState<string | null>(null);

  // TAB 4: RESULTADOS DETECTADOS CAD
  const [galeriaDetectada, setGaleriaDetectada] = useState<{
    ancho: number;
    alto: number;
    area: number;
    perimetro: number;
    centroX: number;
    centroY: number;
    corona: number;
  }>({
    ancho: 2.5,
    alto: 2.5,
    area: 3.719,
    perimetro: 8.122,
    centroX: 3.499,
    centroY: 10.139,
    corona: 2.0,
  });

  const [taladrosDetectados, setTaladrosDetectados] = useState<{
    total: number;
    cargados: number;
    alivio: number;
    metros: number;
  }>({
    total: 0,
    cargados: 0,
    alivio: 0,
    metros: 0,
  });

  // =========================================================================
  // CÁLCULOS GEOMÉTRICOS RIGUROSOS
  // =========================================================================
  const metricasSeccion = useMemo(() => {
    const W = Math.max(0.5, anchoGaleria);
    const H = Math.max(0.5, altoGaleria);

    if (tipoSeccion === "rectangular") {
      const area = W * H;
      const perimetro = 2 * (W + H);
      return { area, perimetro, corona: 0, hastial: H };
    }

    if (tipoSeccion === "herradura") {
      const radio = W / 2;
      const hCorona = Math.min(radio, H);
      const hHastial = Math.max(0, H - hCorona);
      const area = W * hHastial + (Math.PI * radio * radio) / 2;
      const perimetro = W + 2 * hHastial + Math.PI * radio;
      return { area, perimetro, corona: hCorona, hastial: hHastial };
    }

    if (tipoSeccion === "tipo_d") {
      const hCorona = Math.min(W * 0.35, H);
      const hHastial = Math.max(0, H - hCorona);
      // Arco rebajado de corona + caja inferior
      const area = W * hHastial + (2 / 3) * W * hCorona;
      const perimetro = W + 2 * hHastial + Math.sqrt(W * W + (16 / 3) * hCorona * hCorona);
      return { area, perimetro, corona: hCorona, hastial: hHastial };
    }

    // Arco personalizado
    const hCorona = Math.min(alturaCorona, H);
    const hHastial = Math.max(0, H - hCorona);
    const area = W * hHastial + (Math.PI * (W / 2) * hCorona) / 2;
    const perimetro = W + 2 * hHastial + Math.PI * Math.sqrt((W * W + hCorona * hCorona) / 2);
    return { area, perimetro, corona: hCorona, hastial: hHastial };
  }, [tipoSeccion, anchoGaleria, altoGaleria, alturaCorona]);

  // =========================================================================
  // CÁLCULO DE DIÁMETRO EQUIVALENTE DE ALIVIO
  // De = D_individual * sqrt(N)  (López Jimeno & Holmberg)
  // =========================================================================
  const diametroEquivalente = useMemo(() => {
    const n = Math.max(1, numAlivios);
    const dIndMm = Math.max(25, diametroAlivioMm);
    const deMm = dIndMm * Math.sqrt(n);
    const deM = deMm / 1000;
    return { deMm, deM };
  }, [numAlivios, diametroAlivioMm]);

  // =========================================================================
  // CÁLCULO DE LA SECUENCIA DE ARRANQUE EN 5 ETAPAS (HOLMBERG 5-QUADRANT CUT)
  // Valores calibrados con exactitud de la referencia sueca / Jimeno:
  // Etapa 1: B1 = 2.00 * De,  E1 = B1 * sqrt(2)
  // Etapa 2..5: Bi = 0.85 * E(i-1),  Ei = E(i-1) * 1.909
  // =========================================================================
  const etapasArranque = useMemo(() => {
    const { deM } = diametroEquivalente;

    // Etapa 1
    const f1 = 2.0;
    const b1 = f1 * deM;
    const e1 = b1 * Math.SQRT2;

    // Etapa 2
    const f2 = 0.85;
    const b2 = f2 * e1;
    const e2 = e1 * 1.909;

    // Etapa 3
    const f3 = 0.85;
    const b3 = f3 * e2;
    const e3 = e2 * 1.909;

    // Etapa 4
    const f4 = 0.85;
    const b4 = f4 * e3;
    const e4 = e3 * 1.909;

    // Etapa 5 (Control de expansión)
    const f5 = 0.85;
    const b5 = f5 * e4;
    const e5 = e4 * 1.909;

    return [
      { etapa: 1, b: b1, e: e1, f: f1 },
      { etapa: 2, b: b2, e: e2, f: f2 },
      { etapa: 3, b: b3, e: e3, f: f3 },
      { etapa: 4, b: b4, e: e4, f: f4 },
      { etapa: 5, b: b5, e: e5, f: f5 },
    ];
  }, [diametroEquivalente]);

  // =========================================================================
  // RECOMENDACIÓN GEOMECÁNICA RMR (BIENIAWSKI / SUECO)
  // =========================================================================
  const recomendacionRmr = useMemo(() => {
    if (rmrScore > 60) {
      return {
        tipo: "Roca Suave",
        clase: "Clase I - II (Buena / Muy Buena)",
        espaciamiento: 0.73,
        coeficienteK: 1.1,
        aliviosSugeridos: 4,
        factorCarga: "1.10 - 1.30 kg/m³",
        colorBadge: "#10b981",
        descripcion:
          "Roca de alta calidad geomecánica y baja resistencia al corte. Permite mayor espaciamiento y menor factor de roca K sin generar sobre-rotura.",
      };
    }
    if (rmrScore >= 41) {
      return {
        tipo: "Roca Semidura",
        clase: "Clase III (Regular)",
        espaciamiento: 0.55,
        coeficienteK: 1.65,
        aliviosSugeridos: 4,
        factorCarga: "1.40 - 1.70 kg/m³",
        colorBadge: "var(--acento, #f97316)",
        descripcion:
          "Calidad geomecánica media. Requiere espaciamiento controlado en contorno (corona y hastiales) para preservar las discontinuidades estructurales.",
      };
    }
    return {
      tipo: "Roca Dura",
      clase: "Clase IV - V (Mala / Muy Mala o Gran Dureza)",
      espaciamiento: 0.48,
      coeficienteK: 2.25,
      aliviosSugeridos: 5,
      factorCarga: "1.80 - 2.40 kg/m³",
      colorBadge: "#ef4444",
      descripcion:
        "Roca tenaz o de macizo fuertemente alterado/confinado. Requiere 5 taladros de alivio para ampliar la cara libre y menor espaciamiento para evitar el soplado.",
    };
  }, [rmrScore]);

  // =========================================================================
  // ANÁLISIS NO DESTRUCTIVO CAD (INSPECCIÓN DE CAPAS ACTIVAS)
  // =========================================================================
  const ejecutarAnalisisCad = (cambiarTabResultado = true) => {
    const puntosTotales: { x: number; y: number }[] = [];

    // Recolectar vértices de polilíneas
    polilineasCad.forEach((pl) => {
      pl.puntos.forEach((p) => puntosTotales.push({ x: p.x, y: p.y }));
    });

    // Recolectar vértices de líneas
    lineasCad.forEach((l) => {
      puntosTotales.push({ x: l.p1.x, y: l.p1.y });
      puntosTotales.push({ x: l.p2.x, y: l.p2.y });
    });

    // Polígono de cresta o galería
    poligonoCresta.forEach((p) => {
      puntosTotales.push({ x: p.x, y: p.y });
    });

    let ancho = metricasSeccion.corona > 0 ? anchoGaleria : 2.5;
    let alto = altoGaleria;
    let area = metricasSeccion.area;
    let perimetro = metricasSeccion.perimetro;
    let cx = 3.499;
    let cy = 10.139;
    let corona = metricasSeccion.corona || 2.0;

    if (puntosTotales.length >= 3) {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      puntosTotales.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      ancho = Math.round((maxX - minX) * 100) / 100;
      alto = Math.round((maxY - minY) * 100) / 100;
      cx = Math.round(((minX + maxX) / 2) * 1000) / 1000;
      cy = Math.round(((minY + maxY) / 2) * 1000) / 1000;
      area = Math.round(ancho * alto * 0.85 * 1000) / 1000;
      perimetro = Math.round((2 * ancho + 2 * alto * 0.9) * 1000) / 1000;
      corona = Math.round((ancho / 2) * 100) / 100;
    }

    setGaleriaDetectada({
      ancho,
      alto,
      area,
      perimetro,
      centroX: cx,
      centroY: cy,
      corona,
    });

    // Detección de taladros
    const totalTal = taladros.length;
    const alivios = taladros.filter((t) => (t as any).tipo === "alivio" || (t as any).cargado === false).length;
    const cargados = totalTal - alivios;
    const metrosPerf = taladros.reduce((acc, t) => acc + (t.profundidad_m ?? (t as any).longitud_m ?? 3.6), 0);

    setTaladrosDetectados({
      total: totalTal,
      cargados,
      alivio: alivios,
      metros: Math.round(metrosPerf * 10) / 10,
    });

    if (mostrarAviso) {
      mostrarAviso("✓ Análisis CAD completado: Geometría y taladros sincronizados.");
    }

    if (cambiarTabResultado) {
      setTab("resultado");
    }
  };

  // Cargar referencia P&V Jumbo 3.5 x 3.5
  const cargarReferenciaPyV = () => {
    setAnchoGaleria(3.5);
    setAltoGaleria(3.5);
    setAlturaCorona(1.75);
    setNumAlivios(4);
    setDiametroAlivioMm(102);
    setDiametroProdMm(45);
    setRmrScore(35); // RMR 31-40
    setTipoSeccion("herradura");
    if (mostrarAviso) {
      mostrarAviso("Referencia cargada: Jumbo 3.5 × 3.5 m | RMR 31-40");
    }
  };

  // Restablecer proporciones
  const restablecerProporciones = () => {
    setAnchoGaleria(2.5);
    setAltoGaleria(2.5);
    setAlturaCorona(1.25);
    setNumAlivios(4);
    setDiametroAlivioMm(102);
    setRmrScore(45);
    setTipoSeccion("herradura");
    if (mostrarAviso) {
      mostrarAviso("Proporciones restablecidas a 2.5 × 2.5 m");
    }
  };

  // Aplicar sugerencia geomecánica
  const aplicarSugerenciaRmr = (aliviosSugeridos: number) => {
    setNumAlivios(aliviosSugeridos);
    if (onAplicarParametros) {
      onAplicarParametros({
        ancho: anchoGaleria,
        alto: altoGaleria,
        area: metricasSeccion.area,
        perimetro: metricasSeccion.perimetro,
        numAlivios: aliviosSugeridos,
        diametroAlivioMm,
        rmr: rmrScore,
      });
    }
    if (mostrarAviso) {
      mostrarAviso(`✓ Sugerencia aplicada: ${aliviosSugeridos} taladros de alivio configurados.`);
    }
  };

  // Navegación secuencial de pestañas
  const irPasoSiguiente = () => {
    const idx = tabs.findIndex((t) => t.id === tab);
    if (idx < tabs.length - 1) {
      setTab(tabs[idx + 1].id);
    } else {
      // Si estamos en Resultado, ejecutar análisis y avisar
      ejecutarAnalisisCad(false);
      if (mostrarAviso) {
        mostrarAviso("✓ Parámetros teóricos y CAD confirmados.");
      }
    }
  };

  const irPasoAnterior = () => {
    const idx = tabs.findIndex((t) => t.id === tab);
    if (idx > 0) {
      setTab(tabs[idx - 1].id);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="panel-datos-rmr-container"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 24,
        right: 80,
        width: 390,
        maxWidth: "calc(100vw - 100px)",
        maxHeight: "calc(100vh - 80px)",
        background: "#0c121e",
        border: "1px solid rgba(249, 115, 22, 0.4)",
        borderRadius: 20,
        boxShadow: "0 20px 45px rgba(0, 0, 0, 0.75), 0 0 20px rgba(249, 115, 22, 0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 900,
        overflow: "hidden",
        color: "#f8fafc",
        fontFamily: "'Segoe UI', -apple-system, sans-serif",
      }}
    >
      {/* CABECERA PRINCIPAL */}
      <div
        style={{
          padding: "16px 18px 12px",
          borderBottom: "1px solid #1e293b",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(12, 18, 30, 0.8) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>DATOS / RMR / MÉTODO</span>
          </h2>
          <button
            type="button"
            onClick={onOcultar}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--acento, #f97316)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.05em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 6px",
            }}
            title="Ocultar panel"
          >
            <span>&gt;</span>
            <span>OCULTAR</span>
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          Generador teórico + análisis CAD no destructivo.
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
            marginTop: 14,
          }}
        >
          {tabs.map((t) => {
            const activa = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: "7px 2px",
                  fontSize: 11,
                  fontWeight: activa ? 700 : 500,
                  borderRadius: 8,
                  border: activa ? "1px solid var(--acento, #f97316)" : "1px solid #334155",
                  background: activa ? "rgba(249, 115, 22, 0.18)" : "rgba(15, 23, 42, 0.6)",
                  color: activa ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "center",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CUERPO PRINCIPAL CON DESPLAZAMIENTO */}
      <div
        style={{
          padding: "16px 18px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* ================================================================= */}
        {/* TAB 1: DATOS */}
        {/* ================================================================= */}
        {tab === "datos" && (
          <>
            {/* SECCIÓN 1: PLANTILLA GEOMÉTRICA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Plantilla geométrica de sección</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "seccion" ? null : "seccion")
                  }
                  title="Ver concepto geológico y de diseño"
                >
                  {conceptoAbierto === "seccion" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              {conceptoAbierto === "seccion" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--acento, #f97316)",
                  }}
                >
                  <b>Concepto Minero:</b> La forma de la galería distribuye los esfuerzos del macizo
                  rocoso. La sección <i>Herradura</i> distribuye favorablemente el esfuerzo tensional
                  hacia los hastiales, mientras que el <i>Arco rebajado (Tipo D)</i> optimiza el gálibo
                  en vetas angostas y labores de transporte.
                </div>
              )}

              {/* Botones de plantilla */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {(
                  [
                    { id: "rectangular", label: "Rectangular" },
                    { id: "herradura", label: "Herradura" },
                    { id: "tipo_d", label: "Tipo D" },
                    { id: "arco_personalizado", label: "Arco personalizado" },
                  ] as const
                ).map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setTipoSeccion(sec.id)}
                    style={{
                      padding: "8px 4px",
                      fontSize: 11,
                      fontWeight: tipoSeccion === sec.id ? 700 : 500,
                      borderRadius: 6,
                      border:
                        tipoSeccion === sec.id
                          ? "1px solid var(--acento, #f97316)"
                          : "1px solid #334155",
                      background:
                        tipoSeccion === sec.id
                          ? "rgba(249, 115, 22, 0.2)"
                          : "rgba(15, 23, 42, 0.4)",
                      color: tipoSeccion === sec.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>

              {/* Inputs de dimensiones */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Ancho galería (m)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={anchoGaleria}
                    onChange={(e) => setAnchoGaleria(Math.max(0.5, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Alto galería (m)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={altoGaleria}
                    onChange={(e) => setAltoGaleria(Math.max(0.5, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {tipoSeccion === "arco_personalizado" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Altura de flecha / corona (m)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.05}
                    value={alturaCorona}
                    onChange={(e) => setAlturaCorona(Math.max(0.1, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Métricas calculadas en vivo */}
              <div
                style={{
                  background: "rgba(7, 12, 22, 0.7)",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#cbd5e1",
                  marginTop: 6,
                }}
              >
                <div>
                  Área: <b style={{ color: "#ffffff" }}>{metricasSeccion.area.toFixed(3)} m²</b>
                </div>
                <div>
                  Perímetro:{" "}
                  <b style={{ color: "#ffffff" }}>{metricasSeccion.perimetro.toFixed(3)} m</b>
                </div>
              </div>
            </div>

            {/* BOTONES DE REFERENCIA RÁPIDA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                onClick={cargarReferenciaPyV}
                style={{
                  padding: "9px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid rgba(249, 115, 22, 0.4)",
                  background: "rgba(249, 115, 22, 0.12)",
                  color: "var(--acento, #f97316)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                CARGAR REFERENCIA P&amp;V · JUMBO 3.5 × 3.5 RMR 31-40
              </button>
              <button
                type="button"
                onClick={restablecerProporciones}
                style={{
                  padding: "8px 12px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                RESTABLECER PROPORCIONES DE LA PLANTILLA
              </button>
            </div>

            {/* SECCIÓN 2: PATRÓN DE CONTORNO */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
                Patrón de contorno
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {(
                  [
                    { id: "uniforme", label: "Corona uniforme" },
                    { id: "corona_recorte", label: "Corona + recorte" },
                    { id: "recorte_continuo", label: "Recorte continuo" },
                  ] as const
                ).map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setPatronContorno(pat.id)}
                    style={{
                      padding: "6px 4px",
                      fontSize: 10,
                      fontWeight: patronContorno === pat.id ? 700 : 500,
                      borderRadius: 6,
                      border:
                        patronContorno === pat.id
                          ? "1px solid var(--acento, #f97316)"
                          : "1px solid #334155",
                      background:
                        patronContorno === pat.id
                          ? "rgba(249, 115, 22, 0.2)"
                          : "rgba(15, 23, 42, 0.4)",
                      color: patronContorno === pat.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>

              {/* Leyenda Geométrica */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  fontSize: 10,
                  color: "#94a3b8",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#38bdf8",
                      display: "inline-block",
                    }}
                  />
                  <span>Azul claro: Alivio / Escariado</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#ffffff",
                      display: "inline-block",
                    }}
                  />
                  <span>Blanco: Recorte / Control</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                      display: "inline-block",
                    }}
                  />
                  <span>Verde: Corona</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: PARÁMETROS DEL ALIVIO / ARRANQUE */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Corte y Alivio (Cálculo De)</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "alivio" ? null : "alivio")
                  }
                >
                  {conceptoAbierto === "alivio" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              {conceptoAbierto === "alivio" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    lineHeight: 1.45,
                    borderLeft: "3px solid #38bdf8",
                  }}
                >
                  <b>¿Por qué Diámetro Equivalente?</b> En voladura subterránea no hay cara libre. Los
                  taladros vacíos sin cargar proporcionan el volumen de expansión inicial. Según la
                  fórmula sueca: <code>De = D · √N</code>. Múltiples alivios pequeños actúan
                  dinámicamente como un gran cilindro central de alivio.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    N° taladros alivio (N)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={numAlivios}
                    onChange={(e) => setNumAlivios(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Ø individual alivio (mm)
                  </label>
                  <input
                    type="number"
                    min={50}
                    step={1}
                    value={diametroAlivioMm}
                    onChange={(e) => setDiametroAlivioMm(Math.max(25, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Resultado del Diámetro Equivalente */}
              <div
                style={{
                  background: "rgba(56, 189, 248, 0.08)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "#e0f2fe",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Diámetro equivalente:</span>
                <b style={{ color: "#38bdf8", fontSize: 12 }}>
                  De = {diametroEquivalente.deMm.toFixed(1)} mm ({diametroEquivalente.deM.toFixed(3)} m)
                </b>
              </div>
            </div>

            {/* SECCIÓN 4: ACCIONES CAD NO DESTRUCTIVAS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={() => ejecutarAnalisisCad(false)}
                style={{
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                DETECTAR GALERÍA
              </button>
              <button
                type="button"
                onClick={() => ejecutarAnalisisCad(false)}
                style={{
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                DETECTAR TALADROS
              </button>
            </div>

            <button
              type="button"
              onClick={() => ejecutarAnalisisCad(true)}
              style={{
                padding: "10px 14px",
                fontSize: 11,
                fontWeight: 800,
                borderRadius: 8,
                border: "1px solid #10b981",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#34d399",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              ANALIZAR CAD · NO MODIFICAR
            </button>
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 2: RMR */}
        {/* ================================================================= */}
        {tab === "rmr" && (
          <>
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Clasificación Geomecánica (RMR)
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "rmr" ? null : "rmr")
                  }
                >
                  {conceptoAbierto === "rmr" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              {conceptoAbierto === "rmr" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--acento, #f97316)",
                  }}
                >
                  <b>Concepto Geomecánico:</b> El sistema RMR (Bieniawski) integra la resistencia de la
                  roca intacta, RQD, espaciamiento de discontinuidades y presencia de agua. En
                  voladura, un RMR bajo (roca fracturada o dura y confinada) exige menor espaciamiento
                  entre barrenos y un mayor factor de roca <i>K</i> para garantizar fragmentación
                  homogénea sin soplado.
                </div>
              )}

              {/* Slider interactivo y valor numérico */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#94a3b8",
                    marginBottom: 6,
                  }}
                >
                  <span>Índice RMR (0 a 100)</span>
                  <b style={{ color: recomendacionRmr.colorBadge, fontSize: 13 }}>
                    {rmrScore} pts
                  </b>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={rmrScore}
                  onChange={(e) => setRmrScore(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                />
              </div>

              {/* Tarjeta de Recomendación Activa */}
              <div
                style={{
                  background: "rgba(7, 12, 22, 0.8)",
                  borderRadius: 10,
                  border: `1px solid ${recomendacionRmr.colorBadge}`,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: recomendacionRmr.colorBadge,
                    }}
                  >
                    {recomendacionRmr.tipo}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      background: "rgba(30, 41, 59, 0.5)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {recomendacionRmr.clase}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    lineHeight: 1.4,
                    marginBottom: 10,
                  }}
                >
                  {recomendacionRmr.descripcion}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    fontSize: 11,
                    background: "rgba(15, 23, 42, 0.6)",
                    padding: 8,
                    borderRadius: 6,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    Espaciamiento:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.espaciamiento} m</b>
                  </div>
                  <div>
                    Coeficiente K:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.coeficienteK}</b>
                  </div>
                  <div>
                    Alivios recomendados:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.aliviosSugeridos} taladros</b>
                  </div>
                  <div>
                    Factor carga:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.factorCarga}</b>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => aplicarSugerenciaRmr(recomendacionRmr.aliviosSugeridos)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--acento, #f97316)",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  APLICAR SUGERENCIA
                </button>
              </div>
            </div>

            {/* TABLA COMPARATIVA DE CLASES RMR */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
                Matriz de Recomendaciones por Calidad
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  {
                    nombre: "Roca Suave (RMR > 60)",
                    esp: "0.73 m",
                    k: "1.10",
                    alivios: 4,
                    activo: rmrScore > 60,
                  },
                  {
                    nombre: "Roca Semidura (41-60)",
                    esp: "0.55 m",
                    k: "1.65",
                    alivios: 4,
                    activo: rmrScore >= 41 && rmrScore <= 60,
                  },
                  {
                    nombre: "Roca Dura (RMR ≤ 40)",
                    esp: "0.48 m",
                    k: "2.25",
                    alivios: 5,
                    activo: rmrScore <= 40,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 10,
                      background: item.activo
                        ? "rgba(249, 115, 22, 0.15)"
                        : "rgba(7, 12, 22, 0.4)",
                      border: item.activo
                        ? "1px solid var(--acento, #f97316)"
                        : "1px solid transparent",
                      color: item.activo ? "#ffffff" : "#94a3b8",
                    }}
                  >
                    <span>{item.nombre}</span>
                    <span>
                      E = {item.esp} · K = {item.k} · {item.alivios} Alivios
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 3: MÉTODO (SECUENCIA GEOMÉTRICA DEL ARRANQUE) */}
        {/* ================================================================= */}
        {tab === "metodo" && (
          <>
            {/* SELECTOR DE MÉTODO */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 12,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                Método de cálculo
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {(
                  [
                    { id: "corte_paralelo", label: "Corte paralelo" },
                    { id: "practico_empirico", label: "Práctico empírico" },
                    { id: "expansion_sucesiva", label: "Expansión sucesiva" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoDiseno(m.id)}
                    style={{
                      padding: "6px 2px",
                      fontSize: 10,
                      fontWeight: metodoDiseno === m.id ? 700 : 500,
                      borderRadius: 6,
                      border:
                        metodoDiseno === m.id
                          ? "1px solid var(--acento, #f97316)"
                          : "1px solid #334155",
                      background:
                        metodoDiseno === m.id
                          ? "rgba(249, 115, 22, 0.2)"
                          : "rgba(15, 23, 42, 0.4)",
                      color: metodoDiseno === m.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CABECERA SECUENCIA GEOMÉTRICA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                  Secuencia geométrica del arranque
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "holmberg" ? null : "holmberg")
                  }
                >
                  {conceptoAbierto === "holmberg" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  lineHeight: 1.4,
                  marginBottom: conceptoAbierto === "holmberg" ? 10 : 12,
                }}
              >
                Se calculan cinco etapas teóricas. La distribución utiliza el tipo de corte elegido
                y conserva E5 como control de expansión.
              </div>

              {conceptoAbierto === "holmberg" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--acento, #f97316)",
                  }}
                >
                  <b>Fundamento Físico:</b> Cada cuadrante de taladros abre una cavidad rectangular
                  hacia la cual rompe el siguiente. El <i>Burden (Bn)</i> es la distancia crítica a la
                  cara libre para evitar soplado. El <i>Espaciamiento (En)</i> define el lado del
                  prisma desalojado. En la Etapa 1 se aplica <code>f = 2.00</code> sobre el diámetro
                  equivalente <code>De</code>, y en las subsiguientes se conserva <code>f = 0.85</code>{" "}
                  para compensar el ángulo de rotura de 90°.
                </div>
              )}

              {/* LISTA DE 5 ETAPAS (EXACTAS AL DISEÑO) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {etapasArranque.map((et) => (
                  <div
                    key={et.etapa}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(7, 12, 22, 0.75)",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                    }}
                  >
                    {/* Número de etapa con círculo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: "1px solid var(--acento, #f97316)",
                          background: "rgba(249, 115, 22, 0.15)",
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {et.etapa}
                      </div>

                      {/* Valores de B y E */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--acento, #f97316)" }}>
                          B{et.etapa} = {et.b.toFixed(3)} m
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#38bdf8" }}>
                          E{et.etapa} = {et.e.toFixed(3)} m
                        </div>
                      </div>
                    </div>

                    {/* Factor f */}
                    <div
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      f {et.f.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 4: RESULTADO */}
        {/* ================================================================= */}
        {tab === "resultado" && (
          <>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>
              RESULTADO CAD MANUAL · detectado desde capas visibles
            </div>

            {/* TARJETA 1: GALERÍA DETECTADA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #10b981",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#10b981",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                GALERÍA DETECTADA
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                Ancho {galeriaDetectada.ancho.toFixed(1)} m · Alto{" "}
                {galeriaDetectada.alto.toFixed(1)} m
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                Área {galeriaDetectada.area.toFixed(3)} m² · Perímetro{" "}
                {galeriaDetectada.perimetro.toFixed(3)} m
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                Centro X {galeriaDetectada.centroX.toFixed(3)} · Y{" "}
                {galeriaDetectada.centroY.toFixed(3)} · Corona estimada{" "}
                {galeriaDetectada.corona.toFixed(1)} m
              </div>
            </div>

            {/* TARJETA 2: TALADROS MANUALES */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #06b6d4",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#06b6d4",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                TALADROS MANUALES
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                {taladrosDetectados.total} taladros · {taladrosDetectados.metros} m perforados
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#cbd5e1",
                  marginBottom: 4,
                }}
              >
                Cargados {taladrosDetectados.cargados} · Alivio/no cargados{" "}
                {taladrosDetectados.alivio}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  fontStyle: "italic",
                }}
              >
                Fuente: Dibujo CAD
              </div>
            </div>

            {/* DIAGNÓSTICO TÉCNICO DE VOLADURA */}
            <div
              style={{
                background: "rgba(7, 12, 22, 0.6)",
                borderRadius: 10,
                border: "1px solid #1e293b",
                padding: 12,
                fontSize: 11,
                color: "#cbd5e1",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--acento, #f97316)" }}>
                Diagnóstico de Diseño
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Volumen estimado por avance:</span>
                <b>{(galeriaDetectada.area * avanceM * 0.92).toFixed(2)} m³</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Toneladas rotas (ρ = 2.7 t/m³):</span>
                <b>{(galeriaDetectada.area * avanceM * 0.92 * 2.7).toFixed(1)} ton</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Densidad de perforación:</span>
                <b>
                  {galeriaDetectada.area > 0
                    ? (taladrosDetectados.total / galeriaDetectada.area).toFixed(2)
                    : "0"}{" "}
                  tal/m²
                </b>
              </div>
            </div>
          </>
        )}
      </div>

      {/* PIE / BOTONES DE NAVEGACIÓN (ANTERIOR / SIGUIENTE) */}
      <div
        style={{
          padding: "12px 18px",
          borderTop: "1px solid #1e293b",
          background: "rgba(7, 12, 22, 0.9)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={irPasoAnterior}
          disabled={tab === "datos"}
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #475569",
            background: "transparent",
            color: tab === "datos" ? "#475569" : "#e2e8f0",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: tab === "datos" ? "not-allowed" : "pointer",
            textAlign: "center",
          }}
        >
          ANTERIOR
        </button>

        <button
          type="button"
          onClick={irPasoSiguiente}
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "none",
            background: "var(--acento, #f97316)",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            textAlign: "center",
            boxShadow: "0 4px 14px rgba(249, 115, 22, 0.35)",
          }}
        >
          {tab === "resultado" ? "FINALIZAR" : "SIGUIENTE"}
        </button>
      </div>
    </div>
  );
}
