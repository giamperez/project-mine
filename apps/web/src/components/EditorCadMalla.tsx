import React, { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  areaPoligono_m2,
  longitudPoligono_m,
  snapAGrilla,
  type Punto2D,
  type Taladro,
} from "@suite/core";
import { descargarTexto } from "../utils/descargar.js";

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
  | "SOL";

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
  const [herramienta, setHerramienta] = useState<HerramientaCad>("SEL");
  const [bloqueadoGlobal, setBloqueadoGlobal] = useState(false);
  const [snapActivo, setSnapActivo] = useState(true);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Sistema de Coordenadas (con menú desplegable y jalar de archivo)
  const [sistemaCoords, setSistemaCoords] = useState<SistemaCoordenadas>("local");
  const BASE_UTM_E = 432000;
  const BASE_UTM_N = 8765000;

  // Estado del Panel 'SELECCIONAR' (cerrado por defecto)
  const [panelSelVisible, setPanelSelVisible] = useState(false);
  const [panelSelMinimizado, setPanelSelMinimizado] = useState(false);
  const [indicesSeleccionados, setIndicesSeleccionados] = useState<number[]>([]);
  const [puntosCad, setPuntosCad] = useState<PuntoCad3D[]>([]);
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<string[]>([]);

  // Inputs de desplazamiento ΔX, ΔY, ΔZ
  const [deltaX, setDeltaX] = useState("0");
  const [deltaY, setDeltaY] = useState("0");
  const [deltaZ, setDeltaZ] = useState("0");

  // Mover a Coordenadas Absolutas Asignadas (X, Y, Z) y Punto Base de Referencia
  const [moverX, setMoverX] = useState("0");
  const [moverY, setMoverY] = useState("0");
  const [moverZ, setMoverZ] = useState("0");
  const [puntoBaseIndice, setPuntoBaseIndice] = useState<number>(0);
  const [esperandoPuntoBase, setEsperandoPuntoBase] = useState(false);
  const prevSeleccionKeyRef = useRef("");

  // Estado del Panel 'PUNTO' (Exacto a la captura del usuario)
  const [panelPtoVisible, setPanelPtoVisible] = useState(false);
  const [panelPtoMinimizado, setPanelPtoMinimizado] = useState(false);
  const [ptoX, setPtoX] = useState("0");
  const [ptoY, setPtoY] = useState("0");
  const [ptoZ, setPtoZ] = useState("0");
  const [tipoPunto, setTipoPunto] = useState<TipoPuntoCad>("cruz_x");

  // Estado del Panel 'LÍNEA'
  const [panelLinVisible, setPanelLinVisible] = useState(false);
  const [panelLinMinimizado, setPanelLinMinimizado] = useState(false);
  const [tipoLinea, setTipoLinea] = useState<TipoLinea>("continua");
  const [rolIngenieria, setRolIngenieria] = useState<RolIngenieria>("geometria");
  const [distanciaLinea, setDistanciaLinea] = useState("10");
  const [azimutLinea, setAzimutLinea] = useState("0");
  const [lineasCad, setLineasCad] = useState<LineaCad3D[]>([]);
  const [lineasSeleccionadas, setLineasSeleccionadas] = useState<string[]>([]);
  const [inicioLinea, setInicioLinea] = useState<{ x: number; y: number; z: number } | null>(null);
  const [cursorGuiaLinea, setCursorGuiaLinea] = useState<{ x: number; y: number; z: number } | null>(null);

  // Estado del Panel 'POLILÍNEA'
  const [panelPlVisible, setPanelPlVisible] = useState(false);
  const [panelPlMinimizado, setPanelPlMinimizado] = useState(false);
  const [cerrarPolilinea, setCerrarPolilinea] = useState(false);
  const [verticesPolilinea, setVerticesPolilinea] = useState<{ x: number; y: number; z: number }[]>([]);
  const [cursorGuiaPl, setCursorGuiaPl] = useState<{ x: number; y: number; z: number } | null>(null);
  const [polilineasCad, setPolilineasCad] = useState<PolilineaCad3D[]>([]);
  const [polilineasSeleccionadas, setPolilineasSeleccionadas] = useState<string[]>([]);

  // Estado del Panel 'ARCO'
  const [panelArcVisible, setPanelArcVisible] = useState(false);
  const [panelArcMinimizado, setPanelArcMinimizado] = useState(false);
  const [metodoArco, setMetodoArco] = useState<MetodoArco>("inicio_fin_r");
  const [radioArco, setRadioArco] = useState("10.0");
  const [anguloInicioArco, setAnguloInicioArco] = useState("0");
  const [anguloFinArco, setAnguloFinArco] = useState("180");
  const [centroIzquierdaArco, setCentroIzquierdaArco] = useState(true);
  const [puntosArcoConstruccion, setPuntosArcoConstruccion] = useState<{ x: number; y: number; z: number }[]>([]);
  const [cursorGuiaArc, setCursorGuiaArc] = useState<{ x: number; y: number; z: number } | null>(null);
  const [arcosCad, setArcosCad] = useState<ArcoCad3D[]>([]);
  const [arcosSeleccionados, setArcosSeleccionados] = useState<string[]>([]);

  // Estado del Gestor de Capas y Carpetas (Estilo AutoCAD / Civil 3D)
  const [panelCapasVisible, setPanelCapasVisible] = useState(false);
  const [panelCapasMinimizado, setPanelCapasMinimizado] = useState(false);
  const [capaActivaId, setCapaActivaId] = useState("capa-cresta");

  const [carpetas, setCarpetas] = useState<CarpetaCad[]>([
    { id: "carp-malla", nombre: "Malla de Perforación", abierta: true, visible: true },
    { id: "carp-topo", nombre: "Topografía y Geometría", abierta: true, visible: true },
  ]);

  const [capas, setCapas] = useState<CapaCad[]>([
    {
      id: "capa-cresta",
      nombre: "Cresta del Banco",
      color: "#10b981",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: 4,
    },
    {
      id: "capa-taladros",
      nombre: "Taladros de Producción",
      color: "#f97316",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-malla",
      elementosCount: taladros.length,
    },
    {
      id: "capa-lineas",
      nombre: "Líneas de Eje / Guías",
      color: "#818cf8",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-topo",
      elementosCount: 0,
    },
    {
      id: "capa-puntos",
      nombre: "Puntos de Control",
      color: "#06b6d4",
      visible: true,
      bloqueada: false,
      carpetaId: "carp-topo",
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

    const gridHelper = new THREE.GridHelper(500, 100, 0x1f304d, 0x131c2c);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

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

    // 2. Taladros en 3D
    if (capaTaladros?.visible) {
      taladros.forEach((t) => {
        const drillGeo = new THREE.CylinderGeometry(0.12, 0.12, 5, 8);
        const drillMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(capaTaladros.color).getHex(),
          wireframe: true,
          transparent: true,
          opacity: 0.8,
        });
        const drillMesh = new THREE.Mesh(drillGeo, drillMat);
        drillMesh.position.set(t.collar.x, -2.5, t.collar.y);
        group.add(drillMesh);

        const ringGeo = new THREE.TorusGeometry(0.25, 0.06, 6, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(capaTaladros.color).getHex() });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(t.collar.x, 0.05, t.collar.y);
        group.add(ring);
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
  }, [
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
      const pMundo = obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        setCursorGuiaLinea({ x: pMundo.x, y: pMundo.y, z: 0 });
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
      const pMundo = obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        setCursorGuiaPl({ x: pMundo.x, y: pMundo.y, z: 0 });
      }
    }

    // Si la herramienta ARCO tiene puntos fijados, actualizar la guía interactiva hacia el cursor
    if (herramienta === "ARC" && puntosArcoConstruccion.length > 0 && !orbitRef.current.isDragging) {
      const pMundo = obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        setCursorGuiaArc({ x: pMundo.x, y: pMundo.y, z: 0 });
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
      let pt: Punto2D = { x: Math.round(target.x * 10) / 10, y: Math.round(target.z * 10) / 10 };
      if (snapActivo) pt = snapAGrilla(pt, 1);
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

  function distPuntoASegmento2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hacerRaycastSeleccion(clientX: number, clientY: number) {
    const ptoCadId = verificarToquePuntoCad(clientX, clientY);
    if (ptoCadId !== null) {
      setPuntosSeleccionados([ptoCadId]);
      setIndicesSeleccionados([]);
      setLineasSeleccionadas([]);
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
  }

  function raycastPunto(clientX: number, clientY: number) {
    const pt = obtenerCoordenadasPlano(clientX, clientY);
    if (pt) {
      setPtoX(pt.x.toString());
      setPtoY(pt.y.toString());
      setPtoZ("0");

      registrarHistorial();
      const nuevoPunto: PuntoCad3D = {
        id: `pto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        x: pt.x,
        y: pt.y,
        z: 0,
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

      mostrarAviso(`Punto normal SNAP (${pt.x}, ${pt.y}, 0) insertado`);

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
    // Buscar SNAP prioritario a vértice de polígono o punto CAD
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
                    if (h === "SEL") setPanelSelVisible((prev) => !prev);
                    else if (h === "PTO") setPanelPtoVisible((prev) => !prev);
                    else if (h === "LIN") setPanelLinVisible((prev) => !prev);
                    else if (h === "PL") setPanelPlVisible((prev) => !prev);
                    else if (h === "ARC") setPanelArcVisible((prev) => !prev);
                  } else {
                    setHerramienta(h);
                    setPanelSelVisible(h === "SEL");
                    setPanelLinVisible(h === "LIN");
                    setPanelPtoVisible(h === "PTO");
                    setPanelPlVisible(h === "PL");
                    setPanelArcVisible(h === "ARC");
                  }
                  if (h === "REC") handleCrearRectangulo();
                  if (h === "SOL") onIrARender();
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
            <span>Listo para dibujar</span>
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
                {/* Header compacto con botón '−' para minimizar y '✕' para cerrar */}
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>SELECCIONAR</h2>
                    <p>Toca para seleccionar · Arrastra libre</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelSelMinimizado(true)}
                      title="Minimizar panel"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={() => setPanelSelVisible(false)}
                      title="Cerrar panel"
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
                  <button type="button" className="btn-header-round-close" onClick={() => setPanelLinVisible(false)}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header compacto con botón '−' para minimizar y '✕' para cerrar */}
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>LÍNEA</h2>
                    <p>Toca inicio y final en pantalla</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelLinMinimizado(true)}
                      title="Minimizar panel"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={() => setPanelLinVisible(false)}
                      title="Cerrar panel"
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
                  <button type="button" className="btn-header-round-close" onClick={() => setPanelPlVisible(false)}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header compacto con botón '−' para minimizar y '✕' para cerrar */}
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>POLILÍNEA</h2>
                    <p>Toca vértices sucesivos y cierra cuando corresponda.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelPlMinimizado(true)}
                      title="Minimizar panel"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={() => setPanelPlVisible(false)}
                      title="Cerrar panel"
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
                  <button type="button" className="btn-header-round-close" onClick={() => setPanelArcVisible(false)}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header compacto con botón '−' para minimizar y '✕' para cerrar */}
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>ARCO</h2>
                    <p>Inicio/fin + radio, centro/radio o tres puntos.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelArcMinimizado(true)}
                      title="Minimizar panel"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={() => setPanelArcVisible(false)}
                      title="Cerrar panel"
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
                  <button type="button" className="btn-header-round-close" onClick={() => setPanelPtoVisible(false)}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header compacto con botón '−' para minimizar y '✕' para cerrar */}
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>PUNTO</h2>
                    <p>Toca en pantalla o ingresa XYZ</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button
                      type="button"
                      className="btn-header-round-min"
                      onClick={() => setPanelPtoMinimizado(true)}
                      title="Minimizar panel"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="btn-header-round-close"
                      onClick={() => setPanelPtoVisible(false)}
                      title="Cerrar panel"
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
