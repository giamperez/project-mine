import React, { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  areaPoligono_m2,
  longitudPoligono_m,
  snapAGrilla,
  type Punto2D,
  type Taladro,
} from "@suite/core";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { descargarTexto } from "../utils/descargar.js";
import {
  type EntidadRecortable,
  obtenerPuntosDeEntidad,
  calcularInterseccionesEntidades,
  partirCurvaPorCortes,
  type ResultadoParticion,
} from "../utils/cadRecorte.js";
import {
  type RefEntidadUni,
  unirEntidadesEnPolilinea,
  separarPolilineaEnLineas,
  calcularCentroideEntidades,
} from "../utils/cadUnirSeparar.js";
import {
  type ModoDesfase,
  type ResultadoDesfase,
  desfasarLinea,
  desfasarArco,
  desfasarPolilinea,
} from "../utils/cadDesfase.js";

type HerramientaCad =
  | "SEL"
  | "PTO"
  | "LIN"
  | "PL"
  | "ARC"
  | "REC"
  | "UNI"
  | "DIV"
  | "OFF"
  | "COT"
  | "TAL"
  | "SOL"
  | "GRI";

type SistemaCoordenadas = "local" | "utm_18s" | "utm_19s" | "psad56";
type TipoLinea = "continua" | "discontinua" | "puntos" | "centro";
type RolIngenieria = "geometria" | "galeria" | "burden_spacing";

export type TipoPuntoCad = "cruz_x" | "cruz_mas" | "circulo_x" | "punto";

export interface PuntoCad3D {
  id: string;
  x: number;
  y: number;
  z: number;
  capaId: string;
  tipo?: TipoPuntoCad;
}

export interface LineaCad3D {
  id: string;
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
  capaId: string;
  tipo: TipoLinea;
  rol: RolIngenieria;
  longitud: number;
  azimut: number;
}

export interface PolilineaCad3D {
  id: string;
  puntos: { x: number; y: number; z: number }[];
  cerrada: boolean;
  capaId: string;
  tipo: TipoLinea;
  rol: RolIngenieria;
  longitud: number;
}

export type MetodoArco = "inicio_fin_r" | "centro_r" | "tres_puntos";

export interface ArcoCad3D {
  id: string;
  metodo: MetodoArco;
  centro: { x: number; y: number; z: number };
  radio: number;
  anguloInicio: number;
  anguloFin: number;
  puntos: { x: number; y: number; z: number }[];
  capaId: string;
  tipo: TipoLinea;
  rol: RolIngenieria;
  longitud: number;
}

export type TipoCotaCad = "distancia" | "b1" | "b2" | "b3" | "b4" | "b5" | "4g";

export interface CotaCad3D {
  id: string;
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
  desplazamiento: number;
  texto: string;
  tipo: TipoCotaCad;
  capaId: string;
}

export interface AristaSolidoCad {
  id: string;
  solidoId: string;
  tipo: "superior" | "inferior" | "vertical";
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
  longitud: number;
}

export interface SolidoCad3D {
  id: string;
  nombre: string;
  perfil: { x: number; y: number }[];
  modoExtrusion?: "profundidad" | "levantamiento" | "ambos";
  profundidad: number;
  levantamiento?: number;
  area_m2: number;
  volumen_m3: number;
  centroide: { x: number; y: number; z: number };
  color: string;
  capaId: string;
  aristas?: AristaSolidoCad[];
}

export type GrupoTaladroCad =
  | "arranque"
  | "alivio"
  | "cuadrante"
  | "produccion"
  | "corona"
  | "hastial"
  | "arrastre";

export interface InfoGrupoTaladro {
  id: GrupoTaladroCad;
  label: string;
  abrev: string;
  colorDefecto: string;
  radioMmDefecto: string;
  longitudMDefecto: string;
  lookOutDefecto: string;
  gradienteDefecto: string;
  cargadoDefecto: boolean;
}

export const GRUPOS_TALADRO_CONFIG: InfoGrupoTaladro[] = [
  {
    id: "arranque",
    label: "Arranque",
    abrev: "ARR",
    colorDefecto: "#ec4899",
    radioMmDefecto: "22.5",
    longitudMDefecto: "3.6",
    lookOutDefecto: "0",
    gradienteDefecto: "0",
    cargadoDefecto: true,
  },
  {
    id: "alivio",
    label: "Alivio",
    abrev: "ALIV",
    colorDefecto: "#00f0ff",
    radioMmDefecto: "51.0",
    longitudMDefecto: "3.8",
    lookOutDefecto: "0",
    gradienteDefecto: "0",
    cargadoDefecto: false,
  },
  {
    id: "cuadrante",
    label: "Cuadrante",
    abrev: "CUA",
    colorDefecto: "#f59e0b",
    radioMmDefecto: "22.5",
    longitudMDefecto: "3.6",
    lookOutDefecto: "0",
    gradienteDefecto: "0",
    cargadoDefecto: true,
  },
  {
    id: "produccion",
    label: "Producción",
    abrev: "PROD",
    colorDefecto: "#8b5cf6",
    radioMmDefecto: "22.5",
    longitudMDefecto: "3.6",
    lookOutDefecto: "0",
    gradienteDefecto: "0",
    cargadoDefecto: true,
  },
  {
    id: "corona",
    label: "Corona",
    abrev: "COR",
    colorDefecto: "#10b981",
    radioMmDefecto: "22.5",
    longitudMDefecto: "3.6",
    lookOutDefecto: "3",
    gradienteDefecto: "0",
    cargadoDefecto: true,
  },
  {
    id: "hastial",
    label: "Hastial",
    abrev: "HAS",
    colorDefecto: "#f97316",
    radioMmDefecto: "22.5",
    longitudMDefecto: "3.6",
    lookOutDefecto: "3",
    gradienteDefecto: "0",
    cargadoDefecto: true,
  },
  {
    id: "arrastre",
    label: "Arrastre",
    abrev: "ARRS",
    colorDefecto: "#eab308",
    radioMmDefecto: "22.5",
    longitudMDefecto: "3.6",
    lookOutDefecto: "0",
    gradienteDefecto: "-3",
    cargadoDefecto: true,
  },
];

export interface CapaCad {
  id: string;
  nombre: string;
  color: string;
  visible: boolean;
  bloqueada: boolean;
  carpetaId: string;
  elementosCount: number;
}

export interface CarpetaCad {
  id: string;
  nombre: string;
  abierta: boolean;
  visible: boolean;
}

interface EditorCadMallaProps {
  poligonoCresta: Punto2D[];
  onCambiarPoligono: (nuevos: Punto2D[]) => void;
  taladros: Taladro[];
  onCambiarTaladros?: (nuevos: Taladro[]) => void;
  onIrARender: () => void;
  onVolver: () => void;
}

export function generarPuntosArco(
  p1: { x: number; y: number; z?: number },
  p2: { x: number; y: number; z?: number },
  radio: number,
  ladoIzquierdo: boolean
): { x: number; y: number; z: number }[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return [{ x: p1.x, y: p1.y, z: p1.z || 0 }, { x: p2.x, y: p2.y, z: p2.z || 0 }];

  // El radio debe ser al menos la mitad de la cuerda
  const r = Math.max(d / 2 + 0.001, radio);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)));

  const ux = dx / d;
  const uy = dy / d;
  const px = ladoIzquierdo ? -uy : uy;
  const py = ladoIzquierdo ? ux : -ux;

  const cx = mx + h * px;
  const cy = my + h * py;

  const ang1 = Math.atan2(p1.y - cy, p1.x - cx);
  let ang2 = Math.atan2(p2.y - cy, p2.x - cx);

  if (ladoIzquierdo) {
    while (ang2 <= ang1) ang2 += Math.PI * 2;
  } else {
    while (ang2 >= ang1) ang2 -= Math.PI * 2;
  }

  const steps = 32;
  const pts: { x: number; y: number; z: number }[] = [];
  const z = p1.z || 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = ang1 + t * (ang2 - ang1);
    pts.push({
      x: Math.round((cx + r * Math.cos(ang)) * 100) / 100,
      y: Math.round((cy + r * Math.sin(ang)) * 100) / 100,
      z,
    });
  }
  return pts;
}

export function generarPuntosArco3P(
  p1: { x: number; y: number; z?: number },
  p2: { x: number; y: number; z?: number },
  p3: { x: number; y: number; z?: number }
): { x: number; y: number; z: number }[] {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-4) {
    return [
      { x: p1.x, y: p1.y, z: p1.z || 0 },
      { x: p2.x, y: p2.y, z: p2.z || 0 },
      { x: p3.x, y: p3.y, z: p3.z || 0 },
    ];
  }
  const p1Sq = p1.x * p1.x + p1.y * p1.y;
  const p2Sq = p2.x * p2.x + p2.y * p2.y;
  const p3Sq = p3.x * p3.x + p3.y * p3.y;

  const cx = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
  const cy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;
  const r = Math.hypot(p1.x - cx, p1.y - cy);

  let a1 = Math.atan2(p1.y - cy, p1.x - cx);
  let a2 = Math.atan2(p2.y - cy, p2.x - cx);
  let a3 = Math.atan2(p3.y - cy, p3.x - cx);

  while (a2 < a1) a2 += Math.PI * 2;
  while (a3 < a2) a3 += Math.PI * 2;

  const steps = 32;
  const pts: { x: number; y: number; z: number }[] = [];
  const z = p1.z || 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = a1 + t * (a3 - a1);
    pts.push({
      x: Math.round((cx + r * Math.cos(ang)) * 100) / 100,
      y: Math.round((cy + r * Math.sin(ang)) * 100) / 100,
      z,
    });
  }
  return pts;
}

export default function EditorCadMalla({
  poligonoCresta,
  onCambiarPoligono,
  taladros,
  onCambiarTaladros,
  onIrARender,
  onVolver,
}: EditorCadMallaProps) {
  const [herramienta, setHerramienta] = usePersistedState<HerramientaCad>("cad:herramientaActiva", "SEL");
  const [bloqueadoGlobal, setBloqueadoGlobal] = usePersistedState<boolean>("cad:bloqueadoGlobal", false);
  const [snapActivo, setSnapActivo] = usePersistedState<boolean>("cad:snapActivo", true);
  const [mostrarPuntoMedio, setMostrarPuntoMedio] = usePersistedState<boolean>("cad:mostrarPuntoMedio", false);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Sistema de Coordenadas (con menú desplegable y jalar de archivo)
  const [sistemaCoords, setSistemaCoords] = usePersistedState<SistemaCoordenadas>("cad:sistemaCoords", "local");
  const BASE_UTM_E = 432000;
  const BASE_UTM_N = 8765000;

  // Estado del Panel 'SELECCIONAR' (cerrado por defecto)
  const [panelSelVisible, setPanelSelVisible] = useState(false);
  const [panelSelMinimizado, setPanelSelMinimizado] = usePersistedState<boolean>("cad:panelSelMinimizado", false);
  const [indicesSeleccionados, setIndicesSeleccionados] = useState<number[]>([]);
  const [puntosCad, setPuntosCad] = usePersistedState<PuntoCad3D[]>("cad:puntos", []);
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<string[]>([]);

  // Inputs de desplazamiento ΔX, ΔY, ΔZ
  const [deltaX, setDeltaX] = usePersistedState<string>("cad:deltaX", "0");
  const [deltaY, setDeltaY] = usePersistedState<string>("cad:deltaY", "0");
  const [deltaZ, setDeltaZ] = usePersistedState<string>("cad:deltaZ", "0");

  // Mover a Coordenadas Absolutas Asignadas (X, Y, Z) y Punto Base de Referencia
  const [moverX, setMoverX] = usePersistedState<string>("cad:moverX", "0");
  const [moverY, setMoverY] = usePersistedState<string>("cad:moverY", "0");
  const [moverZ, setMoverZ] = usePersistedState<string>("cad:moverZ", "0");
  const [puntoBaseIndice, setPuntoBaseIndice] = useState<number>(0);
  const [esperandoPuntoBase, setEsperandoPuntoBase] = useState(false);
  const prevSeleccionKeyRef = useRef("");

  // Estado del Panel 'PUNTO' (Exacto a la captura del usuario)
  const [panelPtoVisible, setPanelPtoVisible] = useState(false);
  const [panelPtoMinimizado, setPanelPtoMinimizado] = usePersistedState<boolean>("cad:panelPtoMinimizado", false);
  const [ptoX, setPtoX] = usePersistedState<string>("cad:ptoX", "0");
  const [ptoY, setPtoY] = usePersistedState<string>("cad:ptoY", "0");
  const [ptoZ, setPtoZ] = usePersistedState<string>("cad:ptoZ", "0");
  const [tipoPunto, setTipoPunto] = usePersistedState<TipoPuntoCad>("cad:tipoPunto", "cruz_x");

  // Estado del Panel 'LÍNEA'
  const [panelLinVisible, setPanelLinVisible] = useState(false);
  const [panelLinMinimizado, setPanelLinMinimizado] = usePersistedState<boolean>("cad:panelLinMinimizado", false);
  const [tipoLinea, setTipoLinea] = usePersistedState<TipoLinea>("cad:tipoLinea", "continua");
  const [rolIngenieria, setRolIngenieria] = usePersistedState<RolIngenieria>("cad:rolIngenieria", "geometria");
  const [distanciaLinea, setDistanciaLinea] = usePersistedState<string>("cad:distanciaLinea", "10");
  const [azimutLinea, setAzimutLinea] = usePersistedState<string>("cad:azimutLinea", "0");
  const [lineasCad, setLineasCad] = usePersistedState<LineaCad3D[]>("cad:lineas", []);
  const [lineasSeleccionadas, setLineasSeleccionadas] = useState<string[]>([]);
  const [inicioLinea, setInicioLinea] = useState<{ x: number; y: number; z: number } | null>(null);
  const [cursorGuiaLinea, setCursorGuiaLinea] = useState<{ x: number; y: number; z: number } | null>(null);

  // Estado del Panel 'POLILÍNEA'
  const [panelPlVisible, setPanelPlVisible] = useState(false);
  const [panelPlMinimizado, setPanelPlMinimizado] = usePersistedState<boolean>("cad:panelPlMinimizado", false);
  const [cerrarPolilinea, setCerrarPolilinea] = usePersistedState<boolean>("cad:cerrarPolilinea", false);
  const [verticesPolilinea, setVerticesPolilinea] = useState<{ x: number; y: number; z: number }[]>([]);
  const [cursorGuiaPl, setCursorGuiaPl] = useState<{ x: number; y: number; z: number } | null>(null);
  const [polilineasCad, setPolilineasCad] = usePersistedState<PolilineaCad3D[]>("cad:polilineas", []);
  const [polilineasSeleccionadas, setPolilineasSeleccionadas] = useState<string[]>([]);

  // Estado del Panel 'ARCO'
  const [panelArcVisible, setPanelArcVisible] = useState(false);
  const [panelArcMinimizado, setPanelArcMinimizado] = usePersistedState<boolean>("cad:panelArcMinimizado", false);
  const [metodoArco, setMetodoArco] = usePersistedState<MetodoArco>("cad:metodoArco", "inicio_fin_r");
  const [radioArco, setRadioArco] = usePersistedState<string>("cad:radioArco", "10.0");
  const [anguloInicioArco, setAnguloInicioArco] = usePersistedState<string>("cad:anguloInicioArco", "0");
  const [anguloFinArco, setAnguloFinArco] = usePersistedState<string>("cad:anguloFinArco", "180");
  const [centroIzquierdaArco, setCentroIzquierdaArco] = usePersistedState<boolean>("cad:centroIzquierdaArco", true);
  const [puntosArcoConstruccion, setPuntosArcoConstruccion] = useState<{ x: number; y: number; z: number }[]>([]);
  const [cursorGuiaArc, setCursorGuiaArc] = useState<{ x: number; y: number; z: number } | null>(null);
  const [arcosCad, setArcosCad] = usePersistedState<ArcoCad3D[]>("cad:arcos", []);
  const [arcosSeleccionados, setArcosSeleccionados] = useState<string[]>([]);

  // Estado del Panel 'RECORTAR' (Trim - Exacto al Mockup)
  const [panelRecVisible, setPanelRecVisible] = useState(true);
  const [panelRecMinimizado, setPanelRecMinimizado] = usePersistedState<boolean>("cad:panelRecMinimizado", false);
  const [recObjeto, setRecObjeto] = useState<EntidadRecortable | null>(null);
  const [recCortante, setRecCortante] = useState<EntidadRecortable | null>(null);
  const [recConservarInicio, setRecConservarInicio] = usePersistedState<boolean>("cad:recConservarInicio", true);

  // Estado del Panel 'UNIR / SEPARAR' (UNI)
  const [panelUniVisible, setPanelUniVisible] = useState(false);
  const [panelUniMinimizado, setPanelUniMinimizado] = usePersistedState<boolean>("cad:panelUniMinimizado", false);
  const [forzarPolilineaCerrada, setForzarPolilineaCerrada] = usePersistedState<boolean>("cad:forzarPolilineaCerrada", true);
  const [uniSeleccionadas, setUniSeleccionadas] = useState<RefEntidadUni[]>([]);

  // Estado del Panel 'DIVIDIR' (DIV)
  const [panelDivVisible, setPanelDivVisible] = useState(false);
  const [panelDivMinimizado, setPanelDivMinimizado] = usePersistedState<boolean>("cad:panelDivMinimizado", false);
  const [divPartes, setDivPartes] = usePersistedState<string>("cad:divPartes", "4");
  const [divEntidad, setDivEntidad] = useState<EntidadRecortable | null>(null);

  // Estado del Panel 'DESFASE' (OFF)
  const [panelOffVisible, setPanelOffVisible] = useState(false);
  const [panelOffMinimizado, setPanelOffMinimizado] = usePersistedState<boolean>("cad:panelOffMinimizado", false);
  const [offModo, setOffModo] = usePersistedState<ModoDesfase>("cad:offModo", "exterior");
  const [offDistancia, setOffDistancia] = usePersistedState<string>("cad:offDistancia", "0.25");
  const [offEntidad, setOffEntidad] = useState<EntidadRecortable | null>(null);

  // Estado del Panel 'COTA / B' (COT)
  const [panelCotVisible, setPanelCotVisible] = useState(false);
  const [panelCotMinimizado, setPanelCotMinimizado] = usePersistedState<boolean>("cad:panelCotMinimizado", false);
  const [cotModo, setCotModo] = usePersistedState<TipoCotaCad>("cad:cotModo", "distancia");
  const [cotSeparacion, setCotSeparacion] = usePersistedState<string>("cad:cotSeparacion", "0.18");
  const [cotDistanciaB, setCotDistanciaB] = usePersistedState<string>("cad:cotDistanciaB", "0.50");
  const [cotCuadradoAlineado, setCotCuadradoAlineado] = usePersistedState<boolean>("cad:cotCuadradoAlineado", true);
  const [cotCentro, setCotCentro] = useState<{ x: number; y: number; z: number } | null>(null);
  const [cotPuntoInicio, setCotPuntoInicio] = useState<{ x: number; y: number; z: number } | null>(null);
  const [cotCursorGuia, setCotCursorGuia] = useState<{ x: number; y: number; z: number } | null>(null);
  const [cotasCad, setCotasCad] = usePersistedState<CotaCad3D[]>("cad:cotas", []);
  const [cotasSeleccionadas, setCotasSeleccionadas] = useState<string[]>([]);

  // Estado del Panel 'TALADRO' (TAL)
  const [panelTalVisible, setPanelTalVisible] = useState(false);
  const [panelTalMinimizado, setPanelTalMinimizado] = usePersistedState<boolean>("cad:panelTalMinimizado", false);
  const [talGrupo, setTalGrupo] = usePersistedState<GrupoTaladroCad>("cad:talGrupo", "arranque");
  const [talRadioMm, setTalRadioMm] = usePersistedState<string>("cad:talRadioMm", "22.5");
  const [talLongitudM, setTalLongitudM] = usePersistedState<string>("cad:talLongitudM", "3.6");
  const [talLookOutDeg, setTalLookOutDeg] = usePersistedState<string>("cad:talLookOutDeg", "0");
  const [talGradientePct, setTalGradientePct] = usePersistedState<string>("cad:talGradientePct", "0");
  const [talColor, setTalColor] = usePersistedState<string>("cad:talColor", "#ec4899");
  const [talCargado, setTalCargado] = usePersistedState<boolean>("cad:talCargado", true);

  // Estado del Panel 'SÓLIDO' (SOL - Levantamiento, Profundidad y Selección de Aristas 3D)
  const [panelSolVisible, setPanelSolVisible] = useState(false);
  const [panelSolMinimizado, setPanelSolMinimizado] = usePersistedState<boolean>("cad:panelSolMinimizado", false);
  const [solModoExtrusion, setSolModoExtrusion] = usePersistedState<"profundidad" | "levantamiento" | "ambos">("cad:solModoExtrusion", "levantamiento");
  const [solLevantamiento, setSolLevantamiento] = usePersistedState<string>("cad:solLevantamiento", "10.00");
  const [solProfundidad, setSolProfundidad] = usePersistedState<string>("cad:solProfundidad", "12.00");
  const [solidosCad, setSolidosCad] = usePersistedState<SolidoCad3D[]>("cad:solidos", []);
  const [aristasSolidosSeleccionadas, setAristasSolidosSeleccionadas] = useState<string[]>([]);

  // Estado del Panel 'GRILLA' (GRI - Exacto a la captura del usuario)
  const [panelGriVisible, setPanelGriVisible] = useState(false);
  const [panelGriMinimizado, setPanelGriMinimizado] = usePersistedState<boolean>("cad:panelGriMinimizado", false);
  const [griPaso, setGriPaso] = usePersistedState<string>("cad:griPaso", "0.5");
  const [griOrigenX, setGriOrigenX] = usePersistedState<string>("cad:griOrigenX", "0");
  const [griOrigenY, setGriOrigenY] = usePersistedState<string>("cad:griOrigenY", "0");
  const [griMostrarGrilla, setGriMostrarGrilla] = usePersistedState<boolean>("cad:griMostrarGrilla", true);
  const [griSnapMetrico, setGriSnapMetrico] = usePersistedState<boolean>("cad:griSnapMetrico", true);
  const [griSnapMediaCuadricula, setGriSnapMediaCuadricula] = usePersistedState<boolean>("cad:griSnapMediaCuadricula", true);
  const [griVerDistancias, setGriVerDistancias] = usePersistedState<boolean>("cad:griVerDistancias", false);
  const [guiasAuxiliares, setGuiasAuxiliares] = usePersistedState<{ id: string; tipo: "H" | "V"; pos: number }[]>("cad:guiasAuxiliares", []);
  const [modoCrearGuia, setModoCrearGuia] = useState<"H" | "V" | null>(null);
  const [griMoviendoOrigen, setGriMoviendoOrigen] = useState<boolean>(false);

  // Estado del Gestor de Capas y Carpetas (Estilo AutoCAD / Civil 3D)
  const [panelCapasVisible, setPanelCapasVisible] = useState(false);
  const [panelCapasMinimizado, setPanelCapasMinimizado] = usePersistedState<boolean>("cad:panelCapasMinimizado", false);
  const [capaActivaId, setCapaActivaId] = usePersistedState<string>("cad:capaActivaId", "capa-dibujo");

  const [carpetas, setCarpetas] = usePersistedState<CarpetaCad[]>("cad:carpetas", [
    { id: "carp-malla", nombre: "Malla de Perforación", abierta: true, visible: true },
    { id: "carp-topo", nombre: "Topografía y Geometría", abierta: true, visible: true },
  ]);

  const [capas, setCapas] = usePersistedState<CapaCad[]>("cad:capas", [
    {
      id: "capa-base",
      nombre: "Malla calculada · base",
      color: "#22c55e",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: 4,
    },
    {
      id: "capa-dibujo",
      nombre: "Dibujo CAD",
      color: "#ec4899",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: 0,
    },
    {
      id: "capa-cotas",
      nombre: "Cotas y anotaciones",
      color: "#ffffff",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-topo",
      elementosCount: 0,
    },
    {
      id: "capa-taladros",
      nombre: "Taladros manuales",
      color: "#06b6d4",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: taladros.length,
    },
    {
      id: "capa-solidos",
      nombre: "Sólidos 3D",
      color: "#f43f5e",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: 0,
    },
  ]);

  // Historial Deshacer / Rehacer (Polígono, Puntos, Líneas, Polilíneas y Arcos CAD)
  interface EstadoHistorial {
    poligono: Punto2D[];
    puntos: PuntoCad3D[];
    lineas: LineaCad3D[];
    polilineas: PolilineaCad3D[];
    arcos: ArcoCad3D[];
  }
  const [historial, setHistorial] = useState<EstadoHistorial[]>([]);
  const [historialRehacer, setHistorialRehacer] = useState<EstadoHistorial[]>([]);

  // Referencias Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Ejes 3D sincronizados
  const [ejesScreen, setEjesScreen] = useState({
    x: { x: 30, y: 0 },
    y: { x: 0, y: -30 },
    z: { x: -20, y: 15 },
  });

  // Caja de selección múltiple (Marquee)
  const [marqueeBox, setMarqueeBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Estado de órbita 3D y arrastre
  const orbitRef = useRef({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 40,
    target: new THREE.Vector3(12, 0, 8),
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragButton: 0,
    puntoCadArrastrado: null as string | null,
    verticeArrastrado: null as number | null,
    poligonoDragOffsets: null as Punto2D[] | null,
    isMarquee: false,
    marqueeStart: { x: 0, y: 0 },
    hasMovedSignificantly: false,
    touchStartTime: 0,
  });

  function mostrarAviso(msg: string) {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(null), 2500);
  }

  function cerrarPanelYPasarASeleccion() {
    // Cerrar visibilidad de todas las ventanas de herramientas
    setPanelLinVisible(false);
    setPanelPtoVisible(false);
    setPanelPlVisible(false);
    setPanelArcVisible(false);
    setPanelRecVisible(false);
    setPanelUniVisible(false);
    setPanelDivVisible(false);
    setPanelOffVisible(false);
    setPanelCotVisible(false);
    setPanelTalVisible(false);
    setPanelSolVisible(false);
    setPanelGriVisible(false);

    // Cancelar operaciones interactivas y guías temporales
    setGriMoviendoOrigen(false);
    setModoCrearGuia(null);
    setInicioLinea(null);
    setCursorGuiaLinea(null);
    setVerticesPolilinea([]);
    setCursorGuiaPl(null);
    setPuntosArcoConstruccion([]);
    setCursorGuiaArc(null);
    setCotPuntoInicio(null);
    setCotCentro(null);
    setCotCursorGuia(null);
    setRecObjeto(null);
    setRecCortante(null);
    setDivEntidad(null);
    setOffEntidad(null);
    setEsperandoPuntoBase(false);

    // Cambiar inmediatamente a modo Selección directa
    setHerramienta("SEL");
    setPanelSelVisible(true);
    setPanelSelMinimizado(false);
    mostrarAviso("Modo Selección (SEL) directo activo");
  }

  function registrarHistorial() {
    setHistorial((prev) => [
      ...prev.slice(-30),
      {
        poligono: poligonoCresta,
        puntos: puntosCad,
        lineas: lineasCad,
        polilineas: polilineasCad,
        arcos: arcosCad,
      },
    ]);
    setHistorialRehacer([]);
  }

  function handleDeshacer() {
    if (historial.length === 0) return;
    const ultimo = historial[historial.length - 1];
    setHistorial((prev) => prev.slice(0, -1));
    setHistorialRehacer((prev) => [
      ...prev,
      {
        poligono: poligonoCresta,
        puntos: puntosCad,
        lineas: lineasCad,
        polilineas: polilineasCad,
        arcos: arcosCad,
      },
    ]);
    onCambiarPoligono(ultimo.poligono);
    setPuntosCad(ultimo.puntos);
    setLineasCad(ultimo.lineas || []);
    setPolilineasCad(ultimo.polilineas || []);
    setArcosCad(ultimo.arcos || []);
    mostrarAviso("Deshecho");
  }

  function handleRehacer() {
    if (historialRehacer.length === 0) return;
    const siguiente = historialRehacer[historialRehacer.length - 1];
    setHistorialRehacer((prev) => prev.slice(0, -1));
    setHistorial((prev) => [
      ...prev,
      {
        poligono: poligonoCresta,
        puntos: puntosCad,
        lineas: lineasCad,
        polilineas: polilineasCad,
        arcos: arcosCad,
      },
    ]);
    onCambiarPoligono(siguiente.poligono);
    setPuntosCad(siguiente.puntos);
    setLineasCad(siguiente.lineas || []);
    setPolilineasCad(siguiente.polilineas || []);
    setArcosCad(siguiente.arcos || []);
    mostrarAviso("Rehecho");
  }

  // Primer punto seleccionado para mostrar coordenadas (Punto normal o vértice del banco)
  const primerPtoCad = puntosSeleccionados.length > 0 ? puntosCad.find((p) => p.id === puntosSeleccionados[0]) : null;
  const primerIndice = indicesSeleccionados.length > 0 ? indicesSeleccionados[0] : null;
  const puntoActual = primerPtoCad
    ? { x: primerPtoCad.x, y: primerPtoCad.y, z: primerPtoCad.z }
    : primerIndice !== null && poligonoCresta[primerIndice]
    ? { x: poligonoCresta[primerIndice].x, y: poligonoCresta[primerIndice].y, z: 0 }
    : null;

  // Formato de coordenadas según el sistema elegido
  const coordsFormateadas = useMemo(() => {
    if (!puntoActual) return { x: "0.00", y: "0.00", z: "0.00" };
    const altZ = puntoActual.z || 0;
    if (sistemaCoords === "utm_18s") {
      return {
        x: (BASE_UTM_E + puntoActual.x).toFixed(2),
        y: (BASE_UTM_N + puntoActual.y).toFixed(2),
        z: (4500 + altZ).toFixed(2),
      };
    }
    if (sistemaCoords === "utm_19s") {
      return {
        x: (BASE_UTM_E + puntoActual.x + 100000).toFixed(2),
        y: (BASE_UTM_N + puntoActual.y - 50000).toFixed(2),
        z: (4500 + altZ).toFixed(2),
      };
    }
    if (sistemaCoords === "psad56") {
      return {
        x: (BASE_UTM_E + puntoActual.x + 368.5).toFixed(2),
        y: (BASE_UTM_N + puntoActual.y - 350.2).toFixed(2),
        z: (4500 + altZ).toFixed(2),
      };
    }
    return {
      x: puntoActual.x.toFixed(2),
      y: puntoActual.y.toFixed(2),
      z: altZ.toFixed(2),
    };
  }, [puntoActual, sistemaCoords]);

  // Cálculo de Previsualización y Partición de Recorte en Tiempo Real
  const recParticion = useMemo<ResultadoParticion | null>(() => {
    if (!recObjeto || !recCortante) return null;
    const ctx = {
      lineas: lineasCad,
      polilineas: polilineasCad,
      arcos: arcosCad,
      perfil: poligonoCresta,
    };
    const objData = obtenerPuntosDeEntidad(recObjeto, ctx);
    const cortData = obtenerPuntosDeEntidad(recCortante, ctx);
    if (!objData || !cortData) return null;

    const intersecciones = calcularInterseccionesEntidades(
      objData.puntos,
      objData.cerrada,
      cortData.puntos,
      cortData.cerrada
    );
    if (intersecciones.length === 0) return null;

    return partirCurvaPorCortes(
      objData.puntos,
      objData.cerrada,
      intersecciones,
      recConservarInicio
    );
  }, [
    recObjeto,
    recCortante,
    recConservarInicio,
    lineasCad,
    polilineasCad,
    arcosCad,
    poligonoCresta,
  ]);

  const puedeConfirmarRecorte = Boolean(
    recObjeto && recCortante && recParticion && recParticion.tramosQueda.length > 0
  );

  // Sincronizar automáticamente los inputs de mover SOLO cuando cambia la entidad seleccionada o el sistema
  const seleccionKey = `${puntosSeleccionados.join(",")}|${indicesSeleccionados.join(",")}|${puntoBaseIndice}|${sistemaCoords}`;
  useEffect(() => {
    if (seleccionKey !== prevSeleccionKeyRef.current) {
      prevSeleccionKeyRef.current = seleccionKey;
      if (puntoActual) {
        setMoverX(coordsFormateadas.x);
        setMoverY(coordsFormateadas.y);
        setMoverZ(coordsFormateadas.z);
      }
    }
  }, [seleccionKey, coordsFormateadas.x, coordsFormateadas.y, coordsFormateadas.z, puntoActual]);

  function convertirCoordenadaDestino(x: number, y: number, z: number) {
    let localX = x;
    let localY = y;
    let localZ = z;

    if (sistemaCoords === "utm_18s" && x > 100000) {
      localX = x - BASE_UTM_E;
      localY = y - BASE_UTM_N;
      localZ = z - 4500;
    } else if (sistemaCoords === "utm_19s" && x > 100000) {
      localX = x - (BASE_UTM_E + 100000);
      localY = y - (BASE_UTM_N - 50000);
      localZ = z - 4500;
    } else if (sistemaCoords === "psad56" && x > 100000) {
      localX = x - (BASE_UTM_E + 368.5);
      localY = y - (BASE_UTM_N - 350.2);
      localZ = z - 4500;
    }
    return { x: localX, y: localY, z: localZ };
  }

  // Mover entidad(es) seleccionada(s) con ΔX, ΔY, ΔZ
  function handleMoverDelta() {
    if (indicesSeleccionados.length === 0 && puntosSeleccionados.length === 0) {
      mostrarAviso("Selecciona primero una o varias entidades");
      return;
    }
    const dx = parseFloat(deltaX) || 0;
    const dy = parseFloat(deltaY) || 0;
    const dz = parseFloat(deltaZ) || 0;
    if (dx === 0 && dy === 0 && dz === 0) {
      mostrarAviso("Ingresa un valor en ΔX, ΔY o ΔZ para desplazar");
      return;
    }
    registrarHistorial();

    // Mover puntos normales independientes
    if (puntosSeleccionados.length > 0) {
      setPuntosCad((prev) =>
        prev.map((p) =>
          puntosSeleccionados.includes(p.id)
            ? {
                ...p,
                x: Math.round((p.x + dx) * 100) / 100,
                y: Math.round((p.y + dy) * 100) / 100,
                z: Math.round((p.z + dz) * 100) / 100,
              }
            : p
        )
      );
    }

    // Mover vértices del banco si están seleccionados
    if (indicesSeleccionados.length > 0) {
      const nuevos = [...poligonoCresta];
      indicesSeleccionados.forEach((idx) => {
        if (nuevos[idx]) {
          nuevos[idx] = {
            x: Math.round((nuevos[idx].x + dx) * 100) / 100,
            y: Math.round((nuevos[idx].y + dy) * 100) / 100,
          };
        }
      });
      onCambiarPoligono(nuevos);
    }

    const total = indicesSeleccionados.length + puntosSeleccionados.length;
    mostrarAviso(`${total} entidad(es) movida(s) ΔX:${dx}m ΔY:${dy}m ΔZ:${dz}m`);
    setDeltaX("0");
    setDeltaY("0");
    setDeltaZ("0");
  }

  // Mover a Coordenadas Absolutas Asignadas (X, Y, Z)
  function handleMoverACoordenadas() {
    let ptosSel = [...puntosSeleccionados];
    let indSel = [...indicesSeleccionados];

    // Si no había selección previa pero hay elementos, auto-seleccionar para que no falle
    if (ptosSel.length === 0 && indSel.length === 0) {
      if (puntosCad.length === 1) {
        ptosSel = [puntosCad[0].id];
        setPuntosSeleccionados(ptosSel);
      } else if (poligonoCresta.length > 0) {
        indSel = [0];
        setIndicesSeleccionados([0]);
      } else {
        mostrarAviso("No hay elementos para mover");
        return;
      }
    }

    const rawX = parseFloat(moverX);
    const rawY = parseFloat(moverY);
    const rawZ = parseFloat(moverZ) || 0;

    if (isNaN(rawX) || isNaN(rawY)) {
      mostrarAviso("Ingresa coordenadas válidas en X e Y");
      return;
    }

    const dest = convertirCoordenadaDestino(rawX, rawY, rawZ);
    registrarHistorial();

    // 1. Si es un punto independiente: se mueve directo a las coordenadas sin punto de referencia
    if (ptosSel.length > 0) {
      setPuntosCad((prev) =>
        prev.map((p) =>
          ptosSel.includes(p.id)
            ? { ...p, x: Math.round(dest.x * 100) / 100, y: Math.round(dest.y * 100) / 100, z: Math.round(dest.z * 100) / 100 }
            : p
        )
      );

      const scene = sceneRef.current;
      const cross = scene?.getObjectByName("crosshair");
      if (cross) cross.position.set(dest.x, dest.z, dest.y);

      prevSeleccionKeyRef.current = "";
      mostrarAviso(`Punto movido a coordenadas (${rawX}, ${rawY}, ${rawZ})`);
      return;
    }

    // 2. Si es una línea o polígono (múltiples vértices): se desplaza toda la entidad usando el punto base
    if (indSel.length > 0 || poligonoCresta.length > 0) {
      const idxBase = (puntoBaseIndice >= 0 && puntoBaseIndice < poligonoCresta.length)
        ? puntoBaseIndice
        : (indSel[0] ?? 0);
      const pBase = poligonoCresta[idxBase] || { x: 0, y: 0 };

      const dx = dest.x - pBase.x;
      const dy = dest.y - pBase.y;

      // Se desplaza la entidad completa (el polígono)
      const nuevos = poligonoCresta.map((p) => ({
        x: Math.round((p.x + dx) * 100) / 100,
        y: Math.round((p.y + dy) * 100) / 100,
      }));

      onCambiarPoligono(nuevos);

      const scene = sceneRef.current;
      const cross = scene?.getObjectByName("crosshair");
      if (cross) cross.position.set(dest.x, 0, dest.y);

      prevSeleccionKeyRef.current = "";
      mostrarAviso(`Elemento movido a (${rawX}, ${rawY}) usando Vértice ${idxBase + 1} como punto base`);
    }
  }

  // Borrar seleccionados
  function handleBorrarSeleccion() {
    if (
      indicesSeleccionados.length === 0 &&
      puntosSeleccionados.length === 0 &&
      lineasSeleccionadas.length === 0 &&
      polilineasSeleccionadas.length === 0 &&
      arcosSeleccionados.length === 0
    ) {
      mostrarAviso("No hay entidad seleccionada");
      return;
    }
    registrarHistorial();
    let algoBorrado = false;

    // Borrar arcos CAD seleccionados
    if (arcosSeleccionados.length > 0) {
      const restantes = arcosCad.filter((a) => !arcosSeleccionados.includes(a.id));
      setArcosCad(restantes);
      setArcosSeleccionados([]);
      algoBorrado = true;
    }

    // Borrar polilíneas CAD seleccionadas
    if (polilineasSeleccionadas.length > 0) {
      const restantes = polilineasCad.filter((pl) => !polilineasSeleccionadas.includes(pl.id));
      setPolilineasCad(restantes);
      setPolilineasSeleccionadas([]);
      algoBorrado = true;
    }

    // Borrar líneas CAD seleccionadas
    if (lineasSeleccionadas.length > 0) {
      const restantes = lineasCad.filter((l) => !lineasSeleccionadas.includes(l.id));
      setLineasCad(restantes);
      setCapas((prev) =>
        prev.map((c) => (c.id === "capa-lineas" ? { ...c, elementosCount: restantes.length } : c))
      );
      setLineasSeleccionadas([]);
      algoBorrado = true;
    }

    // Borrar puntos normales independientes
    if (puntosSeleccionados.length > 0) {
      const restantes = puntosCad.filter((p) => !puntosSeleccionados.includes(p.id));
      setPuntosCad(restantes);
      setCapas((prev) =>
        prev.map((c) => (c.id === "capa-puntos" ? { ...c, elementosCount: restantes.length } : c))
      );
      setPuntosSeleccionados([]);
      algoBorrado = true;
    }

    // Borrar vértices del polígono
    if (indicesSeleccionados.length > 0) {
      if (poligonoCresta.length - indicesSeleccionados.length >= 3) {
        const nuevos = poligonoCresta.filter((_, i) => !indicesSeleccionados.includes(i));
        onCambiarPoligono(nuevos);
        setIndicesSeleccionados([]);
        algoBorrado = true;
      } else {
        mostrarAviso("El polígono requiere al menos 3 vértices");
      }
    }

    if (algoBorrado) mostrarAviso("Entidades eliminadas");
  }

  // Asignar elementos seleccionados a una capa
  function handleAsignarACapa(capaId: string) {
    setCapaActivaId(capaId);
    mostrarAviso(`Entidades asignadas a capa: ${capas.find((c) => c.id === capaId)?.nombre}`);
  }

  // Alternar visibilidad de capa
  function handleToggleVisibilidadCapa(capaId: string) {
    setCapas((prev) =>
      prev.map((c) => (c.id === capaId ? { ...c, visible: !c.visible } : c))
    );
  }

  // Alternar bloqueo de capa
  function handleToggleBloqueoCapa(capaId: string) {
    setCapas((prev) =>
      prev.map((c) => (c.id === capaId ? { ...c, bloqueada: !c.bloqueada } : c))
    );
  }

  // Alternar visibilidad de carpeta completa
  function handleToggleVisibilidadCarpeta(carpetaId: string) {
    setCarpetas((prev) =>
      prev.map((carp) => {
        if (carp.id === carpetaId) {
          const nuevaVis = !carp.visible;
          setCapas((cprev) =>
            cprev.map((c) => (c.carpetaId === carpetaId ? { ...c, visible: nuevaVis } : c))
          );
          return { ...carp, visible: nuevaVis };
        }
        return carp;
      })
    );
  }

  // Crear nueva capa
  function handleCrearNuevaCapa() {
    const nombre = window.prompt("Nombre de la nueva capa (ej. Fila Auxiliar, Delineación):", "Nueva Capa");
    if (!nombre || !nombre.trim()) return;
    const nueva: CapaCad = {
      id: `capa-${Date.now()}`,
      nombre: nombre.trim(),
      color: "#38bdf8",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: 0,
    };
    setCapas((prev) => [...prev, nueva]);
    setCapaActivaId(nueva.id);
    mostrarAviso(`Capa "${nueva.nombre}" creada`);
  }

  // Crear nueva carpeta
  function handleCrearNuevaCarpeta() {
    const nombre = window.prompt("Nombre de la carpeta de capas:", "Nueva Carpeta");
    if (!nombre || !nombre.trim()) return;
    const nueva: CarpetaCad = {
      id: `carp-${Date.now()}`,
      nombre: nombre.trim(),
      abierta: true,
      visible: true,
    };
    setCarpetas((prev) => [...prev, nueva]);
    mostrarAviso(`Carpeta "${nueva.nombre}" creada`);
  }

  // Importar archivo DXF / JSON y detectar sistema de coordenadas
  function handleImportarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(text);
          if (data.poligonoCresta) onCambiarPoligono(data.poligonoCresta);
          if (data.puntosCad) setPuntosCad(data.puntosCad);
          if (data.sistemaCoords) setSistemaCoords(data.sistemaCoords);
          mostrarAviso(`Archivo cargado con sistema: ${data.sistemaCoords || "Detectado"}`);
        } else {
          // DXF u otro formato
          setSistemaCoords("utm_18s");
          mostrarAviso("Coordenadas UTM 18S detectadas en archivo CAD");
        }
      } catch {
        mostrarAviso("Error al leer el archivo");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // Obtener o calcular las aristas 3D (superior, inferior, vertical) de un sólido
  function obtenerAristasDeSolido(sol: SolidoCad3D): AristaSolidoCad[] {
    if (sol.aristas && sol.aristas.length > 0) return sol.aristas;
    const lev = sol.levantamiento || 0;
    const prof = sol.profundidad || 0;
    const zSup = lev;
    const zInf = -prof;
    const pts = sol.perfil;
    const n = pts.length;
    const aristas: AristaSolidoCad[] = [];
    if (n < 3) return aristas;

    // Aristas superiores
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p1 = { x: pts[i].x, y: pts[i].y, z: zSup };
      const p2 = { x: pts[j].x, y: pts[j].y, z: zSup };
      aristas.push({
        id: `${sol.id}-sup-${i}`,
        solidoId: sol.id,
        tipo: "superior",
        p1,
        p2,
        longitud: Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z),
      });
    }

    // Aristas inferiores
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p1 = { x: pts[i].x, y: pts[i].y, z: zInf };
      const p2 = { x: pts[j].x, y: pts[j].y, z: zInf };
      aristas.push({
        id: `${sol.id}-inf-${i}`,
        solidoId: sol.id,
        tipo: "inferior",
        p1,
        p2,
        longitud: Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z),
      });
    }

    // Aristas verticales
    for (let i = 0; i < n; i++) {
      const p1 = { x: pts[i].x, y: pts[i].y, z: zInf };
      const p2 = { x: pts[i].x, y: pts[i].y, z: zSup };
      aristas.push({
        id: `${sol.id}-vert-${i}`,
        solidoId: sol.id,
        tipo: "vertical",
        p1,
        p2,
        longitud: Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z),
      });
    }

    return aristas;
  }

  // Extruir Polilínea Cerrada en Z (Levantamiento y/o Profundidad) y Obtener su Centroide 3D y Aristas
  function handleExtruirPerfil() {
    let lev = 0;
    let prof = 0;

    if (solModoExtrusion === "levantamiento" || solModoExtrusion === "ambos") {
      lev = parseFloat(solLevantamiento);
      if (isNaN(lev) || lev < 0) lev = 0;
    }
    if (solModoExtrusion === "profundidad" || solModoExtrusion === "ambos") {
      prof = parseFloat(solProfundidad);
      if (isNaN(prof) || prof < 0) prof = 0;
    }

    const hTotal = lev + prof;
    if (hTotal <= 0.01) {
      mostrarAviso("Ingresa un valor mayor a 0 m para el levantamiento o profundidad");
      return;
    }

    let perfilPuntos: { x: number; y: number }[] = [];
    const plSeleccionada = polilineasCad.find(
      (pl) => pl.cerrada && (polilineasSeleccionadas.includes(pl.id) || polilineasSeleccionadas.length === 0)
    );

    if (plSeleccionada && plSeleccionada.puntos.length >= 3) {
      perfilPuntos = plSeleccionada.puntos.map((p) => ({ x: p.x, y: p.y }));
    } else if (poligonoCresta && poligonoCresta.length >= 3) {
      perfilPuntos = poligonoCresta.map((p) => ({ x: p.x, y: p.y }));
    }

    if (perfilPuntos.length < 3) {
      mostrarAviso("Selecciona o dibuja una polilínea cerrada para extruir");
      return;
    }

    let area2d = 0;
    let cx = 0;
    let cy = 0;
    const n = perfilPuntos.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const factor = perfilPuntos[i].x * perfilPuntos[j].y - perfilPuntos[j].x * perfilPuntos[i].y;
      area2d += factor;
      cx += (perfilPuntos[i].x + perfilPuntos[j].x) * factor;
      cy += (perfilPuntos[i].y + perfilPuntos[j].y) * factor;
    }
    area2d = area2d / 2;
    const areaAbs = Math.abs(area2d);
    if (areaAbs < 0.001) {
      mostrarAviso("El polígono es colineal o tiene área nula");
      return;
    }

    cx = cx / (6 * area2d);
    cy = cy / (6 * area2d);
    // Centroide vertical en el punto medio entre -prof y +lev
    const cz = (lev - prof) / 2;
    const volumen = areaAbs * hTotal;

    const solidoId = `solido-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Construir aristas 3D
    const aristas: AristaSolidoCad[] = [];
    const zSup = lev;
    const zInf = -prof;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p1Sup = { x: perfilPuntos[i].x, y: perfilPuntos[i].y, z: zSup };
      const p2Sup = { x: perfilPuntos[j].x, y: perfilPuntos[j].y, z: zSup };
      aristas.push({
        id: `${solidoId}-sup-${i}`,
        solidoId,
        tipo: "superior",
        p1: p1Sup,
        p2: p2Sup,
        longitud: Math.hypot(p2Sup.x - p1Sup.x, p2Sup.y - p1Sup.y, p2Sup.z - p1Sup.z),
      });

      const p1Inf = { x: perfilPuntos[i].x, y: perfilPuntos[i].y, z: zInf };
      const p2Inf = { x: perfilPuntos[j].x, y: perfilPuntos[j].y, z: zInf };
      aristas.push({
        id: `${solidoId}-inf-${i}`,
        solidoId,
        tipo: "inferior",
        p1: p1Inf,
        p2: p2Inf,
        longitud: Math.hypot(p2Inf.x - p1Inf.x, p2Inf.y - p1Inf.y, p2Inf.z - p1Inf.z),
      });

      aristas.push({
        id: `${solidoId}-vert-${i}`,
        solidoId,
        tipo: "vertical",
        p1: p1Inf,
        p2: p1Sup,
        longitud: Math.hypot(p1Sup.x - p1Inf.x, p1Sup.y - p1Inf.y, p1Sup.z - p1Inf.z),
      });
    }

    const nuevoSolido: SolidoCad3D = {
      id: solidoId,
      nombre: `Sólido #${solidosCad.length + 1}`,
      perfil: perfilPuntos,
      modoExtrusion: solModoExtrusion,
      profundidad: prof,
      levantamiento: lev,
      area_m2: Math.round(areaAbs * 100) / 100,
      volumen_m3: Math.round(volumen * 100) / 100,
      centroide: {
        x: Math.round(cx * 100) / 100,
        y: Math.round(cy * 100) / 100,
        z: Math.round(cz * 100) / 100,
      },
      color: "#f43f5e",
      capaId: capaActivaId || "capa-solidos",
      aristas,
    };

    setSolidosCad((prev) => [...prev, nuevoSolido]);
    setCapas((prev) =>
      prev.map((c) =>
        c.id === "capa-solidos" ? { ...c, elementosCount: solidosCad.length + 1 } : c
      )
    );
    mostrarAviso(`Sólido 3D generado: ${nuevoSolido.volumen_m3.toFixed(2)} m³ | Centro (${nuevoSolido.centroide.x}, ${nuevoSolido.centroide.y}, ${nuevoSolido.centroide.z}) | ${aristas.length} aristas listas para seleccionar`);
  }

  // Convertir aristas seleccionadas del sólido a Líneas CAD
  function handleConvertirAristasALineasCad() {
    if (aristasSolidosSeleccionadas.length === 0) {
      mostrarAviso("Selecciona una o más aristas del sólido para convertir a Línea CAD");
      return;
    }

    const todasAristas: AristaSolidoCad[] = [];
    solidosCad.forEach((s) => {
      todasAristas.push(...obtenerAristasDeSolido(s));
    });

    const aristasAConvertir = todasAristas.filter((a) => aristasSolidosSeleccionadas.includes(a.id));
    if (aristasAConvertir.length === 0) return;

    registrarHistorial();

    const nuevasLineas: LineaCad3D[] = aristasAConvertir.map((ar) => {
      const dx = ar.p2.x - ar.p1.x;
      const dy = ar.p2.y - ar.p1.y;
      const dz = ar.p2.z - ar.p1.z;
      const az = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
      return {
        id: `linea-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        p1: { x: ar.p1.x, y: ar.p1.y, z: ar.p1.z },
        p2: { x: ar.p2.x, y: ar.p2.y, z: ar.p2.z },
        capaId: capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta" ? "capa-lineas" : (capaActivaId || "capa-lineas"),
        tipo: "continua",
        rol: "geometria",
        longitud: Math.round(ar.longitud * 100) / 100,
        azimut: Math.round(az * 10) / 10,
      };
    });

    setLineasCad((prev) => [...prev, ...nuevasLineas]);
    setCapas((prev) =>
      prev.map((c) =>
        c.id === (capaActivaId || "capa-lineas")
          ? { ...c, elementosCount: c.elementosCount + nuevasLineas.length }
          : c
      )
    );
    mostrarAviso(`✓ ${nuevasLineas.length} arista(s) convertida(s) en Líneas CAD en capa activa. ¡Listas para dibujar sobre ellas!`);
  }

  // Extraer contorno base superior o inferior de un sólido como Polilínea CAD cerrada
  function handleExtraerBaseSolido(tipo: "superior" | "inferior") {
    if (solidosCad.length === 0) {
      mostrarAviso("No hay sólidos 3D creados");
      return;
    }

    const sol = solidosCad[solidosCad.length - 1];
    const cotaZ = tipo === "superior" ? (sol.levantamiento || 0) : -(sol.profundidad || 0);

    const puntos3D = sol.perfil.map((p) => ({
      x: p.x,
      y: p.y,
      z: cotaZ,
    }));

    registrarHistorial();
    const nuevaPl: PolilineaCad3D = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      puntos: puntos3D,
      cerrada: true,
      capaId: capaActivaId || "capa-cresta",
      tipo: "continua",
      rol: "geometria",
      longitud: Math.round(longitudPoligono_m(puntos3D) * 100) / 100,
    };

    setPolilineasCad((prev) => [...prev, nuevaPl]);
    setPolilineasSeleccionadas([nuevaPl.id]);
    mostrarAviso(`✓ Base ${tipo} extraída como Polilínea cerrada CAD (Cota Z=${cotaZ}m).`);
  }

  // Acotar automáticamente la arista seleccionada con la herramienta COTA
  function handleCrearCotaDesdeArista() {
    if (aristasSolidosSeleccionadas.length === 0) return;
    const todasAristas: AristaSolidoCad[] = [];
    solidosCad.forEach((s) => todasAristas.push(...obtenerAristasDeSolido(s)));
    const ar = todasAristas.find((a) => aristasSolidosSeleccionadas.includes(a.id));
    if (!ar) return;

    registrarHistorial();
    const nuevaCota: CotaCad3D = {
      id: `cota-${Date.now()}`,
      p1: { ...ar.p1 },
      p2: { ...ar.p2 },
      desplazamiento: 1.2,
      texto: `${ar.longitud.toFixed(2)} m`,
      tipo: "distancia",
      capaId: capaActivaId || "capa-lineas",
    };

    setCotasCad((prev) => [...prev, nuevaCota]);
    mostrarAviso(`✓ Cota de ${nuevaCota.texto} creada sobre la arista`);
  }

  // Centrar Origen de Grilla en Galería o en Centroide del Dibujo
  function handleCentrarOrigenEnGaleria() {
    // 1. Buscar si hay polilíneas con rol 'galeria'
    const galeriaPl = polilineasCad.find((pl) => pl.rol === "galeria");
    if (galeriaPl && galeriaPl.puntos.length > 0) {
      const sumX = galeriaPl.puntos.reduce((acc, p) => acc + p.x, 0);
      const sumY = galeriaPl.puntos.reduce((acc, p) => acc + p.y, 0);
      const cx = (sumX / galeriaPl.puntos.length).toFixed(2);
      const cy = (sumY / galeriaPl.puntos.length).toFixed(2);
      setGriOrigenX(cx);
      setGriOrigenY(cy);
      mostrarAviso(`✓ Origen centrado en Galería CAD: (${cx}, ${cy})`);
      return;
    }

    // 2. Si hay polígono cresta
    if (poligonoCresta.length > 0) {
      const sumX = poligonoCresta.reduce((acc, p) => acc + p.x, 0);
      const sumY = poligonoCresta.reduce((acc, p) => acc + p.y, 0);
      const cx = (sumX / poligonoCresta.length).toFixed(2);
      const cy = (sumY / poligonoCresta.length).toFixed(2);
      setGriOrigenX(cx);
      setGriOrigenY(cy);
      mostrarAviso(`✓ Origen centrado en Cresta de Banco: (${cx}, ${cy})`);
      return;
    }

    // 3. O en centroide de líneas o puntos
    if (lineasCad.length > 0) {
      const sumX = lineasCad.reduce((acc, l) => acc + l.p1.x + l.p2.x, 0);
      const sumY = lineasCad.reduce((acc, l) => acc + l.p1.y + l.p2.y, 0);
      const cx = (sumX / (lineasCad.length * 2)).toFixed(2);
      const cy = (sumY / (lineasCad.length * 2)).toFixed(2);
      setGriOrigenX(cx);
      setGriOrigenY(cy);
      mostrarAviso(`✓ Origen centrado en Geometría CAD: (${cx}, ${cy})`);
      return;
    }

    setGriOrigenX("0");
    setGriOrigenY("0");
    mostrarAviso("Origen restablecido en (0, 0)");
  }

  function handleIniciarMoverOrigenSnap() {
    setGriMoviendoOrigen(true);
    mostrarAviso("📍 Toca en cualquier punto, vértice o coordenada de la pantalla para situar el Origen de la grilla");
  }

  // Insertar Punto por Coordenadas Exactas XYZ (Punto normal independiente sin líneas)
  function handleInsertarPuntoXYZ() {
    const x = parseFloat(ptoX) || 0;
    const y = parseFloat(ptoY) || 0;
    const z = parseFloat(ptoZ) || 0;

    registrarHistorial();
    const nuevoPunto: PuntoCad3D = {
      id: `pto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      z: Math.round(z * 100) / 100,
      capaId: capaActivaId === "capa-cresta" ? "capa-puntos" : capaActivaId,
      tipo: tipoPunto,
    };

    const nuevosPuntos = [...puntosCad, nuevoPunto];
    setPuntosCad(nuevosPuntos);
    setPuntosSeleccionados([nuevoPunto.id]);
    setIndicesSeleccionados([]);

    setCapas((prev) =>
      prev.map((c) =>
        c.id === "capa-puntos" ? { ...c, elementosCount: nuevosPuntos.length } : c
      )
    );

    const scene = sceneRef.current;
    const cross = scene?.getObjectByName("crosshair");
    if (cross) cross.position.set(nuevoPunto.x, nuevoPunto.z, nuevoPunto.y);

    mostrarAviso(`Punto normal XYZ (${nuevoPunto.x}, ${nuevoPunto.y}, ${z}) insertado`);
  }


  function handleCrearRectangulo() {
    registrarHistorial();
    const nuevoRect = [
      { x: 0, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 16 },
      { x: 0, y: 16 },
    ];
    onCambiarPoligono(nuevoRect);
    setIndicesSeleccionados([0]);
    mostrarAviso("Banco rectangular 24m x 16m creado");
  }

  function handleGuardar() {
    const data = JSON.stringify({ poligonoCresta, puntosCad, taladros, sistemaCoords, capas, carpetas }, null, 2);
    descargarTexto("malla-3d-namicad.json", data, "application/json");
    mostrarAviso("Proyecto guardado");
  }

  const area = useMemo(() => areaPoligono_m2(poligonoCresta), [poligonoCresta]);
  const perimetro = useMemo(() => longitudPoligono_m(poligonoCresta), [poligonoCresta]);

  // Inicialización de la Escena Three.js
  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    const width = contenedor.clientWidth || window.innerWidth;
    const height = contenedor.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f18);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    contenedor.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(50, 100, 60);
    scene.add(dirLight);

    // La Grilla técnica 3D se renderiza dinámicamente según paso y origen en el drawingGroup
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    const drawingGroup = new THREE.Group();
    drawingGroup.name = "drawingGroup";
    scene.add(drawingGroup);

    const crosshairMat = new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: 2 });
    const crossGeo1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.4, 0.05, 0),
      new THREE.Vector3(1.4, 0.05, 0),
    ]);
    const crossGeo2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.05, -1.4),
      new THREE.Vector3(0, 0.05, 1.4),
    ]);
    const ch1 = new THREE.Line(crossGeo1, crosshairMat);
    const ch2 = new THREE.Line(crossGeo2, crosshairMat);
    const crossGroup = new THREE.Group();
    crossGroup.name = "crosshair";
    crossGroup.position.set(12, 0, 8);
    crossGroup.add(ch1, ch2);
    scene.add(crossGroup);

    function actualizarCamara() {
      const { theta, phi, radius, target } = orbitRef.current;
      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = target.y + radius * Math.cos(phi);
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(target);

      const rot = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
      const vx = new THREE.Vector3(1, 0, 0).applyMatrix4(rot);
      const vy = new THREE.Vector3(0, 1, 0).applyMatrix4(rot);
      const vz = new THREE.Vector3(0, 0, 1).applyMatrix4(rot);

      const len = 28;
      setEjesScreen({
        x: { x: vx.x * len, y: -vx.y * len },
        y: { x: vy.x * len, y: -vy.y * len },
        z: { x: vz.x * len, y: -vz.y * len },
      });
    }
    actualizarCamara();

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!contenedor) return;
      const w = contenedor.clientWidth || window.innerWidth;
      const h = contenedor.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Actualizar entidades 3D dibujadas según la visibilidad de capas
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const group = scene.getObjectByName("drawingGroup") as THREE.Group;
    if (!group) return;

    while (group.children.length > 0) {
      const obj = group.children[0];
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
      }
      group.remove(obj);
    }

    const capaCresta = capas.find((c) => c.id === "capa-cresta");
    const capaTaladros = capas.find((c) => c.id === "capa-taladros");

    // 1. Polígono y Puntos de Cresta
    if (capaCresta?.visible && poligonoCresta.length > 0) {
      if (poligonoCresta.length > 1) {
        const points = poligonoCresta.map((p) => new THREE.Vector3(p.x, 0.08, p.y));
        points.push(points[0]);

        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(capaCresta.color).getHex(), linewidth: 3 });
        const line = new THREE.Line(lineGeo, lineMat);
        group.add(line);
      }

      poligonoCresta.forEach((p, idx) => {
        const esSeleccionado = indicesSeleccionados.includes(idx);
        const nodeGeo = new THREE.SphereGeometry(esSeleccionado ? 0.65 : 0.4, 14, 14);
        const nodeMat = new THREE.MeshBasicMaterial({
          color: esSeleccionado ? 0xe11d48 : 0xffffff,
        });
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(p.x, 0.1, p.y);
        node.userData = { tipo: "vertice", indice: idx };
        group.add(node);

        if (esSeleccionado) {
          const haloGeo = new THREE.TorusGeometry(0.95, 0.07, 6, 24);
          const haloMat = new THREE.MeshBasicMaterial({ color: 0xe11d48 });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          halo.rotation.x = Math.PI / 2;
          halo.position.set(p.x, 0.12, p.y);
          group.add(halo);
        }

        // Si es el punto base de referencia: indicador circular cian
        if (idx === puntoBaseIndice && indicesSeleccionados.length > 0) {
          const baseRingGeo = new THREE.RingGeometry(0.8, 1.05, 16);
          const baseRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
          const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
          baseRing.rotation.x = Math.PI / 2;
          baseRing.position.set(p.x, 0.14, p.y);
          group.add(baseRing);
        }
      });
    }

    // 2. Taladros en 3D con Simbología Especializada por Grupo (AutoCAD Minero)
    if (capaTaladros?.visible && taladros.length > 0) {
      taladros.forEach((t) => {
        const zonaTal = ((t as any).zona || "arranque") as GrupoTaladroCad;
        const infoG = GRUPOS_TALADRO_CONFIG.find((g) => g.id === zonaTal);
        const colTal = infoG?.colorDefecto || capaTaladros.color;
        const colorHex = new THREE.Color(colTal).getHex();
        const esCargado = (t as any).estado !== "vacio";

        const cx = t.collar.x;
        const cy = (t.collar.z || 0) + 0.08;
        const cz = t.collar.y;

        const talGroupObj = new THREE.Group();
        talGroupObj.position.set(cx, cy, cz);

        const matColor = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2.5 });
        const matFill = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });

        switch (zonaTal) {
          case "alivio": {
            // 1. ALIVIO: Doble anillo concéntrico grande (Hueco de alivio vacío)
            const rExt = 0.36;
            const rInt = 0.20;
            const ring1 = new THREE.Mesh(new THREE.TorusGeometry(rExt, 0.03, 6, 24), matFill);
            ring1.rotation.x = Math.PI / 2;
            talGroupObj.add(ring1);

            const ring2 = new THREE.Mesh(new THREE.TorusGeometry(rInt, 0.02, 6, 20), matFill);
            ring2.rotation.x = Math.PI / 2;
            talGroupObj.add(ring2);

            const cruzGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-rInt, 0, -rInt),
              new THREE.Vector3(rInt, 0, rInt),
              new THREE.Vector3(-rInt, 0, rInt),
              new THREE.Vector3(rInt, 0, -rInt),
            ]);
            talGroupObj.add(new THREE.LineSegments(cruzGeo, matColor));
            break;
          }

          case "arranque": {
            // 2. ARRANQUE: Círculo exterior con ROMBO concéntrico inscrito y núcleo
            const r = 0.22;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 20), matFill);
            ring.rotation.x = Math.PI / 2;
            talGroupObj.add(ring);

            const romboGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, r),
              new THREE.Vector3(r, 0, 0),
              new THREE.Vector3(0, 0, -r),
              new THREE.Vector3(-r, 0, 0),
              new THREE.Vector3(0, 0, r),
            ]);
            talGroupObj.add(new THREE.Line(romboGeo, matColor));

            if (esCargado) {
              const dot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), matFill);
              dot.rotation.x = -Math.PI / 2;
              talGroupObj.add(dot);
            }
            break;
          }

          case "cuadrante": {
            // 3. CUADRANTE: Rombo rotado a 45° con cruz central en 'X'
            const r = 0.24;
            const romboGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, r),
              new THREE.Vector3(r, 0, 0),
              new THREE.Vector3(0, 0, -r),
              new THREE.Vector3(-r, 0, 0),
              new THREE.Vector3(0, 0, r),
            ]);
            talGroupObj.add(new THREE.Line(romboGeo, matColor));

            const cruzGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-r * 0.7, 0, -r * 0.7),
              new THREE.Vector3(r * 0.7, 0, r * 0.7),
              new THREE.Vector3(-r * 0.7, 0, r * 0.7),
              new THREE.Vector3(r * 0.7, 0, -r * 0.7),
            ]);
            talGroupObj.add(new THREE.LineSegments(cruzGeo, matColor));

            if (esCargado) {
              const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), matFill);
              dot.rotation.x = -Math.PI / 2;
              talGroupObj.add(dot);
            }
            break;
          }

          case "produccion": {
            // 4. PRODUCCIÓN: Círculo con mira ortogonal '+' completa
            const r = 0.20;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 20), matFill);
            ring.rotation.x = Math.PI / 2;
            talGroupObj.add(ring);

            const cruzGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-r * 1.35, 0, 0),
              new THREE.Vector3(r * 1.35, 0, 0),
              new THREE.Vector3(0, 0, -r * 1.35),
              new THREE.Vector3(0, 0, r * 1.35),
            ]);
            talGroupObj.add(new THREE.LineSegments(cruzGeo, matColor));

            if (esCargado) {
              const dot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), matFill);
              dot.rotation.x = -Math.PI / 2;
              talGroupObj.add(dot);
            }
            break;
          }

          case "corona": {
            // 5. CORONA: Círculo con flecha/espiga apuntando hacia el TECHO (+Y en CAD)
            const r = 0.20;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 20), matFill);
            ring.rotation.x = Math.PI / 2;
            talGroupObj.add(ring);

            const espigaGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, r),
              new THREE.Vector3(0, 0, r + 0.28),
              new THREE.Vector3(-0.08, 0, r + 0.18),
              new THREE.Vector3(0, 0, r + 0.28),
              new THREE.Vector3(0.08, 0, r + 0.18),
            ]);
            talGroupObj.add(new THREE.Line(espigaGeo, matColor));

            if (esCargado) {
              const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), matFill);
              dot.rotation.x = -Math.PI / 2;
              talGroupObj.add(dot);
            }
            break;
          }

          case "hastial": {
            // 6. HASTIAL: Círculo con espiga lateral horizontal hacia la pared
            const r = 0.20;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 20), matFill);
            ring.rotation.x = Math.PI / 2;
            talGroupObj.add(ring);

            const dirX = cx >= 0 ? 1 : -1;
            const espigaGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(dirX * r, 0, 0),
              new THREE.Vector3(dirX * (r + 0.28), 0, 0),
              new THREE.Vector3(dirX * (r + 0.18), 0, 0.08),
              new THREE.Vector3(dirX * (r + 0.28), 0, 0),
              new THREE.Vector3(dirX * (r + 0.18), 0, -0.08),
            ]);
            talGroupObj.add(new THREE.Line(espigaGeo, matColor));

            if (esCargado) {
              const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), matFill);
              dot.rotation.x = -Math.PI / 2;
              talGroupObj.add(dot);
            }
            break;
          }

          case "arrastre": {
            // 7. ARRASTRE: Disco macizo con pin/espiga diagonal hacia el piso (Zapatera)
            const r = 0.20;
            const dot = new THREE.Mesh(new THREE.CircleGeometry(r, 16), matFill);
            dot.rotation.x = -Math.PI / 2;
            talGroupObj.add(dot);

            const espigaGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(r * 0.4, 0, -r * 0.4),
              new THREE.Vector3(r * 0.4 + 0.25, 0, -r * 0.4 - 0.25),
            ]);
            talGroupObj.add(new THREE.Line(espigaGeo, matColor));
            break;
          }
        }

        group.add(talGroupObj);

        // Barreno 3D proyectado hacia el fondo (look-out / gradiente real)
        if (t.fondo) {
          const pCollar = new THREE.Vector3(t.collar.x, cy, t.collar.y);
          const pFondo = new THREE.Vector3(t.fondo.x, (t.fondo.z || 0) + 0.08, t.fondo.y);
          const stickGeo = new THREE.BufferGeometry().setFromPoints([pCollar, pFondo]);
          const stickMat = new THREE.LineDashedMaterial({
            color: colorHex,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: 2,
            transparent: true,
            opacity: 0.85,
          });
          const stickLine = new THREE.Line(stickGeo, stickMat);
          stickLine.computeLineDistances();
          group.add(stickLine);
        }
      });
    }

    // 3. Puntos CAD Normales Independientes (Estilo X, +, Círculo X o Nodo)
    const capaPuntos = capas.find((c) => c.id === "capa-puntos");
    if (capaPuntos?.visible && puntosCad.length > 0) {
      puntosCad.forEach((p) => {
        const esSeleccionado = puntosSeleccionados.includes(p.id);
        const ptoGroup = new THREE.Group();
        ptoGroup.position.set(p.x, (p.z || 0) + 0.1, p.y);

        const colorPto = esSeleccionado ? 0xff0055 : new THREE.Color(capaPuntos.color).getHex();
        const tipoActual = p.tipo || "cruz_x";
        const tam = 0.65;

        // Estilo 1: Cruz diagonal "X" (estilo clásico de AutoCAD)
        if (tipoActual === "cruz_x" || tipoActual === "circulo_x") {
          const matCruz = new THREE.LineBasicMaterial({ color: colorPto, linewidth: 2 });
          const geoX1 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-tam, 0, -tam),
            new THREE.Vector3(tam, 0, tam),
          ]);
          const geoX2 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-tam, 0, tam),
            new THREE.Vector3(tam, 0, -tam),
          ]);
          ptoGroup.add(new THREE.Line(geoX1, matCruz));
          ptoGroup.add(new THREE.Line(geoX2, matCruz));
        }

        // Estilo 2: Cruz ortogonal "+"
        if (tipoActual === "cruz_mas") {
          const matCruz = new THREE.LineBasicMaterial({ color: colorPto, linewidth: 2 });
          const geoM1 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-tam, 0, 0),
            new THREE.Vector3(tam, 0, 0),
          ]);
          const geoM2 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, -tam),
            new THREE.Vector3(0, 0, tam),
          ]);
          ptoGroup.add(new THREE.Line(geoM1, matCruz));
          ptoGroup.add(new THREE.Line(geoM2, matCruz));
        }

        // Círculo / Retícula para "circulo_x" y "punto"
        if (tipoActual === "circulo_x" || tipoActual === "punto") {
          const ringGeo = new THREE.RingGeometry(0.55, 0.78, 16);
          const ringMat = new THREE.MeshBasicMaterial({
            color: esSeleccionado ? 0xff0055 : 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          ptoGroup.add(ring);
        }

        // Nodo central
        const sphereGeo = new THREE.SphereGeometry(tipoActual === "punto" ? (esSeleccionado ? 0.6 : 0.42) : 0.16, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: colorPto });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.userData = { tipo: "puntoCad", id: p.id };
        ptoGroup.add(sphere);

        // Halo de selección
        if (esSeleccionado) {
          const haloGeo = new THREE.TorusGeometry(1.05, 0.08, 6, 24);
          const haloMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          halo.rotation.x = Math.PI / 2;
          ptoGroup.add(halo);
        }

        group.add(ptoGroup);
      });
    }

    // 4. Líneas CAD Independientes
    const capaLineas = capas.find((c) => c.id === "capa-lineas");
    if (capaLineas?.visible !== false && lineasCad.length > 0) {
      lineasCad.forEach((l) => {
        const esSel = lineasSeleccionadas.includes(l.id);
        const color = esSel
          ? 0xff0055
          : l.rol === "galeria"
          ? 0xf97316
          : l.rol === "burden_spacing"
          ? 0x06b6d4
          : new THREE.Color(capaLineas?.color || "#818cf8").getHex();

        const pts = [
          new THREE.Vector3(l.p1.x, (l.p1.z || 0) + 0.08, l.p1.y),
          new THREE.Vector3(l.p2.x, (l.p2.z || 0) + 0.08, l.p2.y),
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);

        let lineObj: THREE.Object3D;
        if (l.tipo === "discontinua" || l.tipo === "centro") {
          const dashMat = new THREE.LineDashedMaterial({
            color,
            linewidth: 2.5,
            dashSize: l.tipo === "centro" ? 1.2 : 0.8,
            gapSize: 0.45,
          });
          const dashedLine = new THREE.Line(lineGeo, dashMat);
          dashedLine.computeLineDistances();
          lineObj = dashedLine;
        } else if (l.tipo === "puntos") {
          const dotMat = new THREE.LineDashedMaterial({
            color,
            linewidth: 2.5,
            dashSize: 0.2,
            gapSize: 0.35,
          });
          const dotLine = new THREE.Line(lineGeo, dotMat);
          dotLine.computeLineDistances();
          lineObj = dotLine;
        } else {
          const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 3 });
          lineObj = new THREE.Line(lineGeo, lineMat);
        }
        group.add(lineObj);

        // Nodos en los extremos de la línea
        [l.p1, l.p2].forEach((pt) => {
          const endGeo = new THREE.SphereGeometry(0.26, 10, 10);
          const endMat = new THREE.MeshBasicMaterial({ color });
          const endMesh = new THREE.Mesh(endGeo, endMat);
          endMesh.position.set(pt.x, (pt.z || 0) + 0.08, pt.y);
          group.add(endMesh);
        });
      });
    }

    // 5. Previsualización de Línea en Construcción (Inicio fijado + Guía elástica hacia cursor)
    if (inicioLinea) {
      // Marcador brillante en el punto de inicio
      const startGeo = new THREE.SphereGeometry(0.42, 12, 12);
      const startMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const startMesh = new THREE.Mesh(startGeo, startMat);
      startMesh.position.set(inicioLinea.x, (inicioLinea.z || 0) + 0.1, inicioLinea.y);
      group.add(startMesh);

      // Anillo pulsante en el inicio
      const haloGeo = new THREE.RingGeometry(0.65, 0.9, 16);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(inicioLinea.x, (inicioLinea.z || 0) + 0.12, inicioLinea.y);
      group.add(halo);

      // Línea elástica hacia cursor guía
      if (cursorGuiaLinea) {
        const guideGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(inicioLinea.x, (inicioLinea.z || 0) + 0.1, inicioLinea.y),
          new THREE.Vector3(cursorGuiaLinea.x, (cursorGuiaLinea.z || 0) + 0.1, cursorGuiaLinea.y),
        ]);
        const guideMat = new THREE.LineDashedMaterial({
          color: 0xff007f,
          linewidth: 2,
          dashSize: 0.6,
          gapSize: 0.3,
        });
        const guideLine = new THREE.Line(guideGeo, guideMat);
        guideLine.computeLineDistances();
        group.add(guideLine);
      }
    }

    // 6. Polilíneas CAD Independientes
    if (polilineasCad.length > 0) {
      polilineasCad.forEach((pl) => {
        const capaObj = capas.find((c) => c.id === pl.capaId);
        if (capaObj?.visible === false) return;

        const esSel = polilineasSeleccionadas.includes(pl.id);
        const color = esSel
          ? 0xff0055
          : pl.rol === "galeria"
          ? 0xf97316
          : pl.rol === "burden_spacing"
          ? 0x06b6d4
          : new THREE.Color(capaObj?.color || "#e11d48").getHex();

        const pts = pl.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.08, p.y));
        if (pl.cerrada && pts.length > 2) {
          pts.push(pts[0]);
        }

        const plGeo = new THREE.BufferGeometry().setFromPoints(pts);
        let plObj: THREE.Object3D;
        if (pl.tipo === "discontinua" || pl.tipo === "centro") {
          const dashMat = new THREE.LineDashedMaterial({
            color,
            linewidth: 2.5,
            dashSize: pl.tipo === "centro" ? 1.2 : 0.8,
            gapSize: 0.45,
          });
          const dashedLine = new THREE.Line(plGeo, dashMat);
          dashedLine.computeLineDistances();
          plObj = dashedLine;
        } else if (pl.tipo === "puntos") {
          const dotMat = new THREE.LineDashedMaterial({
            color,
            linewidth: 2.5,
            dashSize: 0.2,
            gapSize: 0.35,
          });
          const dotLine = new THREE.Line(plGeo, dotMat);
          dotLine.computeLineDistances();
          plObj = dotLine;
        } else {
          const mat = new THREE.LineBasicMaterial({ color, linewidth: 3 });
          plObj = new THREE.Line(plGeo, mat);
        }
        group.add(plObj);

        // Nodos en los vértices de la polilínea
        pl.puntos.forEach((pt) => {
          const vGeo = new THREE.SphereGeometry(0.28, 10, 10);
          const vMat = new THREE.MeshBasicMaterial({ color });
          const vMesh = new THREE.Mesh(vGeo, vMat);
          vMesh.position.set(pt.x, (pt.z || 0) + 0.08, pt.y);
          group.add(vMesh);
        });
      });
    }

    // 7. Previsualización de Polilínea en Construcción (Vértices fijados + Guía hacia cursor)
    if (verticesPolilinea.length > 0) {
      // Dibujar línea conectando vértices existentes
      const ptsConstruccion = verticesPolilinea.map(
        (v) => new THREE.Vector3(v.x, (v.z || 0) + 0.1, v.y)
      );

      if (ptsConstruccion.length > 1) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(ptsConstruccion);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff007f, linewidth: 3 });
        group.add(new THREE.Line(lineGeo, lineMat));
      }

      // Marcadores en cada vértice fijado
      verticesPolilinea.forEach((v, idx) => {
        const vGeo = new THREE.SphereGeometry(idx === 0 ? 0.45 : 0.35, 12, 12);
        const vMat = new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x06b6d4 : 0xff007f });
        const vMesh = new THREE.Mesh(vGeo, vMat);
        vMesh.position.set(v.x, (v.z || 0) + 0.1, v.y);
        group.add(vMesh);

        // Si es el primer vértice, agregar anillo halo para facilitar cerrar
        if (idx === 0) {
          const ringGeo = new THREE.RingGeometry(0.65, 0.9, 16);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(v.x, (v.z || 0) + 0.11, v.y);
          group.add(ring);
        }
      });

      // Guía elástica desde el último vértice hacia la posición del cursor
      if (cursorGuiaPl) {
        const ultimo = verticesPolilinea[verticesPolilinea.length - 1];
        const guidePts = [
          new THREE.Vector3(ultimo.x, (ultimo.z || 0) + 0.1, ultimo.y),
          new THREE.Vector3(cursorGuiaPl.x, (cursorGuiaPl.z || 0) + 0.1, cursorGuiaPl.y),
        ];

        const guideGeo = new THREE.BufferGeometry().setFromPoints(guidePts);
        const guideMat = new THREE.LineDashedMaterial({
          color: 0x38bdf8,
          linewidth: 2,
          dashSize: 0.6,
          gapSize: 0.35,
        });
        const guideLine = new THREE.Line(guideGeo, guideMat);
        guideLine.computeLineDistances();
        group.add(guideLine);

        // Si "Cerrar polilínea" está activado, mostrar también guía elástica de cierre hacia el 1er vértice
        if (cerrarPolilinea && verticesPolilinea.length >= 2) {
          const primero = verticesPolilinea[0];
          const closePts = [
            new THREE.Vector3(cursorGuiaPl.x, (cursorGuiaPl.z || 0) + 0.1, cursorGuiaPl.y),
            new THREE.Vector3(primero.x, (primero.z || 0) + 0.1, primero.y),
          ];
          const closeGeo = new THREE.BufferGeometry().setFromPoints(closePts);
          const closeMat = new THREE.LineDashedMaterial({
            color: 0x94a3b8,
            linewidth: 1.5,
            dashSize: 0.4,
            gapSize: 0.4,
          });
          const closeLine = new THREE.Line(closeGeo, closeMat);
          closeLine.computeLineDistances();
          group.add(closeLine);
        }
      }
    }

    // 8. Arcos CAD Independientes
    if (arcosCad.length > 0) {
      arcosCad.forEach((arc) => {
        const capaObj = capas.find((c) => c.id === arc.capaId);
        if (capaObj?.visible === false) return;

        const esSel = arcosSeleccionados.includes(arc.id);
        const color = esSel
          ? 0xff0055
          : arc.rol === "galeria"
          ? 0xf97316
          : arc.rol === "burden_spacing"
          ? 0x06b6d4
          : new THREE.Color(capaObj?.color || "#a855f7").getHex();

        const pts = arc.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.08, p.y));
        const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);

        let arcObj: THREE.Object3D;
        if (arc.tipo === "discontinua" || arc.tipo === "centro") {
          const dashMat = new THREE.LineDashedMaterial({
            color,
            linewidth: 2.5,
            dashSize: arc.tipo === "centro" ? 1.2 : 0.8,
            gapSize: 0.45,
          });
          const dashedLine = new THREE.Line(arcGeo, dashMat);
          dashedLine.computeLineDistances();
          arcObj = dashedLine;
        } else if (arc.tipo === "puntos") {
          const dotMat = new THREE.LineDashedMaterial({
            color,
            linewidth: 2.5,
            dashSize: 0.2,
            gapSize: 0.35,
          });
          const dotLine = new THREE.Line(arcGeo, dotMat);
          dotLine.computeLineDistances();
          arcObj = dotLine;
        } else {
          const mat = new THREE.LineBasicMaterial({ color, linewidth: 3 });
          arcObj = new THREE.Line(arcGeo, mat);
        }
        group.add(arcObj);

        // Nodos en extremos del arco
        if (arc.puntos.length > 0) {
          const pStart = arc.puntos[0];
          const pEnd = arc.puntos[arc.puntos.length - 1];
          [pStart, pEnd].forEach((pt) => {
            const vGeo = new THREE.SphereGeometry(0.28, 10, 10);
            const vMat = new THREE.MeshBasicMaterial({ color });
            const vMesh = new THREE.Mesh(vGeo, vMat);
            vMesh.position.set(pt.x, (pt.z || 0) + 0.08, pt.y);
            group.add(vMesh);
          });
        }
      });
    }

    // 9. Previsualización de Arco en Construcción
    if (puntosArcoConstruccion.length > 0) {
      // Marcadores en los puntos fijados
      puntosArcoConstruccion.forEach((pt, idx) => {
        const vGeo = new THREE.SphereGeometry(idx === 0 ? 0.45 : 0.35, 12, 12);
        const vMat = new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x06b6d4 : 0xff007f });
        const vMesh = new THREE.Mesh(vGeo, vMat);
        vMesh.position.set(pt.x, (pt.z || 0) + 0.1, pt.y);
        group.add(vMesh);

        if (idx === 0) {
          const ringGeo = new THREE.RingGeometry(0.65, 0.9, 16);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(pt.x, (pt.z || 0) + 0.11, pt.y);
          group.add(ring);
        }
      });

      // Si tenemos punto inicial y el cursor se mueve: previsualizar el arco elástico
      if (cursorGuiaArc) {
        let ptsPreview: { x: number; y: number; z: number }[] = [];
        const rInput = parseFloat(radioArco) || 10;

        if (metodoArco === "inicio_fin_r" && puntosArcoConstruccion.length === 1) {
          ptsPreview = generarPuntosArco(puntosArcoConstruccion[0], cursorGuiaArc, rInput, centroIzquierdaArco);
        } else if (metodoArco === "tres_puntos" && puntosArcoConstruccion.length === 2) {
          ptsPreview = generarPuntosArco3P(puntosArcoConstruccion[0], puntosArcoConstruccion[1], cursorGuiaArc);
        } else if (metodoArco === "centro_r" && puntosArcoConstruccion.length === 1) {
          // Centro fijado: mostrar la circunferencia exacta con el Radio numérico ingresado por el usuario
          const cGeo = new THREE.RingGeometry(Math.max(0.1, rInput - 0.08), rInput + 0.08, 48);
          const cMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
          const cMesh = new THREE.Mesh(cGeo, cMat);
          cMesh.rotation.x = Math.PI / 2;
          cMesh.position.set(puntosArcoConstruccion[0].x, (puntosArcoConstruccion[0].z || 0) + 0.1, puntosArcoConstruccion[0].y);
          group.add(cMesh);

          // Línea radial guía desde el centro hacia el cursor
          const radGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(puntosArcoConstruccion[0].x, (puntosArcoConstruccion[0].z || 0) + 0.1, puntosArcoConstruccion[0].y),
            new THREE.Vector3(cursorGuiaArc.x, (cursorGuiaArc.z || 0) + 0.1, cursorGuiaArc.y),
          ]);
          const radMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, linewidth: 2, dashSize: 0.5, gapSize: 0.3 });
          const radLine = new THREE.Line(radGeo, radMat);
          radLine.computeLineDistances();
          group.add(radLine);
        } else if (metodoArco === "centro_r" && puntosArcoConstruccion.length === 2) {
          // Centro e inicio fijados: previsualizar el arco con el radio exacto rInput
          const c = puntosArcoConstruccion[0];
          const p1 = puntosArcoConstruccion[1];
          let a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
          let a2 = Math.atan2(cursorGuiaArc.y - c.y, cursorGuiaArc.x - c.x);
          if (centroIzquierdaArco) {
            while (a2 <= a1) a2 += Math.PI * 2;
          } else {
            while (a2 >= a1) a2 -= Math.PI * 2;
          }
          const steps = 32;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const a = a1 + t * (a2 - a1);
            ptsPreview.push({
              x: c.x + rInput * Math.cos(a),
              y: c.y + rInput * Math.sin(a),
              z: c.z || 0,
            });
          }
        }

        if (ptsPreview.length > 1) {
          const guidePts = ptsPreview.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.1, p.y));
          const guideGeo = new THREE.BufferGeometry().setFromPoints(guidePts);
          const guideMat = new THREE.LineDashedMaterial({
            color: 0xff007f,
            linewidth: 2.5,
            dashSize: 0.6,
            gapSize: 0.35,
          });
          const guideLine = new THREE.Line(guideGeo, guideMat);
          guideLine.computeLineDistances();
          group.add(guideLine);
        }
      }
    }

    // 10. Previsualización en Tiempo Real de RECORTAR (VERDE = queda · ROJO = se elimina)
    if (herramienta === "REC" && recParticion) {
      // 10.1 Tramos que quedan (VERDE brillante)
      recParticion.tramosQueda.forEach((tramo) => {
        if (tramo.length > 1) {
          const pts = tramo.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.14, p.y));
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({
            color: 0x00ff66,
            linewidth: 4,
          });
          const line = new THREE.Line(geo, mat);
          group.add(line);

          // Nodos esféricos verdes en los extremos del tramo conservado
          [pts[0], pts[pts.length - 1]].forEach((pt) => {
            const nodeGeo = new THREE.SphereGeometry(0.35, 12, 12);
            const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
            const node = new THREE.Mesh(nodeGeo, nodeMat);
            node.position.copy(pt);
            group.add(node);
          });
        }
      });

      // 10.2 Tramos que se eliminan (ROJO discontinuo)
      recParticion.tramosElimina.forEach((tramo) => {
        if (tramo.length > 1) {
          const pts = tramo.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.14, p.y));
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineDashedMaterial({
            color: 0xff0055,
            linewidth: 3,
            dashSize: 0.7,
            gapSize: 0.4,
          });
          const line = new THREE.Line(geo, mat);
          line.computeLineDistances();
          group.add(line);
        }
      });

      // 10.3 Marcadores en puntos de corte (Anillos cian con núcleo blanco)
      recParticion.puntosCorte.forEach((pc) => {
        const ringGeo = new THREE.RingGeometry(0.45, 0.72, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pc.x, (pc.z || 0) + 0.18, pc.y);
        group.add(ring);

        const dotGeo = new THREE.SphereGeometry(0.22, 10, 10);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(pc.x, (pc.z || 0) + 0.18, pc.y);
        group.add(dot);
      });
    }

    // 10.4 Resaltado de la entidad cortante seleccionada (Línea ámbar/dorada)
    if (herramienta === "REC" && recCortante) {
      const ctx = {
        lineas: lineasCad,
        polilineas: polilineasCad,
        arcos: arcosCad,
        perfil: poligonoCresta,
      };
      const cortData = obtenerPuntosDeEntidad(recCortante, ctx);
      if (cortData && cortData.puntos.length > 1) {
        const pts = cortData.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.11, p.y));
        if (cortData.cerrada) pts.push(pts[0]);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({
          color: 0xf59e0b,
          linewidth: 2.5,
          dashSize: 0.9,
          gapSize: 0.5,
        });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        group.add(line);
      }
    }

    // 11. Resaltado de Selección para UNIR / SEPARAR (Cian brillante con nodos en extremos)
    if (herramienta === "UNI" && uniSeleccionadas.length > 0) {
      uniSeleccionadas.forEach((ref) => {
        let pts: THREE.Vector3[] = [];
        if (ref.tipo === "linea") {
          const l = lineasCad.find((item) => item.id === ref.id);
          if (l) {
            pts = [
              new THREE.Vector3(l.p1.x, (l.p1.z || 0) + 0.12, l.p1.y),
              new THREE.Vector3(l.p2.x, (l.p2.z || 0) + 0.12, l.p2.y),
            ];
          }
        } else if (ref.tipo === "polilinea") {
          const pl = polilineasCad.find((item) => item.id === ref.id);
          if (pl) {
            pts = pl.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.12, p.y));
            if (pl.cerrada) pts.push(pts[0]);
          }
        } else if (ref.tipo === "arco") {
          const arc = arcosCad.find((item) => item.id === ref.id);
          if (arc) {
            pts = arc.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.12, p.y));
          }
        }

        if (pts.length > 1) {
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            linewidth: 4,
          });
          const line = new THREE.Line(geo, mat);
          group.add(line);

          // Nodos esféricos cian en los extremos
          [pts[0], pts[pts.length - 1]].forEach((pt) => {
            const nGeo = new THREE.SphereGeometry(0.35, 10, 10);
            const nMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
            const node = new THREE.Mesh(nGeo, nMat);
            node.position.copy(pt);
            group.add(node);
          });
        }
      });
    }

    // 12. Visualización y Snap de Punto Medio (Midpoint ▲) en todas las líneas y polilíneas
    if (mostrarPuntoMedio) {
      const midpoints: THREE.Vector3[] = [];

      lineasCad.forEach((l) => {
        midpoints.push(
          new THREE.Vector3(
            (l.p1.x + l.p2.x) / 2,
            ((l.p1.z || 0) + (l.p2.z || 0)) / 2 + 0.16,
            (l.p1.y + l.p2.y) / 2
          )
        );
      });

      polilineasCad.forEach((pl) => {
        const n = pl.puntos.length;
        const nSeg = pl.cerrada ? n : n - 1;
        for (let i = 0; i < nSeg; i++) {
          const p1 = pl.puntos[i];
          const p2 = pl.puntos[(i + 1) % n];
          midpoints.push(
            new THREE.Vector3(
              (p1.x + p2.x) / 2,
              ((p1.z || 0) + (p2.z || 0)) / 2 + 0.16,
              (p1.y + p2.y) / 2
            )
          );
        }
      });

      midpoints.forEach((m) => {
        // Marcador triangular clásico de AutoCAD para Punto Medio (▲)
        const tam = 0.42;
        const triPts = [
          new THREE.Vector3(m.x, m.y, m.z + tam),
          new THREE.Vector3(m.x + tam * 0.866, m.y, m.z - tam * 0.5),
          new THREE.Vector3(m.x - tam * 0.866, m.y, m.z - tam * 0.5),
          new THREE.Vector3(m.x, m.y, m.z + tam),
        ];
        const triGeo = new THREE.BufferGeometry().setFromPoints(triPts);
        const triMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2.5 });
        const triLine = new THREE.Line(triGeo, triMat);
        group.add(triLine);

        // Nodo esférico cian brillante en el centro exacto
        const dotGeo = new THREE.SphereGeometry(0.18, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(m);
        group.add(dot);
      });
    }

    // 13. Previsualización de Puntos de DIVISIÓN (DIV)
    if (herramienta === "DIV" && divEntidad) {
      const nPartes = parseInt(divPartes, 10) || 4;
      const ptsDiv = calcularPuntosDivision(divEntidad, nPartes);

      // Resaltar la entidad seleccionada en fucsia neón
      const ctxDiv = {
        lineas: lineasCad,
        polilineas: polilineasCad,
        arcos: arcosCad,
        perfil: poligonoCresta,
      };
      const entData = obtenerPuntosDeEntidad(divEntidad, ctxDiv);
      if (entData && entData.puntos.length >= 2) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(
          entData.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.12, p.y))
        );
        const lineMat = new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: 3.5 });
        group.add(new THREE.Line(lineGeo, lineMat));
      }

      // Dibujar los N-1 puntos SNAP calculados con esferas ámbar y cruces cian
      ptsDiv.forEach((pt) => {
        const pos = new THREE.Vector3(pt.x, (pt.z || 0) + 0.18, pt.y);

        const dotGeo = new THREE.SphereGeometry(0.24, 10, 10);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos);
        group.add(dot);

        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(pos.x - 0.28, pos.y, pos.z),
          new THREE.Vector3(pos.x + 0.28, pos.y, pos.z),
          new THREE.Vector3(pos.x, pos.y, pos.z - 0.28),
          new THREE.Vector3(pos.x, pos.y, pos.z + 0.28),
        ]);
        const tickMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2.5 });
        group.add(new THREE.LineSegments(tickGeo, tickMat));
      });
    }

    // 14. Previsualización de DESFASE (OFF)
    if (herramienta === "OFF" && offEntidad) {
      const dVal = parseFloat(offDistancia) || 0.25;
      const ctxOff = {
        lineas: lineasCad,
        polilineas: polilineasCad,
        arcos: arcosCad,
        perfil: poligonoCresta,
      };

      // Resaltar la entidad base original en fucsia neón
      const entData = obtenerPuntosDeEntidad(offEntidad, ctxOff);
      if (entData && entData.puntos.length >= 2) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(
          entData.puntos.map((p) => new THREE.Vector3(p.x, (p.z || 0) + 0.12, p.y))
        );
        const lineMat = new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: 3.5 });
        group.add(new THREE.Line(lineGeo, lineMat));
      }

      // Calcular y dibujar la silueta desfasada en cian brillante
      const resOff = calcularDesfaseEntidad(offEntidad, offModo, dVal);
      if (resOff) {
        if (resOff.tipo === "linea") {
          const lGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(resOff.p1.x, (resOff.p1.z || 0) + 0.18, resOff.p1.y),
            new THREE.Vector3(resOff.p2.x, (resOff.p2.z || 0) + 0.18, resOff.p2.y),
          ]);
          const lMat = new THREE.LineDashedMaterial({
            color: 0x00f0ff,
            linewidth: 3,
            dashSize: 0.8,
            gapSize: 0.4,
          });
          const lLine = new THREE.Line(lGeo, lMat);
          lLine.computeLineDistances();
          group.add(lLine);
        } else if (resOff.tipo === "arco") {
          const ptsArc: THREE.Vector3[] = [];
          const segs = 32;
          let aIni = resOff.anguloInicio;
          let aFin = resOff.anguloFin;
          if (aFin < aIni) aFin += Math.PI * 2;
          for (let i = 0; i <= segs; i++) {
            const a = aIni + (i / segs) * (aFin - aIni);
            ptsArc.push(
              new THREE.Vector3(
                resOff.centro.x + resOff.radio * Math.cos(a),
                (resOff.centro.z || 0) + 0.18,
                resOff.centro.y + resOff.radio * Math.sin(a)
              )
            );
          }
          const aGeo = new THREE.BufferGeometry().setFromPoints(ptsArc);
          const aMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 3 });
          group.add(new THREE.Line(aGeo, aMat));
        } else if (resOff.tipo === "polilinea") {
          const ptsPl = resOff.puntos.map(
            (p) => new THREE.Vector3(p.x, (p.z || 0) + 0.18, p.y)
          );
          if (resOff.cerrada && ptsPl.length > 0) {
            ptsPl.push(ptsPl[0].clone());
          }
          const plGeo = new THREE.BufferGeometry().setFromPoints(ptsPl);
          const plMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 3 });
          group.add(new THREE.Line(plGeo, plMat));
        }
      }
    }

    // -------------------------------------------------------------------------
    // RENDERIZADO DE COTAS CAD (Líneas testigo, línea de cota, ticks y texto métrico)
    // -------------------------------------------------------------------------
    function crearSpriteTextoCotaLocal(texto: string, color: string = "#00f0ff"): THREE.Sprite {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 256, 64);

        // Texto estilo AutoCAD limpio, sin cápsula invasiva
        ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
        ctx.lineWidth = 4;
        ctx.strokeText(texto, 128, 32);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(texto, 128, 32);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.renderOrder = 99999;

      // Tamaño fijo AutoCAD en metros (altura estándar DIMTXT = 0.35 m, ancho 1.4 m)
      const altoCad = 0.35;
      const anchoCad = altoCad * (256 / 64);
      sprite.scale.set(anchoCad, altoCad, 1);
      return sprite;
    }

    cotasCad.forEach((c) => {
      const capa = capas.find((cp) => cp.id === c.capaId);
      if (capa && !capa.visible) return;

      if (c.tipo !== "distancia") {
        // COTA RADIAL DE ARRANQUE (Desde el centro hacia afuera, idéntico a la captura)
        const pCentro = c.p1;
        const pVertice = c.p2;
        const z1 = (pCentro.z || 0) + 0.18;
        const z2 = (pVertice.z || 0) + 0.18;

        // 1. Marcador rombo cian en el centro
        const sc = 0.08;
        const cPts = [
          new THREE.Vector3(pCentro.x, z1, pCentro.y + sc),
          new THREE.Vector3(pCentro.x + sc, z1, pCentro.y),
          new THREE.Vector3(pCentro.x, z1, pCentro.y - sc),
          new THREE.Vector3(pCentro.x - sc, z1, pCentro.y),
          new THREE.Vector3(pCentro.x, z1, pCentro.y + sc),
        ];
        const cGeo = new THREE.BufferGeometry().setFromPoints(cPts);
        const cMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
        group.add(new THREE.Line(cGeo, cMat));

        // 2. Línea radial desde el centro hacia el vértice exterior
        const radGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(pCentro.x, z1, pCentro.y),
          new THREE.Vector3(pVertice.x, z2, pVertice.y),
        ]);
        const radMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
        group.add(new THREE.Line(radGeo, radMat));

        // 3. Etiqueta con el texto de cota en posición correcta 3D (X, Z-alt, Y-cad)
        const sp = crearSpriteTextoCotaLocal(c.texto, "#00f0ff");
        sp.position.set(
          (pCentro.x + pVertice.x) / 2 + 0.15,
          Math.max(z1, z2) + 0.12,
          (pCentro.y + pVertice.y) / 2
        );
        group.add(sp);
        return;
      }

      // MODO DISTANCIA LINEAL
      const p1 = c.p1;
      const p2 = c.p2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) return;

      const desp = c.desplazamiento || 0.18;
      const nx = (-dy / len) * desp;
      const ny = (dx / len) * desp;

      const z1 = (p1.z || 0) + 0.18;
      const z2 = (p2.z || 0) + 0.18;

      const o1 = new THREE.Vector3(p1.x + nx, z1, p1.y + ny);
      const o2 = new THREE.Vector3(p2.x + nx, z2, p2.y + ny);

      // Líneas testigo
      const extMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.8 });
      const ext1Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.x, z1, p1.y),
        new THREE.Vector3(p1.x + nx * 1.15, z1, p1.y + ny * 1.15),
      ]);
      group.add(new THREE.Line(ext1Geo, extMat));

      const ext2Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p2.x, z2, p2.y),
        new THREE.Vector3(p2.x + nx * 1.15, z2, p2.y + ny * 1.15),
      ]);
      group.add(new THREE.Line(ext2Geo, extMat));

      // Línea principal de cota
      const cotaMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
      const cotaGeo = new THREE.BufferGeometry().setFromPoints([o1, o2]);
      group.add(new THREE.Line(cotaGeo, cotaMat));

      // Ticks diagonales
      const tickL = 0.08;
      const tx = (dx / len) * tickL;
      const ty = (dy / len) * tickL;
      const tnx = (nx / desp) * tickL;
      const tny = (ny / desp) * tickL;

      const tick1Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(o1.x - tx - tnx, z1, o1.z - ty - tny),
        new THREE.Vector3(o1.x + tx + tnx, z1, o1.z + ty + tny),
      ]);
      group.add(new THREE.Line(tick1Geo, cotaMat));

      const tick2Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(o2.x - tx - tnx, z2, o2.z - ty - tny),
        new THREE.Vector3(o2.x + tx + tnx, z2, o2.z + ty + tny),
      ]);
      group.add(new THREE.Line(tick2Geo, cotaMat));

      // Texto de Cota centrado sobre la línea (CAD X, CAD Z-alt, CAD Y)
      const sp = crearSpriteTextoCotaLocal(c.texto, "#00f0ff");
      sp.position.set(
        (o1.x + o2.x) / 2,
        Math.max(o1.y, o2.y) + 0.12,
        (o1.z + o2.z) / 2
      );
      group.add(sp);
    });

    // -------------------------------------------------------------------------
    // PREVISUALIZACIÓN INTERACTIVA DE COTA / ARRANQUE
    // -------------------------------------------------------------------------
    if (herramienta === "COT") {
      // Caso 1: Previsualización en modo Distancia Lineal
      if (cotModo === "distancia" && cotPuntoInicio && cotCursorGuia) {
        const p1 = cotPuntoInicio;
        const p2 = cotCursorGuia;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.05) {
          const desp = parseFloat(cotSeparacion) || 0.18;
          const nx = (-dy / len) * desp;
          const ny = (dx / len) * desp;
          const z1 = (p1.z || 0) + 0.18;
          const z2 = (p2.z || 0) + 0.18;
          const o1 = new THREE.Vector3(p1.x + nx, z1, p1.y + ny);
          const o2 = new THREE.Vector3(p2.x + nx, z2, p2.y + ny);

          const prevMat = new THREE.LineDashedMaterial({ color: 0xec4899, dashSize: 0.2, gapSize: 0.1 });
          const cotaGeo = new THREE.BufferGeometry().setFromPoints([o1, o2]);
          const linePrev = new THREE.Line(cotaGeo, prevMat);
          linePrev.computeLineDistances();
          group.add(linePrev);

          const sp = crearSpriteTextoCotaLocal(`${len.toFixed(2)} m`, "#ec4899");
          sp.position.set(
            (o1.x + o2.x) / 2,
            Math.max(o1.y, o2.y) + 0.12,
            (o1.z + o2.z) / 2
          );
          group.add(sp);
        }
      }

      // Caso 2: Previsualización en modo Arranque (B1-B5 / 4G) desde el centro tocado
      if (cotModo !== "distancia" && cotCentro) {
        const centro = cotCentro;
        const zC = (centro.z || 0) + 0.18;

        // 1. Nodo central de rombo cian
        const sc = 0.09;
        const cPts = [
          new THREE.Vector3(centro.x, zC, centro.y + sc),
          new THREE.Vector3(centro.x + sc, zC, centro.y),
          new THREE.Vector3(centro.x, zC, centro.y - sc),
          new THREE.Vector3(centro.x - sc, zC, centro.y),
          new THREE.Vector3(centro.x, zC, centro.y + sc),
        ];
        const cGeo = new THREE.BufferGeometry().setFromPoints(cPts);
        group.add(new THREE.Line(cGeo, new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 })));

        // Calcular distancia hacia afuera (por cursor o por input)
        let distB = parseFloat(cotDistanciaB) || 0.50;
        if (cotCursorGuia) {
          const dCur = Math.hypot(cotCursorGuia.x - centro.x, cotCursorGuia.y - centro.y);
          if (dCur > 0.05) distB = Math.round(dCur * 100) / 100;
        }

        const mitad = distB / 2;
        let ptsCuad: { x: number; y: number }[] = [];

        if (!cotCuadradoAlineado) {
          // Rombo girado 45°
          ptsCuad = [
            { x: centro.x, y: centro.y + mitad },
            { x: centro.x + mitad, y: centro.y },
            { x: centro.x, y: centro.y - mitad },
            { x: centro.x - mitad, y: centro.y },
          ];
        } else {
          // Cuadrado alineado
          ptsCuad = [
            { x: centro.x - mitad, y: centro.y + mitad },
            { x: centro.x + mitad, y: centro.y + mitad },
            { x: centro.x + mitad, y: centro.y - mitad },
            { x: centro.x - mitad, y: centro.y - mitad },
          ];
        }

        // Línea radial desde el centro hacia afuera (hacia el vértice superior)
        const radPts = [
          new THREE.Vector3(centro.x, zC, centro.y),
          new THREE.Vector3(ptsCuad[0].x, zC, ptsCuad[0].y),
        ];
        group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(radPts),
          new THREE.LineBasicMaterial({ color: 0xec4899, linewidth: 2.5 })
        ));

        // Etiqueta al lado de la línea radial (centrado en X, Z-alt, Y-cad)
        const sp = crearSpriteTextoCotaLocal(`${cotModo.toUpperCase()} = ${distB.toFixed(2)} m`, "#ec4899");
        sp.position.set(
          (centro.x + ptsCuad[0].x) / 2 + 0.15,
          zC + 0.12,
          (centro.y + ptsCuad[0].y) / 2
        );
        group.add(sp);

        // Perímetro discontinuo del cuadrante
        const perimPts = ptsCuad.map((p) => new THREE.Vector3(p.x, zC, p.y));
        perimPts.push(perimPts[0].clone());
        const perimMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.15, gapSize: 0.08, linewidth: 2 });
        const perimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(perimPts), perimMat);
        perimLine.computeLineDistances();
        group.add(perimLine);

        // 4 Marcadores de rombo amarillo con cruz cian en las esquinas
        ptsCuad.forEach((p) => {
          const s = 0.07;
          const romboPts = [
            new THREE.Vector3(p.x, zC, p.y + s),
            new THREE.Vector3(p.x + s, zC, p.y),
            new THREE.Vector3(p.x, zC, p.y - s),
            new THREE.Vector3(p.x - s, zC, p.y),
            new THREE.Vector3(p.x, zC, p.y + s),
          ];
          group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(romboPts),
            new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 })
          ));
        });
      }
    }

    // 14. Renderizado de SÓLIDOS 3D Extruidos, Aristas Interactivas y Centroide
    if (solidosCad.length > 0) {
      solidosCad.forEach((sol) => {
        const capaSol = capas.find((c) => c.id === sol.capaId);
        if (capaSol && !capaSol.visible) return;

        const lev = sol.levantamiento || 0;
        const prof = sol.profundidad || 0;
        const hTotal = (lev + prof) > 0 ? (lev + prof) : (sol.profundidad || 1);

        const shape = new THREE.Shape();
        sol.perfil.forEach((pt, idx) => {
          if (idx === 0) shape.moveTo(pt.x, pt.y);
          else shape.lineTo(pt.x, pt.y);
        });
        shape.closePath();

        const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
          depth: hTotal,
          bevelEnabled: false,
        });

        extrudeGeom.rotateX(Math.PI / 2);
        // Trasladar en Y de Three.js para que el sólido ocupe exactamente de -prof a +lev
        extrudeGeom.translate(0, lev, 0);

        const solMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(sol.color || "#f43f5e").getHex(),
          transparent: true,
          opacity: 0.58,
          roughness: 0.35,
          metalness: 0.15,
          side: THREE.DoubleSide,
        });

        const solidMesh = new THREE.Mesh(extrudeGeom, solMat);
        group.add(solidMesh);

        // Renderizado de las aristas del sólido (seleccionadas vs normales)
        const aristas = obtenerAristasDeSolido(sol);
        aristas.forEach((ar) => {
          const esSel = aristasSolidosSeleccionadas.includes(ar.id);
          const colorAr = esSel ? 0x00f0ff : 0xe2e8f0;
          const ancho = esSel ? 3.5 : 1.5;

          // CAD (x, y, z) -> Three.js (x, z, y)
          const p1Vec = new THREE.Vector3(ar.p1.x, ar.p1.z, ar.p1.y);
          const p2Vec = new THREE.Vector3(ar.p2.x, ar.p2.z, ar.p2.y);
          const geom = new THREE.BufferGeometry().setFromPoints([p1Vec, p2Vec]);

          const mat = new THREE.LineBasicMaterial({
            color: colorAr,
            linewidth: ancho,
          });
          const lineObj = new THREE.Line(geom, mat);
          group.add(lineObj);

          if (esSel) {
            // Nodos marcadores esféricos en los extremos de la arista seleccionada
            [p1Vec, p2Vec].forEach((pVec) => {
              const nodeGeo = new THREE.SphereGeometry(0.35, 12, 12);
              const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
              const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
              nodeMesh.position.copy(pVec);
              group.add(nodeMesh);
            });
          }
        });

        // Marcador cian luminiscente en el Centroide 3D
        const centroGeo = new THREE.SphereGeometry(0.38, 16, 16);
        const centroMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const centroMesh = new THREE.Mesh(centroGeo, centroMat);
        // CAD x=x, Three.js Y = CAD z (elevación), Three.js Z = CAD y (Norte)
        centroMesh.position.set(sol.centroide.x, sol.centroide.z, sol.centroide.y);
        group.add(centroMesh);
      });
    }

    // 15. Renderizado de GRILLA Técnica Dinámica y Cruz de Origen
    if (griMostrarGrilla) {
      const p = Math.max(0.1, parseFloat(griPaso) || 0.5);
      const oX = parseFloat(griOrigenX) || 0;
      const oY = parseFloat(griOrigenY) || 0;
      const radio = 160;
      const numLineas = Math.min(400, Math.max(10, Math.round((radio * 2) / p)));
      const size = numLineas * p;

      const dynamicGrid = new THREE.GridHelper(size, numLineas, 0xf43f5e, 0x141e2e);
      dynamicGrid.position.set(oX, -0.02, oY);
      group.add(dynamicGrid);

      // Cruz fucsia en el Origen configurado de la Grilla
      const cruzMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2.5 });
      const cSize = Math.max(1.2, p * 2);
      const cruzGeo1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(oX - cSize, 0.03, oY),
        new THREE.Vector3(oX + cSize, 0.03, oY),
      ]);
      const cruzGeo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(oX, 0.03, oY - cSize),
        new THREE.Vector3(oX, 0.03, oY + cSize),
      ]);
      group.add(new THREE.Line(cruzGeo1, cruzMat));
      group.add(new THREE.Line(cruzGeo2, cruzMat));

      // Marcador esférico de origen (0, 0) de la grilla
      const oGeo = new THREE.SphereGeometry(0.28, 12, 12);
      const oMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
      const oMesh = new THREE.Mesh(oGeo, oMat);
      oMesh.position.set(oX, 0.04, oY);
      group.add(oMesh);

      // Ver Distancias de Grilla (Anotaciones numéricas en metros a lo largo de los ejes)
      if (griVerDistancias) {
        const stepDist = p >= 5 ? p : (p >= 1 ? 5 : (p >= 0.5 ? 2.5 : 1));
        const numMarcas = 10;
        for (let i = -numMarcas; i <= numMarcas; i++) {
          if (i === 0) continue;
          const dVal = (i * stepDist).toFixed(1).replace(/\.0$/, "");
          // Eje X (Este-Oeste)
          const spX = crearSpriteTextoCotaLocal(`${dVal > "0" ? `+${dVal}` : dVal}m`, "#94a3b8");
          spX.position.set(oX + i * stepDist, 0.08, oY);
          spX.scale.set(1.4, 0.7, 1);
          group.add(spX);

          // Eje Y (Norte-Sur en Z de Three.js)
          const spY = crearSpriteTextoCotaLocal(`${dVal > "0" ? `+${dVal}` : dVal}m`, "#06b6d4");
          spY.position.set(oX, 0.08, oY + i * stepDist);
          spY.scale.set(1.4, 0.7, 1);
          group.add(spY);
        }
      }

      // Líneas Auxiliares de Grilla (Horizontales y Verticales)
      // "Al apagar Mostrar grilla también se ocultan todas las guías auxiliares. No se borran."
      if (guiasAuxiliares.length > 0) {
        guiasAuxiliares.forEach((g) => {
          const lGeo = new THREE.BufferGeometry();
          if (g.tipo === "H") {
            // Horizontal: a lo largo de X en Z_three = pos
            lGeo.setFromPoints([
              new THREE.Vector3(-400, 0.02, g.pos),
              new THREE.Vector3(400, 0.02, g.pos),
            ]);
          } else {
            // Vertical: a lo largo de Z_three en X = pos
            lGeo.setFromPoints([
              new THREE.Vector3(g.pos, 0.02, -400),
              new THREE.Vector3(g.pos, 0.02, 400),
            ]);
          }
          const lMat = new THREE.LineDashedMaterial({
            color: g.tipo === "H" ? 0x00f0ff : 0xf43f5e,
            linewidth: 2,
            dashSize: 1.2,
            gapSize: 0.6,
          });
          const auxLine = new THREE.Line(lGeo, lMat);
          auxLine.computeLineDistances();
          group.add(auxLine);
        });
      }
    }
  }, [
    solidosCad,
    aristasSolidosSeleccionadas,
    griMostrarGrilla,
    griVerDistancias,
    guiasAuxiliares,
    griPaso,
    griOrigenX,
    griOrigenY,
    poligonoCresta,
    taladros,
    indicesSeleccionados,
    capas,
    puntosCad,
    puntosSeleccionados,
    tipoPunto,
    puntoBaseIndice,
    lineasCad,
    lineasSeleccionadas,
    inicioLinea,
    cursorGuiaLinea,
    polilineasCad,
    polilineasSeleccionadas,
    verticesPolilinea,
    cursorGuiaPl,
    cerrarPolilinea,
    arcosCad,
    arcosSeleccionados,
    puntosArcoConstruccion,
    cursorGuiaArc,
    radioArco,
    centroIzquierdaArco,
    metodoArco,
    herramienta,
    recParticion,
    recCortante,
    uniSeleccionadas,
    mostrarPuntoMedio,
    divEntidad,
    divPartes,
    offEntidad,
    offModo,
    offDistancia,
    cotasCad,
    cotPuntoInicio,
    cotCursorGuia,
    cotSeparacion,
    cotModo,
    cotCentro,
    cotDistanciaB,
    cotCuadradoAlineado,
  ]);

  // Manejo de Interacción 3D: Arrastre manual de punto individual + Órbita 360° libre de la cámara
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (bloqueadoGlobal) return;

    // Si el toque/clic proviene de un panel flotante, input, botón o control UI, ignorar completamente
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        "header, button, input, select, textarea, aside, [class*='cad-panel'], [class*='panel-'], .cad-3d-gizmo-container, .cad-dock-left-exact, .cad-header-exact, .cad-dock-right-exact, .cad-header-actions-exact"
      )
    ) {
      return;
    }

    orbitRef.current.isDragging = true;
    orbitRef.current.dragStart = { x: e.clientX, y: e.clientY };
    orbitRef.current.dragButton = e.button;
    orbitRef.current.hasMovedSignificantly = false;
    orbitRef.current.touchStartTime = Date.now();
    orbitRef.current.puntoCadArrastrado = null;
    orbitRef.current.verticeArrastrado = null;
    orbitRef.current.poligonoDragOffsets = null;

    if (e.button === 0 && herramienta === "SEL") {
      // 1. Si estamos esperando seleccionar el punto base para una línea o polígono
      if (esperandoPuntoBase) {
        const v = verificarToqueVertice(e.clientX, e.clientY);
        if (v !== null) {
          setPuntoBaseIndice(v);
          setEsperandoPuntoBase(false);
          const pt = poligonoCresta[v];
          if (pt) {
            setMoverX(pt.x.toString());
            setMoverY(pt.y.toString());
            setMoverZ("0");
          }
          mostrarAviso(`Punto base fijado: Vértice ${v + 1}`);
          return;
        }
      }

      // 2. Si hay exactamente 1 punto individual seleccionado y el usuario toca DIRECTAMENTE ese punto:
      // "y si solo es 1 punto se mueve como voy moviendo yo jalando y asi xq lineas no se podrian mover asi"
      if (puntosSeleccionados.length === 1) {
        const selId = puntosSeleccionados[0];
        const ptoBajoPuntero = verificarToquePuntoCad(e.clientX, e.clientY);
        if (ptoBajoPuntero === selId) {
          orbitRef.current.puntoCadArrastrado = selId;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          return;
        }
      }
    }

    // Para cualquier otro arrastre: Órbita 360° libre y completa de la cámara
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Si la herramienta LÍNEA tiene un punto de inicio fijado, actualizar la guía interactiva
    if (herramienta === "LIN" && inicioLinea && !orbitRef.current.isDragging) {
      const snapMed = mostrarPuntoMedio ? verificarToquePuntoMedio(e.clientX, e.clientY, 24) : null;
      const pMundo = snapMed || obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        const pz = ("z" in pMundo && typeof pMundo.z === "number") ? pMundo.z : 0;
        setCursorGuiaLinea({ x: pMundo.x, y: pMundo.y, z: pz });
        const dx = pMundo.x - inicioLinea.x;
        const dy = pMundo.y - inicioLinea.y;
        const long = Math.hypot(dx, dy);
        const az = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
        setDistanciaLinea(long.toFixed(2));
        setAzimutLinea(az.toFixed(1));
      }
    }

    // Si la herramienta POLILÍNEA tiene vértices fijados, actualizar la guía interactiva hacia el cursor
    if (herramienta === "PL" && verticesPolilinea.length > 0 && !orbitRef.current.isDragging) {
      const snapMed = mostrarPuntoMedio ? verificarToquePuntoMedio(e.clientX, e.clientY, 24) : null;
      const pMundo = snapMed || obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        const pz = ("z" in pMundo && typeof pMundo.z === "number") ? pMundo.z : 0;
        setCursorGuiaPl({ x: pMundo.x, y: pMundo.y, z: pz });
      }
    }

    // Si la herramienta ARCO tiene puntos fijados, actualizar la guía interactiva hacia el cursor
    if (herramienta === "ARC" && puntosArcoConstruccion.length > 0 && !orbitRef.current.isDragging) {
      const snapMed = mostrarPuntoMedio ? verificarToquePuntoMedio(e.clientX, e.clientY, 24) : null;
      const pMundo = snapMed || obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        const pz = ("z" in pMundo && typeof pMundo.z === "number") ? pMundo.z : 0;
        setCursorGuiaArc({ x: pMundo.x, y: pMundo.y, z: pz });
      }
    }

    // Si la herramienta COTA tiene un punto inicial o un centro de arranque fijado, actualizar la guía interactiva hacia el cursor
    if (herramienta === "COT" && (cotPuntoInicio || cotCentro) && !orbitRef.current.isDragging) {
      const snapMed = mostrarPuntoMedio ? verificarToquePuntoMedio(e.clientX, e.clientY, 24) : null;
      const pMundo = snapMed || obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        const pz = ("z" in pMundo && typeof pMundo.z === "number") ? pMundo.z : 0;
        setCotCursorGuia({ x: pMundo.x, y: pMundo.y, z: pz });
        if (cotCentro && cotModo !== "distancia") {
          const d = Math.hypot(pMundo.x - cotCentro.x, pMundo.y - cotCentro.y);
          if (d > 0.02) setCotDistanciaB(d.toFixed(2));
        }
      }
    }

    if (!orbitRef.current.isDragging) return;

    const dx = e.clientX - orbitRef.current.dragStart.x;
    const dy = e.clientY - orbitRef.current.dragStart.y;

    if (Math.hypot(dx, dy) > 4) {
      orbitRef.current.hasMovedSignificantly = true;
    }

    // CASO A: Arrastre manual directo de un punto independiente en 3D ("se mueve como voy moviendo yo jalando")
    if (orbitRef.current.puntoCadArrastrado !== null) {
      const pMundo = obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        const idArr = orbitRef.current.puntoCadArrastrado;
        setPuntosCad((prev) =>
          prev.map((p) =>
            p.id === idArr ? { ...p, x: pMundo.x, y: pMundo.y } : p
          )
        );
        setMoverX(pMundo.x.toString());
        setMoverY(pMundo.y.toString());
      }
      return;
    }

    // CASO B: Selección Múltiple por Caja (Marquee Box si se arrastra con Shift)
    if (e.shiftKey && herramienta === "SEL") {
      orbitRef.current.isMarquee = true;
      setMarqueeBox({
        x1: orbitRef.current.dragStart.x,
        y1: orbitRef.current.dragStart.y,
        x2: e.clientX,
        y2: e.clientY,
      });
      return;
    }

    orbitRef.current.dragStart = { x: e.clientX, y: e.clientY };

    // CASO C: Órbita libre 360 grados completa de la cámara
    const camera = cameraRef.current;
    if (!camera) return;

    if (orbitRef.current.dragButton === 0) {
      // 360° horizontal sin límite
      orbitRef.current.theta -= dx * 0.008;
      // Rotación vertical suave y completa evitando singularidades (0.04 a PI - 0.04)
      orbitRef.current.phi = Math.max(0.04, Math.min(Math.PI - 0.04, orbitRef.current.phi - dy * 0.008));
    } else {
      // Panorámica con botón secundario / derecho
      const panFactor = orbitRef.current.radius * 0.0012;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();

      orbitRef.current.target.addScaledVector(right, dx * panFactor);
      orbitRef.current.target.addScaledVector(forward, dy * panFactor);
    }

    const { theta, phi, radius, target } = orbitRef.current;
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);

    // Sincronizar ejes Gizmo 3D
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);
    const vx = new THREE.Vector3(1, 0, 0).applyMatrix4(rot);
    const vy = new THREE.Vector3(0, 1, 0).applyMatrix4(rot);
    const vz = new THREE.Vector3(0, 0, 1).applyMatrix4(rot);
    const len = 28;
    setEjesScreen({
      x: { x: vx.x * len, y: -vx.y * len },
      y: { x: vy.x * len, y: -vy.y * len },
      z: { x: vz.x * len, y: -vz.y * len },
    });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    // Si el toque/clic ocurrió sobre un panel, input o control UI, no crear ni interactuar en 3D
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        "header, button, input, select, textarea, aside, [class*='cad-panel'], [class*='panel-'], .cad-3d-gizmo-container, .cad-dock-left-exact, .cad-header-exact, .cad-dock-right-exact, .cad-header-actions-exact"
      )
    ) {
      orbitRef.current.isDragging = false;
      return;
    }

    const eraArrastrePunto = orbitRef.current.puntoCadArrastrado !== null;
    const eraMarquee = orbitRef.current.isMarquee;

    orbitRef.current.isDragging = false;
    orbitRef.current.puntoCadArrastrado = null;
    orbitRef.current.verticeArrastrado = null;
    orbitRef.current.poligonoDragOffsets = null;

    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignorar
    }

    if (eraArrastrePunto) {
      registrarHistorial();
      return;
    }

    // Finalizar selección múltiple por caja (Marquee)
    if (eraMarquee && marqueeBox) {
      seleccionarPorCaja(marqueeBox);
      setMarqueeBox(null);
      orbitRef.current.isMarquee = false;
      return;
    }

    // Si fue un toque rápido sin arrastrar
    if (!orbitRef.current.hasMovedSignificantly) {
      // Si estamos en modo 'MOVER ORIGEN CON SNAP' de la grilla
      if (griMoviendoOrigen) {
        let ptDestino: { x: number; y: number } | null = null;
        const v = verificarToqueVertice(e.clientX, e.clientY);
        if (v !== null && poligonoCresta[v]) {
          ptDestino = { x: poligonoCresta[v].x, y: poligonoCresta[v].y };
        }
        if (!ptDestino) {
          const ptoId = verificarToquePuntoCad(e.clientX, e.clientY);
          if (ptoId) {
            const ptObj = puntosCad.find((p) => p.id === ptoId);
            if (ptObj) ptDestino = { x: ptObj.x, y: ptObj.y };
          }
        }
        if (!ptDestino) {
          const ptoMed = verificarToquePuntoMedio(e.clientX, e.clientY, 24);
          if (ptoMed) ptDestino = { x: ptoMed.x, y: ptoMed.y };
        }
        if (!ptDestino) {
          const pPlano = obtenerCoordenadasPlano(e.clientX, e.clientY);
          if (pPlano) ptDestino = { x: pPlano.x, y: pPlano.y };
        }

        if (ptDestino) {
          setGriOrigenX(ptDestino.x.toFixed(2));
          setGriOrigenY(ptDestino.y.toFixed(2));
          setGriMoviendoOrigen(false);
          mostrarAviso(`✓ Origen de grilla situado en (${ptDestino.x.toFixed(2)}, ${ptDestino.y.toFixed(2)})`);
          return;
        }
      }

      // Si estamos en modo de fijar Guía Auxiliar (Horizontal o Vertical)
      if (modoCrearGuia) {
        const pPlano = obtenerCoordenadasPlano(e.clientX, e.clientY);
        if (pPlano) {
          const posVal = modoCrearGuia === "H" ? pPlano.y : pPlano.x;
          const nuevaGuia = {
            id: `guia-${Date.now()}`,
            tipo: modoCrearGuia,
            pos: Math.round(posVal * 100) / 100,
          };
          setGuiasAuxiliares((prev) => [...prev, nuevaGuia]);
          setModoCrearGuia(null);
          mostrarAviso(`✓ Guía auxiliar ${nuevaGuia.tipo === "H" ? "Horizontal" : "Vertical"} fijada en ${nuevaGuia.pos}m`);
          return;
        }
      }

      if (herramienta === "SEL") {
        hacerRaycastSeleccion(e.clientX, e.clientY);
      } else if (herramienta === "LIN") {
        setPanelLinVisible(true);
        handleInteractuarLinea(e.clientX, e.clientY);
      } else if (herramienta === "PTO") {
        setPanelPtoVisible(true);
        raycastPunto(e.clientX, e.clientY);
      } else if (herramienta === "PL") {
        setPanelPlVisible(true);
        handleInteractuarPolilinea(e.clientX, e.clientY);
      } else if (herramienta === "ARC") {
        setPanelArcVisible(true);
        handleInteractuarArco(e.clientX, e.clientY);
      } else if (herramienta === "REC") {
        setPanelRecVisible(true);
        handleInteractuarRecorte(e.clientX, e.clientY);
      } else if (herramienta === "UNI") {
        setPanelUniVisible(true);
        handleInteractuarUni(e.clientX, e.clientY);
      } else if (herramienta === "DIV") {
        setPanelDivVisible(true);
        handleInteractuarDividir(e.clientX, e.clientY);
      } else if (herramienta === "OFF") {
        setPanelOffVisible(true);
        handleInteractuarDesfase(e.clientX, e.clientY);
      } else if (herramienta === "COT") {
        setPanelCotVisible(true);
        handleInteractuarCota(e.clientX, e.clientY);
      } else if (herramienta === "TAL") {
        setPanelTalVisible(true);
        handleInsertarTaladroSnap(e.clientX, e.clientY);
      } else if (herramienta === "GRI") {
        setPanelGriVisible(true);
      }
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const camera = cameraRef.current;
    if (!camera) return;

    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    orbitRef.current.radius = Math.max(2, Math.min(800, orbitRef.current.radius * factor));

    const { theta, phi, radius, target } = orbitRef.current;
    camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);
  }

  // Seleccionar entidades contenidas en la caja de selección múltiple (Marquee)
  function seleccionarPorCaja(box: { x1: number; y1: number; x2: number; y2: number }) {
    const contenedor = mountRef.current;
    const camera = cameraRef.current;
    if (!contenedor || !camera) return;

    const rect = contenedor.getBoundingClientRect();
    const minX = Math.min(box.x1, box.x2) - rect.left;
    const maxX = Math.max(box.x1, box.x2) - rect.left;
    const minY = Math.min(box.y1, box.y2) - rect.top;
    const maxY = Math.max(box.y1, box.y2) - rect.top;

    const seleccionados: number[] = [];
    poligonoCresta.forEach((p, idx) => {
      const v = new THREE.Vector3(p.x, 0.1, p.y);
      v.project(camera);
      const sx = ((v.x + 1) * rect.width) / 2;
      const sy = ((-v.y + 1) * rect.height) / 2;

      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        seleccionados.push(idx);
      }
    });

    const ptosSel: string[] = [];
    puntosCad.forEach((pt) => {
      const v = new THREE.Vector3(pt.x, (pt.z || 0) + 0.1, pt.y);
      v.project(camera);
      const sx = ((v.x + 1) * rect.width) / 2;
      const sy = ((-v.y + 1) * rect.height) / 2;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        ptosSel.push(pt.id);
      }
    });

    if (seleccionados.length > 0 || ptosSel.length > 0) {
      setIndicesSeleccionados(seleccionados);
      setPuntosSeleccionados(ptosSel);
      setPanelSelVisible(true);
      mostrarAviso(`${seleccionados.length + ptosSel.length} entidades seleccionadas por recuadro`);
    }
  }

  function obtenerCoordenadasPlano(clientX: number, clientY: number): Punto2D | null {
    const contenedor = mountRef.current;
    const camera = cameraRef.current;
    if (!contenedor || !camera) return null;

    const rect = contenedor.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlane, target);

    if (hit) {
      let pt: Punto2D = { x: Math.round(target.x * 100) / 100, y: Math.round(target.z * 100) / 100 };
      if (griSnapMetrico || snapActivo) {
        const p = Math.max(0.01, parseFloat(griPaso) || 0.5);
        const pasoEfectivo = griSnapMediaCuadricula ? p / 2 : p;
        const oX = parseFloat(griOrigenX) || 0;
        const oY = parseFloat(griOrigenY) || 0;

        pt.x = Math.round((pt.x - oX) / pasoEfectivo) * pasoEfectivo + oX;
        pt.y = Math.round((pt.y - oY) / pasoEfectivo) * pasoEfectivo + oY;
        pt.x = Math.round(pt.x * 1000) / 1000;
        pt.y = Math.round(pt.y * 1000) / 1000;
      }
      return pt;
    }
    return null;
  }

  // Proyectar punto 3D a coordenadas 2D de la pantalla
  function proyectarAPantalla(pos3D: THREE.Vector3): { x: number; y: number; delante: boolean } | null {
    const contenedor = mountRef.current;
    const camera = cameraRef.current;
    if (!contenedor || !camera) return null;
    const rect = contenedor.getBoundingClientRect();
    const v = pos3D.clone().project(camera);
    const sx = ((v.x + 1) / 2) * rect.width + rect.left;
    const sy = ((-v.y + 1) / 2) * rect.height + rect.top;
    return { x: sx, y: sy, delante: v.z < 1 };
  }

  function verificarToquePuntoCad(clientX: number, clientY: number, tolPx = 22): string | null {
    let masCercanoId: string | null = null;
    let minDist = tolPx;
    puntosCad.forEach((pt) => {
      const scr = proyectarAPantalla(new THREE.Vector3(pt.x, (pt.z || 0) + 0.1, pt.y));
      if (scr && scr.delante) {
        const d = Math.hypot(clientX - scr.x, clientY - scr.y);
        if (d < minDist) {
          minDist = d;
          masCercanoId = pt.id;
        }
      }
    });
    return masCercanoId;
  }

  function verificarToqueVertice(clientX: number, clientY: number, tolPx = 22): number | null {
    let masCercano: number | null = null;
    let minDist = tolPx;
    poligonoCresta.forEach((v, idx) => {
      const scr = proyectarAPantalla(new THREE.Vector3(v.x, 0.1, v.y));
      if (scr && scr.delante) {
        const d = Math.hypot(clientX - scr.x, clientY - scr.y);
        if (d < minDist) {
          minDist = d;
          masCercano = idx;
        }
      }
    });
    return masCercano;
  }

  function verificarToquePuntoMedio(clientX: number, clientY: number, tolPx = 24): { x: number; y: number; z: number } | null {
    let masCercano: { x: number; y: number; z: number } | null = null;
    let minDist = tolPx;

    // 1. Líneas individuales
    lineasCad.forEach((l) => {
      const mx = (l.p1.x + l.p2.x) / 2;
      const my = (l.p1.y + l.p2.y) / 2;
      const mz = ((l.p1.z || 0) + (l.p2.z || 0)) / 2;
      const scr = proyectarAPantalla(new THREE.Vector3(mx, mz + 0.16, my));
      if (scr && scr.delante) {
        const d = Math.hypot(clientX - scr.x, clientY - scr.y);
        if (d < minDist) {
          minDist = d;
          masCercano = { x: Math.round(mx * 100) / 100, y: Math.round(my * 100) / 100, z: Math.round(mz * 100) / 100 };
        }
      }
    });

    // 2. Tramos de polilíneas
    polilineasCad.forEach((pl) => {
      const n = pl.puntos.length;
      const nSeg = pl.cerrada ? n : n - 1;
      for (let i = 0; i < nSeg; i++) {
        const p1 = pl.puntos[i];
        const p2 = pl.puntos[(i + 1) % n];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const mz = ((p1.z || 0) + (p2.z || 0)) / 2;
        const scr = proyectarAPantalla(new THREE.Vector3(mx, mz + 0.16, my));
        if (scr && scr.delante) {
          const d = Math.hypot(clientX - scr.x, clientY - scr.y);
          if (d < minDist) {
            minDist = d;
            masCercano = { x: Math.round(mx * 100) / 100, y: Math.round(my * 100) / 100, z: Math.round(mz * 100) / 100 };
          }
        }
      }
    });

    // 3. Puntos medios de aristas de sólidos 3D
    solidosCad.forEach((s) => {
      const capaObj = capas.find((c) => c.id === s.capaId);
      if (capaObj?.visible === false) return;
      const aristas = obtenerAristasDeSolido(s);
      aristas.forEach((ar) => {
        const mx = (ar.p1.x + ar.p2.x) / 2;
        const my = (ar.p1.y + ar.p2.y) / 2;
        const mz = (ar.p1.z + ar.p2.z) / 2;
        // CAD (x, y, z) -> Three.js (x, z, y)
        const scr = proyectarAPantalla(new THREE.Vector3(mx, mz + 0.16, my));
        if (scr && scr.delante) {
          const d = Math.hypot(clientX - scr.x, clientY - scr.y);
          if (d < minDist) {
            minDist = d;
            masCercano = { x: Math.round(mx * 100) / 100, y: Math.round(my * 100) / 100, z: Math.round(mz * 100) / 100 };
          }
        }
      });
    });

    return masCercano;
  }

  function distPuntoASegmento2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function verificarToqueAristaSolido(clientX: number, clientY: number, tolPx = 18): { arista: AristaSolidoCad; dist: number } | null {
    let mejorMatch: { arista: AristaSolidoCad; dist: number } | null = null;
    let minDist = tolPx;

    solidosCad.forEach((sol) => {
      const capaSol = capas.find((c) => c.id === sol.capaId);
      if (capaSol && !capaSol.visible) return;

      const aristas = obtenerAristasDeSolido(sol);
      aristas.forEach((ar) => {
        // CAD (x, y, z) -> Three.js (x, z, y)
        const s1 = proyectarAPantalla(new THREE.Vector3(ar.p1.x, ar.p1.z, ar.p1.y));
        const s2 = proyectarAPantalla(new THREE.Vector3(ar.p2.x, ar.p2.z, ar.p2.y));
        if (s1?.delante && s2?.delante) {
          const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
          if (d < minDist) {
            minDist = d;
            mejorMatch = { arista: ar, dist: d };
          }
        }
      });
    });

    return mejorMatch;
  }

  function verificarToqueVerticeSolido(clientX: number, clientY: number, tolPx = 22): { x: number; y: number; z: number } | null {
    let masCercano: { x: number; y: number; z: number } | null = null;
    let minDist = tolPx;

    solidosCad.forEach((sol) => {
      const capaSol = capas.find((c) => c.id === sol.capaId);
      if (capaSol && !capaSol.visible) return;

      const aristas = obtenerAristasDeSolido(sol);
      aristas.forEach((ar) => {
        [ar.p1, ar.p2].forEach((p) => {
          const scr = proyectarAPantalla(new THREE.Vector3(p.x, p.z + 0.1, p.y));
          if (scr && scr.delante) {
            const d = Math.hypot(clientX - scr.x, clientY - scr.y);
            if (d < minDist) {
              minDist = d;
              masCercano = { x: p.x, y: p.y, z: p.z };
            }
          }
        });
      });
    });

    return masCercano;
  }

  function hacerRaycastSeleccion(clientX: number, clientY: number) {
    // 1. Verificar si tocó una arista de un sólido 3D
    const matchArista = verificarToqueAristaSolido(clientX, clientY);
    if (matchArista) {
      setAristasSolidosSeleccionadas([matchArista.arista.id]);
      setPuntosSeleccionados([]);
      setIndicesSeleccionados([]);
      setLineasSeleccionadas([]);
      setPanelSolVisible(true);
      mostrarAviso(
        `Arista 3D ${matchArista.arista.tipo.toUpperCase()} (${matchArista.arista.longitud.toFixed(2)}m) seleccionada. ¡Lista para extraer a Línea CAD o medir!`
      );
      return;
    }

    const ptoCadId = verificarToquePuntoCad(clientX, clientY);
    if (ptoCadId !== null) {
      setPuntosSeleccionados([ptoCadId]);
      setIndicesSeleccionados([]);
      setLineasSeleccionadas([]);
      setAristasSolidosSeleccionadas([]);
      setPanelSelVisible(true);
      const ptObj = puntosCad.find((p) => p.id === ptoCadId);
      if (ptObj) {
        mostrarAviso(`Punto normal (${ptObj.x}, ${ptObj.y}, ${ptObj.z || 0}) seleccionado`);
      }
      return;
    }

    const idx = verificarToqueVertice(clientX, clientY);
    if (idx !== null) {
      setIndicesSeleccionados([idx]);
      setPuntosSeleccionados([]);
      setLineasSeleccionadas([]);
      setAristasSolidosSeleccionadas([]);
      setPuntoBaseIndice(idx);
      setPanelSelVisible(true);
      mostrarAviso(`Vértice ${idx + 1} seleccionado (Punto base: ${idx + 1})`);
      return;
    }

    // Verificar si tocó una línea CAD en pantalla
    let lineaMasCercanaId: string | null = null;
    let minLineDist = 20;
    lineasCad.forEach((l) => {
      const s1 = proyectarAPantalla(new THREE.Vector3(l.p1.x, (l.p1.z || 0) + 0.08, l.p1.y));
      const s2 = proyectarAPantalla(new THREE.Vector3(l.p2.x, (l.p2.z || 0) + 0.08, l.p2.y));
      if (s1?.delante && s2?.delante) {
        const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
        if (d < minLineDist) {
          minLineDist = d;
          lineaMasCercanaId = l.id;
        }
      }
    });

    if (lineaMasCercanaId) {
      setLineasSeleccionadas([lineaMasCercanaId]);
      setPuntosSeleccionados([]);
      setIndicesSeleccionados([]);
      setAristasSolidosSeleccionadas([]);
      setPanelSelVisible(true);
      const lObj = lineasCad.find((l) => l.id === lineaMasCercanaId);
      if (lObj) {
        mostrarAviso(`Línea (${lObj.longitud}m @ ${lObj.azimut}°) seleccionada`);
      }
      return;
    }

    setIndicesSeleccionados([]);
    setPuntosSeleccionados([]);
    setLineasSeleccionadas([]);
    setAristasSolidosSeleccionadas([]);
  }

  function raycastPunto(clientX: number, clientY: number) {
    let pt: { x: number; y: number; z?: number } | null = null;
    if (mostrarPuntoMedio) {
      const ptoMed = verificarToquePuntoMedio(clientX, clientY, 24);
      if (ptoMed) {
        pt = ptoMed;
        mostrarAviso(`▲ Punto CAD fijado en Punto Medio (${ptoMed.x}, ${ptoMed.y})`);
      }
    }
    if (!pt) {
      pt = obtenerCoordenadasPlano(clientX, clientY);
    }
    if (pt) {
      setPtoX(pt.x.toString());
      setPtoY(pt.y.toString());
      setPtoZ((pt.z || 0).toString());

      registrarHistorial();
      const nuevoPunto: PuntoCad3D = {
        id: `pto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        x: pt.x,
        y: pt.y,
        z: pt.z || 0,
        capaId: capaActivaId === "capa-cresta" ? "capa-puntos" : capaActivaId,
        tipo: tipoPunto,
      };

      const nuevosPuntos = [...puntosCad, nuevoPunto];
      setPuntosCad(nuevosPuntos);
      setPuntosSeleccionados([nuevoPunto.id]);
      setIndicesSeleccionados([]);
      setLineasSeleccionadas([]);

      // Actualizar contador en capa-puntos
      setCapas((prev) =>
        prev.map((c) =>
          c.id === "capa-puntos" ? { ...c, elementosCount: nuevosPuntos.length } : c
        )
      );

      mostrarAviso(`Punto normal (${pt.x}, ${pt.y}, ${pt.z || 0}) insertado`);

      const scene = sceneRef.current;
      const cross = scene?.getObjectByName("crosshair");
      if (cross) cross.position.set(pt.x, 0, pt.y);
    }
  }

  function raycastPlano(clientX: number, clientY: number) {
    const pt = obtenerCoordenadasPlano(clientX, clientY);
    if (pt) {
      registrarHistorial();
      const nuevos = [...poligonoCresta, pt];
      onCambiarPoligono(nuevos);
      setIndicesSeleccionados([nuevos.length - 1]);
      mostrarAviso(`Punto 3D (${pt.x}, ${pt.y})`);

      const scene = sceneRef.current;
      const cross = scene?.getObjectByName("crosshair");
      if (cross) cross.position.set(pt.x, 0, pt.y);
    }
  }

  // Interacción de Línea: 1er toque fija el INICIO, 2do toque fija el FINAL y crea la línea
  function handleInteractuarLinea(clientX: number, clientY: number) {
    // Buscar SNAP prioritario a vértice de polígono, punto CAD o Punto Medio
    let p3D: { x: number; y: number; z: number } | null = null;

    const vIdx = verificarToqueVertice(clientX, clientY, 22);
    if (vIdx !== null && poligonoCresta[vIdx]) {
      p3D = { x: poligonoCresta[vIdx].x, y: poligonoCresta[vIdx].y, z: 0 };
    }

    if (!p3D) {
      const ptoId = verificarToquePuntoCad(clientX, clientY, 22);
      if (ptoId) {
        const ptoObj = puntosCad.find((p) => p.id === ptoId);
        if (ptoObj) {
          p3D = { x: ptoObj.x, y: ptoObj.y, z: ptoObj.z || 0 };
        }
      }
    }

    if (!p3D) {
      const vSol = verificarToqueVerticeSolido(clientX, clientY, 22);
      if (vSol) {
        p3D = vSol;
        mostrarAviso(`▲ Snap: Vértice de Sólido 3D (${vSol.x}, ${vSol.y}, Z=${vSol.z})`);
      }
    }

    if (!p3D && mostrarPuntoMedio) {
      const ptoMed = verificarToquePuntoMedio(clientX, clientY, 24);
      if (ptoMed) {
        p3D = ptoMed;
        mostrarAviso(`▲ Snap: Punto Medio (${ptoMed.x}, ${ptoMed.y})`);
      }
    }

    if (!p3D) {
      const ptPlano = obtenerCoordenadasPlano(clientX, clientY);
      if (ptPlano) {
        p3D = { x: ptPlano.x, y: ptPlano.y, z: 0 };
      }
    }

    if (!p3D) return;

    // Si no había inicio fijado: fijar el INICIO
    if (!inicioLinea) {
      setInicioLinea(p3D);
      mostrarAviso(`📍 Inicio fijado en (${p3D.x}, ${p3D.y}). Ahora toca el punto FINAL.`);
      const scene = sceneRef.current;
      const cross = scene?.getObjectByName("crosshair");
      if (cross) cross.position.set(p3D.x, p3D.z, p3D.y);
      return;
    }

    // Si ya había inicio: fijar el FINAL y crear la entidad Línea
    const dx = p3D.x - inicioLinea.x;
    const dy = p3D.y - inicioLinea.y;
    const dz = (p3D.z || 0) - (inicioLinea.z || 0);
    const long = Math.hypot(dx, dy, dz);

    if (long < 0.05) {
      mostrarAviso("Punto final demasiado cercano al punto inicial");
      return;
    }

    const az = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    registrarHistorial();

    const capaDestino =
      capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta"
        ? "capa-lineas"
        : capaActivaId;

    const nuevaLinea: LineaCad3D = {
      id: `linea-${Date.now()}`,
      p1: { ...inicioLinea },
      p2: { ...p3D },
      capaId: capaDestino,
      tipo: tipoLinea,
      rol: rolIngenieria,
      longitud: Math.round(long * 100) / 100,
      azimut: Math.round(az * 10) / 10,
    };

    const nuevasLineas = [...lineasCad, nuevaLinea];
    setLineasCad(nuevasLineas);
    setDistanciaLinea((Math.round(long * 100) / 100).toString());
    setAzimutLinea((Math.round(az * 10) / 10).toString());

    setCapas((prev) =>
      prev.map((c) =>
        c.id === nuevaLinea.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c
      )
    );

    mostrarAviso(`✓ Línea creada: ${nuevaLinea.longitud}m @ ${nuevaLinea.azimut}°`);
    setInicioLinea(null);
    setCursorGuiaLinea(null);

    const scene = sceneRef.current;
    const cross = scene?.getObjectByName("crosshair");
    if (cross) cross.position.set(p3D.x, p3D.z, p3D.y);
  }

  // Dibujar línea exacta por Distancia + Azimut desde el inicio fijado o punto base
  function handleDibujarLineaPorAzimut() {
    const dist = parseFloat(distanciaLinea);
    const azim = parseFloat(azimutLinea);
    if (isNaN(dist) || dist <= 0 || isNaN(azim)) {
      mostrarAviso("Ingresa una distancia y azimut válidos");
      return;
    }

    const pBase = inicioLinea || (puntosCad.length > 0 ? puntosCad[puntosCad.length - 1] : { x: 0, y: 0, z: 0 });
    const rad = (azim * Math.PI) / 180;
    const destX = Math.round((pBase.x + dist * Math.sin(rad)) * 100) / 100;
    const destY = Math.round((pBase.y + dist * Math.cos(rad)) * 100) / 100;
    const destZ = pBase.z || 0;

    registrarHistorial();

    const capaDestino =
      capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta"
        ? "capa-lineas"
        : capaActivaId;

    const nuevaLinea: LineaCad3D = {
      id: `linea-${Date.now()}`,
      p1: { x: pBase.x, y: pBase.y, z: destZ },
      p2: { x: destX, y: destY, z: destZ },
      capaId: capaDestino,
      tipo: tipoLinea,
      rol: rolIngenieria,
      longitud: dist,
      azimut: azim,
    };

    const nuevasLineas = [...lineasCad, nuevaLinea];
    setLineasCad(nuevasLineas);
    setInicioLinea(null);
    setCursorGuiaLinea(null);

    setCapas((prev) =>
      prev.map((c) =>
        c.id === nuevaLinea.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c
      )
    );

    mostrarAviso(`✓ Línea de ${dist}m @ ${azim}° creada`);
  }

  // Interacción de Polilínea: Cada toque añade un vértice sucesivo
  function handleInteractuarPolilinea(clientX: number, clientY: number) {
    // Si ya tenemos al menos 2 vértices y el usuario toca cerca del 1er vértice: CERRAR Y FINALIZAR
    if (verticesPolilinea.length >= 2) {
      const primero = verticesPolilinea[0];
      const s1 = proyectarAPantalla(new THREE.Vector3(primero.x, (primero.z || 0) + 0.1, primero.y));
      if (s1?.delante && Math.hypot(clientX - s1.x, clientY - s1.y) < 24) {
        setCerrarPolilinea(true);
        ejecutarFinalizarPolilinea(true);
        return;
      }
    }

    // Buscar SNAP prioritario a vértice de polígono, punto CAD o extremo
    let p3D: { x: number; y: number; z: number } | null = null;

    const vIdx = verificarToqueVertice(clientX, clientY, 22);
    if (vIdx !== null && poligonoCresta[vIdx]) {
      p3D = { x: poligonoCresta[vIdx].x, y: poligonoCresta[vIdx].y, z: 0 };
    }

    if (!p3D) {
      const ptoId = verificarToquePuntoCad(clientX, clientY, 22);
      if (ptoId) {
        const ptoObj = puntosCad.find((p) => p.id === ptoId);
        if (ptoObj) {
          p3D = { x: ptoObj.x, y: ptoObj.y, z: ptoObj.z || 0 };
        }
      }
    }

    if (!p3D) {
      const vSol = verificarToqueVerticeSolido(clientX, clientY, 22);
      if (vSol) {
        p3D = vSol;
        mostrarAviso(`▲ Snap: Vértice de Sólido 3D (${vSol.x}, ${vSol.y}, Z=${vSol.z})`);
      }
    }

    if (!p3D && mostrarPuntoMedio) {
      const ptoMed = verificarToquePuntoMedio(clientX, clientY, 24);
      if (ptoMed) {
        p3D = ptoMed;
        mostrarAviso(`▲ Snap: Punto Medio (${ptoMed.x}, ${ptoMed.y})`);
      }
    }

    if (!p3D) {
      const ptPlano = obtenerCoordenadasPlano(clientX, clientY);
      if (ptPlano) {
        p3D = { x: ptPlano.x, y: ptPlano.y, z: 0 };
      }
    }

    if (!p3D) return;

    // Evitar duplicar el mismo punto si es idéntico al último vértice
    if (verticesPolilinea.length > 0) {
      const ultimo = verticesPolilinea[verticesPolilinea.length - 1];
      if (Math.hypot(p3D.x - ultimo.x, p3D.y - ultimo.y, (p3D.z || 0) - (ultimo.z || 0)) < 0.05) {
        return;
      }
    }

    const nuevosVertices = [...verticesPolilinea, p3D];
    setVerticesPolilinea(nuevosVertices);
    mostrarAviso(`📍 Vértice ${nuevosVertices.length} fijado en (${p3D.x}, ${p3D.y})`);

    const scene = sceneRef.current;
    const cross = scene?.getObjectByName("crosshair");
    if (cross) cross.position.set(p3D.x, p3D.z, p3D.y);
  }

  function handleDeshacerUltimoVerticePl() {
    if (verticesPolilinea.length === 0) return;
    const rest = verticesPolilinea.slice(0, -1);
    setVerticesPolilinea(rest);
    if (rest.length === 0) setCursorGuiaPl(null);
    mostrarAviso("Último vértice removido");
  }

  function handleCancelarPolilinea() {
    setVerticesPolilinea([]);
    setCursorGuiaPl(null);
    mostrarAviso("Trazado de polilínea cancelado");
  }

  function ejecutarFinalizarPolilinea(forzarCerrar?: boolean) {
    const estaCerrada = forzarCerrar !== undefined ? forzarCerrar : cerrarPolilinea;
    if (verticesPolilinea.length < 2) {
      mostrarAviso("Se requieren al menos 2 vértices");
      return;
    }

    // Calcular longitud total
    let longTotal = 0;
    for (let i = 0; i < verticesPolilinea.length - 1; i++) {
      const pA = verticesPolilinea[i];
      const pB = verticesPolilinea[i + 1];
      longTotal += Math.hypot(pB.x - pA.x, pB.y - pA.y, (pB.z || 0) - (pA.z || 0));
    }
    if (estaCerrada && verticesPolilinea.length > 2) {
      const pFirst = verticesPolilinea[0];
      const pLast = verticesPolilinea[verticesPolilinea.length - 1];
      longTotal += Math.hypot(pFirst.x - pLast.x, pFirst.y - pLast.y, (pFirst.z || 0) - (pLast.z || 0));
    }

    registrarHistorial();

    const capaDestino =
      capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta"
        ? "capa-lineas"
        : capaActivaId;

    const nuevaPl: PolilineaCad3D = {
      id: `pl-${Date.now()}`,
      puntos: [...verticesPolilinea],
      cerrada: estaCerrada,
      capaId: capaDestino,
      tipo: tipoLinea,
      rol: rolIngenieria,
      longitud: Math.round(longTotal * 100) / 100,
    };

    const nuevas = [...polilineasCad, nuevaPl];
    setPolilineasCad(nuevas);
    setVerticesPolilinea([]);
    setCursorGuiaPl(null);

    setCapas((prev) =>
      prev.map((c) =>
        c.id === nuevaPl.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c
      )
    );

    mostrarAviso(`✓ Polilínea ${estaCerrada ? "cerrada" : "abierta"} creada (${nuevaPl.longitud}m)`);
  }

  function handleFinalizarPolilinea() {
    ejecutarFinalizarPolilinea();
  }

  // Interacción de Arco CAD
  function handleInteractuarArco(clientX: number, clientY: number) {
    let p3D: { x: number; y: number; z: number } | null = null;

    const vIdx = verificarToqueVertice(clientX, clientY, 22);
    if (vIdx !== null && poligonoCresta[vIdx]) {
      p3D = { x: poligonoCresta[vIdx].x, y: poligonoCresta[vIdx].y, z: 0 };
    }

    if (!p3D) {
      const ptoId = verificarToquePuntoCad(clientX, clientY, 22);
      if (ptoId) {
        const ptoObj = puntosCad.find((p) => p.id === ptoId);
        if (ptoObj) {
          p3D = { x: ptoObj.x, y: ptoObj.y, z: ptoObj.z || 0 };
        }
      }
    }

    if (!p3D && mostrarPuntoMedio) {
      const ptoMed = verificarToquePuntoMedio(clientX, clientY, 24);
      if (ptoMed) {
        p3D = ptoMed;
        mostrarAviso(`▲ Snap: Punto Medio (${ptoMed.x}, ${ptoMed.y})`);
      }
    }

    if (!p3D) {
      const ptPlano = obtenerCoordenadasPlano(clientX, clientY);
      if (ptPlano) {
        p3D = { x: ptPlano.x, y: ptPlano.y, z: 0 };
      }
    }

    if (!p3D) return;

    const rInput = parseFloat(radioArco) || 10;
    const capaDestino =
      capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta"
        ? "capa-lineas"
        : capaActivaId;

    // MÉTODO 1: Inicio / Fin + Radio
    if (metodoArco === "inicio_fin_r") {
      if (puntosArcoConstruccion.length === 0) {
        setPuntosArcoConstruccion([p3D]);
        mostrarAviso(`📍 Inicio de arco en (${p3D.x}, ${p3D.y}). Ahora toca el punto FINAL.`);
      } else {
        const pInicio = puntosArcoConstruccion[0];
        const dist = Math.hypot(p3D.x - pInicio.x, p3D.y - pInicio.y);
        if (dist < 0.1) {
          mostrarAviso("Punto final demasiado cercano al punto inicial");
          return;
        }

        const pts = generarPuntosArco(pInicio, p3D, rInput, centroIzquierdaArco);
        let longTotal = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          longTotal += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        }

        registrarHistorial();
        const nuevoArco: ArcoCad3D = {
          id: `arc-${Date.now()}`,
          metodo: "inicio_fin_r",
          centro: { x: (pInicio.x + p3D.x) / 2, y: (pInicio.y + p3D.y) / 2, z: pInicio.z || 0 },
          radio: Math.max(dist / 2, rInput),
          anguloInicio: 0,
          anguloFin: 0,
          puntos: pts,
          capaId: capaDestino,
          tipo: tipoLinea,
          rol: rolIngenieria,
          longitud: Math.round(longTotal * 100) / 100,
        };

        setArcosCad((prev) => [...prev, nuevoArco]);
        setPuntosArcoConstruccion([]);
        setCursorGuiaArc(null);
        setCapas((prev) =>
          prev.map((c) => (c.id === nuevoArco.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c))
        );
        mostrarAviso(`✓ Arco creado: R=${nuevoArco.radio}m (${nuevoArco.longitud}m)`);
      }
      return;
    }

    // MÉTODO 2: Centro + Radio
    if (metodoArco === "centro_r") {
      if (puntosArcoConstruccion.length === 0) {
        setPuntosArcoConstruccion([p3D]);
        mostrarAviso(`📍 Centro fijado en (${p3D.x}, ${p3D.y}). Radio: ${rInput}m. Toca la dirección de INICIO.`);
      } else if (puntosArcoConstruccion.length === 1) {
        setPuntosArcoConstruccion([puntosArcoConstruccion[0], p3D]);
        const aStart = Math.atan2(p3D.y - puntosArcoConstruccion[0].y, p3D.x - puntosArcoConstruccion[0].x);
        setAnguloInicioArco(((aStart * 180 / Math.PI + 360) % 360).toFixed(1));
        mostrarAviso(`📍 Dirección de inicio fijada. Radio: ${rInput}m. Toca la dirección FINAL.`);
      } else {
        const c = puntosArcoConstruccion[0];
        const p1 = puntosArcoConstruccion[1];
        const p2 = p3D;
        const r = rInput; // Exacto según el Radio numérico ingresado por el usuario
        let ang1 = Math.atan2(p1.y - c.y, p1.x - c.x);
        let ang2 = Math.atan2(p2.y - c.y, p2.x - c.x);

        if (centroIzquierdaArco) {
          while (ang2 <= ang1) ang2 += Math.PI * 2;
        } else {
          while (ang2 >= ang1) ang2 -= Math.PI * 2;
        }

        const steps = 32;
        const pts: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const a = ang1 + t * (ang2 - ang1);
          pts.push({
            x: Math.round((c.x + r * Math.cos(a)) * 100) / 100,
            y: Math.round((c.y + r * Math.sin(a)) * 100) / 100,
            z: c.z || 0,
          });
        }

        let longTotal = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          longTotal += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        }

        registrarHistorial();
        const nuevoArco: ArcoCad3D = {
          id: `arc-${Date.now()}`,
          metodo: "centro_r",
          centro: c,
          radio: r,
          anguloInicio: ang1,
          anguloFin: ang2,
          puntos: pts,
          capaId: capaDestino,
          tipo: tipoLinea,
          rol: rolIngenieria,
          longitud: Math.round(longTotal * 100) / 100,
        };

        setArcosCad((prev) => [...prev, nuevoArco]);
        setPuntosArcoConstruccion([]);
        setCursorGuiaArc(null);
        setCapas((prev) =>
          prev.map((c) => (c.id === nuevoArco.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c))
        );
        mostrarAviso(`✓ Arco creado con Radio exacto de ${r}m (${nuevoArco.longitud}m)`);
      }
      return;
    }

    // MÉTODO 3: 3 Puntos
    if (metodoArco === "tres_puntos") {
      if (puntosArcoConstruccion.length === 0) {
        setPuntosArcoConstruccion([p3D]);
        mostrarAviso(`📍 Punto 1 fijado en (${p3D.x}, ${p3D.y}). Toca Punto 2.`);
      } else if (puntosArcoConstruccion.length === 1) {
        setPuntosArcoConstruccion([puntosArcoConstruccion[0], p3D]);
        mostrarAviso(`📍 Punto 2 fijado en (${p3D.x}, ${p3D.y}). Ahora toca Punto 3.`);
      } else {
        const p1 = puntosArcoConstruccion[0];
        const p2 = puntosArcoConstruccion[1];
        const p3 = p3D;
        const pts = generarPuntosArco3P(p1, p2, p3);

        let longTotal = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          longTotal += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        }

        registrarHistorial();
        const nuevoArco: ArcoCad3D = {
          id: `arc-${Date.now()}`,
          metodo: "tres_puntos",
          centro: { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2, z: p1.z || 0 },
          radio: Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 100) / 100,
          anguloInicio: 0,
          anguloFin: 0,
          puntos: pts,
          capaId: capaDestino,
          tipo: tipoLinea,
          rol: rolIngenieria,
          longitud: Math.round(longTotal * 100) / 100,
        };

        setArcosCad((prev) => [...prev, nuevoArco]);
        setPuntosArcoConstruccion([]);
        setCursorGuiaArc(null);
        setCapas((prev) =>
          prev.map((c) => (c.id === nuevoArco.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c))
        );
        mostrarAviso(`✓ Arco por 3 puntos creado (${nuevoArco.longitud}m)`);
      }
    }
  }

  function handleDeshacerPuntoArco() {
    if (puntosArcoConstruccion.length === 0) return;
    const rest = puntosArcoConstruccion.slice(0, -1);
    setPuntosArcoConstruccion(rest);
    if (rest.length === 0) setCursorGuiaArc(null);
    mostrarAviso("Punto de arco deshecho");
  }

  function handleCancelarArco() {
    setPuntosArcoConstruccion([]);
    setCursorGuiaArc(null);
    mostrarAviso("Trazado de arco cancelado");
  }

  // Dibujar arco exacto por parámetros (Centro + Radio + Ángulos)
  function handleDibujarArcoManual() {
    const rInput = parseFloat(radioArco);
    if (isNaN(rInput) || rInput <= 0) {
      mostrarAviso("Ingresa un radio válido");
      return;
    }

    const c =
      puntosArcoConstruccion.length > 0
        ? puntosArcoConstruccion[0]
        : puntosCad.length > 0
        ? puntosCad[puntosCad.length - 1]
        : { x: 0, y: 0, z: 0 };

    let a1 = ((parseFloat(anguloInicioArco) || 0) * Math.PI) / 180;
    let a2 = ((parseFloat(anguloFinArco) || 180) * Math.PI) / 180;

    if (centroIzquierdaArco) {
      while (a2 <= a1) a2 += Math.PI * 2;
    } else {
      while (a2 >= a1) a2 -= Math.PI * 2;
    }

    const steps = 32;
    const pts: { x: number; y: number; z: number }[] = [];
    const z = c.z || 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a1 + t * (a2 - a1);
      pts.push({
        x: Math.round((c.x + rInput * Math.cos(a)) * 100) / 100,
        y: Math.round((c.y + rInput * Math.sin(a)) * 100) / 100,
        z,
      });
    }

    let longTotal = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      longTotal += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }

    registrarHistorial();
    const capaDestino =
      capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta"
        ? "capa-lineas"
        : capaActivaId;

    const nuevoArco: ArcoCad3D = {
      id: `arc-${Date.now()}`,
      metodo: "centro_r",
      centro: c,
      radio: rInput,
      anguloInicio: a1,
      anguloFin: a2,
      puntos: pts,
      capaId: capaDestino,
      tipo: tipoLinea,
      rol: rolIngenieria,
      longitud: Math.round(longTotal * 100) / 100,
    };

    setArcosCad((prev) => [...prev, nuevoArco]);
    setPuntosArcoConstruccion([]);
    setCursorGuiaArc(null);
    setCapas((prev) =>
      prev.map((c) => (c.id === nuevoArco.capaId ? { ...c, elementosCount: c.elementosCount + 1 } : c))
    );
    mostrarAviso(`✓ Arco Centro+R creado: Centro (${c.x}, ${c.y}), Radio ${rInput}m`);
  }

  // =========================================================================
  // FUNCIONES DE SOPORTE: HERRAMIENTA RECORTAR (TRIM)
  // =========================================================================

  function detectarEntidadBajoCursor(clientX: number, clientY: number): EntidadRecortable | null {
    let mejorCandidato: EntidadRecortable | null = null;
    let minDistPx = 28;

    // 1. Líneas CAD
    lineasCad.forEach((l) => {
      const s1 = proyectarAPantalla(new THREE.Vector3(l.p1.x, (l.p1.z || 0) + 0.08, l.p1.y));
      const s2 = proyectarAPantalla(new THREE.Vector3(l.p2.x, (l.p2.z || 0) + 0.08, l.p2.y));
      if (s1?.delante && s2?.delante) {
        const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
        if (d < minDistPx) {
          minDistPx = d;
          mejorCandidato = { tipo: "linea", id: l.id, nombre: `Línea (${l.longitud}m)` };
        }
      }
    });

    // 2. Polilíneas CAD
    polilineasCad.forEach((pl) => {
      const n = pl.puntos.length;
      const nSeg = pl.cerrada ? n : n - 1;
      for (let i = 0; i < nSeg; i++) {
        const pA = pl.puntos[i];
        const pB = pl.puntos[(i + 1) % n];
        const s1 = proyectarAPantalla(new THREE.Vector3(pA.x, (pA.z || 0) + 0.08, pA.y));
        const s2 = proyectarAPantalla(new THREE.Vector3(pB.x, (pB.z || 0) + 0.08, pB.y));
        if (s1?.delante && s2?.delante) {
          const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
          if (d < minDistPx) {
            minDistPx = d;
            mejorCandidato = {
              tipo: "polilinea",
              id: pl.id,
              nombre: `Polilínea ${pl.cerrada ? "cerrada" : "abierta"} (${pl.longitud}m)`,
            };
          }
        }
      }
    });

    // 3. Arcos CAD
    arcosCad.forEach((arc) => {
      for (let i = 0; i < arc.puntos.length - 1; i++) {
        const pA = arc.puntos[i];
        const pB = arc.puntos[i + 1];
        const s1 = proyectarAPantalla(new THREE.Vector3(pA.x, (pA.z || 0) + 0.08, pA.y));
        const s2 = proyectarAPantalla(new THREE.Vector3(pB.x, (pB.z || 0) + 0.08, pB.y));
        if (s1?.delante && s2?.delante) {
          const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
          if (d < minDistPx) {
            minDistPx = d;
            mejorCandidato = { tipo: "arco", id: arc.id, nombre: `Arco R=${arc.radio}m` };
          }
        }
      }
    });

    // 4. Perfil de Cresta
    if (poligonoCresta.length >= 2) {
      for (let i = 0; i < poligonoCresta.length; i++) {
        const pA = poligonoCresta[i];
        const pB = poligonoCresta[(i + 1) % poligonoCresta.length];
        const s1 = proyectarAPantalla(new THREE.Vector3(pA.x, 0.08, pA.y));
        const s2 = proyectarAPantalla(new THREE.Vector3(pB.x, 0.08, pB.y));
        if (s1?.delante && s2?.delante) {
          const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
          if (d < minDistPx) {
            minDistPx = d;
            mejorCandidato = { tipo: "perfil", nombre: "Perfil Cresta" };
          }
        }
      }
    }

    return mejorCandidato;
  }

  function handleInteractuarRecorte(clientX: number, clientY: number) {
    // Si ya existe una previsualización activa con cortes, comprobar si el usuario tocó
    // directamente el tramo ROJO o VERDE para alternar cuál se conserva
    if (recParticion) {
      let minDistVerde = 30;
      let tocoVerde = false;
      recParticion.tramosQueda.forEach((tramo) => {
        for (let i = 0; i < tramo.length - 1; i++) {
          const s1 = proyectarAPantalla(new THREE.Vector3(tramo[i].x, (tramo[i].z || 0) + 0.14, tramo[i].y));
          const s2 = proyectarAPantalla(new THREE.Vector3(tramo[i + 1].x, (tramo[i + 1].z || 0) + 0.14, tramo[i + 1].y));
          if (s1?.delante && s2?.delante) {
            const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
            if (d < minDistVerde) {
              minDistVerde = d;
              tocoVerde = true;
            }
          }
        }
      });

      let minDistRojo = 30;
      let tocoRojo = false;
      recParticion.tramosElimina.forEach((tramo) => {
        for (let i = 0; i < tramo.length - 1; i++) {
          const s1 = proyectarAPantalla(new THREE.Vector3(tramo[i].x, (tramo[i].z || 0) + 0.14, tramo[i].y));
          const s2 = proyectarAPantalla(new THREE.Vector3(tramo[i + 1].x, (tramo[i + 1].z || 0) + 0.14, tramo[i + 1].y));
          if (s1?.delante && s2?.delante) {
            const d = distPuntoASegmento2D(clientX, clientY, s1.x, s1.y, s2.x, s2.y);
            if (d < minDistRojo) {
              minDistRojo = d;
              tocoRojo = true;
            }
          }
        }
      });

      if (tocoRojo && minDistRojo <= minDistVerde) {
        setRecConservarInicio((prev) => !prev);
        mostrarAviso("✓ Tramo tocado fijado como CONSERVAR (VERDE)");
        return;
      } else if (tocoVerde && minDistVerde < 30) {
        setRecConservarInicio((prev) => !prev);
        mostrarAviso("✓ Tramo alternado");
        return;
      }
    }

    const ent = detectarEntidadBajoCursor(clientX, clientY);
    if (!ent) return;

    if (!recObjeto) {
      setRecObjeto(ent);
      mostrarAviso(`Objeto (${ent.nombre}) seleccionado. Ahora toca la CORTANTE.`);
    } else if (!recCortante) {
      if (ent.tipo === recObjeto.tipo && ent.id === recObjeto.id) {
        mostrarAviso("La cortante debe ser una entidad distinta al objeto a recortar.");
        return;
      }
      setRecCortante(ent);
      mostrarAviso(`Cortante (${ent.nombre}) fijada. Revisa la vista previa y confirma.`);
    } else {
      if (ent.tipo === recObjeto.tipo && ent.id === recObjeto.id) {
        mostrarAviso("La cortante debe ser distinta al objeto a recortar.");
        return;
      }
      setRecCortante(ent);
      mostrarAviso(`Nueva cortante (${ent.nombre}) seleccionada.`);
    }
  }

  function handleConfirmarRecorte() {
    if (!recObjeto || !recParticion || recParticion.tramosQueda.length === 0) {
      mostrarAviso("No hay corte válido para confirmar.");
      return;
    }

    registrarHistorial();
    const tramoConservado = recParticion.tramosQueda[0];

    if (recObjeto.tipo === "linea") {
      if (tramoConservado.length >= 2) {
        const p1 = tramoConservado[0];
        const p2 = tramoConservado[tramoConservado.length - 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const long = Math.hypot(dx, dy);
        const az = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

        setLineasCad((prev) =>
          prev.map((l) =>
            l.id === recObjeto.id
              ? {
                  ...l,
                  p1: { x: p1.x, y: p1.y, z: p1.z || 0 },
                  p2: { x: p2.x, y: p2.y, z: p2.z || 0 },
                  longitud: Math.round(long * 100) / 100,
                  azimut: Math.round(az * 10) / 10,
                }
              : l
          )
        );
      }
    } else if (recObjeto.tipo === "polilinea") {
      if (tramoConservado.length >= 2) {
        let long = 0;
        for (let i = 0; i < tramoConservado.length - 1; i++) {
          long += Math.hypot(
            tramoConservado[i + 1].x - tramoConservado[i].x,
            tramoConservado[i + 1].y - tramoConservado[i].y
          );
        }
        setPolilineasCad((prev) =>
          prev.map((pl) =>
            pl.id === recObjeto.id
              ? {
                  ...pl,
                  puntos: tramoConservado.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })),
                  cerrada: false,
                  longitud: Math.round(long * 100) / 100,
                }
              : pl
          )
        );
      }
    } else if (recObjeto.tipo === "arco") {
      if (tramoConservado.length >= 2) {
        let long = 0;
        for (let i = 0; i < tramoConservado.length - 1; i++) {
          long += Math.hypot(
            tramoConservado[i + 1].x - tramoConservado[i].x,
            tramoConservado[i + 1].y - tramoConservado[i].y
          );
        }
        setArcosCad((prev) =>
          prev.map((a) =>
            a.id === recObjeto.id
              ? {
                  ...a,
                  puntos: tramoConservado.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })),
                  longitud: Math.round(long * 100) / 100,
                }
              : a
          )
        );
      }
    } else if (recObjeto.tipo === "perfil") {
      if (tramoConservado.length >= 3) {
        onCambiarPoligono(tramoConservado.map((p) => ({ x: p.x, y: p.y })));
      }
    }

    mostrarAviso("Recorte confirmado con éxito.");
    setRecObjeto(null);
    setRecCortante(null);
  }

  // =========================================================================
  // FUNCIONES DE SOPORTE: HERRAMIENTA UNIR / SEPARAR (UNI)
  // =========================================================================

  function handleInteractuarUni(clientX: number, clientY: number) {
    const ent = detectarEntidadBajoCursor(clientX, clientY);
    if (!ent || ent.tipo === "perfil" || !ent.id) return;

    const ref: RefEntidadUni = { tipo: ent.tipo, id: ent.id };
    setUniSeleccionadas((prev) => {
      const existe = prev.some((s) => s.id === ref.id);
      if (existe) {
        mostrarAviso(`Deseleccionado: ${ent.nombre}`);
        return prev.filter((s) => s.id !== ref.id);
      } else {
        mostrarAviso(`Seleccionado: ${ent.nombre}`);
        return [...prev, ref];
      }
    });
  }

  function handleUnirEnPolilinea() {
    if (uniSeleccionadas.length < 2) {
      mostrarAviso("Selecciona al menos 2 entidades (líneas, arcos o polilíneas) para unir.");
      return;
    }

    const ctx = {
      lineas: lineasCad,
      polilineas: polilineasCad,
      arcos: arcosCad,
      capaActivaId,
    };

    const res = unirEntidadesEnPolilinea(uniSeleccionadas, ctx, forzarPolilineaCerrada);
    if (!res) {
      mostrarAviso("No fue posible unir las entidades seleccionadas. Asegúrate de que sus extremos se conecten.");
      return;
    }

    registrarHistorial();

    // Eliminar las entidades consumidas y agregar la nueva polilínea
    setLineasCad((prev) => prev.filter((l) => !res.lineasConsumidas.includes(l.id)));
    setPolilineasCad((prev) => [
      ...prev.filter((pl) => !res.polilineasConsumidas.includes(pl.id)),
      res.nuevaPolilinea,
    ]);
    setArcosCad((prev) => prev.filter((a) => !res.arcosConsumidos.includes(a.id)));

    setUniSeleccionadas([]);
    mostrarAviso(`✓ Polilínea unida creada (${res.nuevaPolilinea.longitud}m, ${res.nuevaPolilinea.cerrada ? "cerrada" : "abierta"}).`);
  }

  function handleSepararPolilinea() {
    const polilineasIds = uniSeleccionadas.filter((s) => s.tipo === "polilinea").map((s) => s.id);
    if (polilineasIds.length === 0) {
      mostrarAviso("Selecciona al menos una polilínea para separar en líneas.");
      return;
    }

    registrarHistorial();
    const res = separarPolilineaEnLineas(polilineasCad, polilineasIds);

    setPolilineasCad((prev) => prev.filter((pl) => !res.polilineasEliminadas.includes(pl.id)));
    setLineasCad((prev) => [...prev, ...res.nuevasLineas]);

    setUniSeleccionadas([]);
    mostrarAviso(`✓ Polilínea separada en ${res.nuevasLineas.length} líneas independientes.`);
  }

  function handleCrearPuntoCentro() {
    if (uniSeleccionadas.length === 0) {
      mostrarAviso("Selecciona al menos una entidad para calcular su centro.");
      return;
    }

    const ctx = {
      lineas: lineasCad,
      polilineas: polilineasCad,
      arcos: arcosCad,
      capaActivaId,
    };

    const centroide = calcularCentroideEntidades(uniSeleccionadas, ctx);
    if (!centroide) {
      mostrarAviso("No fue posible calcular el centro de las entidades seleccionadas.");
      return;
    }

    registrarHistorial();
    const nuevoPto: PuntoCad3D = {
      id: `pto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: centroide.x,
      y: centroide.y,
      z: centroide.z,
      capaId: capaActivaId === "capa-cresta" ? "capa-puntos" : capaActivaId,
      tipo: "cruz_mas",
    };

    setPuntosCad((prev) => [...prev, nuevoPto]);
    mostrarAviso(`✓ Punto creado: (${centroide.x}, ${centroide.y}, ${centroide.z}) · ${centroide.descripcion}`);
  }

  // =========================================================================
  // FUNCIONES DE SOPORTE: HERRAMIENTA DIVIDIR (DIV)
  // =========================================================================

  function calcularPuntosDivision(
    ent: EntidadRecortable,
    partes: number
  ): { x: number; y: number; z: number }[] {
    const N = Math.max(2, Math.min(100, Math.round(partes)));
    const ptsResultado: { x: number; y: number; z: number }[] = [];

    if (ent.tipo === "linea") {
      const l = lineasCad.find((item) => item.id === ent.id);
      if (l) {
        for (let k = 1; k < N; k++) {
          const t = k / N;
          ptsResultado.push({
            x: Math.round((l.p1.x + t * (l.p2.x - l.p1.x)) * 100) / 100,
            y: Math.round((l.p1.y + t * (l.p2.y - l.p1.y)) * 100) / 100,
            z: Math.round(((l.p1.z || 0) + t * ((l.p2.z || 0) - (l.p1.z || 0))) * 100) / 100,
          });
        }
      }
    } else if (ent.tipo === "arco") {
      const a = arcosCad.find((item) => item.id === ent.id);
      if (a) {
        let aIni = a.anguloInicio;
        let aFin = a.anguloFin;
        if (aFin < aIni) aFin += Math.PI * 2;
        for (let k = 1; k < N; k++) {
          const t = k / N;
          const ang = aIni + t * (aFin - aIni);
          ptsResultado.push({
            x: Math.round((a.centro.x + a.radio * Math.cos(ang)) * 100) / 100,
            y: Math.round((a.centro.y + a.radio * Math.sin(ang)) * 100) / 100,
            z: Math.round((a.centro.z || 0) * 100) / 100,
          });
        }
      }
    } else if (ent.tipo === "polilinea") {
      const pl = polilineasCad.find((item) => item.id === ent.id);
      if (pl && pl.puntos.length >= 2) {
        const segLens: number[] = [];
        let totalL = 0;
        const nSeg = pl.cerrada ? pl.puntos.length : pl.puntos.length - 1;
        for (let i = 0; i < nSeg; i++) {
          const p1 = pl.puntos[i];
          const p2 = pl.puntos[(i + 1) % pl.puntos.length];
          const l = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          segLens.push(l);
          totalL += l;
        }

        for (let k = 1; k < N; k++) {
          const targetDist = (k / N) * totalL;
          let acc = 0;
          for (let i = 0; i < nSeg; i++) {
            const segL = segLens[i];
            if (acc + segL >= targetDist || i === nSeg - 1) {
              const localT = segL > 0 ? (targetDist - acc) / segL : 0;
              const p1 = pl.puntos[i];
              const p2 = pl.puntos[(i + 1) % pl.puntos.length];
              ptsResultado.push({
                x: Math.round((p1.x + localT * (p2.x - p1.x)) * 100) / 100,
                y: Math.round((p1.y + localT * (p2.y - p1.y)) * 100) / 100,
                z: Math.round(((p1.z || 0) + localT * ((p2.z || 0) - (p1.z || 0))) * 100) / 100,
              });
              break;
            }
            acc += segL;
          }
        }
      }
    }

    return ptsResultado;
  }

  function handleInteractuarDividir(clientX: number, clientY: number) {
    const ent = detectarEntidadBajoCursor(clientX, clientY);
    if (!ent || ent.tipo === "perfil" || !ent.id) return;

    setDivEntidad(ent);
    mostrarAviso(`Entidad seleccionada: ${ent.nombre}. Ajusta partes y pulsa DIVIDIR.`);
  }

  function handleEjecutarDividir() {
    if (!divEntidad) {
      mostrarAviso("Selecciona primero una línea, polilínea o arco para dividir.");
      return;
    }

    const nPartes = parseInt(divPartes, 10);
    if (isNaN(nPartes) || nPartes < 2) {
      mostrarAviso("El número de partes debe ser al menos 2.");
      return;
    }

    const puntosGenerados = calcularPuntosDivision(divEntidad, nPartes);
    if (puntosGenerados.length === 0) {
      mostrarAviso("No fue posible generar las divisiones de la entidad.");
      return;
    }

    registrarHistorial();

    const nuevosPuntos: PuntoCad3D[] = puntosGenerados.map((pt, idx) => ({
      id: `pto-div-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      capaId: capaActivaId === "capa-cresta" ? "capa-puntos" : capaActivaId,
      tipo: "cruz_mas",
    }));

    setPuntosCad((prev) => [...prev, ...nuevosPuntos]);
    mostrarAviso(`✓ Se crearon ${nuevosPuntos.length} puntos SNAP equidistantes sobre ${divEntidad.nombre}`);
    setDivEntidad(null);
  }

  // =========================================================================
  // FUNCIONES DE SOPORTE: HERRAMIENTA DESFASE (OFF)
  // =========================================================================

  function calcularDesfaseEntidad(
    ent: EntidadRecortable,
    modo: ModoDesfase,
    distancia: number
  ): ResultadoDesfase | null {
    if (ent.tipo === "linea") {
      const l = lineasCad.find((item) => item.id === ent.id);
      if (!l) return null;
      return desfasarLinea(l.p1, l.p2, distancia, modo);
    }
    if (ent.tipo === "arco") {
      const a = arcosCad.find((item) => item.id === ent.id);
      if (!a) return null;
      return desfasarArco(a.centro, a.radio, a.anguloInicio, a.anguloFin, distancia, modo);
    }
    if (ent.tipo === "polilinea") {
      const pl = polilineasCad.find((item) => item.id === ent.id);
      if (!pl) return null;
      return desfasarPolilinea(pl.puntos, pl.cerrada, distancia, modo);
    }
    if (ent.tipo === "perfil") {
      if (poligonoCresta.length < 3) return null;
      return desfasarPolilinea(
        poligonoCresta.map((p) => ({ x: p.x, y: p.y, z: 0 })),
        true,
        distancia,
        modo
      );
    }
    return null;
  }

  function handleInteractuarDesfase(clientX: number, clientY: number) {
    const ent = detectarEntidadBajoCursor(clientX, clientY);
    if (!ent || !ent.id) return;

    setOffEntidad(ent);
    mostrarAviso(`Entidad seleccionada: ${ent.nombre}. Ajusta modo/distancia y pulsa CREAR DESFASE.`);
  }

  function handleEjecutarDesfase() {
    if (!offEntidad) {
      mostrarAviso("Selecciona primero una entidad para desfasar.");
      return;
    }

    const dVal = parseFloat(offDistancia);
    if (isNaN(dVal) || (offModo !== "profundidad" && dVal <= 0)) {
      mostrarAviso("Ingresa una distancia de desfase válida mayor a 0.");
      return;
    }

    const res = calcularDesfaseEntidad(offEntidad, offModo, dVal);
    if (!res) {
      mostrarAviso("No fue posible calcular el desfase de la entidad seleccionada.");
      return;
    }

    registrarHistorial();

    const capaDestino =
      capaActivaId === "capa-puntos" || capaActivaId === "capa-cresta"
        ? "capa-lineas"
        : capaActivaId;

    if (res.tipo === "linea") {
      const nuevaLin: LineaCad3D = {
        id: `lin-off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        p1: res.p1,
        p2: res.p2,
        longitud: res.longitud,
        azimut: res.azimut,
        capaId: capaDestino,
        tipo: tipoLinea,
        rol: rolIngenieria || "geometria",
      };
      setLineasCad((prev) => [...prev, nuevaLin]);
      mostrarAviso(`✓ Línea desfasada (${res.longitud}m) creada`);
    } else if (res.tipo === "arco") {
      const segs = 32;
      const ptsArc: { x: number; y: number; z: number }[] = [];
      let aIni = res.anguloInicio;
      let aFin = res.anguloFin;
      if (aFin < aIni) aFin += Math.PI * 2;
      for (let i = 0; i <= segs; i++) {
        const a = aIni + (i / segs) * (aFin - aIni);
        ptsArc.push({
          x: Math.round((res.centro.x + res.radio * Math.cos(a)) * 100) / 100,
          y: Math.round((res.centro.y + res.radio * Math.sin(a)) * 100) / 100,
          z: res.centro.z,
        });
      }
      const deltaAng = aFin - aIni;
      const longArco = Math.round(res.radio * deltaAng * 100) / 100;
      const nuevoArc: ArcoCad3D = {
        id: `arc-off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        metodo: "centro_r",
        centro: res.centro,
        radio: res.radio,
        anguloInicio: res.anguloInicio,
        anguloFin: res.anguloFin,
        puntos: ptsArc,
        capaId: capaDestino,
        tipo: tipoLinea,
        rol: rolIngenieria || "geometria",
        longitud: longArco,
      };
      setArcosCad((prev) => [...prev, nuevoArc]);
      mostrarAviso(`✓ Arco desfasado (R=${res.radio}m) creado`);
    } else if (res.tipo === "polilinea") {
      const nuevaPl: PolilineaCad3D = {
        id: `pl-off-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        puntos: res.puntos,
        cerrada: res.cerrada,
        longitud: res.longitud,
        capaId: capaDestino,
        tipo: tipoLinea,
        rol: rolIngenieria || "geometria",
      };
      setPolilineasCad((prev) => [...prev, nuevaPl]);
      mostrarAviso(`✓ Polilínea desfasada (${res.longitud}m, ${res.cerrada ? "cerrada" : "abierta"}) creada`);
    }

    setOffEntidad(null);
  }

  function handleInteractuarCota(clientX: number, clientY: number) {
    let p3D: { x: number; y: number; z: number } | null = null;

    // 1. Buscar snap magnético a vértice de polígono de banco
    const vIdx = verificarToqueVertice(clientX, clientY, 22);
    if (vIdx !== null && poligonoCresta[vIdx]) {
      p3D = { x: poligonoCresta[vIdx].x, y: poligonoCresta[vIdx].y, z: 0 };
    }

    // 2. Buscar snap magnético a punto CAD independiente
    if (!p3D) {
      const ptoId = verificarToquePuntoCad(clientX, clientY, 22);
      if (ptoId) {
        const ptoObj = puntosCad.find((p) => p.id === ptoId);
        if (ptoObj) {
          p3D = { x: ptoObj.x, y: ptoObj.y, z: ptoObj.z || 0 };
        }
      }
    }

    // 3. Buscar snap magnético a punto medio (▲) si está activo
    if (!p3D && mostrarPuntoMedio) {
      const ptoMed = verificarToquePuntoMedio(clientX, clientY, 24);
      if (ptoMed) p3D = ptoMed;
    }

    // 4. Toque libre en el plano de trabajo
    if (!p3D) {
      const ptPlano = obtenerCoordenadasPlano(clientX, clientY);
      if (ptPlano) p3D = { x: ptPlano.x, y: ptPlano.y, z: 0 };
    }

    if (!p3D) return;

    // CASO 1: Modo "distancia" (cota métrica entre 2 puntos con líneas testigo)
    if (cotModo === "distancia") {
      if (!cotPuntoInicio) {
        setCotPuntoInicio(p3D);
        mostrarAviso(`📍 Punto 1 fijado en (${p3D.x.toFixed(2)}, ${p3D.y.toFixed(2)}). Toca el punto final.`);
      } else {
        const p1 = cotPuntoInicio;
        const p2 = p3D;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist < 0.05) {
          mostrarAviso("Los dos puntos de la cota deben ser diferentes.");
          return;
        }

        const separacion = parseFloat(cotSeparacion) || 0.18;
        const nuevaCota: CotaCad3D = {
          id: `cot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          p1,
          p2,
          desplazamiento: separacion,
          texto: `${dist.toFixed(2)} m`,
          tipo: "distancia",
          capaId: capaActivaId,
        };

        registrarHistorial();
        setCotasCad((prev) => [...prev, nuevaCota]);
        setCotPuntoInicio(null);
        setCotCursorGuia(null);
        mostrarAviso(`✓ Cota creada: ${nuevaCota.texto}`);
      }
      return;
    }

    // CASO 2: Modos de Arranque Minero (B1, B2, B3, B4, B5, 4G)
    if (!cotCentro) {
      setCotCentro(p3D);
      mostrarAviso(`📍 Centro de arranque fijado en (${p3D.x.toFixed(2)}, ${p3D.y.toFixed(2)}). Toca un taladro o pulsa GENERAR ${cotModo.toUpperCase()}.`);
    } else {
      const dRef = Math.hypot(p3D.x - cotCentro.x, p3D.y - cotCentro.y) * 2;
      const dFinal = Math.max(0.05, Math.round(dRef * 100) / 100);
      setCotDistanciaB(dFinal.toFixed(2));
      generarCuadranteB(cotCentro, cotModo, dFinal, cotCuadradoAlineado);
    }
  }

  function generarCuadranteB(centro: { x: number; y: number; z: number }, modoB: TipoCotaCad, distB: number, alineado: boolean) {
    const mitad = distB / 2;
    let ptsCuad: { x: number; y: number; z: number }[] = [];

    if (!alineado) {
      // Rombo (girado 45°)
      ptsCuad = [
        { x: centro.x, y: centro.y + mitad, z: centro.z },
        { x: centro.x + mitad, y: centro.y, z: centro.z },
        { x: centro.x, y: centro.y - mitad, z: centro.z },
        { x: centro.x - mitad, y: centro.y, z: centro.z },
      ];
    } else {
      // Cuadrado alineado
      ptsCuad = [
        { x: centro.x - mitad, y: centro.y + mitad, z: centro.z },
        { x: centro.x + mitad, y: centro.y + mitad, z: centro.z },
        { x: centro.x + mitad, y: centro.y - mitad, z: centro.z },
        { x: centro.x - mitad, y: centro.y - mitad, z: centro.z },
      ];
    }

    registrarHistorial();

    // Crear la polilínea cerrada del cuadrante de arranque con trazo discontinuo
    const nuevaPlArranque: PolilineaCad3D = {
      id: `pl-arr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      puntos: ptsCuad,
      cerrada: true,
      longitud: Math.round(distB * 4 * 100) / 100,
      capaId: capaActivaId,
      tipo: "discontinua",
      rol: "galeria",
    };
    setPolilineasCad((prev) => [...prev, nuevaPlArranque]);

    // Crear 4 puntos CAD en las esquinas para facilitar el SNAP
    const nuevosPuntos: PuntoCad3D[] = ptsCuad.map((p, idx) => ({
      id: `pto-arr-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      capaId: capaActivaId,
      tipo: "cruz_x",
    }));
    setPuntosCad((prev) => [...prev, ...nuevosPuntos]);

    // Crear cota testigo del ancho B con el texto exacto (ej. B5 = 0.50 m)
    const sep = parseFloat(cotSeparacion) || 0.18;
    const cotaArranque: CotaCad3D = {
      id: `cot-b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      p1: ptsCuad[0],
      p2: ptsCuad[1],
      desplazamiento: sep,
      texto: `${modoB.toUpperCase()} = ${distB.toFixed(2)} m`,
      tipo: modoB,
      capaId: capaActivaId,
    };
    setCotasCad((prev) => [...prev, cotaArranque]);

    mostrarAviso(`Guía ${modoB.toUpperCase()} creada desde el centro · ${distB.toFixed(2)} m.`);
  }

  function handleEjecutarGenerarB() {
    let centro = cotCentro;
    if (!centro) {
      if (puntosCad.length > 0) {
        centro = { x: puntosCad[puntosCad.length - 1].x, y: puntosCad[puntosCad.length - 1].y, z: puntosCad[puntosCad.length - 1].z || 0 };
      } else if (poligonoCresta.length >= 3) {
        const cx = poligonoCresta.reduce((s, p) => s + p.x, 0) / poligonoCresta.length;
        const cy = poligonoCresta.reduce((s, p) => s + p.y, 0) / poligonoCresta.length;
        centro = { x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100, z: 0 };
      } else {
        centro = { x: 0, y: 0, z: 0 };
      }
    }

    const distB = parseFloat(cotDistanciaB) || 0.50;
    generarCuadranteB(centro, cotModo, distB, cotCuadradoAlineado);
  }

  function handleInsertarTaladroSnap(clientX: number, clientY: number) {
    // 1. Priorizar SNAP a Punto CAD
    const ptoCadId = verificarToquePuntoCad(clientX, clientY, 26);
    let pSnap: { x: number; y: number; z?: number } | null = null;

    if (ptoCadId) {
      const p = puntosCad.find((pt) => pt.id === ptoCadId);
      if (p) pSnap = { x: p.x, y: p.y, z: p.z || 0 };
    }

    // 2. SNAP a Punto Medio
    if (!pSnap && mostrarPuntoMedio) {
      const pMed = verificarToquePuntoMedio(clientX, clientY, 26);
      if (pMed) pSnap = pMed;
    }

    // 3. SNAP a Vértice de Cresta / Polígono
    if (!pSnap) {
      const idxVert = verificarToqueVertice(clientX, clientY, 26);
      if (idxVert !== null && poligonoCresta[idxVert]) {
        pSnap = { x: poligonoCresta[idxVert].x, y: poligonoCresta[idxVert].y, z: 0 };
      }
    }

    // 4. Coordenadas libres del plano de labor si no tocó un SNAP directo
    if (!pSnap) {
      const pMundo = obtenerCoordenadasPlano(clientX, clientY);
      if (pMundo) {
        const pz = ("z" in pMundo && typeof pMundo.z === "number") ? pMundo.z : 0;
        pSnap = { x: pMundo.x, y: pMundo.y, z: pz };
      }
    }

    if (!pSnap) return;

    registrarHistorial();

    const radMm = parseFloat(talRadioMm) || 22.5;
    const longM = parseFloat(talLongitudM) || 3.6;
    const lookOut = parseFloat(talLookOutDeg) || 0;
    const grad = parseFloat(talGradientePct) || 0;

    const thetaRad = (lookOut * Math.PI) / 180;
    const phiRad = Math.atan(grad / 100);

    // Collar en plano de labor; la perforación entra al macizo en -Z con look-out horizontal y gradiente vertical
    const xToe = pSnap.x + longM * Math.sin(thetaRad);
    const yToe = pSnap.y + longM * Math.sin(phiRad);
    const zToe = (pSnap.z || 0) - longM * Math.cos(thetaRad) * Math.cos(phiRad);

    const nuevoTal: Taladro = {
      id: `tal-${talGrupo}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fila: 0,
      columna: 0,
      collar: {
        x: Math.round(pSnap.x * 1000) / 1000,
        y: Math.round(pSnap.y * 1000) / 1000,
        z: Math.round((pSnap.z || 0) * 1000) / 1000,
      },
      fondo: {
        x: Math.round(xToe * 1000) / 1000,
        y: Math.round(yToe * 1000) / 1000,
        z: Math.round(zToe * 1000) / 1000,
      },
      diametroMm: radMm * 2,
      profundidad_m: longM,
      taco_m: talCargado ? 1.0 : 0,
      longitudCarga_m: talCargado ? Math.max(0, longM - 1.0) : 0,
    };
    (nuevoTal as any).zona = talGrupo;

    if (onCambiarTaladros) {
      onCambiarTaladros([...taladros, nuevoTal]);
    }
    const infoG = GRUPOS_TALADRO_CONFIG.find((g) => g.id === talGrupo);
    mostrarAviso(`✓ Taladro ${infoG?.label || talGrupo} insertado en (${pSnap.x.toFixed(2)}, ${pSnap.y.toFixed(2)})`);
  }

  return (
    <div className="cad-screen-wrapper">
      {notificacion && <div className="cad-toast">{notificacion}</div>}

      {/* Input oculto para importar archivos */}
      <input
        type="file"
        id="input-cad-importar"
        accept=".json,.dxf,.csv"
        style={{ display: "none" }}
        onChange={handleImportarArchivo}
      />

      {/* 1. Header idéntico */}
      <header
        className="cad-header-exact"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cad-header-left">
          <button type="button" className="btn-header-back" onClick={onVolver} title="Volver al Portal">
            ←
          </button>
          <span className="cad-header-sub">Modificado 01/09/26 · 00:07</span>
        </div>

        {/* Selector de Sistema de Coordenadas en la Barra Superior */}
        <div className="cad-header-coords-bar">
          <select
            className="select-coords-topbar"
            value={sistemaCoords}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "importar") {
                document.getElementById("input-cad-importar")?.click();
              } else {
                setSistemaCoords(val as SistemaCoordenadas);
              }
            }}
            title="Sistema de coordenadas"
          >
            <option value="local">🌐 Local Mina (m)</option>
            <option value="utm_18s">🌐 UTM 18S</option>
            <option value="utm_19s">🌐 UTM 19S</option>
            <option value="psad56">🌐 PSAD56</option>
            <option value="importar">📁 Jalar DXF/JSON...</option>
          </select>

          <button
            type="button"
            className="btn-topbar-import-icon"
            onClick={() => document.getElementById("input-cad-importar")?.click()}
            title="Importar y jalar coordenadas de archivo"
          >
            📁
          </button>
        </div>

        <div className="cad-header-actions-exact">
          <button type="button" className="btn-exact-icon" onClick={handleDeshacer} disabled={historial.length === 0} title="Deshacer">
            ↺
          </button>
          <button type="button" className="btn-exact-icon" onClick={handleRehacer} disabled={historialRehacer.length === 0} title="Rehacer">
            ↻
          </button>
          <button
            type="button"
            className={`btn-exact-icon ${bloqueadoGlobal ? "icon-yellow" : ""}`}
            onClick={() => setBloqueadoGlobal(!bloqueadoGlobal)}
            title="Bloquear capas"
          >
            🔒
          </button>
          <button
            type="button"
            className="btn-exact-icon icon-green"
            onClick={() => setPanelCapasVisible(!panelCapasVisible)}
            title="Gestor de Capas y Carpetas"
          >
            👁️
          </button>
          <button type="button" className="btn-exact-icon icon-green-check" onClick={onIrARender} title="Confirmar y ver modelo">
            ✅
          </button>
          <button type="button" className="btn-exact-salir" onClick={onVolver} title="Salir">
            SALIR
          </button>
        </div>
      </header>

      {/* 2. Área Central con Canvas 3D Three.js */}
      <div
        ref={mountRef}
        className="cad-three-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Recuadro visual de selección múltiple (Marquee) */}
        {marqueeBox && (
          <div
            className="cad-marquee-box"
            style={{
              left: Math.min(marqueeBox.x1, marqueeBox.x2),
              top: Math.min(marqueeBox.y1, marqueeBox.y2),
              width: Math.abs(marqueeBox.x2 - marqueeBox.x1),
              height: Math.abs(marqueeBox.y2 - marqueeBox.y1),
            }}
          />
        )}

        {/* Dock Lateral Izquierdo */}
        <aside
          className="cad-dock-left-exact"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {(
            [
              "SEL",
              "PTO",
              "LIN",
              "PL",
              "ARC",
              "REC",
              "UNI",
              "DIV",
              "OFF",
              "COT",
              "TAL",
              "SOL",
              "GRI",
            ] as HerramientaCad[]
          ).map((h) => {
            const activo = herramienta === h;
            return (
              <button
                key={h}
                type="button"
                className={`btn-dock-tool-exact ${activo ? "tool-active-pink" : ""}`}
                onClick={() => {
                  if (herramienta === h) {
                    if (h === "SEL") {
                      setPanelSelVisible((prev) => !prev);
                    } else {
                      // Al cerrar la herramienta activa desde el dock, pasa directo a Selección
                      cerrarPanelYPasarASeleccion();
                    }
                  } else {
                    setHerramienta(h);
                    setPanelSelVisible(h === "SEL");
                    setPanelLinVisible(h === "LIN");
                    setPanelPtoVisible(h === "PTO");
                    setPanelPlVisible(h === "PL");
                    setPanelArcVisible(h === "ARC");
                    setPanelRecVisible(h === "REC");
                    setPanelUniVisible(h === "UNI");
                    setPanelDivVisible(h === "DIV");
                    setPanelOffVisible(h === "OFF");
                    setPanelCotVisible(h === "COT");
                    setPanelTalVisible(h === "TAL");
                    setPanelSolVisible(h === "SOL");
                    setPanelGriVisible(h === "GRI");

                    // Mostrar siempre la ventana en su modelo completo expandido al seleccionarla
                    if (h === "SEL") setPanelSelMinimizado(false);
                    if (h === "LIN") setPanelLinMinimizado(false);
                    if (h === "PTO") setPanelPtoMinimizado(false);
                    if (h === "PL") setPanelPlMinimizado(false);
                    if (h === "ARC") setPanelArcMinimizado(false);
                    if (h === "REC") setPanelRecMinimizado(false);
                    if (h === "UNI") setPanelUniMinimizado(false);
                    if (h === "DIV") setPanelDivMinimizado(false);
                    if (h === "OFF") setPanelOffMinimizado(false);
                    if (h === "COT") setPanelCotMinimizado(false);
                    if (h === "TAL") setPanelTalMinimizado(false);
                    if (h === "SOL") setPanelSolMinimizado(false);
                    if (h === "GRI") setPanelGriMinimizado(false);
                  }
                }}
                title={`Herramienta ${h}`}
              >
                {h}
              </button>
            );
          })}
        </aside>

        {/* Dock Lateral Derecho */}
        <aside className="cad-dock-right-exact" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-dock-circle-exact"
            onClick={() => mostrarAviso(`Área: ${area.toFixed(1)} m² | Perímetro: ${perimetro.toFixed(1)} m`)}
            title="Resumen Métrico (Σ)"
          >
            Σ
          </button>

          <button
            type="button"
            className="btn-dock-circle-exact"
            onClick={() => {
              setPanelSelVisible(!panelSelVisible);
            }}
            title="Edición (ED)"
          >
            ED
          </button>

          <button
            type="button"
            className="btn-dock-circle-exact"
            onClick={() => {
              setSnapActivo(!snapActivo);
              mostrarAviso(snapActivo ? "Snap desactivado" : "Snap a 1m activado");
            }}
            title="Snap a Grilla (ES)"
          >
            ES
          </button>

          {/* Botón PM: Snap y Visualización de Punto Medio */}
          <button
            type="button"
            className={`btn-dock-circle-exact ${mostrarPuntoMedio ? "tool-active-pink" : ""}`}
            onClick={() => {
              setMostrarPuntoMedio(!mostrarPuntoMedio);
              mostrarAviso(!mostrarPuntoMedio ? "▲ Puntos medios de líneas activados (marcadores en pantalla)" : "Puntos medios desactivados");
            }}
            title={mostrarPuntoMedio ? "Desactivar Punto Medio (PM)" : "Mostrar y Encajar Punto Medio (PM)"}
            style={mostrarPuntoMedio ? { borderColor: "#06b6d4", color: "#06b6d4", boxShadow: "0 0 14px rgba(6, 182, 212, 0.6)" } : {}}
          >
            PM
          </button>

          <button type="button" className="btn-dock-circle-exact" onClick={onIrARender} title="Confirmar (✓)">
            ✓
          </button>

          <button
            type="button"
            className="btn-dock-circle-exact"
            onClick={() => {
              orbitRef.current.theta = Math.PI / 4;
              orbitRef.current.phi = Math.PI / 3;
              orbitRef.current.radius = 40;
              orbitRef.current.target.set(12, 0, 8);
              mostrarAviso("Vista 3D centrada");
            }}
            title="Centrar Vista 3D"
          >
            °
          </button>
        </aside>

        {/* Ejes 3D sincronizados en tiempo real */}
        <div className="cad-3d-gizmo-container">
          <svg className="cad-3d-gizmo-svg" viewBox="-40 -40 80 80">
            <line x1={0} y1={0} x2={ejesScreen.x.x} y2={ejesScreen.x.y} stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" />
            <text x={ejesScreen.x.x * 1.25} y={ejesScreen.x.y * 1.25} fill="#ef4444" fontSize={10} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
              X
            </text>

            <line x1={0} y1={0} x2={ejesScreen.y.x} y2={ejesScreen.y.y} stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" />
            <text x={ejesScreen.y.x * 1.25} y={ejesScreen.y.y * 1.25} fill="#10b981" fontSize={10} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
              Y
            </text>

            <line x1={0} y1={0} x2={ejesScreen.z.x} y2={ejesScreen.z.y} stroke="#06b6d4" strokeWidth={2.5} strokeLinecap="round" />
            <text x={ejesScreen.z.x * 1.25} y={ejesScreen.z.y * 1.25} fill="#06b6d4" fontSize={10} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
              Z
            </text>
          </svg>

          <div className="cad-badge-listo">
            <span>
              {herramienta === "REC"
                ? "Selecciona objeto y cortante; se muestra preview antes de confirm..."
                : herramienta === "UNI"
                ? "Une líneas en polilínea, cierra perfiles o separa una polilínea."
                : herramienta === "DIV"
                ? "Selecciona una línea y crea N referencias equidistantes."
                : herramienta === "OFF"
                ? "Desfase interior/exterior o Z para líneas, polilíneas, arcos y perfiles."
                : herramienta === "COT"
                ? "Cotas normales o guías B1–B5 / 4G para el arranque."
                : herramienta === "TAL"
                ? "Inserta taladros por grupo usando la configuración activa."
                : "Listo para dibujar"}
            </span>
          </div>
        </div>

        {/* =========================================================================
            PANEL 1: SELECCIONAR (CON BOTONES '−' Y '✕', COORDENADAS ABAJO Y DESPLEGABLE ARRIBA)
           ========================================================================= */}
        {herramienta === "SEL" && panelSelVisible && (
          <div
            className={`cad-panel-seleccionar-exact ${panelSelMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelSelMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Pto:</strong> ({coordsFormateadas.x}, {coordsFormateadas.y})
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelSelMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={() => setPanelSelVisible(false)}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, botón '−' para minimizar y '< OCULTAR' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">SELECCIONAR</h2>
                    <p className="panel-solido-subtitle">Selecciona con toque. La cámara sigue libre; mover solo con ΔXYZ.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelSelMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={() => setPanelSelVisible(false)}
                      title="Cerrar panel (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra compacta de estado: Capa Activa y Contador de Selección */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    Sel: {indicesSeleccionados.length + puntosSeleccionados.length}
                  </span>
                </div>

                {/* Referencia de Punto Base (Para líneas y polígonos) o Punto Individual */}
                {indicesSeleccionados.length > 0 && (
                  <div className="panel-punto-base-box">
                    <div className="pb-header">
                      <span className="pb-label">PUNTO BASE (REFERENCIA):</span>
                      <button
                        type="button"
                        className={`btn-pick-base-pt ${esperandoPuntoBase ? "picking-active" : ""}`}
                        onClick={() => {
                          setEsperandoPuntoBase(!esperandoPuntoBase);
                          if (!esperandoPuntoBase) mostrarAviso("Toca un vértice en pantalla para fijarlo como punto base");
                        }}
                        title="Toca un vértice en pantalla para usarlo como punto base"
                      >
                        {esperandoPuntoBase ? "🎯 Toca vértice..." : "🎯 Cambiar base"}
                      </button>
                    </div>
                    <span className="pb-coords-text">
                      Vértice {puntoBaseIndice + 1} ({poligonoCresta[puntoBaseIndice]?.x.toFixed(2) || "0.00"}, {poligonoCresta[puntoBaseIndice]?.y.toFixed(2) || "0.00"})
                    </span>
                  </div>
                )}

                {puntosSeleccionados.length > 0 && (
                  <div className="panel-punto-base-box">
                    <span className="pb-coords-text">
                      📍 Punto individual · Se mueve directo a coordenadas
                    </span>
                  </div>
                )}

                {/* Fila de 3 columnas X, Y, Z para asignar destino */}
                <div className="panel-sel-coords-grid-3">
                  {/* X */}
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>X</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={moverX}
                      onChange={(e) => setMoverX(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMoverACoordenadas();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>

                  {/* Y */}
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Y</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={moverY}
                      onChange={(e) => setMoverY(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMoverACoordenadas();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>

                  {/* Z */}
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Z</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={moverZ}
                      onChange={(e) => setMoverZ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMoverACoordenadas();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>
                </div>

                {/* Coordenadas absolutas leídas del punto */}
                {puntoActual && (
                  <div className="panel-point-readout-strip compact">
                    <span>Pos:</span>
                    <strong>E: {coordsFormateadas.x}m</strong>
                    <strong>N: {coordsFormateadas.y}m</strong>
                    <strong>Z: {coordsFormateadas.z}m</strong>
                  </div>
                )}

                {/* Fila compacta de acciones */}
                <div className="panel-sel-actions-row">
                  <button type="button" className="btn-cyan-mover-dxyz compact" onClick={handleMoverACoordenadas}>
                    MOVER A XYZ
                  </button>
                  <button type="button" className="btn-outline-borrar-sel compact" onClick={handleBorrarSeleccion} title="Borrar selección">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                    Borrar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 2: LÍNEA (COMPACTO, RESPONSIVO Y CON FLUJO INICIO -> FINAL)
           ========================================================================= */}
        {herramienta === "LIN" && panelLinVisible && (
          <div
            className={`cad-panel-linea-exact ${panelLinMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelLinMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Línea:</strong> {distanciaLinea}m @ {azimutLinea}°
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelLinMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">LÍNEA</h2>
                    <p className="panel-solido-subtitle">Toca inicio y final usando SNAP, o distancia + azimut.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelLinMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador de Líneas */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    Lín: {lineasCad.length}
                  </span>
                </div>

                {/* Conmutador de Punto Medio */}
                <div className="panel-toggle-row">
                  <span className="toggle-label">Mostrar punto medio (▲)</span>
                  <div
                    className={`toggle-switch-track ${mostrarPuntoMedio ? "active" : ""}`}
                    onClick={() => {
                      setMostrarPuntoMedio(!mostrarPuntoMedio);
                      mostrarAviso(!mostrarPuntoMedio ? "▲ Puntos medios activados en pantalla" : "Puntos medios desactivados");
                    }}
                    title="Muestra los puntos medios de las líneas en pantalla y permite encajar en ellos"
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* Caja de paso interactivo (Inicio -> Final) */}
                {!inicioLinea ? (
                  <div className="panel-linea-paso-box">
                    <span className="paso-num">Paso 1: Toca el INICIO</span>
                    <span className="paso-desc">Toca en la escena o sobre un SNAP</span>
                  </div>
                ) : (
                  <div className="panel-linea-paso-box active">
                    <div className="paso-active-header">
                      <span className="paso-num">Paso 2: Toca el FINAL</span>
                      <button
                        type="button"
                        className="btn-cancelar-inicio"
                        onClick={() => {
                          setInicioLinea(null);
                          setCursorGuiaLinea(null);
                        }}
                        title="Reiniciar punto de inicio"
                      >
                        ✕ Reiniciar
                      </button>
                    </div>
                    <span className="paso-desc">
                      Inicio fijado: ({inicioLinea.x}, {inicioLinea.y})
                    </span>
                    <span className="paso-instruccion">
                      Toca el punto final o ingresa distancia + azimut:
                    </span>
                  </div>
                )}

                {/* Selector de Tipo de Línea (4 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Tipo de línea:</span>
                  <div className="panel-pills-row-compact-4">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "continua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("continua")}
                    >
                      Continua
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "discontinua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("discontinua")}
                    >
                      Discont.
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "puntos" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("puntos")}
                    >
                      Puntos
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "centro" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("centro")}
                    >
                      Centro
                    </button>
                  </div>
                </div>

                {/* Selector de Rol de Ingeniería (3 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Rol de ingeniería:</span>
                  <div className="panel-pills-row-compact-3">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "geometria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("geometria")}
                    >
                      Geometría
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "galeria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("galeria")}
                    >
                      Galería
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "burden_spacing" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("burden_spacing")}
                    >
                      Burden
                    </button>
                  </div>
                </div>

                {/* Fila de 2 columnas compactas para Distancia y Azimut */}
                <div className="panel-sel-coords-grid-2">
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Distancia</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={distanciaLinea}
                      onChange={(e) => setDistanciaLinea(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDibujarLineaPorAzimut();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>

                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Azimut</span>
                      <span className="unit-pink">°</span>
                    </div>
                    <input
                      type="number"
                      step="1"
                      value={azimutLinea}
                      onChange={(e) => setAzimutLinea(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDibujarLineaPorAzimut();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>
                </div>

                {/* Botón Principal Fucsia Compacto 'DIBUJAR LÍNEA' */}
                <button
                  type="button"
                  className="btn-pink-dibujar-linea compact"
                  onClick={handleDibujarLineaPorAzimut}
                >
                  DIBUJAR LÍNEA
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: POLILÍNEA (COMPACTO, RESPONSIVO Y ACOPLADO)
           ========================================================================= */}
        {herramienta === "PL" && panelPlVisible && (
          <div
            className={`cad-panel-polilinea-exact ${panelPlMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelPlMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Polilínea:</strong> {verticesPolilinea.length} vértices
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelPlMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">POLILÍNEA</h2>
                    <p className="panel-solido-subtitle">Toca vértices sucesivos y cierra cuando corresponda.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelPlMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    {verticesPolilinea.length > 0 ? `${verticesPolilinea.length} vtx` : `PL: ${polilineasCad.length}`}
                  </span>
                </div>

                {/* Conmutador de Punto Medio */}
                <div className="panel-toggle-row">
                  <span className="toggle-label">Mostrar punto medio (▲)</span>
                  <div
                    className={`toggle-switch-track ${mostrarPuntoMedio ? "active" : ""}`}
                    onClick={() => {
                      setMostrarPuntoMedio(!mostrarPuntoMedio);
                      mostrarAviso(!mostrarPuntoMedio ? "▲ Puntos medios activados en pantalla" : "Puntos medios desactivados");
                    }}
                    title="Muestra los puntos medios de los tramos de polilínea y permite encajar en ellos"
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* Selector de Tipo de Línea (4 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Tipo de línea:</span>
                  <div className="panel-pills-row-compact-4">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "continua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("continua")}
                    >
                      Continua
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "discontinua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("discontinua")}
                    >
                      Discont.
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "puntos" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("puntos")}
                    >
                      Puntos
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "centro" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("centro")}
                    >
                      Centro
                    </button>
                  </div>
                </div>

                {/* Selector de Rol de Ingeniería (3 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Rol de ingeniería:</span>
                  <div className="panel-pills-row-compact-3">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "geometria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("geometria")}
                    >
                      Geometría
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "galeria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("galeria")}
                    >
                      Galería
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "burden_spacing" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("burden_spacing")}
                    >
                      Burden
                    </button>
                  </div>
                </div>

                {/* Caja de estado interactivo del trazado */}
                {verticesPolilinea.length === 0 ? (
                  <div className="panel-linea-paso-box">
                    <span className="paso-num">Trazado</span>
                    <span className="paso-desc">Minimiza el panel y toca cada vértice en la escena.</span>
                  </div>
                ) : (
                  <div className="panel-linea-paso-box active">
                    <div className="paso-active-header">
                      <span className="paso-num">{verticesPolilinea.length} VÉRTICES FIJADOS</span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn-cancelar-inicio"
                          onClick={handleDeshacerUltimoVerticePl}
                          title="Deshacer último vértice"
                        >
                          ↺ Deshacer
                        </button>
                        <button
                          type="button"
                          className="btn-cancelar-inicio"
                          onClick={handleCancelarPolilinea}
                          title="Cancelar y limpiar"
                        >
                          ✕ Limpiar
                        </button>
                      </div>
                    </div>
                    <span className="paso-instruccion">
                      Último: ({verticesPolilinea[verticesPolilinea.length - 1].x}, {verticesPolilinea[verticesPolilinea.length - 1].y})
                    </span>
                  </div>
                )}

                {/* Fila con Switch interactivo para 'Cerrar polilínea' */}
                <div className="panel-toggle-row">
                  <span className="toggle-label">Cerrar polilínea</span>
                  <div
                    className={`toggle-switch-track ${cerrarPolilinea ? "active" : ""}`}
                    onClick={() => setCerrarPolilinea(!cerrarPolilinea)}
                    title={cerrarPolilinea ? "Polilínea cerrada (forma anillo/polígono)" : "Polilínea abierta"}
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* Botón Principal 'FINALIZAR POLILÍNEA' */}
                <button
                  type="button"
                  className="btn-pink-finalizar-pl"
                  onClick={handleFinalizarPolilinea}
                  disabled={verticesPolilinea.length < 2}
                  title={verticesPolilinea.length < 2 ? "Agrega al menos 2 vértices tocando en la pantalla" : "Finalizar polilínea"}
                >
                  FINALIZAR POLILÍNEA
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: ARCO (COMPACTO, RESPONSIVO Y ACOPLADO)
           ========================================================================= */}
        {herramienta === "ARC" && panelArcVisible && (
          <div
            className={`cad-panel-arco-exact ${panelArcMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelArcMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Arco:</strong> R={radioArco}m · {metodoArco === "inicio_fin_r" ? "Inicio/Fin+R" : metodoArco === "centro_r" ? "Centro+R" : "3 Puntos"}
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelArcMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">ARCO</h2>
                    <p className="panel-solido-subtitle">Inicio/fin + radio, centro/radio o tres puntos.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelArcMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    Arc: {arcosCad.length}
                  </span>
                </div>

                {/* Selector de Tipo de Línea (4 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Tipo de línea:</span>
                  <div className="panel-pills-row-compact-4">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "continua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("continua")}
                    >
                      Continua
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "discontinua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("discontinua")}
                    >
                      Discont.
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "puntos" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("puntos")}
                    >
                      Puntos
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoLinea === "centro" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("centro")}
                    >
                      Centro
                    </button>
                  </div>
                </div>

                {/* Selector de Rol de Ingeniería (3 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Rol de ingeniería:</span>
                  <div className="panel-pills-row-compact-3">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "geometria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("geometria")}
                    >
                      Geometría
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "galeria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("galeria")}
                    >
                      Galería
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${rolIngenieria === "burden_spacing" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("burden_spacing")}
                    >
                      Burden
                    </button>
                  </div>
                </div>

                {/* Selector de Método de Construcción del Arco (3 pills compactos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Método:</span>
                  <div className="panel-pills-row-compact-3">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${metodoArco === "inicio_fin_r" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setMetodoArco("inicio_fin_r");
                        setPuntosArcoConstruccion([]);
                      }}
                    >
                      Inicio/fin + R
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${metodoArco === "centro_r" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setMetodoArco("centro_r");
                        setPuntosArcoConstruccion([]);
                      }}
                    >
                      Centro + R
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${metodoArco === "tres_puntos" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setMetodoArco("tres_puntos");
                        setPuntosArcoConstruccion([]);
                      }}
                    >
                      3 puntos
                    </button>
                  </div>
                </div>

                {/* Campo Radio (visible para método Inicio/fin + R y Centro + R) */}
                {metodoArco !== "tres_puntos" && (
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Radio</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={radioArco}
                      onChange={(e) => setRadioArco(e.target.value)}
                      className="panel-coord-num-input-compact"
                    />
                  </div>
                )}

                {/* Switch Centro al lado izquierdo (para método Inicio/fin + R y Centro + R) */}
                {metodoArco !== "tres_puntos" && (
                  <div className="panel-toggle-row">
                    <span className="toggle-label">Centro al lado izquierdo</span>
                    <div
                      className={`toggle-switch-track ${centroIzquierdaArco ? "active" : ""}`}
                      onClick={() => setCentroIzquierdaArco(!centroIzquierdaArco)}
                      title={centroIzquierdaArco ? "Centro a la izquierda (curva cóncava/convexa)" : "Centro a la derecha"}
                    >
                      <div className="toggle-switch-thumb" />
                    </div>
                  </div>
                )}

                {/* Caja de paso interactivo */}
                {puntosArcoConstruccion.length === 0 ? (
                  <div className="panel-linea-paso-box">
                    <span className="paso-num">
                      {metodoArco === "centro_r"
                        ? `Paso 1: Toca el CENTRO (R=${radioArco}m)`
                        : "Paso 1: Toca el INICIO"}
                    </span>
                    <span className="paso-desc">
                      {metodoArco === "centro_r"
                        ? "Toca el centro en escena o ingresa ángulos abajo"
                        : "Toca en la escena o sobre un SNAP"}
                    </span>
                  </div>
                ) : (
                  <div className="panel-linea-paso-box active">
                    <div className="paso-active-header">
                      <span className="paso-num">
                        {metodoArco === "inicio_fin_r"
                          ? "Paso 2: Toca el FINAL"
                          : metodoArco === "centro_r"
                          ? puntosArcoConstruccion.length === 1
                            ? `Paso 2: Toca INICIO (R=${radioArco}m)`
                            : "Paso 3: Toca el FINAL"
                          : puntosArcoConstruccion.length === 1
                          ? "Paso 2: Toca Punto de Paso"
                          : "Paso 3: Toca el FINAL"}
                      </span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn-cancelar-inicio"
                          onClick={handleDeshacerPuntoArco}
                          title="Deshacer último punto"
                        >
                          ↺ Deshacer
                        </button>
                        <button
                          type="button"
                          className="btn-cancelar-inicio"
                          onClick={handleCancelarArco}
                          title="Cancelar arco"
                        >
                          ✕ Limpiar
                        </button>
                      </div>
                    </div>
                    <span className="paso-instruccion">
                      Punto actual: ({puntosArcoConstruccion[puntosArcoConstruccion.length - 1].x}, {puntosArcoConstruccion[puntosArcoConstruccion.length - 1].y})
                    </span>
                  </div>
                )}

                {/* Parámetros de ángulo directo para Centro + R */}
                {metodoArco === "centro_r" && (
                  <div className="panel-sel-coords-grid-2">
                    <div className="panel-coord-box-compact">
                      <div className="panel-coord-head">
                        <span>Áng. Inicio</span>
                        <span className="unit-pink">°</span>
                      </div>
                      <input
                        type="number"
                        step="5"
                        value={anguloInicioArco}
                        onChange={(e) => setAnguloInicioArco(e.target.value)}
                        className="panel-coord-num-input-compact"
                      />
                    </div>

                    <div className="panel-coord-box-compact">
                      <div className="panel-coord-head">
                        <span>Áng. Fin</span>
                        <span className="unit-pink">°</span>
                      </div>
                      <input
                        type="number"
                        step="5"
                        value={anguloFinArco}
                        onChange={(e) => setAnguloFinArco(e.target.value)}
                        className="panel-coord-num-input-compact"
                      />
                    </div>
                  </div>
                )}

                {/* Botón directo 'DIBUJAR ARCO' para Centro + R */}
                {metodoArco === "centro_r" && (
                  <button
                    type="button"
                    className="btn-pink-dibujar-linea compact"
                    onClick={handleDibujarArcoManual}
                    title="Dibujar arco con el radio y ángulos indicados"
                  >
                    DIBUJAR ARCO
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: PUNTO (COMPACTO, RESPONSIVO Y ACOPLADO IGUAL A SELECCIONAR)
           ========================================================================= */}
        {herramienta === "PTO" && panelPtoVisible && (
          <div
            className={`cad-panel-punto-exact ${panelPtoMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelPtoMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Punto:</strong> ({ptoX}, {ptoY}, {ptoZ})
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelPtoMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">PUNTO</h2>
                    <p className="panel-solido-subtitle">Toca en pantalla o ingresa coordenadas absolutas.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelPtoMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador de Puntos */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    Pts: {puntosCad.length}
                  </span>
                </div>

                {/* Selector de Estilo de Punto (Grid compacta de 4 estilos) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Estilo de punto:</span>
                  <div className="panel-pills-row-compact-4">
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoPunto === "cruz_x" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setTipoPunto("cruz_x");
                        if (puntosSeleccionados.length > 0) {
                          setPuntosCad((prev) =>
                            prev.map((p) => (puntosSeleccionados.includes(p.id) ? { ...p, tipo: "cruz_x" } : p))
                          );
                        }
                      }}
                      title="Cruz diagonal (X)"
                    >
                      ✕ Cruz X
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoPunto === "cruz_mas" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setTipoPunto("cruz_mas");
                        if (puntosSeleccionados.length > 0) {
                          setPuntosCad((prev) =>
                            prev.map((p) => (puntosSeleccionados.includes(p.id) ? { ...p, tipo: "cruz_mas" } : p))
                          );
                        }
                      }}
                      title="Cruz ortogonal (+)"
                    >
                      + Cruz +
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoPunto === "circulo_x" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setTipoPunto("circulo_x");
                        if (puntosSeleccionados.length > 0) {
                          setPuntosCad((prev) =>
                            prev.map((p) => (puntosSeleccionados.includes(p.id) ? { ...p, tipo: "circulo_x" } : p))
                          );
                        }
                      }}
                      title="Círculo con cruz (⊗)"
                    >
                      ⊗ Círculo
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${tipoPunto === "punto" ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setTipoPunto("punto");
                        if (puntosSeleccionados.length > 0) {
                          setPuntosCad((prev) =>
                            prev.map((p) => (puntosSeleccionados.includes(p.id) ? { ...p, tipo: "punto" } : p))
                          );
                        }
                      }}
                      title="Punto / Nodo (●)"
                    >
                      ● Nodo
                    </button>
                  </div>
                </div>

                {/* Fila de 3 columnas X, Y, Z compactas (idénticas a SELECCIONAR) */}
                <div className="panel-sel-coords-grid-3">
                  {/* X */}
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>X</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={ptoX}
                      onChange={(e) => setPtoX(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInsertarPuntoXYZ();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>

                  {/* Y */}
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Y</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={ptoY}
                      onChange={(e) => setPtoY(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInsertarPuntoXYZ();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>

                  {/* Z */}
                  <div className="panel-coord-box-compact">
                    <div className="panel-coord-head">
                      <span>Z</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={ptoZ}
                      onChange={(e) => setPtoZ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInsertarPuntoXYZ();
                      }}
                      className="panel-coord-num-input-compact"
                    />
                  </div>
                </div>

                {/* Botón Principal Fucsia Compacto 'INSERTAR XYZ' */}
                <button
                  type="button"
                  className="btn-pink-insertar-xyz compact"
                  onClick={handleInsertarPuntoXYZ}
                >
                  INSERTAR XYZ
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: SÓLIDO (EXTRUIR POLILÍNEA CERRADA EN Z Y OBTENER SU CENTRO)
           ========================================================================= */}
        {/* =========================================================================
            PANEL: SÓLIDO (EXTRUIR POLILÍNEA EN Z - LEVANTAMIENTO, PROFUNDIDAD Y ARISTAS)
           ========================================================================= */}
        {(herramienta === "SOL" || aristasSolidosSeleccionadas.length > 0 || panelSolVisible) && panelSolVisible && (
          <div
            className={`cad-panel-solido-exact ${panelSolMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelSolMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Sólido:</strong>{" "}
                  {solModoExtrusion === "levantamiento"
                    ? `Lev. ${solLevantamiento}m`
                    : solModoExtrusion === "profundidad"
                    ? `Prof. ${solProfundidad}m`
                    : `+${solLevantamiento}m / -${solProfundidad}m`}
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelSolMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo y '< OCULTAR' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">SÓLIDO 3D</h2>
                    <p className="panel-solido-subtitle">
                      Levantamiento (+Z) o Profundidad (-Z)<br />
                      con aristas 3D seleccionables.
                    </p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelSolMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Badge CAPA ACTIVA */}
                <div className="panel-solido-capa-box">
                  CAPA ACTIVA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                </div>

                {/* Selector de Modo: Levantamiento (+Z) vs Profundidad (-Z) vs Ambos */}
                <div className="panel-solido-modo-tabs">
                  <button
                    type="button"
                    className={`btn-modo-tab ${solModoExtrusion === "levantamiento" ? "activo" : ""}`}
                    onClick={() => setSolModoExtrusion("levantamiento")}
                    title="Extruir hacia arriba (+Z, altura o cota superior)"
                  >
                    ↑ Levantamiento
                  </button>
                  <button
                    type="button"
                    className={`btn-modo-tab ${solModoExtrusion === "profundidad" ? "activo" : ""}`}
                    onClick={() => setSolModoExtrusion("profundidad")}
                    title="Extruir hacia abajo (-Z, profundidad o fondo de banco)"
                  >
                    ↓ Profundidad
                  </button>
                  <button
                    type="button"
                    className={`btn-modo-tab ${solModoExtrusion === "ambos" ? "activo" : ""}`}
                    onClick={() => setSolModoExtrusion("ambos")}
                    title="Extruir bilateralmente (+Z y -Z)"
                  >
                    ↕ Ambos
                  </button>
                </div>

                {/* Campo Levantamiento (+Z) */}
                {(solModoExtrusion === "levantamiento" || solModoExtrusion === "ambos") && (
                  <div className="panel-solido-field-group">
                    <div className="panel-solido-field-head">
                      <span className="field-label-white">Levantamiento (+Z)</span>
                      <span className="field-unit-pink">m</span>
                    </div>
                    <div className="panel-solido-input-card">
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={solLevantamiento}
                        onChange={(e) => setSolLevantamiento(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleExtruirPerfil();
                        }}
                        className="panel-solido-input-value"
                        placeholder="10.00"
                      />
                    </div>
                  </div>
                )}

                {/* Campo Profundidad (-Z) */}
                {(solModoExtrusion === "profundidad" || solModoExtrusion === "ambos") && (
                  <div className="panel-solido-field-group">
                    <div className="panel-solido-field-head">
                      <span className="field-label-white">Profundidad (-Z)</span>
                      <span className="field-unit-pink">m</span>
                    </div>
                    <div className="panel-solido-input-card">
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={solProfundidad}
                        onChange={(e) => setSolProfundidad(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleExtruirPerfil();
                        }}
                        className="panel-solido-input-value"
                        placeholder="12.00"
                      />
                    </div>
                  </div>
                )}

                {/* Botón Principal Fucsia: EXTRUIR PERFIL */}
                <button
                  type="button"
                  className="btn-pink-extruir-perfil"
                  onClick={handleExtruirPerfil}
                >
                  EXTRUIR PERFIL 3D
                </button>

                {/* SECCIÓN DE ARISTAS 3D SELECCIONADAS (Para crear más cosas por ahí) */}
                {aristasSolidosSeleccionadas.length > 0 && (() => {
                  const todasAristas: AristaSolidoCad[] = [];
                  solidosCad.forEach((s) => todasAristas.push(...obtenerAristasDeSolido(s)));
                  const arSel = todasAristas.find((a) => aristasSolidosSeleccionadas.includes(a.id));
                  return (
                    <div className="panel-solido-arista-sel-card">
                      <div className="arista-sel-header">
                        <span className="badge-arista-sel">
                          ARISTA 3D ACTIVA ({aristasSolidosSeleccionadas.length})
                        </span>
                        <button
                          type="button"
                          className="btn-arista-deseleccionar"
                          onClick={() => setAristasSolidosSeleccionadas([])}
                          title="Deseleccionar arista"
                        >
                          ✕
                        </button>
                      </div>

                      {arSel && (
                        <div className="arista-sel-info">
                          <div className="arista-info-fila">
                            <span className="info-label">Tipo:</span>
                            <span className="info-val-cyan">{arSel.tipo.toUpperCase()}</span>
                            <span className="info-label">Long:</span>
                            <span className="info-val-white">{arSel.longitud.toFixed(2)} m</span>
                          </div>
                          <div className="arista-coords-box">
                            <div>P1: ({arSel.p1.x}, {arSel.p1.y}, Z={arSel.p1.z})</div>
                            <div>P2: ({arSel.p2.x}, {arSel.p2.y}, Z={arSel.p2.z})</div>
                          </div>
                        </div>
                      )}

                      <div className="arista-acciones-title">ACCIONES DE MODELADO:</div>
                      <div className="arista-acciones-grid">
                        <button
                          type="button"
                          className="btn-arista-accion btn-arista-primario"
                          onClick={handleConvertirAristasALineasCad}
                          title="Convierte esta arista en Línea CAD para seguir dibujando, recortando o usándola de guía"
                        >
                          + Convertir a Línea CAD
                        </button>
                        <button
                          type="button"
                          className="btn-arista-accion"
                          onClick={handleCrearCotaDesdeArista}
                          title="Acotar con medida paramétrica esta arista"
                        >
                          📏 Acotar Arista (COT)
                        </button>
                        <button
                          type="button"
                          className="btn-arista-accion"
                          onClick={() => handleExtraerBaseSolido("superior")}
                          title="Extraer el contorno superior como Polilínea cerrada CAD"
                        >
                          ⬆ Extraer Base Superior
                        </button>
                        <button
                          type="button"
                          className="btn-arista-accion"
                          onClick={() => handleExtraerBaseSolido("inferior")}
                          title="Extraer el contorno inferior como Polilínea cerrada CAD"
                        >
                          ⬇ Extraer Base Inferior
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Tarjeta de resultados si hay sólidos generados */}
                {solidosCad.length > 0 && (
                  <div className="panel-solido-results-card">
                    <div className="results-head">
                      <span>ÚLTIMO SÓLIDO (#{solidosCad.length})</span>
                      <button
                        type="button"
                        className="btn-limpiar-solidos"
                        onClick={() => {
                          setSolidosCad([]);
                          setAristasSolidosSeleccionadas([]);
                          mostrarAviso("Sólidos eliminados");
                        }}
                      >
                        Limpiar
                      </button>
                    </div>
                    <div className="results-grid">
                      <div className="res-item">
                        <label>Volumen</label>
                        <strong>{solidosCad[solidosCad.length - 1].volumen_m3.toFixed(2)} m³</strong>
                      </div>
                      <div className="res-item">
                        <label>Área Base</label>
                        <strong>{solidosCad[solidosCad.length - 1].area_m2.toFixed(2)} m²</strong>
                      </div>
                    </div>
                    <div className="res-centroide">
                      <label>Centroide 3D (X, Y, Z)</label>
                      <code>
                        ({solidosCad[solidosCad.length - 1].centroide.x}, {solidosCad[solidosCad.length - 1].centroide.y}, {solidosCad[solidosCad.length - 1].centroide.z}) m
                      </code>
                    </div>
                    {/* Botón rápido para seleccionar todas las aristas de este sólido */}
                    <button
                      type="button"
                      className="btn-seleccionar-todas-aristas"
                      onClick={() => {
                        const ult = solidosCad[solidosCad.length - 1];
                        const aristas = obtenerAristasDeSolido(ult);
                        setAristasSolidosSeleccionadas(aristas.map((a) => a.id));
                        mostrarAviso(`${aristas.length} aristas del Sólido seleccionadas`);
                      }}
                    >
                      ⚡ Seleccionar todas las aristas del sólido
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: GRILLA (PASO, ORIGEN, MEDIAS REFERENCIAS Y GUÍAS AUXILIARES H/V)
           ========================================================================= */}
        {panelGriVisible && (
          <div
            className={`cad-panel-grilla-exact ${panelGriMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelGriMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Grilla:</strong> Paso {griPaso}m · ({griOrigenX}, {griOrigenY})
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelGriMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título 'GRILLA', subtítulo y '< OCULTAR' */}
                <div className="panel-grilla-header">
                  <div className="panel-grilla-title-col">
                    <h2 className="panel-grilla-title">GRILLA</h2>
                    <p className="panel-grilla-subtitle">
                      Paso, origen, medias referencias y<br />
                      guías auxiliares H/V.
                    </p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelGriMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Campo 1: Paso de grilla */}
                <div className="panel-grilla-field-group">
                  <div className="panel-grilla-field-head">
                    <span className="field-label-white">Paso de grilla</span>
                    <span className="field-unit-pink">m</span>
                  </div>
                  <div className="panel-grilla-input-card">
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={griPaso}
                      onChange={(e) => setGriPaso(e.target.value)}
                      className="panel-grilla-input-value"
                      placeholder="0.5"
                    />
                  </div>
                </div>

                {/* Fila con Origen X y Origen Y */}
                <div className="panel-grilla-coords-row">
                  <div className="panel-grilla-field-group">
                    <div className="panel-grilla-field-head">
                      <span className="field-label-white">Origen X</span>
                      <span className="field-unit-pink">m</span>
                    </div>
                    <div className="panel-grilla-input-card">
                      <input
                        type="number"
                        step="0.5"
                        value={griOrigenX}
                        onChange={(e) => setGriOrigenX(e.target.value)}
                        className="panel-grilla-input-value"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="panel-grilla-field-group">
                    <div className="panel-grilla-field-head">
                      <span className="field-label-white">Origen Y</span>
                      <span className="field-unit-pink">m</span>
                    </div>
                    <div className="panel-grilla-input-card">
                      <input
                        type="number"
                        step="0.5"
                        value={griOrigenY}
                        onChange={(e) => setGriOrigenY(e.target.value)}
                        className="panel-grilla-input-value"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Botón 1: CENTRAR ORIGEN EN GALERÍA */}
                <button
                  type="button"
                  className="btn-grilla-centrar-galeria"
                  onClick={handleCentrarOrigenEnGaleria}
                >
                  CENTRAR ORIGEN EN GALERÍA
                </button>

                {/* Botón 2: MOVER ORIGEN CON SNAP */}
                <button
                  type="button"
                  className={`btn-grilla-mover-snap ${griMoviendoOrigen ? "activo" : ""}`}
                  onClick={handleIniciarMoverOrigenSnap}
                >
                  {griMoviendoOrigen ? "📍 TOCA EN PANTALLA..." : "MOVER ORIGEN CON SNAP"}
                </button>

                {/* 3 Toggles interactivos (switches fucsia con pastilla blanca) */}
                <div className="panel-grilla-toggles">
                  {/* Toggle 1: Mostrar grilla */}
                  <div className="grilla-toggle-row">
                    <span className="grilla-toggle-label">Mostrar grilla</span>
                    <div
                      className={`toggle-switch-track ${griMostrarGrilla ? "active" : ""}`}
                      onClick={() => setGriMostrarGrilla(!griMostrarGrilla)}
                      title="Activar o desactivar visualización de la cuadrícula"
                    >
                      <div className="toggle-switch-thumb" />
                    </div>
                  </div>

                  {/* Toggle 2: SNAP métrico */}
                  <div className="grilla-toggle-row">
                    <span className="grilla-toggle-label">SNAP métrico</span>
                    <div
                      className={`toggle-switch-track ${griSnapMetrico ? "active" : ""}`}
                      onClick={() => {
                        const nuevo = !griSnapMetrico;
                        setGriSnapMetrico(nuevo);
                        setSnapActivo(nuevo);
                        mostrarAviso(nuevo ? `✓ SNAP métrico activado (cada ${griPaso}m)` : "SNAP métrico desactivado");
                      }}
                      title="Fuerza al cursor a encajar en los pasos de la grilla"
                    >
                      <div className="toggle-switch-thumb" />
                    </div>
                  </div>

                  {/* Toggle 3: SNAP a media cuadrícula */}
                  <div className="grilla-toggle-row">
                    <span className="grilla-toggle-label">SNAP a media cuadrícula</span>
                    <div
                      className={`toggle-switch-track ${griSnapMediaCuadricula ? "active" : ""}`}
                      onClick={() => {
                        const nuevo = !griSnapMediaCuadricula;
                        setGriSnapMediaCuadricula(nuevo);
                        const media = ((parseFloat(griPaso) || 0.5) / 2).toFixed(2);
                        mostrarAviso(nuevo ? `✓ SNAP a media cuadrícula activado (cada ${media}m)` : "SNAP a media cuadrícula desactivado");
                      }}
                      title="Permite encajar a la mitad del paso de cuadrícula"
                    >
                      <div className="toggle-switch-thumb" />
                    </div>
                  </div>

                  {/* Toggle 4: Ver distancias de grilla (Exacto a la captura) */}
                  <div className="grilla-toggle-row">
                    <span className="grilla-toggle-label">Ver distancias de grilla</span>
                    <div
                      className={`toggle-switch-track ${griVerDistancias ? "active" : ""}`}
                      onClick={() => {
                        const nuevo = !griVerDistancias;
                        setGriVerDistancias(nuevo);
                        mostrarAviso(nuevo ? "✓ Distancias métricas en grilla visibles" : "Distancias métricas ocultas");
                      }}
                      title="Muestra etiquetas de distancia en metros a lo largo de los ejes"
                    >
                      <div className="toggle-switch-thumb" />
                    </div>
                  </div>
                </div>

                {/* Sección: Líneas auxiliares de grilla */}
                <div className="panel-grilla-aux-section">
                  <div className="panel-grilla-aux-title-row">
                    <span className="panel-grilla-aux-title">Líneas auxiliares de grilla</span>
                    {guiasAuxiliares.length > 0 && (
                      <button
                        type="button"
                        className="btn-limpiar-guias"
                        onClick={() => {
                          setGuiasAuxiliares([]);
                          mostrarAviso("Guías auxiliares eliminadas");
                        }}
                        title="Borrar todas las guías auxiliares"
                      >
                        Limpiar ({guiasAuxiliares.length})
                      </button>
                    )}
                  </div>

                  <div className="panel-grilla-aux-btns">
                    <button
                      type="button"
                      className={`btn-grilla-aux ${modoCrearGuia === "H" ? "activo" : ""}`}
                      onClick={() => {
                        if (modoCrearGuia === "H") {
                          setModoCrearGuia(null);
                        } else {
                          setModoCrearGuia("H");
                          mostrarAviso("📍 Toca en el plano para situar la guía Horizontal");
                        }
                      }}
                    >
                      {modoCrearGuia === "H" ? "📍 Toca en plano..." : "Horizontal"}
                    </button>
                    <button
                      type="button"
                      className={`btn-grilla-aux ${modoCrearGuia === "V" ? "activo" : ""}`}
                      onClick={() => {
                        if (modoCrearGuia === "V") {
                          setModoCrearGuia(null);
                        } else {
                          setModoCrearGuia("V");
                          mostrarAviso("📍 Toca en el plano para situar la guía Vertical");
                        }
                      }}
                    >
                      {modoCrearGuia === "V" ? "📍 Toca en plano..." : "Vertical"}
                    </button>
                  </div>

                  {/* Recuadro informativo exacto a la captura de pantalla */}
                  <div className="panel-grilla-info-box">
                    Al apagar Mostrar grilla también se ocultan todas las guías auxiliares. No se borran.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 3: GESTOR DE CARPETAS Y CAPAS (TIPO AUTOCAD / CIVIL 3D)
           ========================================================================= */}
        {panelCapasVisible && (
          <div
            className={`cad-panel-capas-autocad ${panelCapasMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelCapasMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Capas:</strong> {capas.length} activas
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelCapasMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={() => setPanelCapasVisible(false)}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>ÁRBOL DE CAPAS (AUTOCAD)</h2>
                    <p>Organiza entidades en carpetas y capas. Oculta, muestra o bloquea.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button type="button" className="btn-header-round-min" onClick={() => setPanelCapasMinimizado(true)} title="Minimizar">
                      −
                    </button>
                    <button type="button" className="btn-header-round-close" onClick={() => setPanelCapasVisible(false)} title="Cerrar">
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de Acciones de Capas */}
                <div className="capas-actions-bar">
                  <button type="button" className="btn-capa-action" onClick={handleCrearNuevaCapa}>
                    + Nueva Capa
                  </button>
                  <button type="button" className="btn-capa-action" onClick={handleCrearNuevaCarpeta}>
                    + Nueva Carpeta
                  </button>
                </div>

                {/* Lista Jerárquica de Carpetas y Capas */}
                <div className="capas-tree-container">
                  {carpetas.map((carp) => {
                    const capasDeCarpeta = capas.filter((c) => c.carpetaId === carp.id);
                    return (
                      <div key={carp.id} className="carpeta-block">
                        <div className="carpeta-header">
                          <button
                            type="button"
                            className="btn-toggle-carp"
                            onClick={() =>
                              setCarpetas((prev) =>
                                prev.map((c) => (c.id === carp.id ? { ...c, abierta: !c.abierta } : c))
                              )
                            }
                          >
                            {carp.abierta ? "▾" : "▸"} 📁 <strong>{carp.nombre}</strong>
                          </button>

                          <button
                            type="button"
                            className={`btn-carp-eye ${carp.visible ? "eye-on" : "eye-off"}`}
                            onClick={() => handleToggleVisibilidadCarpeta(carp.id)}
                            title={carp.visible ? "Ocultar carpeta completa" : "Mostrar carpeta completa"}
                          >
                            {carp.visible ? "👁️" : "🚫"}
                          </button>
                        </div>

                        {carp.abierta && (
                          <div className="capas-items-list">
                            {capasDeCarpeta.map((capa) => {
                              const esActiva = capa.id === capaActivaId;
                              return (
                                <div
                                  key={capa.id}
                                  className={`capa-item-row ${esActiva ? "capa-row-activa" : ""}`}
                                  onClick={() => handleAsignarACapa(capa.id)}
                                >
                                  <div className="capa-item-left">
                                    <span className="capa-color-swatch" style={{ background: capa.color }} />
                                    <div className="capa-text-wrap">
                                      <span className="capa-name">{capa.nombre}</span>
                                      <span className="capa-count">{capa.elementosCount} entidades</span>
                                    </div>
                                  </div>

                                  <div className="capa-item-controls" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className={`btn-layer-toggle ${capa.visible ? "eye-on" : "eye-off"}`}
                                      onClick={() => handleToggleVisibilidadCapa(capa.id)}
                                      title={capa.visible ? "Ocultar capa" : "Mostrar capa"}
                                    >
                                      {capa.visible ? "👁️" : "🚫"}
                                    </button>

                                    <button
                                      type="button"
                                      className={`btn-layer-toggle ${capa.bloqueada ? "lock-on" : ""}`}
                                      onClick={() => handleToggleBloqueoCapa(capa.id)}
                                      title={capa.bloqueada ? "Desbloquear capa" : "Bloquear capa"}
                                    >
                                      {capa.bloqueada ? "🔒" : "🔓"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: RECORTAR (TRIM - EXACTO AL MOCKUP DE REFERENCIA)
           ========================================================================= */}
        {herramienta === "REC" && panelRecVisible && (
          <div
            className={`cad-panel-recortar-exact ${panelRecMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelRecMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Recorte:</strong> {recObjeto && recCortante ? "2/2 Listo" : recObjeto ? "1/2 Cortante" : "0/2 Selección"}
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelRecMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">RECORTAR</h2>
                    <p className="panel-solido-subtitle">Selecciona objeto y cortante para recortar.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelRecMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    {recObjeto && recCortante ? "Rec: 2/2" : recObjeto ? "Rec: 1/2" : "Rec: 0/2"}
                  </span>
                </div>

                {/* Selector de Tramo a Conservar (Pills compactos estilo ARCO) */}
                <div className="panel-section-group compact">
                  <span className="section-label-exact-compact">Tramo que se conserva:</span>
                  <div className="panel-pills-row-compact-2" style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${recConservarInicio ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setRecConservarInicio(true);
                        mostrarAviso("Fijado: Tramo A (Inicio) queda en VERDE");
                      }}
                      style={{ flex: 1 }}
                      title="Conservar el tramo inicial"
                    >
                      {recConservarInicio ? "● " : ""}Inicio (Verde)
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${!recConservarInicio ? "pill-active-purple" : ""}`}
                      onClick={() => {
                        setRecConservarInicio(false);
                        mostrarAviso("Fijado: Tramo B (Fin) queda en VERDE");
                      }}
                      style={{ flex: 1 }}
                      title="Conservar el tramo final"
                    >
                      {!recConservarInicio ? "● " : ""}Final (Verde)
                    </button>
                  </div>
                </div>

                {/* Switch estilo ARCO */}
                <div className="panel-toggle-row">
                  <span className="toggle-label">Conservar desde el inicio</span>
                  <div
                    className={`toggle-switch-track ${recConservarInicio ? "active" : ""}`}
                    onClick={() => setRecConservarInicio(!recConservarInicio)}
                    title={recConservarInicio ? "Conservando tramo inicial" : "Conservando tramo final"}
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* Caja de paso interactivo (Estilo PASO 1 / PASO 2 / PASO 3) */}
                {!recObjeto ? (
                  <div className="panel-linea-paso-box">
                    <span className="paso-num">PASO 1: TOCA EL OBJETO A RECORTAR</span>
                    <span className="paso-desc">Toca en la escena la línea, polilínea o arco</span>
                  </div>
                ) : !recCortante ? (
                  <div className="panel-linea-paso-box active">
                    <div className="paso-active-header">
                      <span className="paso-num">PASO 2: TOCA LA CORTANTE</span>
                      <button
                        type="button"
                        className="btn-cancelar-inicio"
                        onClick={() => {
                          setRecObjeto(null);
                          setRecCortante(null);
                          mostrarAviso("Selección reiniciada");
                        }}
                        title="Reiniciar selección"
                      >
                        ✕ Reiniciar
                      </button>
                    </div>
                    <span className="paso-desc">
                      Objeto: <strong>{recObjeto.nombre}</strong>
                    </span>
                    <span className="paso-instruccion">
                      Toca la entidad que servirá como corte o límite.
                    </span>
                  </div>
                ) : (
                  <div className="panel-linea-paso-box active">
                    <div className="paso-active-header">
                      <span className="paso-num">PASO 3: CONFIRMA EL RECORTE</span>
                      <button
                        type="button"
                        className="btn-cancelar-inicio"
                        onClick={() => {
                          setRecObjeto(null);
                          setRecCortante(null);
                          mostrarAviso("Selección reiniciada");
                        }}
                        title="Reiniciar selección"
                      >
                        ✕ Reiniciar
                      </button>
                    </div>
                    <span className="paso-desc">
                      <span className="rec-badge-verde">VERDE</span> = queda · <span className="rec-badge-rojo">ROJO</span> = elimina
                    </span>
                    <span className="paso-instruccion">
                      💡 Toca la línea roja en el 3D para alternar qué tramo conservar.
                    </span>
                  </div>
                )}

                {/* Botón Principal Fucsia Compacto 'CONFIRMAR RECORTE' */}
                <button
                  type="button"
                  className="btn-pink-finalizar-pl"
                  onClick={handleConfirmarRecorte}
                  disabled={!puedeConfirmarRecorte}
                  style={{ width: "100%", marginTop: "4px" }}
                  title={
                    puedeConfirmarRecorte
                      ? "Confirmar recorte y actualizar geometría"
                      : "Selecciona objeto y cortante que se intersecten para habilitar"
                  }
                >
                  CONFIRMAR RECORTE
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL: UNIR / SEPARAR (UNI - COMPACTO, RESPONSIVO Y ACOPLADO)
           ========================================================================= */}
        {herramienta === "UNI" && panelUniVisible && (
          <div
            className={`cad-panel-unir-exact ${panelUniMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelUniMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Unir:</strong> {uniSeleccionadas.length} seleccionadas
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelUniMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">UNIR / SEPARAR</h2>
                    <p className="panel-solido-subtitle">Une segmentos contiguos en polilínea cerrada.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelUniMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    Sel: {uniSeleccionadas.length}
                  </span>
                </div>

                {/* Instrucciones de Selección */}
                <p className="panel-rec-instruction">
                  Selecciona líneas, arcos o polilíneas conectadas. UNI las ordena por sus extremos y puede cerrar el perfil de galería.
                </p>

                {/* Contador con Reset */}
                <div className="panel-rec-selection-row">
                  <span className="panel-rec-selection-label">
                    Seleccionadas: <strong style={{ color: "#00f0ff" }}>{uniSeleccionadas.length}</strong>
                  </span>
                  {uniSeleccionadas.length > 0 && (
                    <button
                      type="button"
                      className="btn-rec-reset"
                      onClick={() => {
                        setUniSeleccionadas([]);
                        mostrarAviso("Selección reiniciada");
                      }}
                      title="Reiniciar selección"
                    >
                      ↺ Reset
                    </button>
                  )}
                </div>

                {/* Switch Forzar polilínea cerrada */}
                <div className="panel-toggle-row">
                  <span className="toggle-label">Forzar polilínea cerrada</span>
                  <div
                    className={`toggle-switch-track ${forzarPolilineaCerrada ? "active" : ""}`}
                    onClick={() => setForzarPolilineaCerrada(!forzarPolilineaCerrada)}
                    title={forzarPolilineaCerrada ? "Cerrará el extremo final con el inicial" : "Polilínea abierta"}
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* Switch Mostrar punto medio */}
                <div className="panel-toggle-row">
                  <span className="toggle-label">Mostrar punto medio (▲)</span>
                  <div
                    className={`toggle-switch-track ${mostrarPuntoMedio ? "active" : ""}`}
                    onClick={() => {
                      setMostrarPuntoMedio(!mostrarPuntoMedio);
                      mostrarAviso(!mostrarPuntoMedio ? "▲ Puntos medios activados en pantalla" : "Puntos medios desactivados");
                    }}
                    title="Muestra los puntos medios de las líneas en pantalla"
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* Tres Botones de Acción Apilados */}
                <div className="btn-uni-stack">
                  {/* 1. UNIR EN POLILÍNEA */}
                  <button
                    type="button"
                    className={`btn-rec-confirmar ${uniSeleccionadas.length >= 2 ? "activo" : ""}`}
                    disabled={uniSeleccionadas.length < 2}
                    onClick={handleUnirEnPolilinea}
                    title={
                      uniSeleccionadas.length >= 2
                        ? "Unir entidades en polilínea continua"
                        : "Selecciona al menos 2 entidades para unir"
                    }
                  >
                    UNIR EN POLILÍNEA
                  </button>

                  {/* 2. SEPARAR POLILÍNEA */}
                  <button
                    type="button"
                    className="btn-uni-secundario"
                    disabled={!uniSeleccionadas.some((s) => s.tipo === "polilinea")}
                    onClick={handleSepararPolilinea}
                    title={
                      uniSeleccionadas.some((s) => s.tipo === "polilinea")
                        ? "Descomponer polilínea en líneas individuales"
                        : "Selecciona al menos una polilínea para separar"
                    }
                  >
                    SEPARAR POLILÍNEA
                  </button>

                  {/* 3. CREAR PUNTO EN CENTRO */}
                  <button
                    type="button"
                    className="btn-uni-secundario"
                    disabled={uniSeleccionadas.length === 0}
                    onClick={handleCrearPuntoCentro}
                    title={
                      uniSeleccionadas.length > 0
                        ? "Calcular centroide e insertar punto CAD"
                        : "Selecciona al menos una entidad para crear punto en centro"
                    }
                  >
                    CREAR PUNTO EN CENTRO
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 7: DIVIDIR (DIV - EXACTO AL MOCKUP COMPACTO)
           ========================================================================= */}
        {herramienta === "DIV" && panelDivVisible && (
          <div
            className={`cad-panel-dividir-exact ${panelDivMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelDivMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Dividir:</strong> {divEntidad ? divEntidad.nombre : "0 selec."} · N={divPartes}
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelDivMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">DIVIDIR</h2>
                    <p className="panel-solido-subtitle">Selecciona una línea y crea N referencias equidistantes.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelDivMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa y Contador */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    {divEntidad ? "1 sel" : "0 sel"}
                  </span>
                </div>

                {/* Instrucciones de Selección */}
                <p className="panel-rec-instruction">
                  Selecciona una línea; se crearán puntos SNAP equidistantes sobre ella.
                </p>

                {/* Objeto seleccionado con botón Reset */}
                {divEntidad && (
                  <div className="panel-rec-selection-row" style={{ marginTop: "-2px", marginBottom: "2px" }}>
                    <span className="panel-rec-selection-tag" title="Entidad a dividir">
                      ✂ {divEntidad.nombre}
                    </span>
                    <button
                      type="button"
                      className="btn-rec-reset"
                      onClick={() => {
                        setDivEntidad(null);
                        mostrarAviso("Selección reiniciada");
                      }}
                      title="Quitar selección"
                    >
                      ↺ Reset
                    </button>
                  </div>
                )}

                {/* Input de Número de Partes */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>Número de partes</span>
                    <span className="unit-pink">N</span>
                  </div>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    step="1"
                    value={divPartes}
                    onChange={(e) => setDivPartes(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>

                {/* Botón Principal Fucsia 'DIVIDIR' */}
                <button
                  type="button"
                  className={`btn-rec-confirmar ${divEntidad ? "activo" : ""}`}
                  disabled={!divEntidad}
                  onClick={handleEjecutarDividir}
                  style={{ width: "100%", marginTop: "6px" }}
                  title={
                    divEntidad
                      ? "Crear puntos SNAP equidistantes sobre la entidad"
                      : "Toca una línea, arco o polilínea en la escena para habilitar"
                  }
                >
                  DIVIDIR
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 8: DESFASE (OFF - EXACTO AL MOCKUP COMPACTO)
           ========================================================================= */}
        {herramienta === "OFF" && panelOffVisible && (
          <div
            className={`cad-panel-desfase-exact ${panelOffMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelOffMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>Desfase:</strong> {offEntidad ? offEntidad.nombre : "0 selec."} · {offModo} · {offDistancia}m
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelOffMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">DESFASE</h2>
                    <p className="panel-solido-subtitle">Genera curvas paralelas a una distancia fija.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelOffMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Barra de estado compacta: Capa Activa */}
                <div className="panel-sel-status-row">
                  <span className="panel-sel-capa-badge">
                    CAPA ACTIVA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}
                  </span>
                  <span className="panel-sel-counter-badge">
                    {offEntidad ? "1 sel" : "0 sel"}
                  </span>
                </div>

                {/* Texto Descriptivo */}
                <p className="panel-rec-instruction">
                  Desfase paralelo real. Selecciona una polilínea cerrada o varias piezas conectadas. Exterior/Interior conserva la silueta a distancia constante; Z duplica a otra profundidad.
                </p>

                {/* Objeto seleccionado con botón Reset */}
                {offEntidad && (
                  <div className="panel-rec-selection-row" style={{ marginTop: "-2px", marginBottom: "2px" }}>
                    <span className="panel-rec-selection-tag" title="Entidad seleccionada">
                      📏 {offEntidad.nombre}
                    </span>
                    <button
                      type="button"
                      className="btn-rec-reset"
                      onClick={() => {
                        setOffEntidad(null);
                        mostrarAviso("Selección reiniciada");
                      }}
                      title="Quitar selección"
                    >
                      ↺ Reset
                    </button>
                  </div>
                )}

                {/* Selector de Modo (4 Pills horizontales: Exterior / Izq, Interior / Der, Z matemático, Profundidad) */}
                <div className="panel-section-group compact">
                  <div
                    className="panel-pills-scroll-row"
                    style={{
                      display: "flex",
                      gap: "5px",
                      overflowX: "auto",
                      paddingBottom: "2px",
                      scrollbarWidth: "none",
                    }}
                  >
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${offModo === "exterior" ? "pill-active-purple" : ""}`}
                      onClick={() => setOffModo("exterior")}
                      style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "5px 9px" }}
                      title="Desfase hacia afuera / izquierda"
                    >
                      Exterior / Izq
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${offModo === "interior" ? "pill-active-purple" : ""}`}
                      onClick={() => setOffModo("interior")}
                      style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "5px 9px" }}
                      title="Desfase hacia adentro / derecha"
                    >
                      Interior / Der
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${offModo === "z_matematico" ? "pill-active-purple" : ""}`}
                      onClick={() => setOffModo("z_matematico")}
                      style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "5px 9px" }}
                      title="Mover en +Z matemático"
                    >
                      Z matemático
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-compact ${offModo === "profundidad" ? "pill-active-purple" : ""}`}
                      onClick={() => setOffModo("profundidad")}
                      style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "5px 9px" }}
                      title="Profundidad minera (-Z hacia dentro del macizo)"
                    >
                      Profundidad
                    </button>
                  </div>
                </div>

                {/* Input de Desfase / Profundidad */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>
                      {offModo === "profundidad"
                        ? "Profundidad"
                        : offModo === "z_matematico"
                        ? "Z matemático"
                        : "Desfase"}
                    </span>
                    <span className="unit-pink">m</span>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    value={offDistancia}
                    onChange={(e) => setOffDistancia(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>

                {/* Caja de Ayuda Contextual (Exacta a la captura para Profundidad minera) */}
                <div className="panel-linea-paso-box" style={{ padding: "8px 10px" }}>
                  <span className="paso-desc" style={{ fontSize: "11.5px", lineHeight: "1.35", color: "#94a3b8" }}>
                    {offModo === "profundidad" ? (
                      <>
                        Profundidad minera: un valor positivo mueve hacia<br />
                        dentro del macizo, es decir -Z.
                      </>
                    ) : offModo === "z_matematico" ? (
                      <>
                        Z matemático: un valor positivo mueve en dirección +Z (hacia arriba o hacia el observador).
                      </>
                    ) : (
                      <>
                        Puedes seleccionar una polilínea unida o varias líneas/arcos conectados. OFF crea la misma silueta paralela hacia afuera o hacia adentro.
                      </>
                    )}
                  </span>
                </div>

                {/* Botón Principal Fucsia 'CREAR DESFASE' */}
                <button
                  type="button"
                  className={`btn-rec-confirmar ${offEntidad ? "activo" : ""}`}
                  disabled={!offEntidad}
                  onClick={handleEjecutarDesfase}
                  style={{ width: "100%", marginTop: "4px" }}
                  title={
                    offEntidad
                      ? "Generar nueva entidad desfasada en la escena"
                      : "Toca una línea, arco o polilínea en la escena para habilitar"
                  }
                >
                  CREAR DESFASE
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 9: COTA / B (COT - EXACTO AL MOCKUP COMPACTO)
           ========================================================================= */}
        {herramienta === "COT" && panelCotVisible && (
          <div
            className={`cad-panel-cota-exact ${panelCotMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelCotMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>COTA / B:</strong> {cotModo.toUpperCase()} · {cotSeparacion}m
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelCotMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header con título, subtítulo, '< OCULTAR' y botón '−' */}
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">COTA / B</h2>
                    <p className="panel-solido-subtitle">Cotas paramétricas o guías B1–B5 / 4G para el arranque.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelCotMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Badge CAPA ACTIVA */}
                <div className="panel-solido-capa-box">
                  CAPA ACTIVA · Cotas y anotaciones ({cotasCad.length} cotas)
                </div>

                {/* Texto Descriptivo */}
                <p className="panel-rec-instruction">
                  Cota normal o guías métricas para construir el arranque desde un centro.
                </p>

                {/* Selector de Modo (Pills horizontales: Distancia, B1, B2, B3, B4, B5, 4G) */}
                <div className="panel-section-group compact">
                  <div
                    className="panel-pills-scroll-row"
                    style={{
                      display: "flex",
                      gap: "5px",
                      overflowX: "auto",
                      paddingBottom: "2px",
                      scrollbarWidth: "none",
                    }}
                  >
                    {(["distancia", "b1", "b2", "b3", "b4", "b5", "4g"] as TipoCotaCad[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`btn-pill-choice-compact ${cotModo === m ? "pill-active-purple" : ""}`}
                        onClick={() => {
                          setCotModo(m);
                          setCotPuntoInicio(null);
                          setCotCursorGuia(null);
                          if (m === "b1") {
                            setCotDistanciaB("0.18");
                            setCotCuadradoAlineado(false);
                          } else if (m === "b2") {
                            setCotDistanciaB("0.35");
                            setCotCuadradoAlineado(true);
                          } else if (m === "b3") {
                            setCotDistanciaB("0.70");
                            setCotCuadradoAlineado(false);
                          } else if (m === "b4") {
                            setCotDistanciaB("1.20");
                            setCotCuadradoAlineado(true);
                          } else if (m === "b5") {
                            setCotDistanciaB("0.50");
                            setCotCuadradoAlineado(true);
                          } else if (m === "4g") {
                            setCotDistanciaB("0.50");
                            setCotCuadradoAlineado(true);
                          }
                        }}
                        style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "5px 11px" }}
                        title={m === "distancia" ? "Cota lineal métrica" : `Guía de arranque ${m.toUpperCase()}`}
                      >
                        {m === "distancia" ? "Distancia" : m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input 1: Separación de cota */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>Separación de cota</span>
                    <span className="unit-pink">m</span>
                  </div>
                  <input
                    type="number"
                    step="0.02"
                    value={cotSeparacion}
                    onChange={(e) => setCotSeparacion(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>

                {/* Si está en modo B1-B5 / 4G: Campo de Distancia B, Switch y Botón de Generar */}
                {cotModo !== "distancia" && (
                  <>
                    {/* Input 2: Distancia B */}
                    <div className="panel-coord-box-compact">
                      <div className="panel-coord-head">
                        <span>{`Distancia ${cotModo.toUpperCase()}`}</span>
                        <span className="unit-pink">m</span>
                      </div>
                      <input
                        type="number"
                        step="0.05"
                        value={cotDistanciaB}
                        onChange={(e) => setCotDistanciaB(e.target.value)}
                        className="panel-coord-num-input-compact"
                        style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                      />
                    </div>

                    {/* Switch: Cuadrado alineado (apagado = rombo) */}
                    <div className="panel-toggle-row" style={{ marginTop: "2px", marginBottom: "2px" }}>
                      <span className="toggle-label" style={{ fontSize: "11px" }}>
                        Cuadrado alineado (apagado = rombo)
                      </span>
                      <div
                        className={`toggle-switch-track ${cotCuadradoAlineado ? "active" : ""}`}
                        onClick={() => setCotCuadradoAlineado(!cotCuadradoAlineado)}
                        title={cotCuadradoAlineado ? "Cuadrado ortogonal" : "Rombo girado 45°"}
                      >
                        <div className="toggle-switch-thumb" />
                      </div>
                    </div>

                    {/* Texto Descriptivo Exacto del Mockup */}
                    <p className="panel-rec-instruction" style={{ margin: "2px 0", fontSize: "11px", lineHeight: "1.35" }}>
                      Toca el centro y luego un taladro/referencia.<br />
                      También puedes tocar solo el centro y usar el botón de abajo con la distancia escrita.
                    </p>

                    {/* Botón Principal: GENERAR [B] DESDE CENTRO */}
                    <button
                      type="button"
                      className={`btn-rec-confirmar ${cotCentro ? "activo" : ""}`}
                      onClick={handleEjecutarGenerarB}
                      style={{ width: "100%", marginTop: "4px" }}
                      title={
                        cotCentro
                          ? `Generar cuadrante ${cotModo.toUpperCase()} en (${cotCentro.x.toFixed(2)}, ${cotCentro.y.toFixed(2)})`
                          : "Toca un punto en la escena como centro para ubicarlo con precisión"
                      }
                    >
                      {`GENERAR ${cotModo.toUpperCase()} DESDE CENTRO`}
                    </button>
                  </>
                )}

                {/* Si está en modo 'distancia': Caja informativa de pasos y botón de reset */}
                {cotModo === "distancia" && (
                  <>
                    <div className="panel-linea-paso-box" style={{ padding: "8px 10px" }}>
                      <span className="paso-desc" style={{ fontSize: "11.5px", lineHeight: "1.35", color: "#94a3b8" }}>
                        {cotPuntoInicio ? (
                          <span style={{ color: "#00f0ff" }}>
                            📍 Punto 1 fijado ({cotPuntoInicio.x.toFixed(2)}, {cotPuntoInicio.y.toFixed(2)}). Toca el punto final en la escena.
                          </span>
                        ) : (
                          "Toca el punto inicial en la escena (aplica SNAP a vértices o puntos medios ▲) para comenzar la cota."
                        )}
                      </span>
                    </div>

                    {cotPuntoInicio && (
                      <button
                        type="button"
                        className="btn-rec-reset"
                        onClick={() => {
                          setCotPuntoInicio(null);
                          setCotCursorGuia(null);
                          mostrarAviso("Punto inicial cancelado");
                        }}
                        style={{ width: "100%", height: "30px", fontSize: "11.5px", marginTop: "4px" }}
                      >
                        ↺ Cancelar Punto 1
                      </button>
                    )}
                  </>
                )}

                {/* Botón de Borrar última cota si existen cotas */}
                {cotasCad.length > 0 && (
                  <button
                    type="button"
                    className="btn-rec-reset"
                    onClick={() => {
                      registrarHistorial();
                      setCotasCad((prev) => prev.slice(0, -1));
                      mostrarAviso("Última cota eliminada");
                    }}
                    style={{ width: "100%", height: "28px", fontSize: "11px", marginTop: "4px" }}
                    title="Eliminar la última cota dibujada"
                  >
                    ✕ Borrar última cota
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 11: TALADRO (TAL) - INSERCIÓN POR GRUPO CON LOOK-OUT Y COLOR
           ========================================================================= */}
        {herramienta === "TAL" && panelTalVisible && (
          <div
            className={`cad-panel-taladro-exact ${panelTalMinimizado ? "panel-comprimido" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {panelTalMinimizado ? (
              <div className="panel-mini-strip">
                <div className="mini-coords-info">
                  <strong>TAL:</strong> {GRUPOS_TALADRO_CONFIG.find((g) => g.id === talGrupo)?.label || talGrupo} · Ø{(parseFloat(talRadioMm) * 2 || 0).toFixed(0)}mm · L{talLongitudM}m
                </div>
                <div className="mini-actions">
                  <button type="button" className="btn-mini-expand" onClick={() => setPanelTalMinimizado(false)}>
                    ⤢ Expandir
                  </button>
                  <button type="button" className="btn-header-round-close" onClick={cerrarPanelYPasarASeleccion}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="panel-solido-header">
                  <div className="panel-solido-title-col">
                    <h2 className="panel-solido-title">TALADRO</h2>
                    <p className="panel-solido-subtitle">
                      Inserta taladros por grupo usando la configuración activa.
                    </p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelTalMinimizado(true)}
                      title="Minimizar panel (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={cerrarPanelYPasarASeleccion}
                      title="Cerrar panel y seleccionar directo (✕)"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Badge CAPA ACTIVA */}
                <div className="panel-solido-capa-box">
                  CAPA ACTIVA · Taladros manuales
                </div>
                {/* 1. Selector de Grupo de taladro con scroll horizontal fluido y todos los 7 grupos */}
                <div style={{ marginTop: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", marginBottom: "4px" }}>
                    Grupo de taladro
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      overflowX: "auto",
                      paddingBottom: "3px",
                      scrollbarWidth: "none",
                    }}
                  >
                    {GRUPOS_TALADRO_CONFIG.map((g) => {
                      const activo = talGrupo === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          className={`btn-pill-choice-compact ${activo ? "pill-active-purple" : ""}`}
                          onClick={() => {
                            setTalGrupo(g.id);
                            setTalRadioMm(g.radioMmDefecto);
                            setTalLongitudM(g.longitudMDefecto);
                            setTalLookOutDeg(g.lookOutDefecto);
                            setTalGradientePct(g.gradienteDefecto);
                            setTalColor(g.colorDefecto);
                            setTalCargado(g.cargadoDefecto);
                          }}
                          style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "5px 11px", fontSize: "11.5px" }}
                          title={`Grupo ${g.label}`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Radio del taladro (mm) */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>Radio del taladro</span>
                    <span className="unit-pink">mm</span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={talRadioMm}
                    onChange={(e) => setTalRadioMm(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>
                <span style={{ fontSize: "10.5px", color: "#64748b", marginTop: "-3px" }}>
                  Diámetro resultante: {(parseFloat(talRadioMm) * 2 || 0).toFixed(0)} mm
                </span>

                {/* 3. Longitud de barreno (m) */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>Longitud de barreno</span>
                    <span className="unit-pink">m</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={talLongitudM}
                    onChange={(e) => setTalLongitudM(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>

                {/* 4. Look-out horizontal (°) */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>Look-out horizontal</span>
                    <span className="unit-pink">°</span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={talLookOutDeg}
                    onChange={(e) => setTalLookOutDeg(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>

                {/* 5. Gradiente vertical (%) */}
                <div className="panel-coord-box-compact">
                  <div className="panel-coord-head">
                    <span>Gradiente vertical</span>
                    <span className="unit-pink">%</span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={talGradientePct}
                    onChange={(e) => setTalGradientePct(e.target.value)}
                    className="panel-coord-num-input-compact"
                    style={{ fontSize: "16px", fontWeight: "800", textAlign: "left", paddingLeft: "10px" }}
                  />
                </div>
                <span style={{ fontSize: "10.5px", color: "#64748b", marginTop: "-3px", lineHeight: "1.3" }}>
                  0° / 0% = paralelo. El barreno guarda COLLAR + TOE reales; la longitud 3D se conserva.
                </span>

                {/* 6. Color (Paleta de 7 colores exacta) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>Color</span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    {["#ec4899", "#00f0ff", "#10b981", "#f59e0b", "#8b5cf6", "#f97316", "#eab308"].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setTalColor(col)}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          backgroundColor: col,
                          border: talColor === col ? "2.5px solid #ffffff" : "1.5px solid rgba(255,255,255,0.2)",
                          cursor: "pointer",
                          boxShadow: talColor === col ? "0 0 10px " + col : "none",
                          transition: "all 0.15s ease",
                        }}
                        title={`Elegir color ${col}`}
                      />
                    ))}
                  </div>
                </div>

                {/* 7. Toggle switch: Taladro cargado */}
                <div className="panel-toggle-row" style={{ marginTop: "3px" }}>
                  <span className="toggle-label" style={{ fontSize: "11px" }}>
                    Taladro cargado
                  </span>
                  <div
                    className={`toggle-switch-track ${talCargado ? "active" : ""}`}
                    onClick={() => setTalCargado(!talCargado)}
                    title={talCargado ? "Taladro cargado con explosivo" : "Taladro vacío (alivio)"}
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>

                {/* 8. Copiar configuración de */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>
                    Copiar configuración de
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      overflowX: "auto",
                      paddingBottom: "3px",
                      scrollbarWidth: "none",
                    }}
                  >
                    {GRUPOS_TALADRO_CONFIG.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className="btn-pill-choice-compact"
                        onClick={() => {
                          setTalRadioMm(g.radioMmDefecto);
                          setTalLongitudM(g.longitudMDefecto);
                          setTalLookOutDeg(g.lookOutDefecto);
                          setTalGradientePct(g.gradienteDefecto);
                          setTalColor(g.colorDefecto);
                          setTalCargado(g.cargadoDefecto);
                          mostrarAviso(`Configuración copiada de ${g.label}`);
                        }}
                        style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "4px 8px", fontSize: "10.5px" }}
                        title={`Copiar configuración de ${g.label}`}
                      >
                        {g.abrev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 9. Caja informativa / paso */}
                <div className="panel-linea-paso-box" style={{ padding: "8px 10px", marginTop: "3px" }}>
                  <span className="paso-desc" style={{ fontSize: "11px", lineHeight: "1.35", color: "#94a3b8" }}>
                    Cada toque inserta un {GRUPOS_TALADRO_CONFIG.find((g) => g.id === talGrupo)?.label.toLowerCase()} en el SNAP seleccionado.
                  </span>
                </div>

                {/* 10. Botón de borrado/deshacer de taladros si existen */}
                {taladros.length > 0 && (
                  <button
                    type="button"
                    className="btn-rec-reset"
                    onClick={() => {
                      registrarHistorial();
                      if (onCambiarTaladros) {
                        onCambiarTaladros(taladros.slice(0, -1));
                      }
                      mostrarAviso("Último taladro eliminado");
                    }}
                    style={{ width: "100%", height: "28px", fontSize: "11px", marginTop: "4px" }}
                    title="Eliminar el último taladro insertado"
                  >
                    ✕ Borrar último taladro ({taladros.length})
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Barra Inferior de Escena */}
      <div className="cad-bottom-scene-exact">
        <div className="scene-exact-left" onClick={() => setPanelCapasVisible(!panelCapasVisible)} style={{ cursor: "pointer" }}>
          <div className="scene-cyan-diamond">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#06b6d4" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="scene-exact-titles">
            <strong>ESCENA</strong>
            <span>Activa · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}</span>
          </div>
        </div>

        <div className="scene-exact-tools">
          <button type="button" className="btn-scene-exact-tool" onClick={() => setPanelCapasVisible(!panelCapasVisible)} title="Ver Árbol de Capas AutoCAD">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#38bdf8" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
          <button type="button" className="btn-scene-exact-tool" onClick={handleCrearRectangulo} title="Banco rectangular">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22c55e" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button type="button" className="btn-scene-exact-tool" onClick={() => mostrarAviso(`Perímetro: ${perimetro.toFixed(1)}m`)} title="Medir">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#e11d48" strokeWidth="2.5">
              <path d="M19 5L5 19" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="19" cy="5" r="2" />
            </svg>
          </button>
          <button type="button" className="btn-scene-exact-tool" onClick={onVolver} title="Colapsar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* 4. Barra de Pestañas Inferior (Dibujo | Render | +) */}
      <footer className="cad-bottom-tabs-exact">
        <div className="cad-tabs-group-exact">
          <button type="button" className="cad-tab-pill-exact tab-active-pink">
            Dibujo
          </button>
          <button type="button" className="cad-tab-pill-exact" onClick={onIrARender}>
            Render
          </button>
        </div>

        <button type="button" className="btn-cad-plus-exact" onClick={() => mostrarAviso("Nueva escena CAD creada")} title="Agregar escena">
          +
        </button>
      </footer>
    </div>
  );
}
