import type { CSSProperties, ReactNode } from "react";

/**
 * Kit visual de diseño premium para Estereografía Estructural y Cinemática de Taludes.
 * Paleta corporativa minera: Verde Esmeralda (#10b981), Menta (#34d399, #6ee7b7),
 * con acentos técnicos en Ámbar (#f59e0b) y Rojo (#ef4444).
 */
export const ACENTO = "#10b981";
export const ACENTO_SUAVE = "#34d399";
export const ACENTO_FONDO = "rgba(16, 185, 129, 0.16)";
export const ACENTO_BORDE = "rgba(16, 185, 129, 0.3)";
export const ACENTO_CYAN = "#06b6d4";
export const ACENTO_MAGENTA = "#ec4899";

interface TarjetaProps {
  icono?: ReactNode;
  titulo: string;
  subtitulo?: string;
  extra?: ReactNode;
  colorBorde?: string;
  children: ReactNode;
  style?: CSSProperties;
}

/** Tarjeta con diseño glassmorphic de ingeniería, borde luminoso sutil y encabezado enriquecido */
export function Tarjeta({ icono, titulo, subtitulo, extra, colorBorde, children, style }: TarjetaProps) {
  return (
    <div
      className="estereo-card"
      style={{
        ...(colorBorde ? { borderColor: colorBorde } : {}),
        ...style,
      }}
    >
      <div className="estereo-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {icono && <div className="estereo-card-icon">{icono}</div>}
          <div>
            <div className="estereo-card-title">{titulo}</div>
            {subtitulo && (
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, letterSpacing: "0.02em" }}>
                {subtitulo}
              </div>
            )}
          </div>
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

/** Chip elegante para contadores, tags y badges */
export function Chip({
  children,
  color = ACENTO,
  bg,
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color,
        background: bg || `${color}18`,
        border: `1px solid ${color}44`,
        borderRadius: 999,
        padding: "2px 8px",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </span>
  );
}

interface OpcionPill<T extends string> {
  value: T;
  label: string;
  icono?: string;
}

interface PillGroupProps<T extends string> {
  opciones: OpcionPill<T>[];
  valor: T;
  onCambiar: (v: T) => void;
  columnas?: number;
}

/** Segmented Control táctil de alta definición */
export function PillGroup<T extends string>({ opciones, valor, onCambiar, columnas }: PillGroupProps<T>) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnas ?? opciones.length}, 1fr)`,
        gap: 5,
        background: "rgba(6, 18, 15, 0.7)",
        padding: 3,
        borderRadius: 11,
        border: "1px solid rgba(16, 185, 129, 0.12)",
      }}
    >
      {opciones.map((o) => {
        const activo = o.value === valor;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onCambiar(o.value)}
            style={{
              padding: "7px 6px",
              fontSize: 11,
              fontWeight: activo ? 700 : 500,
              borderRadius: 8,
              border: activo ? "1px solid rgba(52, 211, 153, 0.5)" : "1px solid transparent",
              background: activo
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(5, 150, 105, 0.22))"
                : "transparent",
              color: activo ? "#ffffff" : "#94a3b8",
              cursor: "pointer",
              transition: "all 0.15s ease",
              lineHeight: 1.25,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              boxShadow: activo ? "0 2px 8px rgba(16, 185, 129, 0.25)" : "none",
            }}
          >
            {o.icono && <span style={{ fontSize: 12 }}>{o.icono}</span>}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Componente de número con stepper táctil (+/-) para teléfonos y escritorios */
export function StepperInput({
  valor,
  min = 0,
  max = 360,
  step = 1,
  sufijo = "°",
  onCambiar,
}: {
  valor: number;
  min?: number;
  max?: number;
  step?: number;
  sufijo?: string;
  onCambiar: (v: number) => void;
}) {
  const decrementar = () => {
    const nuevo = Math.max(min, valor - step);
    onCambiar(nuevo);
  };

  const incrementar = () => {
    const nuevo = Math.min(max, valor + step);
    onCambiar(nuevo);
  };

  return (
    <div className="estereo-stepper">
      <button
        type="button"
        className="estereo-stepper-btn"
        onClick={decrementar}
        title="Disminuir"
      >
        −
      </button>
      <input
        type="number"
        className="estereo-stepper-input"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(e) => {
          const val = Number(e.target.value);
          if (!isNaN(val)) {
            onCambiar(Math.max(min, Math.min(max, val)));
          }
        }}
      />
      {sufijo && (
        <span style={{ fontSize: 12, color: "#64748b", paddingRight: 4, userSelect: "none" }}>
          {sufijo}
        </span>
      )}
      <button
        type="button"
        className="estereo-stepper-btn"
        onClick={incrementar}
        title="Incrementar"
      >
        +
      </button>
    </div>
  );
}

/** Deslizador con track en degradé esmeralda a menta */
export function Deslizador({
  valor,
  min,
  max,
  step = 1,
  onCambiar,
}: {
  valor: number;
  min: number;
  max: number;
  step?: number;
  onCambiar: (v: number) => void;
}) {
  const pct = ((valor - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={valor}
      onChange={(e) => onCambiar(Number(e.target.value))}
      style={{
        width: "100%",
        accentColor: ACENTO,
        background: `linear-gradient(to right, #059669 0%, #10b981 ${pct}%, #1e293b ${pct}%)`,
        height: 6,
        borderRadius: 999,
        appearance: "none",
        WebkitAppearance: "none",
        cursor: "pointer",
        outline: "none",
      }}
    />
  );
}

/** Barra de progreso con gradiente y porcentaje visual */
export function BarraProgreso({ pct, color }: { pct: number; color: string }) {
  const clamp = Math.min(100, Math.max(0, pct));
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.7)",
        borderRadius: 999,
        height: 6,
        overflow: "hidden",
        width: "100%",
        border: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      <div
        style={{
          width: `${clamp}%`,
          background: color,
          height: "100%",
          borderRadius: 999,
          boxShadow: `0 0 8px ${color}88`,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

/** Badge de estado cinemático con punto LED pulsante */
export function RiskBadge({
  tipo,
  texto,
}: {
  tipo: "critico" | "advertencia" | "seguro";
  texto: string;
}) {
  const config = {
    critico: {
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.15)",
      borde: "rgba(239, 68, 68, 0.4)",
      dot: "#f87171",
    },
    advertencia: {
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.15)",
      borde: "rgba(245, 158, 11, 0.4)",
      dot: "#fbbf24",
    },
    seguro: {
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.15)",
      borde: "rgba(16, 185, 129, 0.4)",
      dot: "#34d399",
    },
  }[tipo];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.borde}`,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.dot,
          boxShadow: `0 0 6px ${config.dot}`,
        }}
      />
      {texto}
    </span>
  );
}
