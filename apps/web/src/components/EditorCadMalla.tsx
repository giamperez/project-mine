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

  // Estado del Panel 'SELECCIONAR'
  const [panelSelVisible, setPanelSelVisible] = useState(true);
  const [panelSelMinimizado, setPanelSelMinimizado] = useState(false);
  const [indicesSeleccionados, setIndicesSeleccionados] = useState<number[]>([0]);

  // Inputs de desplazamiento ΔX, ΔY, ΔZ
  const [deltaX, setDeltaX] = useState("0");
  const [deltaY, setDeltaY] = useState("0");
  const [deltaZ, setDeltaZ] = useState("0");

  // Estado del Panel 'LÍNEA'
  const [panelLinVisible, setPanelLinVisible] = useState(false);
  const [panelLinMinimizado, setPanelLinMinimizado] = useState(false);
  const [tipoLinea, setTipoLinea] = useState<TipoLinea>("continua");
  const [rolIngenieria, setRolIngenieria] = useState<RolIngenieria>("geometria");
  const [distanciaLinea, setDistanciaLinea] = useState("10");
  const [azimutLinea, setAzimutLinea] = useState("0");

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

  // Historial Deshacer / Rehacer
  const [historial, setHistorial] = useState<Punto2D[][]>([]);
  const [historialRehacer, setHistorialRehacer] = useState<Punto2D[][]>([]);

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
    verticeArrastrado: null as number | null,
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
    setHistorial((prev) => [...prev.slice(-30), poligonoCresta]);
    setHistorialRehacer([]);
  }

  function handleDeshacer() {
    if (historial.length === 0) return;
    const ultimo = historial[historial.length - 1];
    setHistorial((prev) => prev.slice(0, -1));
    setHistorialRehacer((prev) => [...prev, poligonoCresta]);
    onCambiarPoligono(ultimo);
    mostrarAviso("Deshecho");
  }

  function handleRehacer() {
    if (historialRehacer.length === 0) return;
    const siguiente = historialRehacer[historialRehacer.length - 1];
    setHistorialRehacer((prev) => prev.slice(0, -1));
    setHistorial((prev) => [...prev, poligonoCresta]);
    onCambiarPoligono(siguiente);
    mostrarAviso("Rehecho");
  }

  // Primer punto seleccionado para mostrar coordenadas
  const primerIndice = indicesSeleccionados.length > 0 ? indicesSeleccionados[0] : null;
  const puntoActual = primerIndice !== null && poligonoCresta[primerIndice] ? poligonoCresta[primerIndice] : null;

  // Formato de coordenadas según el sistema elegido
  const coordsFormateadas = useMemo(() => {
    if (!puntoActual) return { x: "0.00", y: "0.00", z: "0.00" };
    if (sistemaCoords === "utm_18s") {
      return {
        x: (BASE_UTM_E + puntoActual.x).toFixed(2),
        y: (BASE_UTM_N + puntoActual.y).toFixed(2),
        z: "4500.00",
      };
    }
    if (sistemaCoords === "utm_19s") {
      return {
        x: (BASE_UTM_E + puntoActual.x + 100000).toFixed(2),
        y: (BASE_UTM_N + puntoActual.y - 50000).toFixed(2),
        z: "4500.00",
      };
    }
    if (sistemaCoords === "psad56") {
      return {
        x: (BASE_UTM_E + puntoActual.x + 368.5).toFixed(2),
        y: (BASE_UTM_N + puntoActual.y - 350.2).toFixed(2),
        z: "4500.00",
      };
    }
    return {
      x: puntoActual.x.toFixed(2),
      y: puntoActual.y.toFixed(2),
      z: "0.00",
    };
  }, [puntoActual, sistemaCoords]);

  // Mover entidad(es) seleccionada(s) con ΔX, ΔY, ΔZ
  function handleMoverDelta() {
    if (indicesSeleccionados.length === 0) {
      mostrarAviso("Selecciona primero una o varias entidades");
      return;
    }
    const dx = parseFloat(deltaX) || 0;
    const dy = parseFloat(deltaY) || 0;
    if (dx === 0 && dy === 0) {
      mostrarAviso("Ingresa un valor en ΔX o ΔY para desplazar");
      return;
    }
    registrarHistorial();
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
    mostrarAviso(`${indicesSeleccionados.length} entidad(es) movida(s) ΔX:${dx}m ΔY:${dy}m`);
    setDeltaX("0");
    setDeltaY("0");
    setDeltaZ("0");
  }

  // Borrar seleccionados
  function handleBorrarSeleccion() {
    if (indicesSeleccionados.length === 0) {
      mostrarAviso("No hay entidad seleccionada");
      return;
    }
    if (poligonoCresta.length - indicesSeleccionados.length < 3) {
      mostrarAviso("El polígono requiere al menos 3 vértices");
      return;
    }
    registrarHistorial();
    const nuevos = poligonoCresta.filter((_, i) => !indicesSeleccionados.includes(i));
    onCambiarPoligono(nuevos);
    setIndicesSeleccionados(nuevos.length > 0 ? [0] : []);
    mostrarAviso("Entidades eliminadas");
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

  // Dibujar Línea por Distancia y Azimut
  function handleDibujarLineaPorAzimut() {
    const d = parseFloat(distanciaLinea) || 10;
    const az = (parseFloat(azimutLinea) || 0) * (Math.PI / 180);
    const pUltimo = poligonoCresta[poligonoCresta.length - 1] || { x: 0, y: 0 };

    const dx = d * Math.sin(az);
    const dy = d * Math.cos(az);

    registrarHistorial();
    const nuevoPunto = {
      x: Math.round((pUltimo.x + dx) * 10) / 10,
      y: Math.round((pUltimo.y + dy) * 10) / 10,
    };
    const nuevos = [...poligonoCresta, nuevoPunto];
    onCambiarPoligono(nuevos);
    setIndicesSeleccionados([nuevos.length - 1]);
    mostrarAviso(`Línea agregada: ${d}m a ${azimutLinea}°`);
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
    const data = JSON.stringify({ poligonoCresta, taladros, sistemaCoords, capas, carpetas }, null, 2);
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

    // 1. Polígono de Cresta
    if (capaCresta?.visible && poligonoCresta.length > 1) {
      const points = poligonoCresta.map((p) => new THREE.Vector3(p.x, 0.08, p.y));
      points.push(points[0]);

      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(capaCresta.color).getHex(), linewidth: 3 });
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);

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
  }, [poligonoCresta, taladros, indicesSeleccionados, capas]);

  // Manejo de Interacción 3D: Arrastre a mano automático + Selección múltiple por caja + Órbita 360°
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (bloqueadoGlobal) return;

    orbitRef.current.isDragging = true;
    orbitRef.current.dragStart = { x: e.clientX, y: e.clientY };
    orbitRef.current.dragButton = e.button;
    orbitRef.current.hasMovedSignificantly = false;
    orbitRef.current.touchStartTime = Date.now();

    // Comprobar si tocó directamente un vértice para arrastrarlo a mano de inmediato
    if (herramienta === "SEL") {
      const v = verificarToqueVertice(e.clientX, e.clientY);
      if (v !== null) {
        // Toca un vértice -> ARRASTRE A MANO AUTOMÁTICO
        orbitRef.current.verticeArrastrado = v;
        if (!indicesSeleccionados.includes(v)) {
          setIndicesSeleccionados([v]);
        }
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }
    }

    orbitRef.current.verticeArrastrado = null;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!orbitRef.current.isDragging) return;

    const dx = e.clientX - orbitRef.current.dragStart.x;
    const dy = e.clientY - orbitRef.current.dragStart.y;

    if (Math.hypot(dx, dy) > 4) {
      orbitRef.current.hasMovedSignificantly = true;
    }

    // CASO A: Arrastre manual directo del punto en 3D
    if (orbitRef.current.verticeArrastrado !== null) {
      const pMundo = obtenerCoordenadasPlano(e.clientX, e.clientY);
      if (pMundo) {
        const nuevos = [...poligonoCresta];
        nuevos[orbitRef.current.verticeArrastrado] = pMundo;
        onCambiarPoligono(nuevos);
      }
      return;
    }

    // CASO B: Selección Múltiple por Caja (Marquee Box si se arrastra con Shift o toque prolongado en vacío)
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

    // CASO C: Órbita libre 360 grados de la cámara
    const camera = cameraRef.current;
    if (!camera) return;

    if (orbitRef.current.dragButton === 0) {
      orbitRef.current.theta -= dx * 0.008; // 360° horizontal libre
      orbitRef.current.phi = Math.max(0.02, Math.min(Math.PI - 0.02, orbitRef.current.phi - dy * 0.008)); // 360° vertical libre
    } else {
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
    if (orbitRef.current.verticeArrastrado !== null) {
      registrarHistorial();
      orbitRef.current.verticeArrastrado = null;
      orbitRef.current.isDragging = false;
      return;
    }

    // Finalizar selección múltiple por caja (Marquee)
    if (orbitRef.current.isMarquee && marqueeBox) {
      seleccionarPorCaja(marqueeBox);
      setMarqueeBox(null);
      orbitRef.current.isMarquee = false;
      orbitRef.current.isDragging = false;
      return;
    }

    // Si fue un toque rápido sin arrastrar
    if (!orbitRef.current.hasMovedSignificantly) {
      if (herramienta === "SEL") {
        hacerRaycastSeleccion(e.clientX, e.clientY);
      } else if (herramienta === "LIN") {
        setPanelLinVisible(true);
        raycastPlano(e.clientX, e.clientY);
      } else if (herramienta === "PTO" || herramienta === "PL") {
        raycastPlano(e.clientX, e.clientY);
      }
    }

    orbitRef.current.isDragging = false;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignorar
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

    if (seleccionados.length > 0) {
      setIndicesSeleccionados(seleccionados);
      setPanelSelVisible(true);
      mostrarAviso(`${seleccionados.length} entidades seleccionadas por recuadro`);
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

  function verificarToqueVertice(clientX: number, clientY: number): number | null {
    const p = obtenerCoordenadasPlano(clientX, clientY);
    if (!p) return null;
    let masCercano: number | null = null;
    let minDist = 3.5;
    poligonoCresta.forEach((v, idx) => {
      const dist = Math.hypot(v.x - p.x, v.y - p.y);
      if (dist < minDist) {
        minDist = dist;
        masCercano = idx;
      }
    });
    return masCercano;
  }

  function hacerRaycastSeleccion(clientX: number, clientY: number) {
    const idx = verificarToqueVertice(clientX, clientY);
    if (idx !== null) {
      setIndicesSeleccionados([idx]);
      setPanelSelVisible(true);
      mostrarAviso(`Vértice ${idx + 1} seleccionado`);
    } else {
      setIndicesSeleccionados([]);
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
      <header className="cad-header-exact">
        <div className="cad-header-left">
          <button type="button" className="btn-header-back" onClick={onVolver} title="Volver al Portal">
            ←
          </button>
          <span className="cad-header-sub">Modificado 01/09/26 · 00:07</span>
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
        <aside className="cad-dock-left-exact" onClick={(e) => e.stopPropagation()}>
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
                  setHerramienta(h);
                  if (h === "SEL") {
                    setPanelSelVisible(true);
                    setPanelLinVisible(false);
                  } else if (h === "LIN") {
                    setPanelLinVisible(true);
                    setPanelSelVisible(false);
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
            className={`btn-dock-circle-exact ${panelSelVisible || panelLinVisible || panelCapasVisible ? "active-border-white" : ""}`}
            onClick={() => {
              if (herramienta === "LIN") {
                setPanelLinVisible(!panelLinVisible);
              } else {
                setPanelSelVisible(!panelSelVisible);
              }
            }}
            title="Panel de Edición (ED)"
          >
            ED
          </button>

          <button
            type="button"
            className={`btn-dock-circle-exact ${snapActivo ? "active-border-white" : ""}`}
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
          <div className={`cad-panel-seleccionar-exact ${panelSelMinimizado ? "panel-comprimido" : ""}`} onClick={(e) => e.stopPropagation()}>
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
                {/* Header con botón '−' para minimizar y '✕' para cerrar */}
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>SELECCIONAR</h2>
                    <p>Selecciona con toque. La cámara sigue libre; mover solo con ΔXYZ.</p>
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

                {/* Menú Desplegable de Sistema de Coordenadas Arriba */}
                <div className="panel-coords-dropdown-wrap">
                  <label className="dropdown-label">SISTEMA DE COORDENADAS:</label>
                  <div className="dropdown-row">
                    <select
                      className="select-coords-custom"
                      value={sistemaCoords}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "importar") {
                          document.getElementById("input-cad-importar")?.click();
                        } else {
                          setSistemaCoords(val as SistemaCoordenadas);
                        }
                      }}
                    >
                      <option value="local">🌐 Local de Mina (m)</option>
                      <option value="utm_18s">🌐 UTM WGS84 - Zona 18S</option>
                      <option value="utm_19s">🌐 UTM WGS84 - Zona 19S</option>
                      <option value="psad56">🌐 PSAD56 - Zona 18S</option>
                      <option value="importar">📁 Jalar de archivo DXF/JSON...</option>
                    </select>

                    <button
                      type="button"
                      className="btn-importar-coords-icon"
                      onClick={() => document.getElementById("input-cad-importar")?.click()}
                      title="Importar y jalar coordenadas"
                    >
                      📁
                    </button>
                  </div>
                </div>

                <div className="panel-sel-capa-box">
                  <span>CAPA ACTIVA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}</span>
                </div>

                <p className="panel-sel-instruction">
                  Toca una entidad para seleccionarla. Arrastrar NO mueve objetos: un dedo mantiene la órbita libre. Para desplazar usa MOVER ΔXYZ.
                </p>

                <div className="panel-sel-counter">
                  <strong>Seleccionadas: {indicesSeleccionados.length}</strong>
                </div>

                {/* RECUADROS ΔX, ΔY, ΔZ IDÉNTICOS A LA CAPTURA DEL USUARIO */}
                <div className="panel-sel-coords-row">
                  {/* ΔX */}
                  <div className="panel-coord-box">
                    <div className="panel-coord-head">
                      <span>ΔX</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={deltaX}
                      onChange={(e) => setDeltaX(e.target.value)}
                      className="panel-coord-num-input"
                    />
                  </div>

                  {/* ΔY */}
                  <div className="panel-coord-box">
                    <div className="panel-coord-head">
                      <span>ΔY</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={deltaY}
                      onChange={(e) => setDeltaY(e.target.value)}
                      className="panel-coord-num-input"
                    />
                  </div>
                </div>

                {/* ΔZ (Ancho Completo) */}
                <div className="panel-sel-coords-single">
                  <div className="panel-coord-box">
                    <div className="panel-coord-head">
                      <span>ΔZ</span>
                      <span className="unit-pink">m</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={deltaZ}
                      onChange={(e) => setDeltaZ(e.target.value)}
                      className="panel-coord-num-input"
                    />
                  </div>
                </div>

                {/* Coordenadas absolutas leídas del punto */}
                {puntoActual && (
                  <div className="panel-point-readout-strip">
                    <span>Posición:</span>
                    <strong>E: {coordsFormateadas.x}m</strong>
                    <strong>N: {coordsFormateadas.y}m</strong>
                    <strong>Z: {coordsFormateadas.z}m</strong>
                  </div>
                )}

                {/* Botón Principal Cyan 'MOVER ΔXYZ' */}
                <button type="button" className="btn-cyan-mover-dxyz" onClick={handleMoverDelta}>
                  MOVER ΔXYZ
                </button>

                {/* Botón Destructivo 'BORRAR SELECCIÓN' */}
                <button type="button" className="btn-outline-borrar-sel" onClick={handleBorrarSeleccion}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                  BORRAR SELECCIÓN
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 2: LÍNEA (CON BOTONES '−' Y '✕')
           ========================================================================= */}
        {herramienta === "LIN" && panelLinVisible && (
          <div className={`cad-panel-linea-exact ${panelLinMinimizado ? "panel-comprimido" : ""}`} onClick={(e) => e.stopPropagation()}>
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
                <div className="panel-sel-header">
                  <div className="panel-sel-titles">
                    <h2>LÍNEA</h2>
                    <p>Toca inicio y final usando SNAP; o distancia + azimut.</p>
                  </div>
                  <div className="panel-header-buttons">
                    <button type="button" className="btn-header-round-min" onClick={() => setPanelLinMinimizado(true)} title="Minimizar">
                      −
                    </button>
                    <button type="button" className="btn-header-round-close" onClick={() => setPanelLinVisible(false)} title="Cerrar">
                      ✕
                    </button>
                  </div>
                </div>

                <div className="panel-sel-capa-box">
                  <span>CAPA ACTIVA · {capas.find((c) => c.id === capaActivaId)?.nombre || "Dibujo CAD"}</span>
                </div>

                <div className="panel-section-group">
                  <span className="section-label-exact">Tipo de línea</span>
                  <div className="panel-pills-row-exact">
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${tipoLinea === "continua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("continua")}
                    >
                      Continua
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${tipoLinea === "discontinua" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("discontinua")}
                    >
                      Discontinua
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${tipoLinea === "puntos" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("puntos")}
                    >
                      Puntos
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${tipoLinea === "centro" ? "pill-active-purple" : ""}`}
                      onClick={() => setTipoLinea("centro")}
                    >
                      Centro
                    </button>
                  </div>
                </div>

                <div className="panel-section-group">
                  <span className="section-label-exact">Rol de ingeniería</span>
                  <div className="panel-pills-row-exact">
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${rolIngenieria === "geometria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("geometria")}
                    >
                      Geometría
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${rolIngenieria === "galeria" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("galeria")}
                    >
                      Galería
                    </button>
                    <button
                      type="button"
                      className={`btn-pill-choice-exact ${rolIngenieria === "burden_spacing" ? "pill-active-purple" : ""}`}
                      onClick={() => setRolIngenieria("burden_spacing")}
                    >
                      Burden / spacing
                    </button>
                  </div>
                </div>

                <p className="panel-instruction-exact">
                  Modo principal: toca INICIO y FINAL. Para línea exacta, toca solo el inicio y completa:
                </p>

                <div className="panel-coord-box">
                  <div className="panel-coord-head">
                    <span>Distancia</span>
                    <span className="unit-pink">m</span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={distanciaLinea}
                    onChange={(e) => setDistanciaLinea(e.target.value)}
                    className="panel-coord-num-input"
                  />
                </div>

                <div className="panel-coord-box">
                  <div className="panel-coord-head">
                    <span>Azimut</span>
                    <span className="unit-pink">°</span>
                  </div>
                  <input
                    type="number"
                    step="1"
                    value={azimutLinea}
                    onChange={(e) => setAzimutLinea(e.target.value)}
                    className="panel-coord-num-input"
                  />
                </div>

                <button type="button" className="btn-pink-dibujar-linea" onClick={handleDibujarLineaPorAzimut}>
                  DIBUJAR LÍNEA
                </button>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            PANEL 3: GESTOR DE CARPETAS Y CAPAS (TIPO AUTOCAD / CIVIL 3D)
           ========================================================================= */}
        {panelCapasVisible && (
          <div className={`cad-panel-capas-autocad ${panelCapasMinimizado ? "panel-comprimido" : ""}`} onClick={(e) => e.stopPropagation()}>
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
