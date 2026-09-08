import React, { useState, useMemo, useEffect } from "react";
import { usePersistedState } from "../hooks/usePersistedState.js";
import {
  calcularArranqueHolmberg,
  calcularConstanteRocaRmr,
  calcularConstanteRocaCorregida,
  obtenerParametrosRmr,
  calcularTaladrosEmpiricos,
  calcularLongitudYAvance,
  calcularAreaInfluenciaConeingemmet,
  calcularKuzRam,
  calcularHolmbergPersson,
  generarLayoutCompletoTunel,
  CATALOGO_EXPLOSIVOS_PERU,
  type PropiedadesExplosivoMina,
} from "@suite/core";
import type { Punto2D, Taladro } from "@suite/core";
import type { LineaCad3D, PolilineaCad3D, CotaCad3D, PuntoCad3D } from "./EditorCadMalla.js";
import EsquemaArranqueCotas, { type TipoArranqueSubterraneo } from "./EsquemaArranqueCotas.js";
import { BotonInfoTeoria, TarjetaTeoriaMalla, type DatosEnVivoMalla } from "./TarjetaTeoriaMalla.js";

export type TabPanel = "datos" | "rmr" | "arranque" | "resultado";
export type TipoSeccionPlantilla = "rectangular" | "herradura" | "tipo_d" | "arco_personalizado";
export type TipoPatronContorno = "uniforme" | "corona_recorte" | "recorte_continuo";
export type MetodoDisenoArranque =
  | "holmberg_1982"
  | "corte_paralelo"
  | "langefors_kihlstrom"
  | "empirico_famesa"
  | "area_influencia_coneingemmet"
  | "practico_empirico";
export type TipoCorteArranque = "paralelo_quemado" | "cuna" | "piramidal" | "abanico" | "diamante";

// ============================================================================
// ICONOS VECTORIALES TÉCNICOS SVG (ESTILO DASHBOARD DE INGENIERÍA)
// ============================================================================

export function IconoMalla({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.35" />
      <circle cx="12" cy="12" r="6" strokeOpacity="0.7" />
      <circle cx="12" cy="12" r="2" fill={color} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function IconoSeccion({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V11a8 8 0 0 1 16 0v10" />
      <path d="M4 21h16" />
      <line x1="2" y1="21" x2="22" y2="21" />
      <line x1="4" y1="11" x2="20" y2="11" strokeDasharray="2 2" strokeOpacity="0.4" />
    </svg>
  );
}

export function IconoGeomecanica({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5-6 4 13 2.5-7h5" />
      <path d="M4 19h16" strokeDasharray="2 2" strokeOpacity="0.5" />
    </svg>
  );
}

export function IconoMallaArranque({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" strokeOpacity="0.35" />
      <rect x="7.5" y="7.5" width="9" height="9" transform="rotate(45 12 12)" strokeOpacity="0.75" />
      <circle cx="12" cy="12" r="2.2" fill={color} />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="16" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
      <line x1="12" y1="2.5" x2="12" y2="21.5" strokeDasharray="2 2" strokeOpacity="0.4" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" strokeDasharray="2 2" strokeOpacity="0.4" />
    </svg>
  );
}

export function IconoAnalitica({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-5 4 3 5-7" />
      <circle cx="11" cy="11" r="1.5" fill={color} />
      <circle cx="15" cy="14" r="1.5" fill={color} />
      <circle cx="20" cy="7" r="1.5" fill={color} />
    </svg>
  );
}

export function IconoPerfilHerradura({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V12a7 7 0 0 1 14 0v8" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function IconoPerfilTunel({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconoPerfilTipoD({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V15c0-4.5 3.6-8 8-8s8 3.5 8 8v5" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconoPerfilRectangular({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="16" height="14" rx="1.5" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

export function IconoBroca({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="1.2" fill={color} />
      <line x1="12" y1="4" x2="12" y2="8.5" />
      <line x1="12" y1="15.5" x2="12" y2="20" />
      <line x1="4" y1="12" x2="8.5" y2="12" />
      <line x1="15.5" y1="12" x2="20" y2="12" />
    </svg>
  );
}

export function IconoExplosivo({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="10" height="14" rx="2" />
      <line x1="7" y1="11" x2="17" y2="11" strokeOpacity="0.5" />
      <line x1="7" y1="16" x2="17" y2="16" strokeOpacity="0.5" />
      <path d="M12 7V3" />
      <path d="M9 3h6" />
    </svg>
  );
}

export function IconoCalculo({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="11" y2="11" />
      <line x1="13" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="11" y2="15" />
      <line x1="13" y1="15" x2="16" y2="15" />
    </svg>
  );
}

export function IconoEscudo({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" />
    </svg>
  );
}

export function IconoCronometro({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M10 2h4" />
      <line x1="12" y1="2" x2="12" y2="5" />
    </svg>
  );
}

export function IconoMinimizar({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconoExpandir({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
    </svg>
  );
}

export function IconoCerrar({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconoDockLateral({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export function IconoDockAbajo({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}

export function IconoLimpiar({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// Control numérico con botones +/- perfectamente responsivo y sin flechas nativas
interface ControlPasoNumeroProps {
  label: string;
  valor: number;
  unidad?: string;
  paso?: number;
  min?: number;
  max?: number;
  decimales?: number;
  onChange: (nuevoValor: number) => void;
  titleTooltip?: string;
}

function ControlPasoNumero({
  label,
  valor,
  unidad = "",
  paso = 0.1,
  min = 0,
  max,
  decimales = 1,
  onChange,
  titleTooltip,
}: ControlPasoNumeroProps) {
  const [textoLocal, setTextoLocal] = useState<string>(
    Number.isFinite(valor) ? (decimales > 0 ? valor.toFixed(decimales) : String(valor)) : "0"
  );
  const [estaEnfocado, setEstaEnfocado] = useState(false);

  useEffect(() => {
    if (!estaEnfocado) {
      setTextoLocal(
        Number.isFinite(valor) ? (decimales > 0 ? valor.toFixed(decimales) : String(valor)) : "0"
      );
    }
  }, [valor, estaEnfocado, decimales]);

  const decrementar = () => {
    const factor = Math.pow(10, decimales);
    const nuevo = Math.round((valor - paso) * factor) / factor;
    const finalVal = Math.max(min, nuevo);
    onChange(finalVal);
    setTextoLocal(decimales > 0 ? finalVal.toFixed(decimales) : String(finalVal));
  };

  const incrementar = () => {
    const factor = Math.pow(10, decimales);
    const nuevo = Math.round((valor + paso) * factor) / factor;
    const finalVal = max !== undefined ? Math.min(max, nuevo) : nuevo;
    onChange(finalVal);
    setTextoLocal(decimales > 0 ? finalVal.toFixed(decimales) : String(finalVal));
  };

  const handleBlur = () => {
    setEstaEnfocado(false);
    const val = parseFloat(textoLocal.replace(",", "."));
    if (!isNaN(val)) {
      const finalVal = Math.max(min, max !== undefined ? Math.min(max, val) : val);
      onChange(finalVal);
      setTextoLocal(decimales > 0 ? finalVal.toFixed(decimales) : String(finalVal));
    } else {
      setTextoLocal(decimales > 0 ? valor.toFixed(decimales) : String(valor));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, width: "100%" }}>
      <label
        title={titleTooltip || `${label} ${unidad ? `(${unidad})` : ""}`}
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: "#94a3b8",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.2,
          padding: "0 2px",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {unidad && (
          <span style={{ fontSize: 9.5, color: "#38bdf8", marginLeft: 4, flexShrink: 0, fontWeight: 700 }}>
            ({unidad})
          </span>
        )}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "rgba(7, 12, 22, 0.95)",
          border: estaEnfocado ? "1px solid var(--acento, #f97316)" : "1px solid #334155",
          borderRadius: 6,
          overflow: "hidden",
          height: 32,
          boxSizing: "border-box",
          transition: "border-color 0.15s ease",
        }}
      >
        <button
          type="button"
          onClick={decrementar}
          disabled={valor <= min}
          style={{
            width: 28,
            flexShrink: 0,
            border: "none",
            background: "rgba(255, 255, 255, 0.03)",
            borderRight: "1px solid #1e293b",
            color: valor <= min ? "#475569" : "#cbd5e1",
            fontSize: 14,
            fontWeight: 700,
            cursor: valor <= min ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
            transition: "all 0.15s ease",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            if (valor > min) {
              e.currentTarget.style.background = "rgba(249, 115, 22, 0.2)";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
            e.currentTarget.style.color = valor <= min ? "#475569" : "#cbd5e1";
          }}
          title={`Reducir ${paso} ${unidad}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          value={textoLocal}
          onFocus={() => setEstaEnfocado(true)}
          onChange={(e) => {
            const txt = e.target.value;
            if (/^-?[\d.,]*$/.test(txt) || txt === "") {
              setTextoLocal(txt);
              const val = parseFloat(txt.replace(",", "."));
              if (!isNaN(val)) {
                onChange(Math.max(min, max !== undefined ? Math.min(max, val) : val));
              }
            }
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              incrementar();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              decrementar();
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            width: "100%",
            padding: "0 2px",
            background: "transparent",
            border: "none",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            textAlign: "center",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={incrementar}
          disabled={max !== undefined && valor >= max}
          style={{
            width: 28,
            flexShrink: 0,
            border: "none",
            background: "rgba(255, 255, 255, 0.03)",
            borderLeft: "1px solid #1e293b",
            color: max !== undefined && valor >= max ? "#475569" : "#cbd5e1",
            fontSize: 14,
            fontWeight: 700,
            cursor: max !== undefined && valor >= max ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
            transition: "all 0.15s ease",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            if (max === undefined || valor < max) {
              e.currentTarget.style.background = "rgba(249, 115, 22, 0.2)";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
            e.currentTarget.style.color = max !== undefined && valor >= max ? "#475569" : "#cbd5e1";
          }}
          title={`Aumentar ${paso} ${unidad}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface Props {
  visible: boolean;
  onOcultar: () => void;
  poligonoCresta?: Punto2D[];
  onCambiarPoligono?: (pts: Punto2D[]) => void;
  lineasCad?: LineaCad3D[];
  polilineasCad?: PolilineaCad3D[];
  cotasCad?: CotaCad3D[];
  puntosCad?: PuntoCad3D[];
  taladros?: Taladro[];
  onCambiarTaladros?: (nuevos: Taladro[]) => void;
  onGenerarTaladros?: (nuevos: Taladro[]) => void;
  onCambiarCotasCad?: (cotas: CotaCad3D[] | ((prev: CotaCad3D[]) => CotaCad3D[])) => void;
  onCambiarPolilineasCad?: (pls: PolilineaCad3D[] | ((prev: PolilineaCad3D[]) => PolilineaCad3D[])) => void;
  onCambiarPuntosCad?: (pts: PuntoCad3D[] | ((prev: PuntoCad3D[]) => PuntoCad3D[])) => void;
  onAplicarParametros?: (params: {
    ancho: number;
    alto: number;
    area: number;
    perimetro: number;
    tipoSeccion?: TipoSeccionPlantilla;
    rmr: number;
    alivios?: number;
    numAlivios?: number;
    diametroAlivioMm?: number;
    diametroProdMm?: number;
    metodo?: MetodoDisenoArranque;
    tipoCorte?: TipoCorteArranque;
  }) => void;
  mostrarAviso?: (msg: string) => void;
}

export interface PlantillaMalla {
  id: string;
  nombre: string;
  tipoSeccion: TipoSeccionPlantilla;
  ancho: number;
  alto: number;
  corona: number;
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  avanceM: number;
  rmr: number;
  descripcion: string;
  badge: string;
  color: string;
  icono: string;
}

export const PLANTILLAS_MALLA_PRESET: PlantillaMalla[] = [
  {
    id: "herradura-2.5x2.5",
    nombre: "Herradura Estándar",
    tipoSeccion: "herradura",
    ancho: 2.5,
    alto: 2.5,
    corona: 1.25,
    numAlivios: 4,
    diametroAlivioMm: 102,
    diametroProdMm: 45,
    avanceM: 3.6,
    rmr: 45,
    descripcion: "Cuele Holmberg con 4 alivios centrales Ø102mm, arrastres, corona y hastiales (cantidad de taladros calculada según RMR).",
    badge: "2.5 × 2.5m",
    color: "#f97316",
    icono: "HER",
  },
  {
    id: "herradura-3.0x3.0",
    nombre: "Túnel Principal",
    tipoSeccion: "herradura",
    ancho: 3.0,
    alto: 3.0,
    corona: 1.5,
    numAlivios: 4,
    diametroAlivioMm: 102,
    diametroProdMm: 45,
    avanceM: 3.8,
    rmr: 55,
    descripcion: "Galería de transporte y acarreo principal con 4 cuadrantes y corona reforzada.",
    badge: "3.0 × 3.0m",
    color: "#38bdf8",
    icono: "TUN",
  },
  {
    id: "tipo-d-3.5x3.0",
    nombre: "Rampa Tipo D",
    tipoSeccion: "tipo_d",
    ancho: 3.5,
    alto: 3.0,
    corona: 1.05,
    numAlivios: 4,
    diametroAlivioMm: 102,
    diametroProdMm: 45,
    avanceM: 3.6,
    rmr: 50,
    descripcion: "Sección abovedada rebajada para optimización de gálibo de equipos LHD y volquetes.",
    badge: "3.5 × 3.0m",
    color: "#a855f7",
    icono: "TP-D",
  },
  {
    id: "rectangular-2.5x2.5",
    nombre: "Labor en Veta",
    tipoSeccion: "rectangular",
    ancho: 2.5,
    alto: 2.5,
    corona: 0,
    numAlivios: 4,
    diametroAlivioMm: 89,
    diametroProdMm: 41,
    avanceM: 3.2,
    rmr: 40,
    descripcion: "Corte rectangular para labores de avance en vetas angostas y subniveles de explotación.",
    badge: "2.5 × 2.5m",
    color: "#10b981",
    icono: "REC",
  },
];

/**
 * Diametro equivalente de alivio y secuencia de burden/espaciamiento del arranque (cuele Holmberg,
 * metodo simplificado de Jimeno Tabla 22.2), delegando en el motor ya validado de
 * packages/core/src/formulas/mining/tunnelRound.ts::calcularArranqueHolmberg — en vez de mantener
 * una segunda copia de la misma formula que podía (y de hecho llegó a) divergir con constantes
 * incorrectas. `maximoSecciones` limita a 5 etapas y reutiliza la regla de parada real (deja de
 * agregar secciones cuando el lado resultante alcanza sqrt(avance)), asi que en galerías pequeñas o
 * con avances cortos no se generan anillos de arranque más grandes que la propia sección.
 */
function calcularHolmberg(numAlivios: number, diametroAlivioMm: number, avanceM: number) {
  const resultado = calcularArranqueHolmberg({
    diametroIndividualAlivio_mm: diametroAlivioMm,
    numeroTaladrosAlivio: numAlivios,
    avance_m: avanceM,
    maximoSecciones: 5,
  });
  return {
    deMm: resultado.diametroEquivalente_mm,
    deM: resultado.diametroEquivalente_mm / 1000,
    etapas: resultado.secciones.map((s) => ({ etapa: s.numero, b: s.burden_m, e: s.espaciamiento_m, f: s.factor })),
  };
}

/**
 * Espaciamiento de taladros de contorno segun clase de roca (RMR) — mismos valores que usa
 * `recomendacionRmr` más abajo, alineados con la tabla "Distancias entre taladros" de la
 * referencia (tenaz 0.50-0.55m, intermedio 0.60-0.65m, friable 0.70-0.75m; se toma el punto medio).
 */
function calcularEspaciamientoContornoPorRmr(rmr: number): number {
  if (rmr > 60) return 0.48; // roca dura / tenaz (RMR alto = macizo mas competente/tenaz)
  if (rmr >= 41) return 0.55; // roca semidura / intermedio
  return 0.73; // roca suave / friable (RMR bajo = macizo fracturado/friable)
}

/**
 * Espaciamiento "normal" (SIN voladura controlada) — regla práctica de Mamani López, R.J. (op.
 * cit., p.19): "se estima una distancia de 2 ft por cada pulgada de diámetro de broca". Es el
 * espaciamiento que usan los taladros de contorno cuando NO se busca una pared lisa (patrón
 * "Corona uniforme"), bastante más abierto que el de recorte/smooth blasting.
 */
function calcularEspaciamientoProduccionReglaPractica(diametroMm: number): number {
  const diametroPulgadas = diametroMm / 25.4;
  const espaciamientoPies = 2 * diametroPulgadas;
  return espaciamientoPies * 0.3048;
}

/**
 * Secuencia del arranque por el "método práctico/empírico": en vez de la progresión geométrica de
 * Holmberg (B1=1.5·De, Bn=E(n-1)...), usa 3 bandas de distancia fijas y ya tabuladas por zona —
 * arranque 0.15-0.30 m, ayudas 0.60-0.90 m, cuadradores 0.50-0.70 m — tal como se enseña para un
 * diseño rápido de campo sin calcular el diámetro equivalente (Mamani López, R.J., "Diseño de
 * mallas de perforación en minería subterránea", material de curso, Bolivia, p.19, "Distancia
 * entre taladros"). Se usa el punto medio de cada banda; a diferencia de Holmberg, estas bandas NO
 * crecen monótonamente (no son secciones concéntricas de un mismo cuele, son zonas con nombre
 * propio), así que el espaciamiento se toma como B·√2 solo como convención geométrica para poder
 * dibujar los mismos anillos que usa el método de corte paralelo.
 */
function calcularEtapasPracticoEmpirico(): Array<{ etapa: number; b: number; e: number; f: number }> {
  const bandas = [
    { b: (0.15 + 0.3) / 2 }, // Arranque
    { b: (0.6 + 0.9) / 2 }, // Ayudas
    { b: (0.5 + 0.7) / 2 }, // Cuadradores
  ];
  return bandas.map((banda, idx) => ({
    etapa: idx + 1,
    b: banda.b,
    e: banda.b * Math.SQRT2,
    f: NaN,
  }));
}

/**
 * Factor de carga (kg de explosivo por m³ de roca a volar) según el área de la sección del túnel
 * y la categoría de roca — tabla "Kilos de explosivos estimados por m³ de roca" (Mamani López,
 * R.J., "Diseño de mallas de perforación en minería subterránea", material de curso, Bolivia).
 * A menor área de sección, mayor factor de carga (más perímetro relativo al volumen); a mayor
 * dureza/tenacidad de la roca, también mayor factor de carga. Devuelve el rango [min, max] kg/m³
 * de la fila correspondiente — no se interpola entre filas porque la fuente las presenta como
 * bandas discretas, no como una función continua.
 */
function factorCargaPorAreaYRoca(areaM2: number, categoria: "dura" | "intermedia" | "suave"): [number, number] {
  const filas: Array<{ hasta: number; dura: [number, number]; intermedia: [number, number]; suave: [number, number] }> = [
    { hasta: 5, dura: [2.6, 3.2], intermedia: [1.8, 2.3], suave: [1.2, 1.6] },
    { hasta: 10, dura: [2.0, 2.6], intermedia: [1.4, 1.8], suave: [0.9, 1.2] },
    { hasta: 20, dura: [1.65, 2.0], intermedia: [1.1, 1.4], suave: [0.6, 0.9] },
    { hasta: 40, dura: [1.2, 1.65], intermedia: [0.75, 1.1], suave: [0.4, 0.6] },
    { hasta: 60, dura: [0.8, 1.2], intermedia: [0.5, 0.75], suave: [0.3, 0.4] },
  ];
  const fila = filas.find((f) => areaM2 <= f.hasta) ?? filas[filas.length - 1];
  return fila[categoria];
}

/**
 * Número de taladros a partir del RMR y el área de la sección — Ecuación 2 de Beltrán Velásquez,
 * S. (2022) "Diseño de malla de perforación y voladura para optimizar la productividad en una
 * mina subterránea en Pataz, La Libertad 2020" (tesis de titulación, Universidad Privada del
 * Norte): N = RMR·√(Sección)/2.5, con Sección = ancho·alto·factor de corrección geométrica
 * (0.88 para secciones en arco, verificado contra el ejemplo de la tesis: RMR=55,
 * 1.70×1.80×0.88 → N=36; 1.0 para secciones rectangulares sin corrección).
 */
function numeroTaladrosPorRmr(rmr: number, anchoM: number, altoM: number, factorGeometrico: number): number {
  const seccion = Math.max(0.1, anchoM * altoM * factorGeometrico);
  return Math.round((rmr * Math.sqrt(seccion)) / 2.5);
}

/**
 * Genera la malla completa (alivio + anillos del arranque + contorno) para una seccion dada.
 * Fuente unica compartida por la vista en vivo y por la carga de plantillas, para que ambas
 * generen exactamente los mismos puntos a partir de los mismos parametros.
 */
/**
 * Genera la malla completa equilibrada y verificada (alivios, arranque, ayudas de destroza interior,
 * cuadradores, corona y arrastres con look-out) según la teoría técnica minera completa.
 */
function construirTaladrosMalla(opciones: {
  ancho: number;
  alto: number;
  tipoSeccion: TipoSeccionPlantilla;
  corona: number;
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  avanceM: number;
  rmr: number;
  metodoDiseno: MetodoDisenoArranque;
  patronContorno: TipoPatronContorno;
  tipoCorte?: TipoCorteArranque;
}): Taladro[] {
  const { puntos } = generarLayoutCompletoTunel({
    ancho_m: opciones.ancho,
    alto_m: opciones.alto,
    tipoSeccion: opciones.tipoSeccion,
    alturaCorona_m: opciones.corona,
    numAlivios: opciones.numAlivios,
    diametroAlivioMm: opciones.diametroAlivioMm,
    diametroProdMm: opciones.diametroProdMm,
    avanceM: opciones.avanceM,
    rmr: opciones.rmr,
    metodo:
      opciones.metodoDiseno === "practico_empirico"
        ? "practico_empirico"
        : opciones.metodoDiseno === "langefors_kihlstrom"
        ? "langefors_kihlstrom"
        : opciones.metodoDiseno === "empirico_famesa"
        ? "empirico_famesa"
        : opciones.metodoDiseno === "area_influencia_coneingemmet"
        ? "area_influencia_coneingemmet"
        : "holmberg_1982",
    patronContorno: opciones.patronContorno,
    tipoCorte: opciones.tipoCorte,
  });

  const L = Math.max(0.5, opciones.avanceM);
  const cx = opciones.ancho / 2;

  return puntos.map((p, idx) => {
    // Divergencia angular minera estándar: ~2.5° (0.043 rad = ~11 a 15 cm de apertura al fondo)
    // SOLO para taladros perimetrales (arrastres, hastiales, cuadradores, corona, recorte)
    const esContorno =
      p.zona === "arrastre" ||
      p.zona === "hastial" ||
      p.zona === "cuadradores" ||
      p.zona === "corona" ||
      p.zona === "recorte";

    const anguloLookout = esContorno ? 0.0436 : 0; // 2.5° exactos
    let dx = 0;
    let dy = 0;

    if (p.zona === "arrastre") {
      // Zapateras: divergencia sutil hacia el piso para mantener la rasante
      dy = -L * Math.sin(anguloLookout);
      if (Math.abs(p.x - cx) > opciones.ancho * 0.35) {
        dx = (p.x < cx ? -1 : 1) * L * Math.sin(anguloLookout) * 0.5;
      }
    } else if (p.zona === "hastial" || p.zona === "cuadradores") {
      // Hastiales: divergencia lateral hacia las cajas
      dx = (p.x < cx ? -1 : 1) * L * Math.sin(anguloLookout);
    } else if (p.zona === "corona" || p.zona === "recorte") {
      // Corona: divergencia hacia el techo para no perder gálibo
      dy = L * Math.sin(anguloLookout);
      if (Math.abs(p.x - cx) > opciones.ancho * 0.35) {
        dx = (p.x < cx ? -1 : 1) * L * Math.sin(anguloLookout) * 0.4;
      }
    }
    // Arranque, cuadrantes 1..4, ayudas y alivios: dx = 0, dy = 0 (100% paralelos al eje)

    // Dirección UNIFORME hacia el macizo rocoso (-Z siempre negativo)
    const dz = -L * Math.cos(anguloLookout);
    const xToe = Math.round((p.x + dx) * 1000) / 1000;
    const yToe = Math.round((p.y + dy) * 1000) / 1000;
    const zToe = Math.round(dz * 1000) / 1000;

    const taco = p.cargado ? Math.round(((p.diamMm * 10) / 1000) * 100) / 100 : 0;
    const longCarga = p.cargado ? Math.max(0, L - taco) : 0;

    const tal: Taladro = {
      id: `tal-live-${idx + 1}`,
      fila: idx + 1,
      columna: 1,
      collar: { x: p.x, y: p.y, z: 0 },
      fondo: { x: xToe, y: yToe, z: zToe },
      diametroMm: p.diamMm,
      profundidad_m: L,
      taco_m: taco,
      longitudCarga_m: longCarga,
    };
    (tal as any).zona = p.zona;
    (tal as any).cargado = p.cargado;
    (tal as any).tipo = p.cargado ? "produccion" : "alivio";
    (tal as any).color = p.color;
    (tal as any).lookout = esContorno ? (p.lookout ?? (anguloLookout > 0 ? Math.round((anguloLookout * 180) / Math.PI * 10) / 10 : 0)) : 0;
    (tal as any).anguloLookoutRad = esContorno ? (p.anguloLookoutRad ?? anguloLookout) : undefined;
    (tal as any).etapa = p.etapa;
    return tal;
  });
}

export default function PanelDatosRmrMetodo({
  visible,
  onOcultar,
  poligonoCresta = [],
  onCambiarPoligono,
  lineasCad = [],
  polilineasCad = [],
  cotasCad = [],
  puntosCad = [],
  taladros = [],
  onCambiarTaladros,
  onGenerarTaladros,
  onCambiarCotasCad,
  onCambiarPolilineasCad,
  onCambiarPuntosCad,
  onAplicarParametros,
  mostrarAviso,
}: Props) {
  // Detección reactiva de dispositivo móvil
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Posición del menú: "abajo" (Bottom Sheet desplegable) por defecto a solicitud del usuario, o "lateral"
  const [posicion, setPosicion] = usePersistedState<"abajo" | "lateral">("panelRmr:posicion", "abajo");
  const [minimizado, setMinimizado] = usePersistedState<boolean>("panelRmr:minimizado", false);

  // Navegación entre pestañas
  const [tab, setTab] = useState<TabPanel>("datos");
  const tabs: { id: TabPanel; label: string }[] = [
    { id: "datos", label: "Datos & Sección" },
    { id: "rmr", label: "RMR Geomecánica" },
    { id: "arranque", label: "Arranque & Método" },
    { id: "resultado", label: "Resultado CAD" },
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
  const [explosivoId, setExplosivoId] = useState<string>("semexsa-65");
  const explosivoActual = useMemo(
    () => CATALOGO_EXPLOSIVOS_PERU.find((e) => e.id === explosivoId) ?? CATALOGO_EXPLOSIVOS_PERU[2],
    [explosivoId]
  );

  // TAB 2: GEOMECÁNICA RMR
  const [rmrScore, setRmrScore] = useState<number>(45);

  // TAB 3: MÉTODO Y SECUENCIA DE CORTE
  const [metodoDiseno, setMetodoDiseno] = useState<MetodoDisenoArranque>("holmberg_1982");
  const [tipoCorte, setTipoCorte] = useState<TipoCorteArranque>("paralelo_quemado");
  const [tipoArranqueSubterraneo, setTipoArranqueSubterraneo] = useState<TipoArranqueSubterraneo>("cuatro_cuadrantes_holmberg");

  // Control de activación de la malla (en blanco hasta que el usuario jale/cargue una plantilla o diseñe)
  const [mallaGenerada, setMallaGenerada] = useState<boolean>(() => {
    return Boolean((taladros && taladros.length > 0) || (poligonoCresta && poligonoCresta.length > 0));
  });

  // Si externamente entran taladros o polígonos, marcar como malla generada
  useEffect(() => {
    if ((taladros && taladros.length > 0) || (poligonoCresta && poligonoCresta.length > 0)) {
      setMallaGenerada(true);
    }
  }, [taladros?.length, poligonoCresta?.length]);

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
      const hCorona = Math.min(W * 0.35, H * 0.5);
      const hHastial = Math.max(0, H - hCorona);
      const area = W * hHastial + (Math.PI * (W / 2) * hCorona) / 2;
      const perimetro = W + 2 * hHastial + Math.PI * Math.sqrt((W * W + hCorona * hCorona) / 2);
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
  // DIÁMETRO EQUIVALENTE DE ALIVIO Y SECUENCIA DE ARRANQUE (CUELE HOLMBERG)
  // De = D_individual * sqrt(N); B1=1.5*De, E1=B1*sqrt(2); Bn=E(n-1), En=1.5*Bn*sqrt(2)
  // (metodo simplificado de Jimeno Tabla 22.2, delegado en
  // packages/core/src/formulas/mining/tunnelRound.ts::calcularArranqueHolmberg).
  // =========================================================================
  const resultadoHolmberg = useMemo(
    () => calcularHolmberg(numAlivios, diametroAlivioMm, avanceM),
    [numAlivios, diametroAlivioMm, avanceM]
  );
  const diametroEquivalente = useMemo(
    () => ({ deMm: resultadoHolmberg.deMm, deM: resultadoHolmberg.deM }),
    [resultadoHolmberg]
  );
  // =========================================================================
  // PARÁMETROS GEOMECÁNICOS RMR Y CONSTANTES DE ROCA
  // c = 5.73e-3 * RMR + 0.057 (Lee et al., 2005)
  // c̄ = c + 0.05 (B >= 1.4m) ó c + 0.07/B (B < 1.4m) (López Jimeno)
  // =========================================================================
  const constanteRocaC = useMemo(() => calcularConstanteRocaRmr(rmrScore), [rmrScore]);
  const constanteRocaCorregida = useMemo(() => calcularConstanteRocaCorregida(constanteRocaC, 0.6), [constanteRocaC]);
  const paramsRmr = useMemo(() => obtenerParametrosRmr(rmrScore), [rmrScore]);

  // Estimación de taladros por los 3 métodos empíricos principales:
  // 1. Regla rápida: N = 10 * sqrt(S)
  // 2. Regla precisa: N = (P / dt) + c * S
  // 3. FAMESA (Walter Guillén): N = (P / E) + K * S
  const taladrosEmpiricos = useMemo(
    () => calcularTaladrosEmpiricos(metricasSeccion.area, metricasSeccion.perimetro, rmrScore),
    [metricasSeccion.area, metricasSeccion.perimetro, rmrScore]
  );

  // Avance teórico de la ronda
  const avanceTeorico = useMemo(
    () => calcularLongitudYAvance(diametroAlivioMm, tipoCorte as any, metricasSeccion.area),
    [diametroAlivioMm, tipoCorte, metricasSeccion.area]
  );

  // Área de influencia (CONEINGEMMET 2003, San Rafael / Ananea)
  const areaInfluenciaConeingemmet = useMemo(
    () =>
      calcularAreaInfluenciaConeingemmet({
        diametroMm: diametroProdMm,
        presionDetonacionKbar: explosivoActual.presionDetonacionKbar,
        resistenciaCompresionKgcm2: rmrScore > 60 ? 1200 : rmrScore > 40 ? 750 : 400,
        rqdPorcentaje: Math.max(20, rmrScore * 0.95),
      }),
    [diametroProdMm, explosivoActual.presionDetonacionKbar, rmrScore]
  );

  // =========================================================================
  // CÁLCULO DEL CENTRO DEL CUELE / ALIVIOS (CAD REAL POSITION)
  // =========================================================================
  const centroAliviosCalculado = useMemo<{ x: number; y: number }>(() => {
    if (taladros && taladros.length > 0) {
      const alivios = taladros.filter(
        (t) =>
          (t as any).zona === "alivio" ||
          (t as any).tipo === "alivio" ||
          (!(t as any).cargado && t.diametroMm > 60)
      );
      if (alivios.length > 0) {
        const cx = alivios.reduce((acc, t) => acc + t.collar.x, 0) / alivios.length;
        const cy = alivios.reduce((acc, t) => acc + t.collar.y, 0) / alivios.length;
        return { x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 };
      }
    }

    if (poligonoCresta && poligonoCresta.length >= 3) {
      const minX = Math.min(...poligonoCresta.map((p) => p.x));
      const maxX = Math.max(...poligonoCresta.map((p) => p.x));
      const minY = Math.min(...poligonoCresta.map((p) => p.y));
      const maxY = Math.max(...poligonoCresta.map((p) => p.y));
      const w = maxX - minX;
      const h = maxY - minY;
      const cx = minX + w / 2;
      let hCorona = 0;
      if (tipoSeccion === "herradura") {
        hCorona = w / 2;
      } else if (tipoSeccion === "tipo_d") {
        hCorona = Math.min(w * 0.35, h * 0.5);
      }
      const hHastial = Math.max(0, h - hCorona);
      const cy =
        minY + (tipoSeccion === "rectangular" ? h * 0.44 : Math.min(hHastial * 0.75, h * 0.4));
      return { x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 };
    }

    const w = anchoGaleria;
    const h = altoGaleria;
    const cx = w / 2;
    let hCorona = 0;
    if (tipoSeccion === "herradura") {
      hCorona = w / 2;
    } else if (tipoSeccion === "tipo_d") {
      hCorona = Math.min(w * 0.35, h * 0.5);
    }
    const hHastial = Math.max(0, h - hCorona);
    const cy = tipoSeccion === "rectangular" ? h * 0.44 : Math.min(hHastial * 0.75, h * 0.4);
    return { x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 };
  }, [taladros, poligonoCresta, tipoSeccion, anchoGaleria, altoGaleria]);

  // =========================================================================
  // MOTOR DE LAYOUT COMPLETO TUNEL (SUBTERRÁNEO EQUILIBRADO)
  // =========================================================================
  const layoutCalculado = useMemo(() => {
    return generarLayoutCompletoTunel({
      ancho_m: anchoGaleria,
      alto_m: altoGaleria,
      tipoSeccion,
      alturaCorona_m: alturaCorona,
      numAlivios,
      diametroAlivioMm,
      diametroProdMm,
      avanceM,
      rmr: rmrScore,
      metodo:
        metodoDiseno === "practico_empirico"
          ? "practico_empirico"
          : metodoDiseno === "langefors_kihlstrom"
          ? "langefors_kihlstrom"
          : metodoDiseno === "empirico_famesa"
          ? "empirico_famesa"
          : metodoDiseno === "area_influencia_coneingemmet"
          ? "area_influencia_coneingemmet"
          : "holmberg_1982",
      tipoCorte,
      patronContorno,
    });
  }, [
    anchoGaleria,
    altoGaleria,
    tipoSeccion,
    alturaCorona,
    numAlivios,
    diametroAlivioMm,
    diametroProdMm,
    avanceM,
    rmrScore,
    metodoDiseno,
    tipoCorte,
    patronContorno,
  ]);

  const desgloseZonas = layoutCalculado.desglose;

  // Factor de carga analítico (Powder factor) y balance de explosivos
  const factorCargaEstimado = useMemo(() => {
    const volumen = Math.max(0.1, metricasSeccion.area * avanceM * 0.92);
    const totalCargados =
      taladrosDetectados.cargados > 0 ? taladrosDetectados.cargados : desgloseZonas.totalCargados;
    const d_m = diametroProdMm / 1000;
    const q_l = (Math.PI / 4) * d_m * d_m * explosivoActual.densidadGcm3 * 1000;
    const longitudCarga = Math.max(0.5, avanceM - (diametroProdMm * 10) / 1000);
    const pesoExplosivoTotal = totalCargados * q_l * longitudCarga;
    const fc = pesoExplosivoTotal / volumen;
    return {
      volumenM3: volumen,
      toneladas: volumen * 2.7,
      q_l_kg_m: q_l,
      longitudCarga_m: longitudCarga,
      pesoTotalKg: pesoExplosivoTotal,
      factorCargaKgM3: fc,
      rangoOptimo: fc >= 2.0 && fc <= 4.0,
    };
  }, [
    metricasSeccion.area,
    avanceM,
    taladrosDetectados.cargados,
    desgloseZonas.totalCargados,
    diametroProdMm,
    explosivoActual,
  ]);

  // La lista mostrada debe coincidir con la que realmente usa construirTaladrosMalla
  const etapasArranque = useMemo(() => {
    if (metodoDiseno === "practico_empirico") {
      return calcularEtapasPracticoEmpirico().map((et) => ({
        ...et,
        cabe: true,
        nota: "Banda fija práctica",
      }));
    }
    return resultadoHolmberg.etapas.map((et) => {
      const cabe = et.e < Math.min(anchoGaleria, altoGaleria) * 0.88;
      return {
        ...et,
        cabe,
        nota: cabe ? "Cabe en sección útil" : "Truncado por gálibo útil",
      };
    });
  }, [metodoDiseno, resultadoHolmberg.etapas, anchoGaleria, altoGaleria]);

  // =========================================================================
  // MODELOS PREDICTIVOS: FRAGMENTACIÓN KUZ-RAM Y DAÑO HOLMBERG-PERSSON
  // =========================================================================
  const resultadoKuzRam = useMemo(() => {
    const totalCargados =
      taladrosDetectados.cargados > 0 ? taladrosDetectados.cargados : desgloseZonas.totalCargados;

    return calcularKuzRam({
      area_m2: metricasSeccion.area,
      avance_m: avanceM,
      numTaladrosCargados: totalCargados,
      pesoExplosivoTotal_kg: factorCargaEstimado.pesoTotalKg,
      rmr: rmrScore,
      rwsPeso: explosivoActual.rwsPeso,
    });
  }, [
    metricasSeccion.area,
    avanceM,
    taladrosDetectados.cargados,
    desgloseZonas.totalCargados,
    factorCargaEstimado.pesoTotalKg,
    rmrScore,
    explosivoActual.rwsPeso,
  ]);

  const resultadoHolmbergPersson = useMemo(() => {
    return calcularHolmbergPersson({
      diametroCargaMm: diametroProdMm,
      densidadExplosivoGcm3: explosivoActual.densidadGcm3,
      espaciamientoContorno_m: paramsRmr.espaciamientoE_m,
      voladuraControlada: patronContorno !== "uniforme",
    });
  }, [diametroProdMm, explosivoActual.densidadGcm3, paramsRmr.espaciamientoE_m, patronContorno]);

  // =========================================================================
  // RECOMENDACIÓN GEOMECÁNICA RMR (BIENIAWSKI / SUECO)
  // =========================================================================
  const recomendacionRmr = useMemo(() => {
    const areaM2 = metricasSeccion.area;
    if (rmrScore > 60) {
      const [fcMin, fcMax] = factorCargaPorAreaYRoca(areaM2, "dura");
      return {
        tipo: "Roca Dura",
        clase: "Clase I - II (Buena / Muy Buena)",
        espaciamiento: calcularEspaciamientoContornoPorRmr(rmrScore),
        aliviosSugeridos: 5,
        factorCarga: `${fcMin.toFixed(2)} - ${fcMax.toFixed(2)} kg/m³`,
        colorBadge: "#ef4444",
        descripcion:
          "Roca de alta calidad geomecánica (macizo competente, poco fracturado) y por tanto tenaz frente a la voladura. Requiere 5 taladros de alivio y menor espaciamiento/mayor factor de carga para lograr la fragmentación.",
      };
    }
    if (rmrScore >= 41) {
      const [fcMin, fcMax] = factorCargaPorAreaYRoca(areaM2, "intermedia");
      return {
        tipo: "Roca Semidura",
        clase: "Clase III (Regular)",
        espaciamiento: calcularEspaciamientoContornoPorRmr(rmrScore),
        aliviosSugeridos: 4,
        factorCarga: `${fcMin.toFixed(2)} - ${fcMax.toFixed(2)} kg/m³`,
        colorBadge: "var(--acento, #f97316)",
        descripcion:
          "Calidad geomecánica media. Requiere espaciamiento controlado en contorno (corona y hastiales) para preservar las discontinuidades estructurales.",
      };
    }
    const [fcMin, fcMax] = factorCargaPorAreaYRoca(areaM2, "suave");
    return {
      tipo: "Roca Suave",
      clase: "Clase IV - V (Mala / Muy Mala o Gran Fracturamiento)",
      espaciamiento: calcularEspaciamientoContornoPorRmr(rmrScore),
      aliviosSugeridos: 4,
      factorCarga: `${fcMin.toFixed(2)} - ${fcMax.toFixed(2)} kg/m³`,
      colorBadge: "#10b981",
      descripcion:
        "Macizo de baja calidad geomecánica (muy fracturado/alterado): fragmenta con menor energía. Permite mayor espaciamiento y menor factor de carga sin generar sobre-rotura.",
    };
  }, [rmrScore, metricasSeccion.area]);

  // Estimación de número de taladros (Beltrán Velásquez, 2022)
  const numeroTaladrosEstimado = useMemo(() => {
    const factorGeometrico = tipoSeccion === "rectangular" ? 1.0 : 0.88;
    return Math.max(1, numeroTaladrosPorRmr(rmrScore, anchoGaleria, altoGaleria, factorGeometrico));
  }, [rmrScore, anchoGaleria, altoGaleria, tipoSeccion]);

  // Datos consolidados en tiempo real para las fichas de teoría minera (?)
  const datosEnVivoParaTeoria: DatosEnVivoMalla = useMemo(() => {
    return {
      tipoSeccion,
      anchoGaleria,
      altoGaleria,
      alturaCorona,
      areaSeccion: metricasSeccion.area,
      perimetroSeccion: metricasSeccion.perimetro,
      numAlivios,
      diametroAlivioMm,
      diametroProdMm,
      diametroEquivalenteDeMm: diametroEquivalente.deMm,
      avanceM,
      rmrScore,
      claseRmr: recomendacionRmr.clase,
      tipoRoca: recomendacionRmr.tipo,
      explosivoNombre: explosivoActual.nombre,
      explosivoVod: explosivoActual.vodMs,
      explosivoDensidad: explosivoActual.densidadGcm3,
      explosivoPresionDetKbar: explosivoActual.presionDetonacionKbar,
      explosivoRws: explosivoActual.rwsPeso,
      factorCargaKgM3: factorCargaEstimado.factorCargaKgM3,
      volumenRotoM3: factorCargaEstimado.volumenM3,
      toneladasRotas: factorCargaEstimado.toneladas,
      pesoTotalExplosivoKg: factorCargaEstimado.pesoTotalKg,
      cargaLinealKgM: factorCargaEstimado.q_l_kg_m,
      metodoDiseno,
      patronContorno,
      totalTaladros: taladrosDetectados.total > 0 ? taladrosDetectados.total : desgloseZonas.totalTaladros,
      taladrosCargados: taladrosDetectados.cargados > 0 ? taladrosDetectados.cargados : desgloseZonas.totalCargados,
      taladrosAlivio: taladrosDetectados.alivio > 0 ? taladrosDetectados.alivio : desgloseZonas.alivios,
      kuzRamX50Cm: resultadoKuzRam.x50_cm,
      kuzRamUniformidadN: resultadoKuzRam.indiceUniformidad_n,
      kuzRamSobretamanoPct: resultadoKuzRam.porcentajeSobretamano_30cm,
      kuzRamFinosPct: resultadoKuzRam.porcentajeFinos_5cm,
      holmbergPpvContorno: resultadoHolmbergPersson.ppvContorno_mms,
      holmbergRadioDanoM: resultadoHolmbergPersson.radioDanoCritico_m,
      etapasHolmberg: etapasArranque,
    };
  }, [
    tipoSeccion,
    anchoGaleria,
    altoGaleria,
    alturaCorona,
    metricasSeccion,
    numAlivios,
    diametroAlivioMm,
    diametroProdMm,
    diametroEquivalente,
    avanceM,
    rmrScore,
    recomendacionRmr,
    explosivoActual,
    factorCargaEstimado,
    metodoDiseno,
    patronContorno,
    taladrosDetectados,
    desgloseZonas,
    resultadoKuzRam,
    resultadoHolmbergPersson,
    etapasArranque,
  ]);

  // =========================================================================
  // GENERACIÓN DE MALLA EN VIVO (LIVE REAL-TIME CALCULATION)
  // =========================================================================
  const calcularContornoEnVivo = (
    tipo: TipoSeccionPlantilla,
    ancho: number,
    alto: number,
    corona: number
  ): Punto2D[] => {
    const W = Math.max(0.5, ancho);
    const H = Math.max(0.5, alto);

    if (tipo === "rectangular") {
      return [
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: W, y: H },
        { x: 0, y: H },
      ];
    }

    if (tipo === "herradura") {
      const radio = W / 2;
      const hHastial = Math.max(0, H - radio);
      const pts: Punto2D[] = [];
      pts.push({ x: 0, y: 0 });
      pts.push({ x: W, y: 0 });
      pts.push({ x: W, y: hHastial });
      const numPtsArco = 32;
      for (let i = 0; i <= numPtsArco; i++) {
        const ang = (i / numPtsArco) * Math.PI;
        const x = W / 2 + radio * Math.cos(ang);
        const y = hHastial + radio * Math.sin(ang);
        pts.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      }
      pts.push({ x: 0, y: 0 });
      return pts;
    }

    // tipo_d o arco_personalizado: arco elíptico suave y continuo
    const hCorona = tipo === "tipo_d" ? Math.min(W * 0.35, H * 0.5) : Math.min(corona, H * 0.8);
    const hHastial = Math.max(0, H - hCorona);
    const pts: Punto2D[] = [];
    pts.push({ x: 0, y: 0 });
    pts.push({ x: W, y: 0 });
    pts.push({ x: W, y: hHastial });
    const numPts = 32;
    for (let i = 0; i <= numPts; i++) {
      const ang = (i / numPts) * Math.PI; // 0 a PI (de x=W hacia x=0)
      const x = W / 2 + (W / 2) * Math.cos(ang);
      const y = hHastial + hCorona * Math.sin(ang);
      pts.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    }
    pts.push({ x: 0, y: 0 });
    return pts;
  };

  const calcularTaladrosEnVivo = (): Taladro[] =>
    construirTaladrosMalla({
      ancho: anchoGaleria,
      alto: altoGaleria,
      tipoSeccion,
      corona: alturaCorona,
      numAlivios,
      diametroAlivioMm,
      diametroProdMm,
      avanceM,
      rmr: rmrScore,
      metodoDiseno,
      tipoCorte,
      patronContorno,
    });

  const handleCargarPlantilla = (p: PlantillaMalla) => {
    setTipoSeccion(p.tipoSeccion);
    setAnchoGaleria(p.ancho);
    setAltoGaleria(p.alto);
    setAlturaCorona(p.corona);
    setNumAlivios(p.numAlivios);
    setDiametroAlivioMm(p.diametroAlivioMm);
    setDiametroProdMm(p.diametroProdMm);
    setAvanceM(p.avanceM);
    setRmrScore(p.rmr);
    setMallaGenerada(true);

    const contorno = calcularContornoEnVivo(p.tipoSeccion, p.ancho, p.alto, p.corona);
    const lista = construirTaladrosMalla({
      ancho: p.ancho,
      alto: p.alto,
      tipoSeccion: p.tipoSeccion,
      corona: p.corona,
      numAlivios: p.numAlivios,
      diametroAlivioMm: p.diametroAlivioMm,
      diametroProdMm: p.diametroProdMm,
      avanceM: p.avanceM,
      rmr: p.rmr,
      metodoDiseno,
      tipoCorte,
      patronContorno,
    });

    if (onCambiarPoligono) {
      onCambiarPoligono(contorno);
    }
    if (onGenerarTaladros) {
      onGenerarTaladros(lista);
    } else if (onCambiarTaladros) {
      onCambiarTaladros(lista);
    }

    mostrarAviso?.(`Plantilla cargada: ${p.nombre} (${p.badge}) - ${lista.length} taladros.`);
  };

  const handleLimpiarLienzo = () => {
    setMallaGenerada(false);
    if (onCambiarPoligono) {
      onCambiarPoligono([]);
    }
    if (onCambiarTaladros) {
      onCambiarTaladros([]);
    }
    try {
      localStorage.removeItem("suite-mineria:cad:malla-1:puntos");
      localStorage.removeItem("suite-mineria:cad:puntos");
    } catch {
      // noop
    }
    mostrarAviso?.("✓ Lienzo en blanco: Malla y contorno limpiados.");
  };

  // Limpiar capas de guías/cotas superpuestas del CAD para que la vista quede limpia
  const handleLimpiarGuiasCad = () => {
    const capaId = "capa-arranque-cotas";
    if (onCambiarPolilineasCad) {
      onCambiarPolilineasCad((prev) => prev.filter((p) => p.capaId !== capaId && !p.id.startsWith("pl-q")));
    }
    if (onCambiarCotasCad) {
      onCambiarCotasCad((prev) =>
        prev.filter((c) => c.capaId !== capaId && !c.id.startsWith("cot-b") && !c.id.startsWith("cot-e"))
      );
    }
    if (onCambiarPuntosCad) {
      onCambiarPuntosCad((prev) =>
        prev.filter((p) => p.capaId !== capaId && !p.id.startsWith("pto-q") && !p.id.startsWith("pto-alivio"))
      );
    }
    mostrarAviso?.("✓ Capas de guías y cotas limpiadas del CAD 3D.");
  };

  // Aplicar un trazo de arranque del catálogo visual oficial
  const handleAplicarTrazoSeleccionado = (config: {
    numAlivios: number;
    diametroAlivioMm: number;
    tipoCorte: string;
    nombreTrazo: string;
  }) => {
    // 1. Limpiar cualquier residuo de cotas anteriores
    handleLimpiarGuiasCad();

    // 2. Aplicar los parámetros a la malla
    setNumAlivios(config.numAlivios);
    setDiametroAlivioMm(config.diametroAlivioMm);
    setTipoCorte(config.tipoCorte as TipoCorteArranque);
    setMallaGenerada(true);

    // 3. Regenerar los taladros inmediatamente con la nueva configuración
    const contorno = calcularContornoEnVivo(tipoSeccion, anchoGaleria, altoGaleria, alturaCorona);
    const nuevosTaladros = construirTaladrosMalla({
      ancho: anchoGaleria,
      alto: altoGaleria,
      tipoSeccion,
      corona: alturaCorona,
      numAlivios: config.numAlivios,
      diametroAlivioMm: config.diametroAlivioMm,
      diametroProdMm,
      avanceM,
      rmr: rmrScore,
      metodoDiseno,
      tipoCorte: config.tipoCorte as TipoCorteArranque,
      patronContorno,
    });

    if (onCambiarPoligono) {
      onCambiarPoligono(contorno);
    }
    if (onGenerarTaladros) {
      onGenerarTaladros(nuevosTaladros);
    } else if (onCambiarTaladros) {
      onCambiarTaladros(nuevosTaladros);
    }

    if (onAplicarParametros) {
      onAplicarParametros({
        ancho: anchoGaleria,
        alto: altoGaleria,
        area: metricasSeccion.area,
        perimetro: metricasSeccion.perimetro,
        tipoSeccion,
        rmr: rmrScore,
        numAlivios: config.numAlivios,
        diametroAlivioMm: config.diametroAlivioMm,
        diametroProdMm,
        tipoCorte: config.tipoCorte as TipoCorteArranque,
      });
    }

    mostrarAviso?.(`✓ Trazo aplicado a la malla: ${config.nombreTrazo}`);
  };

  // Efecto reactivo para actualizar la malla EN VIVO en el Canvas 3D (solo si la malla está activa)
  useEffect(() => {
    if (!visible || !mallaGenerada) return;
    const contorno = calcularContornoEnVivo(tipoSeccion, anchoGaleria, altoGaleria, alturaCorona);
    const nuevosTaladros = calcularTaladrosEnVivo();

    if (onCambiarPoligono) {
      onCambiarPoligono(contorno);
    }
    if (onGenerarTaladros) {
      onGenerarTaladros(nuevosTaladros);
    } else if (onCambiarTaladros) {
      onCambiarTaladros(nuevosTaladros);
    }
  }, [
    visible,
    mallaGenerada,
    tipoSeccion,
    anchoGaleria,
    altoGaleria,
    alturaCorona,
    numAlivios,
    diametroAlivioMm,
    diametroProdMm,
    avanceM,
    rmrScore,
    metodoDiseno,
    tipoCorte,
    patronContorno,
  ]);

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
    const metrosPerf = taladros.reduce((acc, t) => acc + (t.profundidad_m || (t as any).longitud_m || 3.6), 0);

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
      style={
        isMobile
          ? {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              width: "100%",
              maxWidth: "100vw",
              transform: "none",
              maxHeight: minimizado ? 44 : "64vh",
              height: minimizado ? 44 : "auto",
              background: "#0c121e",
              border: "1.5px solid rgba(249, 115, 22, 0.45)",
              borderBottom: "none",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.95), 0 0 25px rgba(249, 115, 22, 0.15)",
              display: "flex",
              flexDirection: "column",
              zIndex: 900,
              overflow: "hidden",
              color: "#f8fafc",
              fontFamily: "'Segoe UI', -apple-system, sans-serif",
              boxSizing: "border-box",
              transition: "max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease",
            }
          : posicion === "abajo"
          ? {
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(1180px, calc(100vw - 120px))",
              maxHeight: minimizado ? 46 : "48vh",
              height: minimizado ? 46 : "auto",
              background: "#0c121e",
              border: "1.5px solid rgba(249, 115, 22, 0.45)",
              borderBottom: "none",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.88), 0 0 25px rgba(249, 115, 22, 0.15)",
              display: "flex",
              flexDirection: "column",
              zIndex: 900,
              overflow: "hidden",
              color: "#f8fafc",
              fontFamily: "'Segoe UI', -apple-system, sans-serif",
              transition: "max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease",
            }
          : {
              position: "absolute",
              top: 24,
              right: 80,
              width: 400,
              maxWidth: "calc(100vw - 100px)",
              maxHeight: minimizado ? 46 : "calc(100vh - 80px)",
              height: minimizado ? 46 : "auto",
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
              transition: "max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease",
            }
      }
    >
      {/* CABECERA PRINCIPAL */}
      <div
        style={{
          padding: isMobile ? "6px 12px 8px" : posicion === "abajo" ? "8px 16px 10px" : "14px 18px 10px",
          borderBottom: minimizado ? "none" : "1px solid #1e293b",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.45) 0%, rgba(12, 18, 30, 0.85) 100%)",
        }}
      >
        {(posicion === "abajo" || isMobile) && (
          <div
            onClick={() => setMinimizado(!minimizado)}
            style={{
              width: isMobile ? 32 : 38,
              height: 4,
              background: "rgba(255, 255, 255, 0.28)",
              borderRadius: 2,
              margin: "0 auto 5px",
              cursor: "pointer",
            }}
            title={minimizado ? "Expandir panel inferior" : "Comprimir panel"}
          />
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 11.5 : 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            <IconoMalla size={17} color="var(--acento, #f97316)" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isMobile ? "DISEÑO DE MALLA" : "DISEÑO DE MALLA · SUBTERRÁNEA"}
            </span>
            {minimizado && (
              <span
                style={{
                  fontSize: isMobile ? 9 : 10,
                  fontWeight: 600,
                  color: "var(--acento, #f97316)",
                  background: "rgba(249, 115, 22, 0.12)",
                  padding: "2px 6px",
                  borderRadius: 12,
                  border: "1px solid rgba(249, 115, 22, 0.3)",
                  flexShrink: 0,
                }}
              >
                {anchoGaleria}×{altoGaleria}m · {tab.toUpperCase()}
              </span>
            )}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {/* Botón para alternar posición entre Abajo y Lateral (solo desktop) */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setPosicion(posicion === "abajo" ? "lateral" : "abajo")}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  color: "#94a3b8",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "var(--acento, #f97316)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#94a3b8";
                  e.currentTarget.style.borderColor = "#334155";
                }}
                title={posicion === "abajo" ? "Cambiar a panel lateral derecho" : "Acoplar abajo como panel inferior"}
              >
                {posicion === "abajo" ? <IconoDockLateral size={13} /> : <IconoDockAbajo size={13} />}
                <span>{posicion === "abajo" ? "Lateral" : "Abajo"}</span>
              </button>
            )}

            {/* Botón Minimizar (-) estilo CAD profesional */}
            <button
              type="button"
              onClick={() => setMinimizado(!minimizado)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid #334155",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.borderColor = "var(--acento, #f97316)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.borderColor = "#334155";
              }}
              title={minimizado ? "Expandir / Restaurar panel" : "Minimizar panel (-)"}
            >
              {minimizado ? <IconoExpandir size={13} /> : <IconoMinimizar size={13} />}
            </button>

            {/* Botón Cerrar (✕) estilo CAD profesional */}
            <button
              type="button"
              onClick={onOcultar}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#f87171",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                e.currentTarget.style.color = "#f87171";
              }}
              title="Cerrar panel (✕)"
            >
              <IconoCerrar size={13} />
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        {!minimizado && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: isMobile ? 3 : 6,
              marginTop: isMobile ? 6 : 10,
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
                    padding: isMobile ? "6px 2px" : "7px 6px",
                    fontSize: isMobile ? 10 : 11,
                    fontWeight: activa ? 700 : 500,
                    borderRadius: 6,
                    border: activa ? "1px solid var(--acento, #f97316)" : "1px solid #334155",
                    background: activa ? "rgba(249, 115, 22, 0.22)" : "rgba(15, 23, 42, 0.6)",
                    color: activa ? "#ffffff" : "#94a3b8",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={t.label}
                >
                  {t.id === "datos" && <IconoSeccion size={14} color={activa ? "var(--acento, #f97316)" : "#94a3b8"} />}
                  {t.id === "rmr" && <IconoGeomecanica size={14} color={activa ? "var(--acento, #f97316)" : "#94a3b8"} />}
                  {t.id === "arranque" && <IconoMallaArranque size={14} color={activa ? "var(--acento, #f97316)" : "#94a3b8"} />}
                  {t.id === "resultado" && <IconoAnalitica size={14} color={activa ? "var(--acento, #f97316)" : "#94a3b8"} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CUERPO PRINCIPAL CON DESPLAZAMIENTO (solo si no está minimizado) */}
      {!minimizado && (
        <div
          style={{
            padding: isMobile ? "10px 12px" : posicion === "abajo" ? "12px 18px" : "16px 18px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 10 : 12,
            maxHeight: isMobile
              ? "calc(64vh - 90px)"
              : posicion === "abajo"
              ? "calc(48vh - 95px)"
              : "calc(100vh - 180px)",
          }}
        >
        {/* ================================================================= */}
        {/* TAB 1: DATOS */}
        {/* ================================================================= */}
        {tab === "datos" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            {/* SECCIÓN UNIFICADA: PLANTILLA Y GEOMETRÍA DE SECCIÓN */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                borderRadius: 12,
                padding: 14,
                border: mallaGenerada ? "1px solid #1e293b" : "1.5px solid var(--acento, #f97316)",
                boxShadow: mallaGenerada ? "none" : "0 0 20px rgba(249, 115, 22, 0.2)",
              }}
            >
              {/* Cabecera con estado y concepto */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#ffffff",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoSeccion size={16} color="var(--acento, #f97316)" />
                  <span>Geometría de Sección y Plantillas</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: mallaGenerada ? "rgba(16, 185, 129, 0.15)" : "rgba(249, 115, 22, 0.15)",
                      color: mallaGenerada ? "#10b981" : "var(--acento, #f97316)",
                      border: mallaGenerada ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(249, 115, 22, 0.3)",
                    }}
                  >
                    {mallaGenerada ? "● EN VIVO" : "○ EN BLANCO"}
                  </span>
                  <BotonInfoTeoria
                    activo={conceptoAbierto === "seccion"}
                    onClick={() => setConceptoAbierto(conceptoAbierto === "seccion" ? null : "seccion")}
                    titulo="Ver teoría de geometría de sección, distribución de esfuerzos y fórmulas (?)"
                  />
                </div>
              </div>

              {conceptoAbierto === "seccion" && (
                <TarjetaTeoriaMalla
                  id="seccion"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              {/* BARRA DE PLANTILLAS RÁPIDAS CON ICONOS CAD */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 5 }}>
                  Plantillas estándar de minería (cargar predefinido):
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 6,
                  }}
                >
                  {PLANTILLAS_MALLA_PRESET.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleCargarPlantilla(p)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #334155",
                        background: "rgba(15, 23, 42, 0.5)",
                        color: "#f8fafc",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--acento, #f97316)";
                        e.currentTarget.style.background = "rgba(249, 115, 22, 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#334155";
                        e.currentTarget.style.background = "rgba(15, 23, 42, 0.5)";
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#ffffff" }}>
                        {p.tipoSeccion === "herradura" && <IconoPerfilHerradura size={14} color={p.color} />}
                        {p.tipoSeccion === "tipo_d" && <IconoPerfilTipoD size={14} color={p.color} />}
                        {p.tipoSeccion === "rectangular" && <IconoPerfilRectangular size={14} color={p.color} />}
                        {p.tipoSeccion === "arco_personalizado" && <IconoPerfilTunel size={14} color={p.color} />}
                        <span>{p.nombre}</span>
                      </span>
                      <span style={{ fontSize: 9, color: p.color, fontWeight: 700 }}>
                        {p.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SELECTOR DE FORMA DE SECCIÓN */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 5 }}>
                  Forma geométrica del arco:
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 4,
                  }}
                >
                  {(
                    [
                      { id: "rectangular", label: "Rectangular", Icon: IconoPerfilRectangular },
                      { id: "herradura", label: "Herradura", Icon: IconoPerfilHerradura },
                      { id: "tipo_d", label: "Tipo D", Icon: IconoPerfilTipoD },
                      { id: "arco_personalizado", label: "Arco pers.", Icon: IconoPerfilTunel },
                    ] as const
                  ).map((sec) => {
                    const activa = tipoSeccion === sec.id;
                    const IconComp = sec.Icon;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setTipoSeccion(sec.id);
                          setMallaGenerada(true);
                        }}
                        style={{
                          padding: "6px 2px",
                          fontSize: 10,
                          fontWeight: activa ? 700 : 500,
                          borderRadius: 6,
                          border: activa ? "1px solid var(--acento, #f97316)" : "1px solid #334155",
                          background: activa ? "rgba(249, 115, 22, 0.2)" : "rgba(15, 23, 42, 0.4)",
                          color: activa ? "#ffffff" : "#94a3b8",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 3,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <IconComp size={15} color={activa ? "var(--acento, #f97316)" : "#64748b"} />
                        <span>{sec.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inputs de dimensiones con botones +/- profesionales y responsivos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 115px), 1fr))", gap: 8, marginBottom: 8 }}>
                <ControlPasoNumero
                  label="Ancho galería"
                  unidad="m"
                  valor={anchoGaleria}
                  paso={0.1}
                  min={0.5}
                  decimales={1}
                  onChange={(val) => {
                    setAnchoGaleria(val);
                    setMallaGenerada(true);
                  }}
                  titleTooltip="Ancho útil de la labor en metros"
                />
                <ControlPasoNumero
                  label="Alto galería"
                  unidad="m"
                  valor={altoGaleria}
                  paso={0.1}
                  min={0.5}
                  decimales={1}
                  onChange={(val) => {
                    setAltoGaleria(val);
                    setMallaGenerada(true);
                  }}
                  titleTooltip="Alto útil de la labor en metros"
                />
                {tipoSeccion === "arco_personalizado" && (
                  <ControlPasoNumero
                    label="Altura corona"
                    unidad="m"
                    valor={alturaCorona}
                    paso={0.05}
                    min={0.1}
                    decimales={2}
                    onChange={(val) => {
                      setAlturaCorona(val);
                      setMallaGenerada(true);
                    }}
                    titleTooltip="Altura de flecha / corona en metros"
                  />
                )}
              </div>

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

              {/* Botones de acción inferior */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 }}>
                <button
                  type="button"
                  onClick={restablecerProporciones}
                  style={{
                    padding: "5px 10px",
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #334155",
                    background: "rgba(15, 23, 42, 0.4)",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  ↺ Restablecer proporciones
                </button>

                {mallaGenerada && (
                  <button
                    type="button"
                    onClick={handleLimpiarLienzo}
                    style={{
                      padding: "5px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 6,
                      border: "1px solid #475569",
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#f87171",
                      cursor: "pointer",
                    }}
                  >
                    ✕ Limpiar Malla
                  </button>
                )}
              </div>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoPerfilTunel size={16} color="#38bdf8" />
                  <span>Patrón de contorno</span>
                </div>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "patron_contorno"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "patron_contorno" ? null : "patron_contorno")}
                  titulo="Ver justificación técnica de voladura de contorno y smooth blasting (?)"
                />
              </div>

              {conceptoAbierto === "patron_contorno" && (
                <TarjetaTeoriaMalla
                  id="patron_contorno"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

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
                    onClick={() => {
                      setPatronContorno(pat.id);
                      setMallaGenerada(true);
                    }}
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
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoBroca size={16} color="#38bdf8" />
                  <span>Corte y Alivio (Cálculo De)</span>
                </span>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "alivio"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "alivio" ? null : "alivio")}
                  titulo="Ver fundamento de diámetro equivalente, cara libre y fórmulas (?)"
                />
              </div>

              {conceptoAbierto === "alivio" && (
                <TarjetaTeoriaMalla
                  id="alivio"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 115px), 1fr))", gap: 8, marginBottom: 8 }}>
                <ControlPasoNumero
                  label="N° taladros alivio"
                  unidad="N"
                  valor={numAlivios}
                  paso={1}
                  min={1}
                  max={8}
                  decimales={0}
                  onChange={(val) => setNumAlivios(val)}
                  titleTooltip="Número de taladros escariadores sin carga"
                />
                <ControlPasoNumero
                  label="Ø individual alivio"
                  unidad="mm"
                  valor={diametroAlivioMm}
                  paso={13}
                  min={25}
                  max={250}
                  decimales={0}
                  onChange={(val) => setDiametroAlivioMm(val)}
                  titleTooltip="Diámetro de cada taladro de alivio (mm)"
                />
                <ControlPasoNumero
                  label="Ø producción"
                  unidad="mm"
                  valor={diametroProdMm}
                  paso={2}
                  min={25}
                  max={75}
                  decimales={0}
                  onChange={(val) => setDiametroProdMm(val)}
                  titleTooltip="Diámetro de los barrenos cargados (mm)"
                />
              </div>
              <span style={{ fontSize: 9.5, color: "#64748b", display: "block", marginBottom: 8 }}>
                Referencia taladros cargados: dura 34mm · semidura 36mm · blanda 38mm (Mamani López)
              </span>

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

            {/* SECCIÓN 4: SELECCIÓN DE EXPLOSIVO Y PARÁMETROS DE CARGA (CATÁLOGO PERUANO) */}
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
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoExplosivo size={16} color="#f97316" />
                  <span>Explosivo Industrial (Catálogo Perú)</span>
                </span>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "explosivo"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "explosivo" ? null : "explosivo")}
                  titulo="Ver termodinámica del explosivo, VOD, presión de detonación y fórmulas (?)"
                />
              </div>

              {conceptoAbierto === "explosivo" && (
                <TarjetaTeoriaMalla
                  id="explosivo"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Explosivo seleccionado (EXSA / FAMESA)
                </label>
                <select
                  value={explosivoId}
                  onChange={(e) => setExplosivoId(e.target.value)}
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
                >
                  {CATALOGO_EXPLOSIVOS_PERU.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.nombre} ({exp.fabricante}) · VOD {exp.vodMs} m/s
                    </option>
                  ))}
                </select>
              </div>

              {/* Ficha técnica interactiva */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  fontSize: 11,
                  background: "rgba(7, 12, 22, 0.8)",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(249, 115, 22, 0.25)",
                  marginBottom: 10,
                }}
              >
                <div>
                  Densidad &rho;<sub>e</sub>:{" "}
                  <b style={{ color: "#f97316" }}>{explosivoActual.densidadGcm3} g/cm³</b>
                </div>
                <div>
                  VOD: <b style={{ color: "#38bdf8" }}>{explosivoActual.vodMs} m/s</b>
                </div>
                <div>
                  P. Detonación:{" "}
                  <b style={{ color: "#e2e8f0" }}>{explosivoActual.presionDetonacionKbar} kbar</b>
                </div>
                <div>
                  Potencia RWS:{" "}
                  <b style={{ color: "#10b981" }}>{explosivoActual.rwsPeso}% ANFO</b>
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "#94a3b8" }}>
                  Aplicación: <span style={{ color: "#cbd5e1" }}>{explosivoActual.usoPrincipal}</span>
                </div>
              </div>

              {/* Longitud de Perforación y Avance de la ronda con botones +/- */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1" }}>Longitud & Avance</span>
                  <BotonInfoTeoria
                    activo={conceptoAbierto === "avance"}
                    onClick={() => setConceptoAbierto(conceptoAbierto === "avance" ? null : "avance")}
                    titulo="Ver justificación de avance, taco y fórmulas (?)"
                    tamano="sm"
                  />
                </div>
                {conceptoAbierto === "avance" && (
                  <TarjetaTeoriaMalla
                    id="avance"
                    onCerrar={() => setConceptoAbierto(null)}
                    datosEnVivo={datosEnVivoParaTeoria}
                  />
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                    <ControlPasoNumero
                      label="Longitud de Perforación / Avance"
                      unidad="m"
                      valor={avanceM}
                      paso={0.1}
                      min={0.5}
                      max={6.0}
                      decimales={1}
                      onChange={(val) => setAvanceM(val)}
                      titleTooltip="Longitud de barrena y profundidad de perforación por ronda"
                    />
                  </div>
                  <div
                    style={{
                      padding: "7px 10px",
                      background: "rgba(56, 189, 248, 0.1)",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      borderRadius: 6,
                      fontSize: 11,
                      color: "#38bdf8",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      height: 32,
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    Avance real ~{(avanceM * 0.92).toFixed(2)} m (92%)
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: INSPECCIÓN NO DESTRUCTIVA CAD */}
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={() => ejecutarAnalisisCad(true)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  borderRadius: 8,
                  border: "1px solid #10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#34d399",
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>INSPECCIONAR Y DETECTAR ELEMENTOS EN ESCENA CAD</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: RMR */}
        {/* ================================================================= */}
        {tab === "rmr" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
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
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoGeomecanica size={16} color="var(--acento, #f97316)" />
                  <span>Clasificación Geomecánica (RMR)</span>
                </span>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "rmr"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "rmr" ? null : "rmr")}
                  titulo="Ver fundamento geomecánico de Bieniawski (1989) y fórmulas (?)"
                />
              </div>

              {conceptoAbierto === "rmr" && (
                <TarjetaTeoriaMalla
                  id="rmr"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
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
                    N° taladros estimado:{" "}
                    <b style={{ color: "#ffffff" }}>{numeroTaladrosEstimado}</b>
                  </div>
                  <div>
                    Alivios recomendados:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.aliviosSugeridos} taladros</b>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    Factor carga (por área de sección):{" "}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconoMallaArranque size={14} color="#f97316" />
                  <span>Matriz de Recomendaciones por Calidad (Mamani López / Beltrán)</span>
                </div>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "matriz_roca"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "matriz_roca" ? null : "matriz_roca")}
                  titulo="Ver matriz de tenacidad, espaciamiento y carga (?)"
                  tamano="sm"
                />
              </div>

              {conceptoAbierto === "matriz_roca" && (
                <TarjetaTeoriaMalla
                  id="matriz_roca"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(() => {
                  const areaM2 = metricasSeccion.area;
                  const fmt = (r: [number, number]) => `${r[0].toFixed(2)}-${r[1].toFixed(2)}`;
                  return [
                    {
                      nombre: "Roca Dura (RMR > 60)",
                      esp: `${calcularEspaciamientoContornoPorRmr(61).toFixed(2)} m`,
                      fc: fmt(factorCargaPorAreaYRoca(areaM2, "dura")),
                      alivios: 5,
                      activo: rmrScore > 60,
                    },
                    {
                      nombre: "Roca Semidura (41-60)",
                      esp: `${calcularEspaciamientoContornoPorRmr(50).toFixed(2)} m`,
                      fc: fmt(factorCargaPorAreaYRoca(areaM2, "intermedia")),
                      alivios: 4,
                      activo: rmrScore >= 41 && rmrScore <= 60,
                    },
                    {
                      nombre: "Roca Suave (RMR ≤ 40)",
                      esp: `${calcularEspaciamientoContornoPorRmr(30).toFixed(2)} m`,
                      fc: fmt(factorCargaPorAreaYRoca(areaM2, "suave")),
                      alivios: 4,
                      activo: rmrScore <= 40,
                    },
                  ];
                })().map((item, idx) => (
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
                      E = {item.esp} · FC = {item.fc} kg/m³ · {item.alivios} Alivios
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* TARJETA 3: FÓRMULAS EMPÍRICAS DE PERFORACIÓN (3 PILARES) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #38bdf8",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#38bdf8",
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoCalculo size={16} color="#38bdf8" />
                  <span>Estimación de Taladros (3 Fórmulas Empíricas)</span>
                </span>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "empirico"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "empirico" ? null : "empirico")}
                  titulo="Ver ecuaciones empíricas (Sueca, Precisa, FAMESA, Beltrán) y cálculos (?)"
                />
              </div>

              {conceptoAbierto === "empirico" && (
                <TarjetaTeoriaMalla
                  id="empirico"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, marginBottom: 10 }}>
                <div style={{ background: "rgba(7, 12, 22, 0.6)", padding: 8, borderRadius: 6 }}>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>1. Regla Sueca (10·√S)</div>
                  <b style={{ color: "#ffffff", fontSize: 13 }}>{taladrosEmpiricos.reglaRapida} taladros</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.6)", padding: 8, borderRadius: 6 }}>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>2. Regla Precisa ((P/dt)+c·S)</div>
                  <b style={{ color: "#ffffff", fontSize: 13 }}>{taladrosEmpiricos.reglaPrecisa} taladros</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.6)", padding: 8, borderRadius: 6 }}>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>3. FAMESA ((P/E)+K·S)</div>
                  <b style={{ color: "#ffffff", fontSize: 13 }}>{taladrosEmpiricos.famesaGuillen} taladros</b>
                </div>
                <div style={{ background: "rgba(249, 115, 22, 0.15)", border: "1px solid rgba(249, 115, 22, 0.4)", padding: 8, borderRadius: 6 }}>
                  <div style={{ color: "#f97316", fontSize: 10, fontWeight: 700 }}>Promedio Recomendado</div>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>{taladrosEmpiricos.promedioRecomendado} taladros</b>
                </div>
              </div>

              {/* Constantes de Roca Lee et al. (2005) */}
              <div
                style={{
                  background: "rgba(7, 12, 22, 0.8)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 10,
                  color: "#cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Constante de roca: <b style={{ color: "#38bdf8" }}>c = {constanteRocaC.toFixed(4)} kg/m³</b></span>
                <span>Corregida: <b style={{ color: "#f97316" }}>c̄ = {constanteRocaCorregida.toFixed(4)} kg/m³</b></span>
              </div>
            </div>

            {/* TARJETA 4: TEORÍA DE ÁREA DE INFLUENCIA (CONEINGEMMET 2003) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid rgba(168, 85, 247, 0.4)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#c084fc",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoAnalitica size={16} color="#c084fc" />
                  <span>Área de Influencia CONEINGEMMET (2003)</span>
                </span>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "coneingemmet"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "coneingemmet" ? null : "coneingemmet")}
                  titulo="Ver fórmula de burden crítico según PoD y resistencia de roca (?)"
                  tamano="sm"
                />
              </div>

              {conceptoAbierto === "coneingemmet" && (
                <TarjetaTeoriaMalla
                  id="coneingemmet"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8, lineHeight: 1.4 }}>
                Fórmula de burden crítico: <code>B = &empty; &middot; [ PoD / (Fs &middot; &sigma;<sub>r</sub> &middot; RQD) + 1 ]</code> según presión de detonación PoD ({explosivoActual.presionDetonacionKbar} kbar) y resistencia del macizo.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, fontSize: 10 }}>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "6px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                  <div style={{ color: "#94a3b8" }}>B. Arranque</div>
                  <b style={{ color: "#f97316", fontSize: 11 }}>{areaInfluenciaConeingemmet.bArranque_m.toFixed(3)} m</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "6px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                  <div style={{ color: "#94a3b8" }}>B. Ayudas</div>
                  <b style={{ color: "#38bdf8", fontSize: 11 }}>{areaInfluenciaConeingemmet.bAyudas_m.toFixed(3)} m</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "6px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                  <div style={{ color: "#94a3b8" }}>B. Sub-ayudas / Destroza</div>
                  <b style={{ color: "#ffffff", fontSize: 11 }}>{areaInfluenciaConeingemmet.bSubAyudas_m.toFixed(3)} m</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "6px 8px", borderRadius: 6, border: "1px solid #334155" }}>
                  <div style={{ color: "#94a3b8" }}>B. Contorno / Recorte</div>
                  <b style={{ color: "#10b981", fontSize: 11 }}>{areaInfluenciaConeingemmet.bContorno_m.toFixed(3)} m</b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: ARRANQUE & MÉTODO (CATÁLOGO OFICIAL, CÁLCULO Y SECUENCIA)  */}
        {/* ================================================================= */}
        {tab === "arranque" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "stretch",
            }}
          >
            {/* CATÁLOGO DE TRAZOS DISPONIBLES PARA EL CUELE */}
            <EsquemaArranqueCotas
              numAlivios={numAlivios}
              diametroAlivioMm={diametroAlivioMm}
              diametroProdMm={diametroProdMm}
              avanceM={avanceM}
              rmr={rmrScore}
              anchoGaleria={anchoGaleria}
              altoGaleria={altoGaleria}
              tipoSeccion={tipoSeccion}
              centroCuele={centroAliviosCalculado}
              taladros={taladros}
              tipoArranque={tipoArranqueSubterraneo}
              explosivoId={explosivoId}
              onCambiarTipoArranque={setTipoArranqueSubterraneo}
              onAplicarTrazoSeleccionado={handleAplicarTrazoSeleccionado}
              onLimpiarGuiasCad={handleLimpiarGuiasCad}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
                gap: 12,
                alignItems: "start",
              }}
            >
            {/* SELECTOR DE MÉTODO DE DISEÑO */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoCalculo size={15} color="#38bdf8" />
                  <span>Método de cálculo y diseño del cuele</span>
                </div>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "metodo_arranque"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "metodo_arranque" ? null : "metodo_arranque")}
                  titulo="Ver comparación de métodos de cuele (Holmberg, Langefors, FAMESA) (?)"
                  tamano="sm"
                />
              </div>

              {conceptoAbierto === "metodo_arranque" && (
                <TarjetaTeoriaMalla
                  id="metodo_arranque"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                {(
                  [
                    { id: "holmberg_1982", label: "Holmberg (1982 / Sueco)" },
                    { id: "langefors_kihlstrom", label: "Langefors-Kihlström" },
                    { id: "empirico_famesa", label: "FAMESA (W. Guillén)" },
                    { id: "area_influencia_coneingemmet", label: "CONEINGEMMET (2003)" },
                    { id: "practico_empirico", label: "Práctico Empírico" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoDiseno(m.id)}
                    style={{
                      padding: "8px 6px",
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
                      gridColumn: m.id === "practico_empirico" ? "1 / -1" : undefined,
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Selector de Tipo de Corte / Arranque */}
              <div style={{ marginTop: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Tipo de corte / arranque</span>
                  <span style={{ fontSize: 9, color: "var(--acento, #f97316)", fontWeight: 600 }}>5 Geometrías Subterráneas</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 5 }}>
                  {(
                    [
                      { id: "paralelo_quemado", label: "Paralelo", sub: "Holmberg / Cuadrantes" },
                      { id: "cuna", label: "En Cuña", sub: "V-Cut Angular" },
                      { id: "piramidal", label: "Piramidal", sub: "4 Diagonales en X" },
                      { id: "abanico", label: "En Abanico", sub: "Radial / Fan Cut" },
                      { id: "diamante", label: "Diamante", sub: "Ortogonal / Cruz" },
                    ] as const
                  ).map((c) => {
                    const activo = tipoCorte === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setTipoCorte(c.id)}
                        style={{
                          padding: "6px 4px",
                          borderRadius: 6,
                          border: activo
                            ? "1px solid var(--acento, #f97316)"
                            : "1px solid #334155",
                          background: activo
                            ? "rgba(249, 115, 22, 0.22)"
                            : "rgba(15, 23, 42, 0.5)",
                          color: activo ? "#ffffff" : "#94a3b8",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: activo ? 700 : 600, color: activo ? "#ffffff" : "#cbd5e1" }}>
                          {c.label}
                        </span>
                        <span style={{ fontSize: 8, color: activo ? "var(--acento, #f97316)" : "#64748b" }}>
                          {c.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4, marginTop: 8 }}>
                <b>Holmberg:</b> progresión cuadrangular Bn = 1.5·Bn-1·&radic;2 con alivio Deq. <b>Langefors:</b> balance de energía con factor de esponjamiento y burden crítico. <b>CONEINGEMMET:</b> área de influencia radial según PoD de {explosivoActual.nombre}.
              </div>
            </div>

            {/* CABECERA SECUENCIA GEOMÉTRICA DEL ARRANQUE */}
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
                <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoMallaArranque size={16} color="var(--acento, #f97316)" />
                  <span>Secuencia geométrica del arranque ({etapasArranque.length} etapas)</span>
                </div>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "holmberg_secuencia"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "holmberg_secuencia" ? null : "holmberg_secuencia")}
                  titulo="Ver deducción matemática de cuadrantes Holmberg Bn y En (?)"
                />
              </div>

              {conceptoAbierto === "holmberg_secuencia" && (
                <TarjetaTeoriaMalla
                  id="holmberg_secuencia"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              {/* LISTA DE ETAPAS (BURDEN, ESPACIAMIENTO Y FACTOR) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {etapasArranque.map((et) => (
                  <div
                    key={et.etapa}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(7, 12, 22, 0.75)",
                      border: et.cabe
                        ? "1px solid rgba(56, 189, 248, 0.25)"
                        : "1px dashed rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
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

                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--acento, #f97316)" }}>
                          B{et.etapa} = {et.b.toFixed(3)} m
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#38bdf8" }}>
                          E{et.etapa} = {et.e.toFixed(3)} m
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      {!isNaN(et.f) && (
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
                          f = {et.f.toFixed(2)}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 9,
                          color: et.cabe ? "#10b981" : "#f87171",
                          fontWeight: 600,
                        }}
                      >
                        {et.nota}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TARJETA 3: DESGLOSE DE ZONAS (DISTRIBUCIÓN REAL COMPLETA) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
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
                  letterSpacing: "0.04em",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoSeccion size={16} color="#10b981" />
                  <span>Desglose de Taladros por Zona</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#ffffff", fontWeight: 700 }}>
                    {desgloseZonas.totalCargados} cargados / {desgloseZonas.totalTaladros} total
                  </span>
                  <BotonInfoTeoria
                    activo={conceptoAbierto === "desglose_zonas"}
                    onClick={() => setConceptoAbierto(conceptoAbierto === "desglose_zonas" ? null : "desglose_zonas")}
                    titulo="Ver funciones y roles mecánicos por cada zona (?)"
                    tamano="sm"
                  />
                </div>
              </div>

              {conceptoAbierto === "desglose_zonas" && (
                <TarjetaTeoriaMalla
                  id="desglose_zonas"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "7px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8", display: "inline-block" }} />
                    Alivios (vacíos):
                  </span>
                  <b style={{ color: "#ffffff" }}>{desgloseZonas.alivios} tal</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "7px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--acento, #f97316)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--acento, #f97316)", display: "inline-block" }} />
                    Arranque (cuele):
                  </span>
                  <b style={{ color: "#ffffff" }}>{desgloseZonas.arranque} tal</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "7px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#eab308", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#eab308", display: "inline-block" }} />
                    Ayudas de destroza:
                  </span>
                  <b style={{ color: "#ffffff" }}>{desgloseZonas.ayudas} tal</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "7px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#a855f7", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a855f7", display: "inline-block" }} />
                    Cuadradores:
                  </span>
                  <b style={{ color: "#ffffff" }}>{desgloseZonas.cuadradores} tal</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "7px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#10b981", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    Corona (techo):
                  </span>
                  <b style={{ color: "#ffffff" }}>{desgloseZonas.corona} tal</b>
                </div>
                <div style={{ background: "rgba(7, 12, 22, 0.7)", padding: "7px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#64748b", display: "inline-block" }} />
                    Arrastres (piso):
                  </span>
                  <b style={{ color: "#ffffff" }}>{desgloseZonas.arrastre} tal</b>
                </div>
              </div>
            </div>

            {/* TARJETA 4: SECUENCIA DE RETARDOS DE DETONACIÓN (TIMING) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #334155",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconoCronometro size={15} color="#f59e0b" />
                  <span>Secuencia de Salida y Retardos Recomendada</span>
                </div>
                <BotonInfoTeoria
                  activo={conceptoAbierto === "timing"}
                  onClick={() => setConceptoAbierto(conceptoAbierto === "timing" ? null : "timing")}
                  titulo="Ver justificación de micro-retardos MS vs periodo largo LP (?)"
                  tamano="sm"
                />
              </div>

              {conceptoAbierto === "timing" && (
                <TarjetaTeoriaMalla
                  id="timing"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 10, color: "#cbd5e1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(7, 12, 22, 0.5)", padding: "4px 8px", borderRadius: 4 }}>
                  <span>1. Arranque Central:</span>
                  <b style={{ color: "var(--acento, #f97316)" }}>MS 1 a MS 4 (25 - 100 ms)</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(7, 12, 22, 0.5)", padding: "4px 8px", borderRadius: 4 }}>
                  <span>2. Ayudas de Destroza:</span>
                  <b style={{ color: "#eab308" }}>MS 5 a MS 10 (125 - 300 ms)</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(7, 12, 22, 0.5)", padding: "4px 8px", borderRadius: 4 }}>
                  <span>3. Cuadradores y Corona:</span>
                  <b style={{ color: "#a855f7" }}>LP 1 a LP 5 (0.5 - 2.5 s)</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(7, 12, 22, 0.5)", padding: "4px 8px", borderRadius: 4 }}>
                  <span>4. Arrastres (piso):</span>
                  <b style={{ color: "#10b981" }}>LP 6 a LP 8 (últimos para proyectar saca)</b>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: RESULTADO Y ANALÍTICA PREDICTIVA DE VOLADURA */}
        {/* ================================================================= */}
        {tab === "resultado" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            {/* TARJETA 1: GALERÍA Y PARÁMETROS GEOMÉTRICOS */}
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
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoPerfilHerradura size={16} color="#10b981" />
                  <span>GALERÍA Y GEOMETRÍA</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>
                    {anchoGaleria}×{altoGaleria} m · {tipoSeccion.toUpperCase()}
                  </span>
                  <BotonInfoTeoria
                    activo={conceptoAbierto === "galeria"}
                    onClick={() => setConceptoAbierto(conceptoAbierto === "galeria" ? null : "galeria")}
                    titulo="Ver teoría de geometría de labor y fórmulas (?)"
                    tamano="sm"
                  />
                </div>
              </div>

              {conceptoAbierto === "galeria" && (
                <TarjetaTeoriaMalla
                  id="seccion"
                  onCerrar={() => setConceptoAbierto(null)}
                  datosEnVivo={datosEnVivoParaTeoria}
                />
              )}

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                Área útil: <b>{metricasSeccion.area.toFixed(3)} m²</b> · Perímetro:{" "}
                <b>{metricasSeccion.perimetro.toFixed(2)} m</b>
              </div>

              <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 6 }}>
                Avance programado: <b>{avanceM.toFixed(2)} m</b> · Avance real estimado (92%):{" "}
                <b style={{ color: "#38bdf8" }}>{(avanceM * 0.92).toFixed(2)} m</b>
              </div>

              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                RMR: <b style={{ color: recomendacionRmr.colorBadge }}>{rmrScore} pts</b> ({recomendacionRmr.tipo}) · Corona: {metricasSeccion.corona.toFixed(2)} m
              </div>
            </div>

            {/* TARJETA 2: TALADROS EN ESCENA / MALLA */}
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
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <IconoBroca size={16} color="#06b6d4" />
                  <span>TALADROS Y PERFORACIÓN</span>
                </span>
                <span style={{ fontSize: 10, color: "#cbd5e1" }}>
                  &empty; Alivio {diametroAlivioMm}mm &middot; &empty; Prod {diametroProdMm}mm
                </span>
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                Total taladros:{" "}
                <b>
                  {taladrosDetectados.total > 0
                    ? taladrosDetectados.total
                    : desgloseZonas.totalTaladros}{" "}
                  tal
                </b>{" "}
                ({taladrosDetectados.cargados > 0 ? taladrosDetectados.cargados : desgloseZonas.totalCargados} cargados +{" "}
                {taladrosDetectados.alivio > 0 ? taladrosDetectados.alivio : desgloseZonas.alivios} alivio)
              </div>

              <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 6 }}>
                Metraje total perforado:{" "}
                <b style={{ color: "#38bdf8" }}>
                  {taladrosDetectados.metros > 0
                    ? taladrosDetectados.metros.toFixed(1)
                    : (desgloseZonas.totalTaladros * avanceM).toFixed(1)}{" "}
                  m
                </b>
              </div>

              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                Densidad de perforación:{" "}
                <b style={{ color: "#ffffff" }}>
                  {(
                    (taladrosDetectados.total > 0
                      ? taladrosDetectados.total
                      : desgloseZonas.totalTaladros) / metricasSeccion.area
                  ).toFixed(2)}{" "}
                  tal/m²
                </b>{" "}
                  · Perforación específica:{" "}
                  <b>
                    {(
                      (desgloseZonas.totalTaladros * avanceM) /
                      Math.max(0.1, factorCargaEstimado.volumenM3)
                    ).toFixed(2)}{" "}
                    m/m³
                  </b>
                </div>
              </div>

              {/* TARJETA TÉCNICA: DESGLOSE COMPLETO POR TIPO DE TALADRO Y CARGA */}
              <div
                style={{
                  gridColumn: isMobile ? "1" : "1 / -1",
                  background: "rgba(15, 23, 42, 0.85)",
                  borderRadius: 12,
                  padding: 14,
                  border: "1px solid #3b82f6",
                  overflowX: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#60a5fa",
                    letterSpacing: "0.05em",
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <IconoAnalitica size={16} color="#60a5fa" />
                    <span>CUADRO TÉCNICO DETALLADO POR TIPO DE TALADRO</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>
                      Norma Orica / EXSA / FAMESA · Avance {avanceM} m
                    </span>
                    <BotonInfoTeoria
                      activo={conceptoAbierto === "cuadro_tecnico"}
                      onClick={() => setConceptoAbierto(conceptoAbierto === "cuadro_tecnico" ? null : "cuadro_tecnico")}
                      titulo="Ver justificación técnica de tacos, look-out y desacoplamiento (?)"
                      tamano="sm"
                    />
                  </div>
                </div>

                {conceptoAbierto === "cuadro_tecnico" && (
                  <TarjetaTeoriaMalla
                    id="cuadro_tecnico"
                    onCerrar={() => setConceptoAbierto(null)}
                    datosEnVivo={datosEnVivoParaTeoria}
                  />
                )}

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11,
                    textAlign: "left",
                    minWidth: 640,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                      <th style={{ padding: "6px 8px" }}>Zona / Tipo</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>N.° Tal</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>Ø (mm)</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>Long. (m)</th>
                      <th style={{ padding: "6px 8px" }}>Explosivo Asignado</th>
                      <th style={{ padding: "6px 8px" }}>Tipo de Carga</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>Taco (m)</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>Look-out</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
                      <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f0ff", display: "inline-block" }} />
                        <b>Alivio (Escariadores)</b>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#00f0ff" }}>{desgloseZonas.alivios}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{diametroAlivioMm} mm</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{avanceM} m</td>
                      <td style={{ padding: "6px 8px", color: "#94a3b8" }}>Ninguno (Taladro Vacío)</td>
                      <td style={{ padding: "6px 8px", color: "#94a3b8" }}>Sin Carga</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", color: "#94a3b8" }}>-</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>0°</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
                      <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--acento, #f97316)", display: "inline-block" }} />
                        <b>Arranque (Cuele Cuádruple)</b>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "var(--acento, #f97316)" }}>{desgloseZonas.arranque}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{diametroProdMm} mm</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{avanceM} m</td>
                      <td style={{ padding: "6px 8px" }}>{explosivoActual.nombre}</td>
                      <td style={{ padding: "6px 8px" }}>Columna Continua Fuerte</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>0.30 m</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>0°</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
                      <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308", display: "inline-block" }} />
                        <b>Ayudas de Destroza</b>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#eab308" }}>{desgloseZonas.ayudas}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{diametroProdMm} mm</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{avanceM} m</td>
                      <td style={{ padding: "6px 8px" }}>{explosivoActual.nombre}</td>
                      <td style={{ padding: "6px 8px" }}>Carga Normal</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{(avanceM * 0.2).toFixed(2)} m</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>0°</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
                      <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", display: "inline-block" }} />
                        <b>Cuadradores (Hastiales)</b>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#a855f7" }}>{desgloseZonas.cuadradores}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{diametroProdMm} mm</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{avanceM} m</td>
                      <td style={{ padding: "6px 8px" }}>{explosivoActual.nombre}</td>
                      <td style={{ padding: "6px 8px" }}>Carga Periférica</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{(avanceM * 0.25).toFixed(2)} m</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>2° - 3°</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
                      <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                        <b>Corona (Techo / Bóveda)</b>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#10b981" }}>{desgloseZonas.corona}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{diametroProdMm} mm</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{avanceM} m</td>
                      <td style={{ padding: "6px 8px" }}>Exsacorte / Carga Amortiguada</td>
                      <td style={{ padding: "6px 8px" }}>Desacoplada (Smooth Blasting)</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{(avanceM * 0.3).toFixed(2)} m</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>3°</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b", display: "inline-block" }} />
                        <b>Arrastres (Zapateras / Piso)</b>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#94a3b8" }}>{desgloseZonas.arrastre}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{diametroProdMm} mm</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{avanceM} m</td>
                      <td style={{ padding: "6px 8px" }}>{explosivoActual.nombre} (Alta Densidad)</td>
                      <td style={{ padding: "6px 8px" }}>Carga de Fondo Fuerte</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>0.25 m</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>3° - 4°</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TARJETA 3: BALANCE DE EXPLOSIVOS & FACTOR DE CARGA (POWDER FACTOR) */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.75)",
                  borderRadius: 12,
                  padding: 14,
                  border: factorCargaEstimado.rangoOptimo
                    ? "1.5px solid #10b981"
                    : "1.5px solid var(--acento, #f97316)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: factorCargaEstimado.rangoOptimo ? "#10b981" : "var(--acento, #f97316)",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <IconoExplosivo size={16} color="#f97316" />
                    <span>BALANCE DE EXPLOSIVOS Y FACTOR DE CARGA</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: factorCargaEstimado.rangoOptimo
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(249, 115, 22, 0.2)",
                        color: factorCargaEstimado.rangoOptimo ? "#10b981" : "var(--acento, #f97316)",
                      }}
                    >
                      {factorCargaEstimado.rangoOptimo ? "RANGO ÓPTIMO" : "VERIFICAR"}
                    </span>
                    <BotonInfoTeoria
                      activo={conceptoAbierto === "balance_explosivos"}
                      onClick={() => setConceptoAbierto(conceptoAbierto === "balance_explosivos" ? null : "balance_explosivos")}
                      titulo="Ver teoría de balance de masa y rangos óptimos de powder factor (?)"
                      tamano="sm"
                    />
                  </div>
                </div>

                {conceptoAbierto === "balance_explosivos" && (
                  <TarjetaTeoriaMalla
                    id="balance_explosivos"
                    onCerrar={() => setConceptoAbierto(null)}
                    datosEnVivo={datosEnVivoParaTeoria}
                  />
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, marginBottom: 8 }}>
                  <div>
                    Volumen roto teórico: <b>{factorCargaEstimado.volumenM3.toFixed(2)} m³</b>
                  </div>
                  <div>
                    Toneladas rotas (&rho; 2.7): <b>{factorCargaEstimado.toneladas.toFixed(1)} t</b>
                  </div>
                  <div>
                    Explosivo: <b style={{ color: "#38bdf8" }}>{explosivoActual.nombre}</b>
                  </div>
                  <div>
                    Carga lineal q<sub>l</sub>: <b>{factorCargaEstimado.q_l_kg_m.toFixed(3)} kg/m</b>
                  </div>
                  <div>
                    Peso total explosivo: <b style={{ color: "#f97316" }}>{factorCargaEstimado.pesoTotalKg.toFixed(1)} kg</b>
                  </div>
                  <div>
                    Factor de carga:{" "}
                    <b
                      style={{
                        fontSize: 13,
                        color: factorCargaEstimado.rangoOptimo ? "#10b981" : "var(--acento, #f97316)",
                      }}
                    >
                      {factorCargaEstimado.factorCargaKgM3.toFixed(2)} kg/m³
                    </b>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 10,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: factorCargaEstimado.rangoOptimo
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(249, 115, 22, 0.1)",
                    color: factorCargaEstimado.rangoOptimo ? "#a7f3d0" : "#fed7aa",
                  }}
                >
                  {factorCargaEstimado.rangoOptimo
                    ? "Factor de carga dentro del estándar para túneles subterráneos (2.0 a 4.0 kg/m³). Fragmentación equilibrada garantizada."
                    : factorCargaEstimado.factorCargaKgM3 < 2.0
                    ? "Carga específica baja (<2.0 kg/m³): verificar que la roca no sea excesivamente tenaz para evitar bolones."
                    : "Carga específica alta (>4.0 kg/m³): verificar taco y desacoplamiento para evitar daño a las cajas/hastiales."}
                </div>
              </div>

              {/* TARJETA 4: PREDICCIÓN DE FRAGMENTACIÓN KUZ-RAM */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.75)",
                  borderRadius: 12,
                  padding: 14,
                  border: "1px solid #a855f7",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#c084fc",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <IconoAnalitica size={16} color="#c084fc" />
                    <span>FRAGMENTACIÓN PREDICTIVA (KUZ-RAM)</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          resultadoKuzRam.calidadFragmentacion === "optima"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(249, 115, 22, 0.2)",
                        color:
                          resultadoKuzRam.calidadFragmentacion === "optima" ? "#10b981" : "#f97316",
                      }}
                    >
                      {resultadoKuzRam.calidadFragmentacion.toUpperCase()}
                    </span>
                    <BotonInfoTeoria
                      activo={conceptoAbierto === "kuz_ram"}
                      onClick={() => setConceptoAbierto(conceptoAbierto === "kuz_ram" ? null : "kuz_ram")}
                      titulo="Ver modelo Kuz-Ram, ecuaciones de Kuznetsov y Rosin-Rammler (?)"
                      tamano="sm"
                    />
                  </div>
                </div>

                {conceptoAbierto === "kuz_ram" && (
                  <TarjetaTeoriaMalla
                    id="kuz_ram"
                    onCerrar={() => setConceptoAbierto(null)}
                    datosEnVivo={datosEnVivoParaTeoria}
                  />
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, marginBottom: 8 }}>
                  <div>
                    Tamaño medio X<sub>50</sub>:{" "}
                    <b style={{ color: "#ffffff", fontSize: 12 }}>
                      {resultadoKuzRam.x50_cm.toFixed(1)} cm ({Math.round(resultadoKuzRam.x50_cm * 10)} mm)
                    </b>
                  </div>
                  <div>
                    Índice de uniformidad n: <b>{resultadoKuzRam.indiceUniformidad_n.toFixed(2)}</b>
                  </div>
                  <div>
                    Finos (&lt; 2.5 cm): <b>{resultadoKuzRam.porcentajeFinos_5cm.toFixed(1)}%</b>
                  </div>
                  <div>
                    Sobretamaño / Bolones (&gt; 30 cm):{" "}
                    <b style={{ color: resultadoKuzRam.porcentajeSobretamano_30cm > 15 ? "#ef4444" : "#10b981" }}>
                      {resultadoKuzRam.porcentajeSobretamano_30cm.toFixed(1)}%
                    </b>
                  </div>
                </div>

                <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
                  {resultadoKuzRam.calidadFragmentacion === "optima"
                    ? "Granulometría óptima para acarreo con equipos LHD y chancado primario sin sobrecostos de taqueo."
                    : resultadoKuzRam.calidadFragmentacion === "fina"
                    ? "Fragmentación fina generada por alta densidad de energía o macizo fracturado."
                    : "Presencia de bolones estimada: considerar incrementar ligeramente la carga en ayudas o reducir el espaciamiento."}
                </div>
              </div>

              {/* TARJETA 5: CONTROL DE DAÑO EN CAMPO CERCANO HOLMBERG-PERSSON */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.75)",
                  borderRadius: 12,
                  padding: 14,
                  border:
                    resultadoHolmbergPersson.riesgoSobreExcavacion === "bajo"
                      ? "1px solid #10b981"
                      : resultadoHolmbergPersson.riesgoSobreExcavacion === "moderado"
                      ? "1px solid #eab308"
                      : "1px solid #ef4444",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      resultadoHolmbergPersson.riesgoSobreExcavacion === "bajo"
                        ? "#10b981"
                        : resultadoHolmbergPersson.riesgoSobreExcavacion === "moderado"
                        ? "#facc15"
                        : "#ef4444",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <IconoEscudo size={16} color="#f59e0b" />
                    <span>DAÑO EN CAMPO CERCANO (HOLMBERG-PERSSON)</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          resultadoHolmbergPersson.riesgoSobreExcavacion === "bajo"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        color:
                          resultadoHolmbergPersson.riesgoSobreExcavacion === "bajo"
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      RIESGO {resultadoHolmbergPersson.riesgoSobreExcavacion.toUpperCase()}
                    </span>
                    <BotonInfoTeoria
                      activo={conceptoAbierto === "holmberg_persson"}
                      onClick={() => setConceptoAbierto(conceptoAbierto === "holmberg_persson" ? null : "holmberg_persson")}
                      titulo="Ver modelo de daño Holmberg-Persson y PPV crítico (?)"
                      tamano="sm"
                    />
                  </div>
                </div>

                {conceptoAbierto === "holmberg_persson" && (
                  <TarjetaTeoriaMalla
                    id="holmberg_persson"
                    onCerrar={() => setConceptoAbierto(null)}
                    datosEnVivo={datosEnVivoParaTeoria}
                  />
                )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, marginBottom: 8 }}>
                <div>
                  PPV pico contorno:{" "}
                  <b style={{ color: "#ffffff" }}>{resultadoHolmbergPersson.ppvContorno_mms} mm/s</b>
                </div>
                <div>
                  Radio daño crítico:{" "}
                  <b style={{ color: "#38bdf8" }}>{resultadoHolmbergPersson.radioDanoCritico_m.toFixed(2)} m</b>
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "#cbd5e1" }}>
                  Voladura controlada contorno:{" "}
                  <b style={{ color: patronContorno !== "uniforme" ? "#10b981" : "#f97316" }}>
                    {patronContorno !== "uniforme" ? "Activada (Smooth Blasting)" : "Desactivada (Corona uniforme)"}
                  </b>
                </div>
              </div>

              <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
                {resultadoHolmbergPersson.recomendacionVoladuraSuave}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* PIE / BOTONES DE NAVEGACIÓN (ANTERIOR / SIGUIENTE) */}
      {!minimizado && (
        <div
          style={{
            padding: isMobile ? "8px 12px" : "10px 18px",
            borderTop: "1px solid #1e293b",
            background: "rgba(7, 12, 22, 0.95)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: isMobile ? 8 : 10,
          }}
        >
          <button
            type="button"
            onClick={irPasoAnterior}
            disabled={tab === "datos"}
            style={{
              padding: isMobile ? "8px" : "9px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "transparent",
              color: tab === "datos" ? "#475569" : "#e2e8f0",
              fontSize: isMobile ? 11 : 12,
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
              padding: isMobile ? "8px" : "9px",
              borderRadius: 8,
              border: "none",
              background: "var(--acento, #f97316)",
              color: "#ffffff",
              fontSize: isMobile ? 11 : 12,
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
      )}
    </div>
  );
}
