import React from "react";
import type { TipoMotorTopo } from "../motoresTopograficos.js";

interface IconProps {
  size?: number;
  className?: string;
}

// -----------------------------------------------------------------------------
// ICONOS DE LOS 8 MOTORES TOPOGRÁFICOS (PRECISIÓN CAD / GEODESIA)
// -----------------------------------------------------------------------------

export function IconoMotor({ id, size = 22, className = "" }: { id: TipoMotorTopo; size?: number; className?: string }) {
  switch (id) {
    case "POL":
      // Poligonal cerrada: Polígono de 5 estaciones con vértices triangulares geodésicos y vector de cierre
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 3 20 8 18 19 6 19 4 8" strokeOpacity="0.9" />
          {/* Estaciones geodésicas en vértices */}
          <polygon points="12 2 13.5 5 10.5 5" fill="currentColor" />
          <polygon points="20 7 21.5 10 18.5 10" fill="currentColor" />
          <polygon points="18 18 19.5 21 16.5 21" fill="currentColor" />
          <polygon points="6 18 7.5 21 4.5 21" fill="currentColor" />
          <polygon points="4 7 5.5 10 2.5 10" fill="currentColor" />
          {/* Ejes y centro de poligonal */}
          <line x1="12" y1="9" x2="12" y2="14" strokeWidth="1.2" strokeDasharray="2 2" strokeOpacity="0.7" />
          <line x1="9" y1="12" x2="15" y2="12" strokeWidth="1.2" strokeDasharray="2 2" strokeOpacity="0.7" />
        </svg>
      );

    case "NIV":
      // Nivelación compuesta: Nivel óptico sobre trípode con línea de colimación horizontal y mira graduada en BM
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Nivel óptico (anteojo) */}
          <rect x="3" y="6" width="9" height="4" rx="1" />
          <line x1="3" y1="8" x2="1" y2="8" strokeWidth="2" />
          <line x1="12" y1="8" x2="13" y2="8" strokeWidth="2.5" />
          {/* Trípode */}
          <line x1="7.5" y1="10" x2="4" y2="21" />
          <line x1="7.5" y1="10" x2="7.5" y2="21" />
          <line x1="7.5" y1="10" x2="11" y2="21" />
          {/* Línea de visual/colimación rasante */}
          <line x1="13" y1="8" x2="20" y2="8" strokeDasharray="2 2" strokeWidth="1.3" strokeOpacity="0.8" />
          {/* Mira topográfica con graduación */}
          <rect x="19" y="3" width="3" height="18" rx="0.5" strokeWidth="1.5" />
          <line x1="19" y1="6" x2="22" y2="6" strokeWidth="1" />
          <line x1="19" y1="9" x2="22" y2="9" strokeWidth="1" />
          <line x1="19" y1="12" x2="22" y2="12" strokeWidth="1" />
          <line x1="19" y1="15" x2="22" y2="15" strokeWidth="1" />
          <line x1="19" y1="18" x2="22" y2="18" strokeWidth="1" />
        </svg>
      );

    case "COO":
      // Coordenadas y radiaciones: Origen con ejes N-E, azimut angular y prisma radiado
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Ejes Norte y Este */}
          <line x1="4" y1="20" x2="4" y2="4" strokeWidth="1.8" />
          <polyline points="2 6 4 4 6 6" strokeWidth="1.8" />
          <line x1="4" y1="20" x2="20" y2="20" strokeWidth="1.8" />
          <polyline points="18 18 20 20 18 22" strokeWidth="1.8" />
          {/* Estación base P1 */}
          <circle cx="4" cy="20" r="2.5" fill="currentColor" />
          {/* Vector radiado a P2 */}
          <line x1="4" y1="20" x2="18" y2="8" strokeWidth="2" />
          {/* Prisma reflector / estación radiada P2 */}
          <circle cx="18" cy="8" r="3" strokeWidth="1.5" />
          <circle cx="18" cy="8" r="1" fill="currentColor" />
          {/* Arco de azimut */}
          <path d="M4 11 A9 9 0 0 1 11 13" strokeDasharray="1.5 1.5" strokeWidth="1.2" />
        </svg>
      );

    case "CH":
      // Curva horizontal: Tangentes en PI, arco circular y puntos de tangencia PC y PT con radio
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Tangentes exterior que intersectan en PI */}
          <line x1="3" y1="19" x2="14" y2="5" strokeDasharray="2.5 2" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="14" y1="5" x2="21" y2="18" strokeDasharray="2.5 2" strokeWidth="1.2" strokeOpacity="0.6" />
          {/* Vértice PI */}
          <circle cx="14" cy="5" r="1.8" fill="currentColor" />
          {/* Arco circular de la curva */}
          <path d="M5 16.5 C 9 10, 15 10, 19.5 16" strokeWidth="2.4" strokeLinecap="round" />
          {/* Hitos PC y PT */}
          <circle cx="5" cy="16.5" r="2" fill="currentColor" />
          <circle cx="19.5" cy="16" r="2" fill="currentColor" />
          {/* Radios hacia el centro de curvatura */}
          <line x1="5" y1="16.5" x2="12" y2="21" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.5" />
          <line x1="19.5" y1="16" x2="12" y2="21" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.5" />
          <circle cx="12" cy="21" r="1.5" strokeWidth="1.2" />
        </svg>
      );

    case "CV":
      // Curva vertical: Perfil de rasante con pendientes tangentes, vértice PVI y arco parabólico
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Grilla técnica de perfil */}
          <line x1="3" y1="21" x2="21" y2="21" strokeWidth="1.4" strokeOpacity="0.5" />
          <line x1="3" y1="4" x2="3" y2="21" strokeWidth="1.4" strokeOpacity="0.5" />
          {/* Tangentes de rasante (g1 y g2) */}
          <line x1="4" y1="16" x2="12" y2="6" strokeDasharray="2.5 2" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="12" y1="6" x2="20" y2="16" strokeDasharray="2.5 2" strokeWidth="1.2" strokeOpacity="0.6" />
          {/* Vértice PVI */}
          <circle cx="12" cy="6" r="1.8" fill="currentColor" />
          {/* Curva vertical parabólica */}
          <path d="M4 16 Q 12 8.5 20 16" strokeWidth="2.4" strokeLinecap="round" />
          {/* Hitos PVC y PVT */}
          <circle cx="4" cy="16" r="2" fill="currentColor" />
          <circle cx="20" cy="16" r="2" fill="currentColor" />
        </svg>
      );

    case "PEN":
      // Pendiente y emplantillado: Triángulo de pendiente de rasante con cruceta de emplantillado
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Triángulo geométrico de rasante */}
          <line x1="3" y1="19" x2="21" y2="19" strokeWidth="1.5" strokeOpacity="0.5" />
          <line x1="21" y1="19" x2="21" y2="7" strokeWidth="1.5" strokeOpacity="0.5" />
          {/* Línea de rasante con pendiente */}
          <line x1="3" y1="19" x2="21" y2="7" strokeWidth="2.2" />
          {/* Cruceta / estaca de emplantillado en punto intermedio */}
          <line x1="12" y1="21" x2="12" y2="10" strokeWidth="1.8" />
          {/* Travesaño horizontal de la cruceta de emplantillado */}
          <line x1="9" y1="10" x2="15" y2="10" strokeWidth="2.2" />
          <circle cx="12" cy="13" r="1.8" fill="currentColor" />
        </svg>
      );

    case "AREA":
      // Área por coordenadas: Polígono catastral cerrado con vértices geodésicos, achurado y centroide
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Contorno poligonal */}
          <polygon points="5 18 3 8 13 4 21 9 18 19" strokeWidth="2" strokeOpacity="0.95" />
          {/* Achurado técnico de superficie */}
          <line x1="6" y1="13" x2="10" y2="6" strokeWidth="1" strokeOpacity="0.4" />
          <line x1="10" y1="16" x2="16" y2="7" strokeWidth="1" strokeOpacity="0.4" />
          <line x1="14" y1="18" x2="19" y2="13" strokeWidth="1" strokeOpacity="0.4" />
          {/* Centroide con retícula de cruz */}
          <circle cx="12" cy="12" r="2.5" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );

    case "BUZ":
      // Replanteo de buzones: Vista volumétrica con brocal circular de buzón, pozo vertical y tubería con pendiente
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Tapa de buzón superior (elipse brocal) */}
          <ellipse cx="8" cy="6" rx="5" ry="2.2" strokeWidth="1.8" />
          {/* Pozo cilíndrico del buzón principal */}
          <line x1="3" y1="6" x2="3" y2="18" strokeWidth="1.8" />
          <line x1="13" y1="6" x2="13" y2="18" strokeWidth="1.8" />
          <ellipse cx="8" cy="18" rx="5" ry="2.2" strokeWidth="1.8" />
          <circle cx="8" cy="6" r="1.2" fill="currentColor" />
          {/* Tubería de salida hacia segundo buzón en desnivel */}
          <path d="M13 17 L21 20" strokeWidth="2.2" />
          <path d="M13 19 L21 22" strokeWidth="2.2" />
          {/* Segundo buzón aguas abajo */}
          <line x1="21" y1="14" x2="21" y2="22" strokeWidth="1.5" strokeOpacity="0.6" />
        </svg>
      );

    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// ICONOS DE ACCIONES, HERRAMIENTAS Y NAVEGACIÓN TÉCNICA
// -----------------------------------------------------------------------------

export function IconoGps({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="5" strokeWidth="2.2" />
      <line x1="12" y1="19" x2="12" y2="22" strokeWidth="2.2" />
      <line x1="2" y1="12" x2="5" y2="12" strokeWidth="2.2" />
      <line x1="19" y1="12" x2="22" y2="12" strokeWidth="2.2" />
    </svg>
  );
}

export function IconoReplanteo({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <line x1="12" y1="1" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="23" />
      <line x1="1" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="23" y2="12" />
    </svg>
  );
}

export function IconoExportar({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function Icono3D({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function Icono2D({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="9" y1="3" x2="9" y2="21" strokeWidth="1.2" strokeDasharray="2 2" />
      <polyline points="9 16 12 13 16 17" strokeWidth="2" />
    </svg>
  );
}

export function IconoGuardar({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export function IconoRestaurar({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function IconoCompartir({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function IconoVolver({ size = 18, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconoPlus({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconoCheck({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconoTrash({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconoCopy({ size = 15, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconoChevronDown({ size = 14, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Iconos para tipos de archivo / interoperabilidad
export function IconoDxf({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

export function IconoCsv({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export function IconoGeoJson({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function IconoCad3D({ size = 16, className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
