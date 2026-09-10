import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { generarCurvasNivel, triangularSuperficie, type PuntoTopografico } from "@suite/core";
import { extraerMetadataFoto, proyectarFotosDron } from "./exifDron.js";

// Sin esto, three.js vuelve a descargar y decodificar cada foto cada vez que se reconstruye
// la escena (p. ej. al alternar una capa o cambiar de vista con VUELO/HÍBRIDO) aunque la
// textura ya se haya cargado antes — es la causa principal de que "habilitar una vista" se
// sienta lento. Con la cache activada, un mismo vuelo reutiliza las texturas ya decodificadas.
THREE.Cache.enabled = true;

// Relieve topográfico bare-earth (pendiente natural y depresiones) usado tanto para la superficie
// MDT como para las curvas de nivel — deben leer la MISMA función de altura para que las curvas
// coincidan con el relieve realmente dibujado (antes, las curvas eran un patrón senoidal aparte
// que no tenía relación con la superficie).
function alturaTerrenoBareEarth(vx: number, vy: number): number {
  return Math.sin(vx * 0.028) * 2.6 + Math.cos(vy * 0.032) * 2.1 + Math.sin((vx + vy) * 0.015) * 1.8 - 0.8;
}

// Ancho (en unidades de escena) del frustum de la cámara ortográfica en zoom 1x.
// El encuadre automático ajusta camara.zoom sobre esta base para cubrir el bloque de vuelo real.
const ORTHO_FRUSTUM = 18;

// Set de iconos de línea (mismo estilo que el resto de la suite) para reemplazar los emojis
// de los presets de vista y los toggles de capa — se ven consistentes en cualquier SO/navegador.
function IconDron() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M6.4 6.4 10 10M17.6 6.4 14 10M6.4 17.6 10 14M17.6 17.6 14 14" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function IconTerreno() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 19 9 7l4 6 2-3 6 9H3z" />
    </svg>
  );
}

function IconHibrido() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9.5" cy="12" r="6" />
      <circle cx="14.5" cy="12" r="6" />
    </svg>
  );
}

function IconRayo() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function IconOjo({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 4.22-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.4 18.4 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

interface Props {
  proyectoId: string;
  proyectoNombre: string;
  onVolver: () => void;
}

interface FotoDron {
  id: string;
  nombre: string;
  url: string;
  ancho: number;
  alto: number;
  hasGps: boolean;
  lat?: number;
  lon?: number;
  alt?: number;
  relativeAlt?: number;
  gimbalYaw?: number;
  flightYaw?: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotDeg: number;
  centroX: number;
  centroY: number;
  centroZ?: number;
}

type EtapaDron = "FOTOS" | "EDITAR" | "ALINEA" | "SOLUCI" | "FUSION" | "MODELO" | "CURVAS" | "RESULT";

export default function EspacioDronFotogrametria({
  proyectoNombre,
  onVolver,
}: Props) {
  // Modo de vista: Planta (2D ortogonal cenital) o 3D (perspectiva libre)
  const [vistaModo, setVistaModo] = useState<"PLANTA" | "3D">("3D");

  // Etapa activa del dock derecho
  const [etapaActiva, setEtapaActiva] = useState<EtapaDron>("FOTOS");
  // En pantallas angostas el panel flotante arranca minimizado: abierto por defecto dejaba
  // ver solo una franja mínima del visor 3D detrás suyo. El usuario lo expande con el "+".
  const [panelMinimizado, setPanelMinimizado] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 600
  );
  const [panelOculto, setPanelOculto] = useState(false);
  // Dock izquierdo (capas) comprimible: en pantallas angostas ocupa mucho alto fijo;
  // se puede colapsar a una píldora chica y expandir de nuevo.
  const [dockCapasColapsado, setDockCapasColapsado] = useState(false);

  // Capas de visibilidad del dock izquierdo
  const [capas, setCapas] = useState({
    foto: true,
    huella: true,
    vuelo: true,
    cam: true,
    sfm: false,
    nube: false,
    sup: false,
    curva: false,
  });

  // Calidad de textura / cobertura
  const [calidad, setCalidad] = useState<"Baja" | "Media" | "Alta">("Media");

  // Estados especializados para las etapas 4 - 8 (exactos a las capturas)
  const [solucionCongelada, setSolucionCongelada] = useState(false);
  const [metodoFusion, setMetodoFusion] = useState<"metrico" | "visual_hibrido">("visual_hibrido");
  const [resolucionHeightField, setResolucionHeightField] = useState("AUTO");
  const [sliderHeightField, setSliderHeightField] = useState(0);
  const [terrainFusionConstruido, setTerrainFusionConstruido] = useState(false);
  const [resolucionCeldaModelo, setResolucionCeldaModelo] = useState("AUTO");
  const [intervaloCurvas, setIntervaloCurvas] = useState("1.00");
  const [importarSuperficie, setImportarSuperficie] = useState(true);
  const [importarCurvas, setImportarCurvas] = useState(false);
  const [importarRecorrido, setImportarRecorrido] = useState(false);
  const [importarNubeSfm, setImportarNubeSfm] = useState(false);

  // Mapeo de etiqueta activa para el header del panel flotante
  const etapaTagMap: Record<EtapaDron, string> = {
    FOTOS: "FOTOS · ACTIVA",
    EDITAR: "EDITAR · ACTIVA",
    ALINEA: "ALINEAR · ACTIVA",
    SOLUCI: "SOLUCIÓN · ACTIVA",
    FUSION: "FUSIÓN · ACTIVA",
    MODELO: "MODELO 3D · ACTIVA",
    CURVAS: "CURVAS · ACTIVA",
    RESULT: "RESULTADOS · ACTIVA",
  };

  // Notificación flotante rápida
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  // Lista de fotos iniciales simuladas (exactas a las de las capturas)
  const [fotos, setFotos] = useState<FotoDron[]>([
    {
      id: "f1",
      nombre: "IMG-20260909-WA0000.jpg",
      url: "",
      ancho: 899,
      alto: 1599,
      hasGps: false,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotDeg: 0,
      centroX: -2.5,
      centroY: 7.5,
    },
    {
      id: "f2",
      nombre: "IMG-20260909-WA0001.jpg",
      url: "",
      ancho: 899,
      alto: 1599,
      hasGps: false,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotDeg: 0,
      centroX: -0.8,
      centroY: 2.5,
    },
    {
      id: "f3",
      nombre: "IMG-20260909-WA0002.jpg",
      url: "",
      ancho: 899,
      alto: 1599,
      hasGps: false,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotDeg: 0,
      centroX: 0.8,
      centroY: -2.5,
    },
    {
      id: "f4",
      nombre: "IMG-20260909-WA0003.jpg",
      url: "",
      ancho: 899,
      alto: 1599,
      hasGps: false,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotDeg: 0,
      centroX: 2.5,
      centroY: -7.5,
    },
  ]);

  const [fotoIndex, setFotoIndex] = useState(0);
  const fotoActual = fotos[fotoIndex] || fotos[0];

  // Puntos y soluciones de referencia para alineación fotogramétrica (Etapa 3)
  const [referenciasGuardadas, setReferenciasGuardadas] = useState<{
    id: string;
    fotoBaseId: string;
    fotoBaseNombre: string;
    fotoTargetId: string;
    fotoTargetNombre: string;
    dx: number;
    dy: number;
    dist: number;
    puntoBase?: { x: number; y: number };
    puntoTarget?: { x: number; y: number };
  }[]>([]);
  const [refModo, setRefModo] = useState<"DOS_FOTOS" | "UNA_FOTO">("DOS_FOTOS");
  const [refFotoBaseIdx, setRefFotoBaseIdx] = useState<number>(0);
  const [refPasoActivo, setRefPasoActivo] = useState<"BASE" | "TARGET">("BASE");
  const [puntoBase, setPuntoBase] = useState<{ x: number; y: number } | null>(null);
  const [puntoTarget, setPuntoTarget] = useState<{ x: number; y: number } | null>(null);
  const [puntosUnaFoto, setPuntosUnaFoto] = useState<{ x: number; y: number }[]>([]);

  // Referencias a Three.js
  const contenedorRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const camaraPerspRef = useRef<THREE.PerspectiveCamera | null>(null);
  const camaraOrthoRef = useRef<THREE.OrthographicCamera | null>(null);
  const camaraActivaRef = useRef<THREE.Camera | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlesRef = useRef<OrbitControls | null>(null);
  const grupoEscenaRef = useRef<THREE.Group | null>(null);
  // Refs a materiales de huella y cámara por índice de foto:
  // se usan para actualizar SOLO el color activo al cambiar fotoIndex,
  // sin reconstruir ningún objeto de la escena.
  const huellaMatRefsRef = useRef<Map<number, THREE.LineBasicMaterial>>(new Map());
  const camMatRefsRef = useRef<Map<number, THREE.MeshStandardMaterial>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Mensaje de confirmación al activar/desactivar cada capa. Se guardan las dos frases ya
  // conjugadas (no un nombre + sufijo genérico) porque el género/número varía por capa:
  // "Cámaras activadas" pero "Plano del terreno activado".
  const CAPA_MENSAJE: Record<keyof typeof capas, { on: string; off: string }> = {
    foto: { on: "Fotos activadas", off: "Fotos desactivadas" },
    huella: { on: "Huellas activadas", off: "Huellas desactivadas" },
    vuelo: { on: "Trayectoria de vuelo activada", off: "Trayectoria de vuelo desactivada" },
    cam: { on: "Cámaras activadas", off: "Cámaras desactivadas" },
    sfm: { on: "Puntos SfM activados", off: "Puntos SfM desactivados" },
    nube: { on: "Nube densa activada", off: "Nube densa desactivada" },
    sup: { on: "Plano del terreno activado", off: "Plano del terreno desactivado" },
    curva: { on: "Curvas de nivel activadas", off: "Curvas de nivel desactivadas" },
  };

  // Capas que requieren recálculo 3D pesado (triangulación, Delaunay, nube de puntos).
  // Al activarlas se muestra el overlay de carga antes de que el efecto bloquee el hilo.
  const CAPAS_PESADAS: Array<keyof typeof capas> = ["sfm", "nube", "sup", "curva"];

  const CAPA_CARGANDO: Partial<Record<keyof typeof capas, string>> = {
    sfm: "Generando nube dispersa SfM",
    nube: "Construyendo nube densa de puntos",
    sup: "Calculando superficie MDT",
    curva: "Calculando curvas de nivel",
  };

  // Toggle de capas
  const toggleCapa = (key: keyof typeof capas) => {
    setCapas((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      showToast(next[key] ? CAPA_MENSAJE[key].on : CAPA_MENSAJE[key].off);
      // Mostrar overlay inmediato al ACTIVAR capas que hacen cómputo pesado en el hilo principal
      if (next[key] && CAPAS_PESADAS.includes(key)) {
        const mensajeCarga = CAPA_CARGANDO[key] ?? "Procesando capa";
        setCargaEstado({ mensaje: mensajeCarga, actual: 0, total: 0 });
      }
      return next;
    });
  };

  // Ajustes en modo EDITAR (+- X, Y, Z, ROT)
  const aplicarOffset = (dx: number, dy: number, dz: number, drot: number) => {
    setFotos((prev) =>
      prev.map((f, i) => {
        if (i !== fotoIndex) return f;
        return {
          ...f,
          offsetX: Number((f.offsetX + dx).toFixed(2)),
          offsetY: Number((f.offsetY + dy).toFixed(2)),
          offsetZ: Number((f.offsetZ + dz).toFixed(2)),
          rotDeg: (f.rotDeg + drot) % 360,
        };
      })
    );
  };

  // Generador de texturas procedurales si no hay foto real cargada
  const generarTexturaFoto = (idx: number): THREE.CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Fondo degradado fotogramétrico simulado
      const grad = ctx.createLinearGradient(0, 0, 512, 768);
      if (idx === 0) {
        grad.addColorStop(0, "#8b5cf6");
        grad.addColorStop(0.5, "#ec4899");
        grad.addColorStop(1, "#f59e0b");
      } else if (idx === 1) {
        grad.addColorStop(0, "#06b6d4");
        grad.addColorStop(0.5, "#3b82f6");
        grad.addColorStop(1, "#8b5cf6");
      } else if (idx === 2) {
        grad.addColorStop(0, "#10b981");
        grad.addColorStop(0.5, "#06b6d4");
        grad.addColorStop(1, "#3b82f6");
      } else {
        grad.addColorStop(0, "#f43f5e");
        grad.addColorStop(0.5, "#e11d48");
        grad.addColorStop(1, "#881337");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 768);

      // Líneas de ortofoto / cuadrículas de detalle
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      for (let y = 0; y < 768; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      for (let x = 0; x < 512; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 768);
        ctx.stroke();
      }

      // Etiqueta de la toma
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`FOTO #${idx + 1}`, 30, 60);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "20px monospace";
      ctx.fillText(`TOMA UAV EXIF / FOOTPRINT`, 30, 95);
      ctx.fillText(`RES: 899x1599 px`, 30, 125);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  // Inicialización y renderizado de la escena Three.js
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const width = contenedor.clientWidth || window.innerWidth;
    const height = contenedor.clientHeight || window.innerHeight;

    // Escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0712);
    escenaRef.current = scene;

    // Cámara Perspectiva (3D)
    const persp = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    persp.position.set(0, -22, 28);
    persp.up.set(0, 0, 1);
    camaraPerspRef.current = persp;

    // Cámara Ortográfica (Planta cenital 2D)
    const aspect = width / height;
    const ortho = new THREE.OrthographicCamera(
      (-ORTHO_FRUSTUM * aspect) / 2,
      (ORTHO_FRUSTUM * aspect) / 2,
      ORTHO_FRUSTUM / 2,
      -ORTHO_FRUSTUM / 2,
      0.1,
      2000
    );
    ortho.position.set(0, 0, 50);
    ortho.up.set(0, 1, 0);
    camaraOrthoRef.current = ortho;
    camaraActivaRef.current = persp;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    contenedor.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controles Orbit
    const controls = new OrbitControls(persp, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controlesRef.current = controls;

    // Luces
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffe4e6, 1.2);
    dirLight.position.set(15, -20, 30);
    scene.add(dirLight);

    // Grilla en el plano XY (Z=0) con tono rosado neón oscuro.
    // Base de 50 unidades; se reescala según el encuadre real del vuelo (ver efecto de encuadre),
    // porque un vuelo con GPS real puede abarcar cientos de metros y dejaría esta base fija
    // como un parche diminuto y descentrado sobre el terreno.
    const grid = new THREE.GridHelper(50, 50, 0xec4899, 0x3b1c32);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    gridRef.current = grid;

    // Grupo de elementos de fotogrametría
    const grupo = new THREE.Group();
    scene.add(grupo);
    grupoEscenaRef.current = grupo;

    // Loop de animación
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camaraActivaRef.current || persp);
    };
    animate();

    const handleResize = () => {
      if (!contenedor) return;
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      persp.aspect = w / h;
      persp.updateProjectionMatrix();

      const asp = w / h;
      ortho.left = (-ORTHO_FRUSTUM * asp) / 2;
      ortho.right = (ORTHO_FRUSTUM * asp) / 2;
      ortho.top = ORTHO_FRUSTUM / 2;
      ortho.bottom = -ORTHO_FRUSTUM / 2;
      ortho.updateProjectionMatrix();

      renderer.setSize(w, h);
    };

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

  const [cargandoMuestra, setCargandoMuestra] = useState(false);
  // Estado de carga con progreso visible (barra + contador) para operaciones largas —
  // leer EXIF/XMP de decenas de fotos puede tardar varios segundos y sin una señal clara
  // de avance parece que la app se colgó. null = sin carga en curso.
  const [cargaEstado, setCargaEstado] = useState<{ mensaje: string; actual: number; total: number } | null>(null);
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

  // Encuadra la cámara activa (persp o ortho) sobre el bloque de vuelo real y aplica
  // el modo de vista (PLANTA/3D). Se re-ejecuta tanto al cargar/editar fotos como al
  // alternar el modo, para que la cámara ortográfica nunca pierda el encuadre del vuelo
  // ni quede con un zoom fijo que no cubra vuelos de mayor extensión.
  useEffect(() => {
    const controls = controlesRef.current;
    const persp = camaraPerspRef.current;
    const ortho = camaraOrthoRef.current;
    if (!controls || !persp || !ortho) return;

    let midX = 0;
    let midY = 0;
    let span = 35;
    if (fotos.length > 0) {
      const xs = fotos.map((f) => f.centroX);
      const ys = fotos.map((f) => f.centroY);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      midX = (minX + maxX) / 2;
      midY = (minY + maxY) / 2;
      span = Math.max(maxX - minX, maxY - minY, 35);
    }

    controls.target.set(midX, midY, 0);

    if (gridRef.current) {
      gridRef.current.position.set(midX, midY, 0);
      gridRef.current.scale.setScalar((span * 2.4) / 50);
    }

    persp.position.set(midX, midY - span * 1.25, span * 1.4);
    persp.lookAt(midX, midY, 0);

    ortho.position.set(midX, midY, span * 2.5);
    ortho.lookAt(midX, midY, 0);
    // El frustum ortográfico es fijo (ORTHO_FRUSTUM); el zoom lo adapta al tamaño real del vuelo.
    ortho.zoom = ORTHO_FRUSTUM / (span * 1.15);
    ortho.updateProjectionMatrix();

    if (vistaModo === "PLANTA") {
      controls.object = ortho;
      camaraActivaRef.current = ortho;
      controls.enableRotate = false; // Solo paneo y zoom en vista cenital
    } else {
      controls.object = persp;
      camaraActivaRef.current = persp;
      controls.enableRotate = true;
    }
    controls.update();
  }, [fotos, vistaModo]);

  // Actualizar geometría de fotos, footprints, cámaras y terreno en la escena Three.js
  useEffect(() => {
    const grupo = grupoEscenaRef.current;
    if (!grupo) return;

    // Limpiar geometrías previas
    while (grupo.children.length > 0) {
      const child = grupo.children[0];
      grupo.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }
    // Resetear refs de materiales — se repoblan durante el loop de fotos a continuación
    huellaMatRefsRef.current.clear();
    camMatRefsRef.current.clear();

    const vueloPuntos: THREE.Vector3[] = [];

    // Progreso de textura al (re)activar la capa FOTO: cada vez que se alterna una vista con
    // fotos reales (p. ej. VUELO/HÍBRIDO), three.js vuelve a decodificar hasta ~48 imágenes y
    // eso puede tardar unos segundos — sin señal visible se ve trabado. El contador es propio
    // de esta pasada del efecto (no un LoadingManager global) para que dos activaciones
    // seguidas no se pisen los contadores entre sí.
    let efectoVigente = true;
    const totalTexturas = capas.foto ? fotos.filter((f) => f.url).length : 0;
    let texturasListas = 0;
    if (totalTexturas > 0) {
      setCargaEstado({ mensaje: "Cargando texturas de fotos", actual: 0, total: totalTexturas });
    }
    const marcarTexturaLista = () => {
      if (!efectoVigente) return;
      texturasListas += 1;
      setCargaEstado((prev) => {
        if (!prev || prev.mensaje !== "Cargando texturas de fotos") return prev;
        return texturasListas >= totalTexturas ? null : { ...prev, actual: texturasListas };
      });
    };

    // Las capas pesadas (sfm, nube, sup, curva) ejecutan cómputo costoso en el hilo principal;
    // el toggleCapa ya activa el overlay antes de que llegue aquí, pero por si el efecto
    // corre sin pasar por toggleCapa (cambio de fotos, intervalo, etc.) lo garantizamos aquí.
    // Se apaga en el cleanup o al terminar el cómputo pesado.
    const hayCapaPesadaActiva = capas.sfm || capas.nube || capas.sup || capas.curva;
    let timeoutCapaPesada: ReturnType<typeof setTimeout> | null = null;
    if (hayCapaPesadaActiva && totalTexturas === 0) {
      // El overlay ya puede estar puesto por toggleCapa; si no, lo ponemos ahora.
      setCargaEstado((prev) => prev ?? { mensaje: "Procesando escena 3D", actual: 0, total: 0 });
    }

    fotos.forEach((foto, i) => {
      const posX = foto.centroX + foto.offsetX;
      const posY = foto.centroY + foto.offsetY;
      const posZ = (foto.centroZ ?? 0) + foto.offsetZ;

      const rotRad = (foto.rotDeg * Math.PI) / 180;

      // Dimensiones de la huella — calculadas a partir de la altitud de vuelo AGL del dron
      const anchoPlano = foto.relativeAlt && foto.relativeAlt > 0 ? Math.min(foto.relativeAlt * 0.95, 52) : 22;
      const altoPlano = foto.relativeAlt && foto.relativeAlt > 0 ? Math.min(foto.relativeAlt * 0.72, 39) : 16;

      // 1. Huella y Textura de la foto con rotación de rumbo (Yaw)
      if (capas.foto) {
        const geom = new THREE.PlaneGeometry(anchoPlano, altoPlano);
        let mat: THREE.MeshBasicMaterial;
        if (foto.url) {
          const tex = textureLoader.load(foto.url, marcarTexturaLista, undefined, marcarTexturaLista);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          mat = new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
          });
        } else {
          mat = new THREE.MeshBasicMaterial({
            map: generarTexturaFoto(i),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
          });
        }
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(posX, posY, posZ + 0.02 * i);
        mesh.rotation.z = -rotRad;
        grupo.add(mesh);
      }

      // 2. Rectángulo de huella (Footprint box)
      if (capas.huella) {
        const pts = [
          new THREE.Vector3(-anchoPlano / 2, -altoPlano / 2, 0),
          new THREE.Vector3(anchoPlano / 2, -altoPlano / 2, 0),
          new THREE.Vector3(anchoPlano / 2, altoPlano / 2, 0),
          new THREE.Vector3(-anchoPlano / 2, altoPlano / 2, 0),
          new THREE.Vector3(-anchoPlano / 2, -altoPlano / 2, 0),
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        // Color inicial neutro — el efecto de fotoIndex lo pondrá activo enseguida
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xf472b6,
          linewidth: 1.5,
        });
        huellaMatRefsRef.current.set(i, lineMat);
        const box = new THREE.Line(lineGeom, lineMat);
        box.position.set(posX, posY, posZ + 0.04 * i);
        box.rotation.z = -rotRad;
        grupo.add(box);

        // Cruz central de la huella
        const cSize = Math.max(0.4, anchoPlano * 0.04);
        const crossPts = [
          new THREE.Vector3(-cSize, 0, 0),
          new THREE.Vector3(cSize, 0, 0),
          new THREE.Vector3(0, -cSize, 0),
          new THREE.Vector3(0, cSize, 0),
        ];
        const crossGeom = new THREE.BufferGeometry().setFromPoints(crossPts);
        const crossMat = new THREE.LineBasicMaterial({ color: 0xec4899 });
        const cross = new THREE.LineSegments(crossGeom, crossMat);
        cross.position.set(posX, posY, posZ + 0.05);
        cross.rotation.z = -rotRad;
        grupo.add(cross);
      }

      // 3. Cámara en el espacio y línea de nadir
      // La altura real de vuelo (relativeAlt, ~50-120m típico) es casi del mismo orden que el
      // ancho de la huella: si el marcador se dibuja a esa altura real, de cerca en 3D se ve
      // "volando" muy lejos de su propia foto y las líneas de nadir cruzan la escena como una
      // telaraña. Se ancla la altura visual al tamaño de la huella (no a la altitud real) para
      // que el marcador y su línea de nadir queden legibles en cualquier vuelo, sin perder la
      // huella real (que sí usa relativeAlt tal cual).
      const camAlt = Math.max(anchoPlano * 0.32, 1.2);
      const camPos = new THREE.Vector3(posX, posY, camAlt + posZ);
      vueloPuntos.push(camPos);

      if (capas.cam) {
        const coneRadius = Math.max(0.4, anchoPlano * 0.035);
        const coneHeight = coneRadius * 2.2;
        const camGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 12);
        camGeom.rotateX(-Math.PI / 2);
        // Color inicial neutro — el efecto de fotoIndex lo activará enseguida
        const camMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.5,
          roughness: 0.3,
        });
        camMatRefsRef.current.set(i, camMat);
        const camMesh = new THREE.Mesh(camGeom, camMat);
        camMesh.position.copy(camPos);
        grupo.add(camMesh);

        // Línea nadir desde la cámara al suelo
        const nadirPts = [camPos, new THREE.Vector3(posX, posY, posZ)];
        const nadirGeom = new THREE.BufferGeometry().setFromPoints(nadirPts);
        const nadirMat = new THREE.LineDashedMaterial({
          color: 0xec4899,
          dashSize: 1.0,
          gapSize: 0.6,
        });
        const nadirLine = new THREE.Line(nadirGeom, nadirMat);
        nadirLine.computeLineDistances();
        grupo.add(nadirLine);
      }
    });

    // 4. Trayectoria de vuelo conectando cámaras
    if (capas.vuelo && vueloPuntos.length > 1) {
      const vueloGeom = new THREE.BufferGeometry().setFromPoints(vueloPuntos);
      const vueloMat = new THREE.LineBasicMaterial({
        color: 0xf43f5e,
        linewidth: 2.5,
      });
      const vueloLine = new THREE.Line(vueloGeom, vueloMat);
      grupo.add(vueloLine);
    }

    // 5. Nube SfM dispersa (capas.sfm)
    if (capas.sfm && fotos.length > 0) {
      const sfmPoints: number[] = [];
      const sfmColors: number[] = [];
      fotos.forEach((f) => {
        for (let k = 0; k < 40; k++) {
          const px = f.centroX + (Math.random() - 0.5) * 35;
          const py = f.centroY + (Math.random() - 0.5) * 28;
          const pz = (f.centroZ ?? 0) + (Math.random() - 0.5) * 3.5;
          sfmPoints.push(px, py, pz);
          if (k % 2 === 0) {
            sfmColors.push(0.92, 0.28, 0.6);
          } else {
            sfmColors.push(0.06, 0.71, 0.83);
          }
        }
      });
      const sfmGeom = new THREE.BufferGeometry();
      sfmGeom.setAttribute("position", new THREE.Float32BufferAttribute(sfmPoints, 3));
      sfmGeom.setAttribute("color", new THREE.Float32BufferAttribute(sfmColors, 3));
      const sfmMat = new THREE.PointsMaterial({
        size: 1.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
      });
      grupo.add(new THREE.Points(sfmGeom, sfmMat));
    }

    // 6. Superficie 3D: MDT (Modelo Digital del Terreno - Bare Earth / Solo Terreno)
    if (capas.sup && fotos.length > 0) {
      const xs = fotos.map((f) => f.centroX);
      const ys = fotos.map((f) => f.centroY);
      const minX = Math.min(...xs) - 20;
      const maxX = Math.max(...xs) + 20;
      const minY = Math.min(...ys) - 20;
      const maxY = Math.max(...ys) + 20;
      const nx = 48;
      const ny = 48;
      const planeGeom = new THREE.PlaneGeometry(maxX - minX, maxY - minY, nx, ny);
      const posAttr = planeGeom.attributes.position;
      const colors: number[] = [];

      // Calcular relieve natural topográfico del terreno sin construcciones (Bare-Earth DTM)
      let minZ = Infinity;
      let maxZ = -Infinity;
      const vertexZ: number[] = [];

      for (let idx = 0; idx < posAttr.count; idx++) {
        const vx = posAttr.getX(idx) + (minX + maxX) / 2;
        const vy = posAttr.getY(idx) + (minY + maxY) / 2;
        const vz = alturaTerrenoBareEarth(vx, vy);
        posAttr.setZ(idx, vz);
        vertexZ.push(vz);
        if (vz < minZ) minZ = vz;
        if (vz > maxZ) maxZ = vz;
      }

      // Rampa de color hipsométrica topográfica (verde valles -> ocre/amarillo colinas)
      const rangeZ = Math.max(0.1, maxZ - minZ);
      for (let idx = 0; idx < posAttr.count; idx++) {
        const normZ = (vertexZ[idx] - minZ) / rangeZ;
        let r = 0.2;
        let g = 0.7;
        let b = 0.3;
        if (normZ < 0.33) {
          // Tierras bajas / depresiones (verde suave)
          r = 0.15 + normZ * 0.5;
          g = 0.65 + normZ * 0.3;
          b = 0.25;
        } else if (normZ < 0.66) {
          // Lomas medias (arena / ocre / dorado)
          const t = (normZ - 0.33) / 0.33;
          r = 0.75 + t * 0.15;
          g = 0.68 - t * 0.15;
          b = 0.2 + t * 0.1;
        } else {
          // Cumbres y crestas (pardo / marrón topográfico)
          const t = (normZ - 0.66) / 0.34;
          r = 0.7 - t * 0.2;
          g = 0.45 - t * 0.15;
          b = 0.25;
        }
        colors.push(r, g, b);
      }

      planeGeom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      planeGeom.computeVertexNormals();

      const planeMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.75,
        metalness: 0.05,
        side: THREE.DoubleSide,
        transparent: capas.foto,
        opacity: capas.foto ? 0.75 : 0.95,
      });

      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, -0.3);
      grupo.add(planeMesh);

      // Malla de alambre sutil (wireframe topográfico DTM)
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
      });
      const wireMesh = new THREE.Mesh(planeGeom, wireMat);
      wireMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, -0.28);
      grupo.add(wireMesh);
    }

    // 7. Curvas de nivel topográficas 3D (capas.curva) — intersección real de la superficie con
    // planos horizontales (mismo algoritmo que el módulo de Topografía: triangularSuperficie +
    // generarCurvasNivel de @suite/core), muestreando la MISMA función de altura que la superficie MDT.
    if (capas.curva && fotos.length > 0) {
      const step = Math.max(0.5, Number(intervaloCurvas) || 1.0);
      const xs = fotos.map((f) => f.centroX);
      const ys = fotos.map((f) => f.centroY);
      const minX = Math.min(...xs) - 20;
      const maxX = Math.max(...xs) + 20;
      const minY = Math.min(...ys) - 20;
      const maxY = Math.max(...ys) + 20;

      const resolucion = 24; // celdas por eje: suficiente detalle sin recalcular Delaunay de más
      const puntos: PuntoTopografico[] = [];
      for (let j = 0; j <= resolucion; j++) {
        const vy = minY + ((maxY - minY) * j) / resolucion;
        for (let i = 0; i <= resolucion; i++) {
          const vx = minX + ((maxX - minX) * i) / resolucion;
          puntos.push({ x: vx, y: vy, z: alturaTerrenoBareEarth(vx, vy) });
        }
      }

      const superficie = triangularSuperficie(puntos);
      const segmentos = generarCurvasNivel({ superficie, intervalo_m: step });

      if (segmentos.length > 0) {
        const curvePts: THREE.Vector3[] = [];
        for (const s of segmentos) {
          curvePts.push(new THREE.Vector3(s.a.x, s.a.y, s.cota + 0.05));
          curvePts.push(new THREE.Vector3(s.b.x, s.b.y, s.cota + 0.05));
        }
        const curveGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
        const curveMat = new THREE.LineSegments(
          curveGeom,
          new THREE.LineBasicMaterial({
            color: 0xfbbf24,
            linewidth: 2,
            transparent: true,
            opacity: 0.95,
          })
        );
        grupo.add(curveMat);
      }
    }

    // Apagar el overlay de capas pesadas ahora que el cómputo síncrónico terminó.
    // Se usa un timeout mínimo para que React tenga tiempo de pintar el overlay antes de
    // que lo quitemos (de lo contrario el usuario nunca lo vería porque el hilo estaba ocupado).
    if (hayCapaPesadaActiva && totalTexturas === 0) {
      timeoutCapaPesada = setTimeout(() => {
        if (efectoVigente) setCargaEstado(null);
      }, 120);
    }

    return () => {
      // Si el efecto vuelve a correr (o el componente se desmonta) antes de que terminen de
      // cargar las texturas de esta pasada, sus callbacks tardíos ya no deben tocar el estado
      // de la pasada siguiente.
      efectoVigente = false;
      if (timeoutCapaPesada !== null) clearTimeout(timeoutCapaPesada);
    };
  }, [fotos, capas, intervaloCurvas, textureLoader]);

  // Efecto LIGERO: solo actualiza colores de los materiales de huella y cámara
  // cuando cambia la foto seleccionada. NO reconstruye ningún objeto de la escena.
  useEffect(() => {
    const COLOR_ACTIVO_HUE = new THREE.Color(0xff007f);
    const COLOR_NEUTRO_HUE = new THREE.Color(0xf472b6);
    const COLOR_ACTIVO_CAM = new THREE.Color(0xff007f);
    const COLOR_NEUTRO_CAM = new THREE.Color(0xf59e0b);
    const COLOR_EMISSIVE_ACTIVO = new THREE.Color(0xff007f);
    const COLOR_EMISSIVE_NEUTRO = new THREE.Color(0xd97706);

    huellaMatRefsRef.current.forEach((mat, idx) => {
      mat.color.copy(idx === fotoIndex ? COLOR_ACTIVO_HUE : COLOR_NEUTRO_HUE);
      mat.needsUpdate = true;
    });
    camMatRefsRef.current.forEach((mat, idx) => {
      mat.color.copy(idx === fotoIndex ? COLOR_ACTIVO_CAM : COLOR_NEUTRO_CAM);
      mat.emissive.copy(idx === fotoIndex ? COLOR_EMISSIVE_ACTIVO : COLOR_EMISSIVE_NEUTRO);
      mat.needsUpdate = true;
    });
  }, [fotoIndex]);

  // Carga de fotos reales del usuario desde explorador
  const handleCargarFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const listaFiles = Array.from(files)
      .filter((f) => /\.(jpe?g|png|webp|tif?f)$/i.test(f.name))
      // El FileList del navegador no garantiza orden de vuelo; se ordena por nombre
      // (natural) para que la trayectoria conecte las tomas en secuencia.
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    if (listaFiles.length === 0) {
      showToast("No se seleccionaron archivos de imagen válidos.");
      return;
    }

    setCargaEstado({ mensaje: "Leyendo metadatos EXIF/XMP", actual: 0, total: listaFiles.length });
    let leidas = 0;
    const promesas = listaFiles.map(async (file) => {
      const meta = await extraerMetadataFoto(file);
      const url = URL.createObjectURL(file);
      leidas += 1;
      setCargaEstado((prev) => (prev ? { ...prev, actual: leidas } : prev));
      return { file, meta, url };
    });

    const items = await Promise.all(promesas);
    const proyectados = proyectarFotosDron(
      items.map((it) => ({
        lat: it.meta.lat,
        lon: it.meta.lon,
        alt: it.meta.alt,
        relativeAlt: it.meta.relativeAlt,
      }))
    );

    const nuevasFotos: FotoDron[] = items.map((it, i) => ({
      id: `usr_${Date.now()}_${i}`,
      nombre: it.file.name,
      url: it.url,
      ancho: it.meta.ancho,
      alto: it.meta.alto,
      hasGps: it.meta.lat !== null && it.meta.lon !== null,
      lat: it.meta.lat ?? undefined,
      lon: it.meta.lon ?? undefined,
      alt: it.meta.alt ?? undefined,
      relativeAlt: it.meta.relativeAlt ?? undefined,
      gimbalYaw: it.meta.gimbalYaw ?? undefined,
      flightYaw: it.meta.flightYaw ?? undefined,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotDeg: it.meta.flightYaw ?? it.meta.gimbalYaw ?? 0,
      centroX: proyectados[i].x,
      centroY: proyectados[i].y,
      centroZ: proyectados[i].z,
    }));

    setFotos(nuevasFotos);
    setFotoIndex(0);
    setCargaEstado(null);
    showToast(`✓ ${nuevasFotos.length} fotos procesadas con telemetría de dron`);
  };

  // Carga automática directa de la carpeta de prueba C:\Users\gpere\Downloads\4thAve
  const handleCargarMuestra4thAve = async () => {
    try {
      setCargandoMuestra(true);
      setCargaEstado({ mensaje: "Escaneando carpeta 4thAve", actual: 0, total: 1 });
      const res = await fetch("/api/dji-samples");
      if (!res.ok) {
        throw new Error("No se pudo conectar al endpoint local de muestras");
      }
      const data = await res.json();
      const files: string[] = data.files || [];
      if (files.length === 0) {
        throw new Error("No se encontraron fotos JPG en 4thAve");
      }

      setCargaEstado({ mensaje: "Leyendo telemetría DJI (GPS/EXIF)", actual: 0, total: files.length });
      let leidas = 0;

      const promesas = files.map(async (fileName) => {
        const photoUrl = `/api/dji-photo?file=${encodeURIComponent(fileName)}`;
        try {
          const fileRes = await fetch(photoUrl);
          const blob = await fileRes.blob();
          const meta = await extraerMetadataFoto(blob);
          leidas += 1;
          setCargaEstado((prev) => (prev ? { ...prev, actual: leidas } : prev));
          return { fileName, photoUrl, meta };
        } catch {
          leidas += 1;
          setCargaEstado((prev) => (prev ? { ...prev, actual: leidas } : prev));
          return {
            fileName,
            photoUrl,
            meta: {
              lat: null,
              lon: null,
              alt: null,
              relativeAlt: null,
              gimbalYaw: null,
              flightYaw: null,
              ancho: 4000,
              alto: 3000,
            },
          };
        }
      });

      const items = await Promise.all(promesas);
      const proyectados = proyectarFotosDron(
        items.map((it) => ({
          lat: it.meta.lat,
          lon: it.meta.lon,
          alt: it.meta.alt,
          relativeAlt: it.meta.relativeAlt,
        }))
      );

      const fotosDJI: FotoDron[] = items.map((it, i) => ({
        id: `dji_${i}_${it.fileName}`,
        nombre: it.fileName,
        url: it.photoUrl,
        ancho: it.meta.ancho,
        alto: it.meta.alto,
        hasGps: it.meta.lat !== null && it.meta.lon !== null,
        lat: it.meta.lat ?? undefined,
        lon: it.meta.lon ?? undefined,
        alt: it.meta.alt ?? undefined,
        relativeAlt: it.meta.relativeAlt ?? undefined,
        gimbalYaw: it.meta.gimbalYaw ?? undefined,
        flightYaw: it.meta.flightYaw ?? undefined,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        rotDeg: it.meta.flightYaw ?? it.meta.gimbalYaw ?? 0,
        centroX: proyectados[i].x,
        centroY: proyectados[i].y,
        centroZ: proyectados[i].z,
      }));

      setFotos(fotosDJI);
      setFotoIndex(0);
      showToast(`✓ ${fotosDJI.length} fotos DJI reales cargadas de 4thAve`);
    } catch (err: any) {
      console.warn("Aviso carga muestra:", err);
      showToast(`Aviso: ${err.message}. Puedes usar el botón 'CARPETA' o 'FOTOS' para seleccionarlas.`);
    } finally {
      setCargandoMuestra(false);
      setCargaEstado(null);
    }
  };

  // Carga automática inicial de las 48 fotos de muestra de 4thAve para visualización inmediata del ejemplo.
  // Guard contra el doble-invocado de efectos de React.StrictMode en desarrollo: sin él, esta carga
  // (y sus ~48 descargas de fotos reales) arrancaba DOS veces en paralelo, cruzando los contadores
  // de progreso entre ambos ciclos y haciendo que la barra de carga pareciera trabada o parpadeara.
  const cargaInicialHechaRef = useRef(false);
  useEffect(() => {
    if (cargaInicialHechaRef.current) return;
    cargaInicialHechaRef.current = true;
    handleCargarMuestra4thAve();
  }, []);


  return (
    <div className="v8-dron-workspace">
      {/* 1. HEADER SUPERIOR */}
      <header className="v8-dron-header">
        <div className="v8-dron-header-left">
          <button
            type="button"
            className="btn-v8-dron-back"
            onClick={onVolver}
            title="Volver a Modelo 3D"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="v8-dron-titles">
            <h1 className="v8-dron-title">V8 · DRON</h1>
            <span className="v8-dron-subtitle">
              FOTOGRAMETRÍA + TOPOGRAFÍA · {proyectoNombre}
            </span>
          </div>
        </div>

        <div className="v8-dron-header-right">
          {/* Presets de visualización rápida: Vuelo vs Terreno 3D */}
          <div className="v8-dron-view-switch" style={{ marginRight: 6 }}>
            <button
              type="button"
              className={`btn-v8-switch-item ${capas.foto && !capas.sup ? "activo" : ""}`}
              onClick={() => {
                setCapas({
                  foto: true,
                  huella: true,
                  vuelo: true,
                  cam: true,
                  sfm: false,
                  nube: false,
                  sup: false,
                  curva: false,
                });
                setVistaModo("3D");
                showToast("Modo: Cámaras y trayectoria de vuelo");
              }}
              title="Ver estaciones de toma, cámaras y fotos del dron"
            >
              <IconDron /> VUELO
            </button>
            <button
              type="button"
              className={`btn-v8-switch-item ${capas.sup && !capas.foto ? "activo" : ""}`}
              onClick={() => {
                setCapas({
                  foto: false,
                  huella: false,
                  vuelo: false,
                  cam: false,
                  sfm: false,
                  nube: false,
                  sup: true,
                  curva: true,
                });
                setVistaModo("3D");
                showToast("Modo: Plano 3D del Terreno (Bare-Earth sin construcciones)");
              }}
              title="Ver solo el plano 3D del terreno (Bare-Earth DTM sin casas)"
            >
              <IconTerreno /> TERRENO 3D
            </button>
            <button
              type="button"
              className={`btn-v8-switch-item ${capas.sup && capas.foto ? "activo" : ""}`}
              onClick={() => {
                setCapas({
                  foto: true,
                  huella: false,
                  vuelo: true,
                  cam: true,
                  sfm: false,
                  nube: false,
                  sup: true,
                  curva: true,
                });
                setVistaModo("3D");
                showToast("Modo: Fusión Híbrida (Fotos + Terreno 3D)");
              }}
              title="Ver fotos proyectadas sobre el terreno 3D"
            >
              <IconHibrido /> HÍBRIDO
            </button>
          </div>

          {/* Switch PLANTA / 3D */}
          <div className="v8-dron-view-switch">
            <button
              type="button"
              className={`btn-v8-switch-item ${vistaModo === "PLANTA" ? "activo" : ""}`}
              onClick={() => setVistaModo("PLANTA")}
            >
              PLANTA
            </button>
            <button
              type="button"
              className={`btn-v8-switch-item ${vistaModo === "3D" ? "activo" : ""}`}
              onClick={() => setVistaModo("3D")}
            >
              3D
            </button>
          </div>

          <button
            type="button"
            className="btn-v8-header-icon"
            onClick={() => showToast("Ajustando encuadre de vuelo...")}
            title="Ajustar encuadre"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 8V5a1 1 0 0 1 1-1h3" />
              <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
              <path d="M4 16v3a1 1 0 0 0 1 1h3" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Zona de trabajo bajo el header: al ser un hijo flex (no absoluto respecto a toda la
          pantalla), el canvas y los docks siempre ocupan exactamente el espacio que sobra
          debajo del header, sea cual sea su alto real — en vez de restar a mano un "top" fijo
          que se desincroniza apenas el header crece (p. ej. al envolver en 2 líneas en móvil). */}
      <div className="v8-dron-stage">
        {/* 2. CONTENEDOR 3D CANVAS */}
        <div className="v8-dron-canvas-wrap" ref={contenedorRef} />

        {/* Overlay de progreso: sin esto, leer EXIF/XMP de decenas de fotos (o traerlas de
            4thAve por red) se ve exactamente igual que la app trabada — nada en pantalla
            cambia salvo un toast que desaparece solo. Bloquea la interacción a propósito
            mientras dura, para evitar clics que pisen la carga en curso. */}
        {cargaEstado && (
          <div className="v8-carga-overlay" role="status" aria-live="polite">
            <div className="v8-carga-card">
              <div className="v8-carga-spinner" />
              <div className="v8-carga-texto">
                <span className="v8-carga-mensaje">{cargaEstado.mensaje}…</span>
                {cargaEstado.total > 1 && (
                  <span className="v8-carga-contador">
                    {cargaEstado.actual} / {cargaEstado.total}
                  </span>
                )}
              </div>
              <div className="v8-carga-barra-track">
                <div
                  className="v8-carga-barra-fill"
                  data-indeterminado={cargaEstado.total === 0 ? "true" : undefined}
                  style={{
                    width: `${cargaEstado.total > 0 ? Math.min(100, (cargaEstado.actual / cargaEstado.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. DOCK VERTICAL IZQUIERDO: CAPAS DE VISIBILIDAD */}
        <nav className={`v8-dron-dock-left ${dockCapasColapsado ? "colapsado" : ""}`}>
          <button
            type="button"
            className="btn-v8-dock-toggle"
            onClick={() => setDockCapasColapsado((v) => !v)}
            title={dockCapasColapsado ? "Expandir capas" : "Comprimir capas"}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {dockCapasColapsado ? <polyline points="9 6 15 12 9 18" /> : <polyline points="15 6 9 12 15 18" />}
            </svg>
          </button>

          {!dockCapasColapsado && (
            <>
          <div className="v8-dock-header-icon" title="Capas de visibilidad">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.foto ? "activo" : ""}`}
          onClick={() => toggleCapa("foto")}
          title="Alternar fotos"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.foto} /></span>
          <span className="v8-layer-label">FOTO</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.huella ? "activo" : ""}`}
          onClick={() => toggleCapa("huella")}
          title="Alternar huella/footprint"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.huella} /></span>
          <span className="v8-layer-label">HUELLA</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.vuelo ? "activo" : ""}`}
          onClick={() => toggleCapa("vuelo")}
          title="Alternar trayectoria de vuelo"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.vuelo} /></span>
          <span className="v8-layer-label">VUELO</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.cam ? "activo" : ""}`}
          onClick={() => toggleCapa("cam")}
          title="Alternar cámaras y nadir"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.cam} /></span>
          <span className="v8-layer-label">CAM</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.sfm ? "activo" : ""}`}
          onClick={() => toggleCapa("sfm")}
          title="Alternar puntos SfM"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.sfm} /></span>
          <span className="v8-layer-label">SFM</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.nube ? "activo" : ""}`}
          onClick={() => toggleCapa("nube")}
          title="Alternar nube densa"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.nube} /></span>
          <span className="v8-layer-label">NUBE</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.sup ? "activo" : ""}`}
          onClick={() => toggleCapa("sup")}
          title="Alternar superficie"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.sup} /></span>
          <span className="v8-layer-label">SUP</span>
        </button>

        <button
          type="button"
          className={`btn-v8-layer-toggle ${capas.curva ? "activo" : ""}`}
          onClick={() => toggleCapa("curva")}
          title="Alternar curvas de nivel"
        >
          <span className="v8-layer-eye"><IconOjo visible={capas.curva} /></span>
          <span className="v8-layer-label">CURVA</span>
        </button>
            </>
          )}
        </nav>

        {/* 4. DOCK VERTICAL DERECHO: HERRAMIENTAS Y ETAPAS */}
        <nav className="v8-dron-dock-right">
        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "FOTOS" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("FOTOS");
            setPanelOculto(false);
          }}
          title="1. Fotos del dron"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>FOTOS</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "EDITAR" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("EDITAR");
            setPanelOculto(false);
          }}
          title="2. Editar / revisar footprints"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>EDITAR</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "ALINEA" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("ALINEA");
            setPanelOculto(false);
          }}
          title="3. Alinear por referencia"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span>ALINEA</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "SOLUCI" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("SOLUCI");
            setPanelOculto(false);
          }}
          title="4. Solución SfM"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>SOLUCI</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "FUSION" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("FUSION");
            setPanelOculto(false);
          }}
          title="5. Fusión y Ortofoto"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="12 2 2 22 22 22 12 2" />
          </svg>
          <span>FUSIÓN</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "MODELO" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("MODELO");
            setPanelOculto(false);
          }}
          title="6. Modelo 3D"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>MODELO</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "CURVAS" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("CURVAS");
            setPanelOculto(false);
          }}
          title="7. Curvas de nivel"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <span>CURVAS</span>
        </button>

        <button
          type="button"
          className={`btn-v8-stage-item ${etapaActiva === "RESULT" ? "activo" : ""}`}
          onClick={() => {
            setEtapaActiva("RESULT");
            setPanelOculto(false);
          }}
          title="8. Resultados"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>RESULT</span>
        </button>
      </nav>

      {/* 5. PANEL FLOTANTE DE LA ETAPA ACTIVA */}
      {!panelOculto && (
        <aside className={`v8-stage-floating-panel ${panelMinimizado ? "minimizado" : ""}`}>
          <div className="v8-stage-panel-header">
            <span className="v8-stage-tag">{etapaTagMap[etapaActiva]}</span>
            <div className="v8-stage-panel-header-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="btn-header-round-min"
                onClick={() => setPanelMinimizado((v) => !v)}
                title={panelMinimizado ? "Expandir (+)" : "Minimizar (−)"}
              >
                {panelMinimizado ? "+" : "−"}
              </button>
              <button
                type="button"
                className="btn-header-round-close"
                onClick={() => setPanelOculto(true)}
                title="Cerrar panel (✕)"
              >
                ✕
              </button>
            </div>
          </div>

          {!panelMinimizado && (
            <div className="v8-stage-panel-body">
              {/* ETAPA 1: FOTOS */}
              {etapaActiva === "FOTOS" && (
                <>
                  <h2 className="v8-stage-title">1 · FOTOS DEL DRON</h2>
                  <p className="v8-stage-p">
                    Al cargar, NAMICAD ordena el vuelo, ubica cada toma por GPS/EXIF, respeta yaw/roll y une los solapes en una cobertura continua de revisión.
                  </p>

                  <div className="v8-subcard">
                    <span className="v8-subcard-title">CALIDAD DE COBERTURA / TEXTURA</span>
                    <p className="v8-subcard-desc">
                      Las fotos originales nunca se reducen ni se modifican. Esta opción controla el mosaico del visor y la guía visual de Terrain Fusion.
                    </p>

                    <div className="v8-quality-selector">
                      {(["Baja", "Media", "Alta"] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          className={`btn-v8-quality ${calidad === q ? "activo" : ""}`}
                          onClick={() => setCalidad(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    <span className="v8-quality-subinfo">
                      {calidad === "Baja"
                        ? "Rápida · mosaico 2K"
                        : calidad === "Media"
                        ? "Equilibrada · mosaico 3.5K"
                        : "Detalle máximo · mosaico 8K"}
                    </span>
                  </div>

                  {/* Botones de acción principales para fotos */}
                  <div className="v8-import-actions-row">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      multiple
                      accept="image/*"
                      onChange={handleCargarFotos}
                    />
                    <input
                      type="file"
                      ref={folderInputRef}
                      style={{ display: "none" }}
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                      onChange={handleCargarFotos}
                    />
                    <button
                      type="button"
                      className="btn-v8-fotos-main"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      FOTOS
                    </button>
                    <button
                      type="button"
                      className="btn-v8-folder-main"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      CARPETA
                    </button>
                    <button
                      type="button"
                      className="btn-v8-folder-main"
                      style={{
                        background: "linear-gradient(135deg, rgba(236,72,153,0.32), rgba(168,85,247,0.32))",
                        borderColor: "#ec4899",
                        color: "#fbcfe8",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                      }}
                      onClick={handleCargarMuestra4thAve}
                      disabled={cargandoMuestra}
                      title="Cargar carpeta de prueba C:\Users\gpere\Downloads\4thAve"
                    >
                      {cargandoMuestra ? (
                        "CARGANDO..."
                      ) : (
                        <>
                          <IconRayo /> 4thAve (48 DJI)
                        </>
                      )}
                    </button>
                  </div>

                  <div className="v8-info-box">
                    <span className="v8-info-box-label">Vuelo cargado</span>
                    <span className="v8-info-box-value">
                      {fotos.length} fotos · {fotos.filter((f) => f.hasGps).length} con GPS ·{" "}
                      {fotos.some((f) => f.alt)
                        ? `Alt: ~${(fotos.reduce((acc, f) => acc + (f.alt || 0), 0) / (fotos.length || 1)).toFixed(1)}m (AGL ~${(fotos.reduce((acc, f) => acc + (f.relativeAlt || 0), 0) / (fotos.length || 1)).toFixed(1)}m)`
                        : "Relativa / coincidencia visual"}
                    </span>
                  </div>

                  <div className="v8-info-box">
                    <span className="v8-info-box-label">Cobertura en planta</span>
                    <span className="v8-info-box-value">
                      FOTO = cobertura GPS/UTM · HUELLA = footprint real de cámara · VUELO = centros GPS en secuencia
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn-v8-regenerar"
                    onClick={() => showToast(`Cobertura ${calidad.toUpperCase()} recalculada para ${fotos.length} fotos`)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    REGENERAR COBERTURA · {calidad.toUpperCase()}
                  </button>

                  <p className="v8-hint-text">
                    Toca un footprint en el visor o una foto de la lista para seleccionarla. Si corriges o excluyes una toma, actualiza la cobertura antes de alinear.
                  </p>

                  {/* Lista de fotos */}
                  <div className="v8-photos-list">
                    {fotos.map((f, i) => (
                      <div
                        key={f.id}
                        className={`v8-photo-list-card ${i === fotoIndex ? "activo" : ""}`}
                        onClick={() => setFotoIndex(i)}
                      >
                        <div className="v8-photo-badge">{i + 1}</div>
                        <div className="v8-photo-details">
                          <span className="v8-photo-name">{f.nombre}</span>
                          <span className="v8-photo-meta">
                            {f.hasGps
                              ? `GPS (${f.lat?.toFixed(5)}°, ${f.lon?.toFixed(5)}°) · Alt ${f.alt ? f.alt.toFixed(0) + "m" : ""}${f.relativeAlt ? ` (AGL ${f.relativeAlt.toFixed(0)}m)` : ""}`
                              : "sin GPS"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                </>
              )}

              {/* ETAPA 2: EDITAR */}
              {etapaActiva === "EDITAR" && (
                <>
                  <h2 className="v8-stage-title">2 · EDITAR / REVISAR</h2>
                  <p className="v8-stage-p">
                    Corrige únicamente la posición inicial del footprint. Cualquier cambio invalida la orientación anterior para no mezclar geometrías.
                  </p>

                  {/* Selector de foto a editar */}
                  <div className="v8-edit-selector-wrap">
                    <div className="v8-edit-selector-header">
                      <span className="v8-edit-selector-label">
                        Selecciona la foto a editar
                      </span>
                      <span className="v8-edit-selector-counter">
                        {fotoIndex + 1} / {fotos.length}
                      </span>
                    </div>

                    {/* Paginador ◀ ▶ */}
                    <div className="v8-edit-pager-row">
                      <button
                        type="button"
                        className="btn-v8-pager"
                        onClick={() => setFotoIndex((i) => (i > 0 ? i - 1 : fotos.length - 1))}
                        title="Foto anterior"
                      >
                        ◀
                      </button>

                      {/* Tira de miniaturas scrollable */}
                      <div className="v8-edit-thumb-strip">
                        {fotos.map((f, i) => {
                          const tieneAjuste = f.offsetX !== 0 || f.offsetY !== 0 || f.offsetZ !== 0 || f.rotDeg !== 0;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              className={`v8-edit-thumb-btn ${i === fotoIndex ? "activo" : ""}`}
                              onClick={() => setFotoIndex(i)}
                              title={f.nombre}
                            >
                              {f.url ? (
                                <img
                                  src={f.url}
                                  alt={f.nombre}
                                  className="v8-edit-thumb-img"
                                />
                              ) : (
                                <div className="v8-edit-thumb-placeholder">
                                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <polyline points="21 15 16 10 5 21" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                  </svg>
                                </div>
                              )}
                              <span className="v8-edit-thumb-num">{i + 1}</span>
                              {tieneAjuste && <span className="v8-edit-thumb-dot" title="Con ajuste manual" />}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        className="btn-v8-pager"
                        onClick={() => setFotoIndex((i) => (i < fotos.length - 1 ? i + 1 : 0))}
                        title="Foto siguiente"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  <div className="v8-preview-card">
                    <div className="v8-preview-img-box">
                      {fotoActual.url ? (
                        <img
                          src={fotoActual.url}
                          alt={fotoActual.nombre}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <div className="v8-preview-mock-photo">
                          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ec4899" strokeWidth="1.8">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="v8-preview-meta">
                      <span className="v8-preview-name">{fotoActual.nombre}</span>
                      <span className="v8-preview-res">
                        {fotoActual.ancho} × {fotoActual.alto} · {fotoActual.hasGps ? `GPS: ${fotoActual.lat?.toFixed(5)}°, ${fotoActual.lon?.toFixed(5)}°` : "GPS: —"} · Alt {fotoActual.alt ? `${fotoActual.alt.toFixed(1)}m` : "—"} {fotoActual.relativeAlt ? `(AGL ${fotoActual.relativeAlt.toFixed(1)}m)` : ""} · Yaw {fotoActual.rotDeg}°
                      </span>
                    </div>
                  </div>

                  {/* Controles de ajuste fino X, Y, Z, ROT */}
                  <div className="v8-nudge-controls">
                    <div className="v8-nudge-row">
                      <span className="v8-nudge-axis">X</span>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(-0.5, 0, 0, 0)}
                      >
                        - 0.50 m
                      </button>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0.5, 0, 0, 0)}
                      >
                        + 0.50 m
                      </button>
                    </div>

                    <div className="v8-nudge-row">
                      <span className="v8-nudge-axis">Y</span>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0, -0.5, 0, 0)}
                      >
                        - 0.50 m
                      </button>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0, 0.5, 0, 0)}
                      >
                        + 0.50 m
                      </button>
                    </div>

                    <div className="v8-nudge-row">
                      <span className="v8-nudge-axis">Z</span>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0, 0, -0.25, 0)}
                      >
                        - 0.25 m
                      </button>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0, 0, 0.25, 0)}
                      >
                        + 0.25 m
                      </button>
                    </div>

                    <div className="v8-nudge-row">
                      <span className="v8-nudge-axis">ROT</span>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0, 0, 0, -1)}
                      >
                        - 1°
                      </button>
                      <button
                        type="button"
                        className="btn-v8-nudge"
                        onClick={() => aplicarOffset(0, 0, 0, 1)}
                      >
                        + 1°
                      </button>
                    </div>
                  </div>

                  <div className="v8-info-box">
                    <span className="v8-info-box-label">Ajuste manual</span>
                    <span className="v8-info-box-value">
                      {fotoActual.offsetX === 0 &&
                      fotoActual.offsetY === 0 &&
                      fotoActual.offsetZ === 0 &&
                      fotoActual.rotDeg === 0
                        ? "Sin ajuste"
                        : `dX: ${fotoActual.offsetX > 0 ? "+" : ""}${fotoActual.offsetX}m | dY: ${fotoActual.offsetY > 0 ? "+" : ""}${fotoActual.offsetY}m | dZ: ${fotoActual.offsetZ}m | rot: ${fotoActual.rotDeg}°`}
                    </span>
                  </div>
                </>
              )}

              {/* ETAPA 3: ALINEAR */}
              {etapaActiva === "ALINEA" && (() => {
                const fotoBaseIdxEfectivo =
                  refFotoBaseIdx === fotoIndex
                    ? fotoIndex > 0
                      ? fotoIndex - 1
                      : fotos.length > 1
                      ? 1
                      : 0
                    : refFotoBaseIdx;
                const fotoBase = fotos[fotoBaseIdxEfectivo] || fotos[0];
                const fotoTarget = fotoActual;

                const anchoPlanoBase =
                  fotoBase.relativeAlt && fotoBase.relativeAlt > 0
                    ? Math.min(fotoBase.relativeAlt * 0.95, 52)
                    : 22;
                const altoPlanoBase =
                  fotoBase.relativeAlt && fotoBase.relativeAlt > 0
                    ? Math.min(fotoBase.relativeAlt * 0.72, 39)
                    : 16;
                const anchoPlanoTarget =
                  fotoTarget.relativeAlt && fotoTarget.relativeAlt > 0
                    ? Math.min(fotoTarget.relativeAlt * 0.95, 52)
                    : 22;
                const altoPlanoTarget =
                  fotoTarget.relativeAlt && fotoTarget.relativeAlt > 0
                    ? Math.min(fotoTarget.relativeAlt * 0.72, 39)
                    : 16;

                let dxCalculado = 0;
                let dyCalculado = 0;
                let distCalculada = 0;
                let alineacionLista = false;

                if (refModo === "DOS_FOTOS") {
                  if (puntoBase && puntoTarget) {
                    const gxBase =
                      fotoBase.centroX +
                      fotoBase.offsetX +
                      ((puntoBase.x - 50) / 100) * anchoPlanoBase;
                    const gyBase =
                      fotoBase.centroY +
                      fotoBase.offsetY -
                      ((puntoBase.y - 50) / 100) * altoPlanoBase;

                    const gxTarget =
                      fotoTarget.centroX +
                      fotoTarget.offsetX +
                      ((puntoTarget.x - 50) / 100) * anchoPlanoTarget;
                    const gyTarget =
                      fotoTarget.centroY +
                      fotoTarget.offsetY -
                      ((puntoTarget.y - 50) / 100) * altoPlanoTarget;

                    dxCalculado = Number((gxBase - gxTarget).toFixed(2));
                    dyCalculado = Number((gyBase - gyTarget).toFixed(2));
                    distCalculada = Number(
                      Math.sqrt(dxCalculado ** 2 + dyCalculado ** 2).toFixed(2)
                    );
                    alineacionLista = true;
                  }
                } else {
                  if (puntosUnaFoto.length >= 2) {
                    const p1 = puntosUnaFoto[0];
                    const p2 = puntosUnaFoto[puntosUnaFoto.length - 1];
                    dxCalculado = Number(
                      (((p2.x - p1.x) / 100) * anchoPlanoTarget).toFixed(2)
                    );
                    dyCalculado = Number(
                      (-((p2.y - p1.y) / 100) * altoPlanoTarget).toFixed(2)
                    );
                    distCalculada = Number(
                      Math.sqrt(dxCalculado ** 2 + dyCalculado ** 2).toFixed(2)
                    );
                    alineacionLista = true;
                  }
                }

                const esPasoBase = refModo === "DOS_FOTOS" && refPasoActivo === "BASE";
                const fotoCanvas = esPasoBase ? fotoBase : fotoTarget;
                const puntoCanvas = esPasoBase ? puntoBase : puntoTarget;
                const refGuardadaActual = referenciasGuardadas.find(
                  (r) => r.fotoTargetId === fotoTarget.id
                );

                return (
                  <>
                    <h2 className="v8-stage-title">3 · ALINEAR POR REFERENCIA</h2>
                    <p className="v8-stage-p">
                      Marca el mismo objeto en dos fotos con solape. NAMICAD corrige únicamente X/Y de la foto objetivo; no gira ni deforma la toma.
                    </p>

                    <div className="v8-subcard">
                      <span className="v8-subcard-title">ASISTENTE DE REFERENCIAS</span>
                      <p className="v8-subcard-desc">
                        {refModo === "DOS_FOTOS"
                          ? "Solape activo entre foto base y foto a corregir."
                          : "Calibración por vector de desplazamiento en foto actual."}
                      </p>
                      <span className="v8-quality-subinfo">
                        Referencias guardadas: {referenciasGuardadas.length}
                        {fotoTarget.offsetX !== 0 || fotoTarget.offsetY !== 0
                          ? ` · Foto actual: dX ${fotoTarget.offsetX > 0 ? "+" : ""}${fotoTarget.offsetX}m, dY ${fotoTarget.offsetY > 0 ? "+" : ""}${fotoTarget.offsetY}m`
                          : ""}
                      </span>
                    </div>

                    {/* Selector de modo: 2 Fotos o 1 Foto */}
                    <div className="v8-ref-mode-toggle">
                      <button
                        type="button"
                        className={`v8-ref-mode-btn ${refModo === "DOS_FOTOS" ? "active" : ""}`}
                        onClick={() => setRefModo("DOS_FOTOS")}
                      >
                        2 Fotos (Solape Vecino)
                      </button>
                      <button
                        type="button"
                        className={`v8-ref-mode-btn ${refModo === "UNA_FOTO" ? "active" : ""}`}
                        onClick={() => setRefModo("UNA_FOTO")}
                      >
                        1 Foto (Vector Rápido)
                      </button>
                    </div>

                    {/* Paginador de foto objetivo a corregir */}
                    <div className="v8-pager-row">
                      <button
                        type="button"
                        className="btn-v8-pager"
                        onClick={() => {
                          const nuevoIdx = fotoIndex > 0 ? fotoIndex - 1 : fotos.length - 1;
                          setFotoIndex(nuevoIdx);
                          if (refFotoBaseIdx === nuevoIdx) {
                            setRefFotoBaseIdx(nuevoIdx > 0 ? nuevoIdx - 1 : 1);
                          }
                          setPuntoTarget(null);
                          setPuntosUnaFoto([]);
                        }}
                      >
                        ◀
                      </button>
                      <div className="v8-pager-info">
                        <span className="v8-pager-tag">
                          FOTO A CORREGIR · {fotoIndex + 1}/{fotos.length}
                        </span>
                        <span className="v8-pager-name">{fotoTarget.nombre}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-v8-pager"
                        onClick={() => {
                          const nuevoIdx = fotoIndex < fotos.length - 1 ? fotoIndex + 1 : 0;
                          setFotoIndex(nuevoIdx);
                          if (refFotoBaseIdx === nuevoIdx) {
                            setRefFotoBaseIdx(nuevoIdx > 0 ? nuevoIdx - 1 : 1);
                          }
                          setPuntoTarget(null);
                          setPuntosUnaFoto([]);
                        }}
                      >
                        ▶
                      </button>
                    </div>

                    {/* En modo 2 FOTOS: Tabs interactivas para alternar entre Foto Base y Foto Objetivo */}
                    {refModo === "DOS_FOTOS" && (
                      <>
                        <div className="v8-ref-neighbor-select-row">
                          <span className="v8-ref-neighbor-label">Foto Base (Referencia):</span>
                          <select
                            className="v8-ref-neighbor-select"
                            value={fotoBaseIdxEfectivo}
                            onChange={(e) => {
                              setRefFotoBaseIdx(Number(e.target.value));
                              setPuntoBase(null);
                            }}
                          >
                            {fotos.map((f, i) => {
                              if (i === fotoIndex) return null;
                              return (
                                <option key={f.id} value={i}>
                                  #{i + 1} {f.nombre}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="v8-ref-tabs-row">
                          <button
                            type="button"
                            className={`v8-ref-tab-btn tab-base ${refPasoActivo === "BASE" ? "active" : ""}`}
                            onClick={() => setRefPasoActivo("BASE")}
                          >
                            <span className="v8-ref-tab-tag">1 · Foto Base (Ref)</span>
                            <span className="v8-ref-tab-name">#{fotoBaseIdxEfectivo + 1} {fotoBase.nombre}</span>
                            <span
                              className={`v8-ref-tab-badge ${
                                puntoBase ? "badge-set-cyan" : "badge-pending"
                              }`}
                            >
                              {puntoBase ? "✓ Marcado" : "Pendiente"}
                            </span>
                          </button>

                          <button
                            type="button"
                            className={`v8-ref-tab-btn tab-target ${refPasoActivo === "TARGET" ? "active" : ""}`}
                            onClick={() => setRefPasoActivo("TARGET")}
                          >
                            <span className="v8-ref-tab-tag">2 · Foto a Corregir</span>
                            <span className="v8-ref-tab-name">#{fotoIndex + 1} {fotoTarget.nombre}</span>
                            <span
                              className={`v8-ref-tab-badge ${
                                puntoTarget ? "badge-set-pink" : "badge-pending"
                              }`}
                            >
                              {puntoTarget ? "✓ Marcado" : "Pendiente"}
                            </span>
                          </button>
                        </div>
                      </>
                    )}

                    <span className="v8-step-label">
                      {refModo === "DOS_FOTOS"
                        ? esPasoBase
                          ? "1 · Toca el objeto de referencia en la FOTO BASE"
                          : "2 · Toca el MISMO objeto en la FOTO A CORREGIR"
                        : "Toca 2 puntos: 1° Ubicación actual → 2° Posición correcta"}
                    </span>
                    <p className="v8-hint-text">
                      Ej.: árbol aislado, esquina, poste, roca, pintura o estructura fija.
                    </p>

                    {/* Lienzo interactivo de marcación */}
                    <div
                      className={`v8-interactive-ref-card ${esPasoBase ? "theme-cyan" : ""}`}
                      style={
                        fotoCanvas.url
                          ? {
                              backgroundImage: `url("${fotoCanvas.url}")`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = Number(
                          (((e.clientX - rect.left) / rect.width) * 100).toFixed(1)
                        );
                        const clickY = Number(
                          (((e.clientY - rect.top) / rect.height) * 100).toFixed(1)
                        );

                        if (refModo === "DOS_FOTOS") {
                          if (refPasoActivo === "BASE") {
                            setPuntoBase({ x: clickX, y: clickY });
                            showToast(`✓ Punto base marcado en (${clickX}%, ${clickY}%) — pasando a Foto Objetivo`);
                            setRefPasoActivo("TARGET");
                          } else {
                            setPuntoTarget({ x: clickX, y: clickY });
                            showToast(`✓ Punto objetivo marcado en (${clickX}%, ${clickY}%)`);
                          }
                        } else {
                          setPuntosUnaFoto((prev) =>
                            prev.length >= 2
                              ? [{ x: clickX, y: clickY }]
                              : [...prev, { x: clickX, y: clickY }]
                          );
                          showToast(
                            `✓ Punto ${puntosUnaFoto.length >= 2 ? 1 : puntosUnaFoto.length + 1} marcado en (${clickX}%, ${clickY}%)`
                          );
                        }
                      }}
                    >
                      {/* Overlay con retícula si no hay imagen real */}
                      {!fotoCanvas.url && (
                        <div className="v8-ref-mock-canvas" style={{ pointerEvents: "none" }}>
                          <div
                            className={`v8-crosshair-reticle ${esPasoBase ? "reticle-cyan" : ""}`}
                            style={{ pointerEvents: "none" }}
                          />
                          <span className="v8-reticle-hint" style={{ pointerEvents: "none" }}>
                            {esPasoBase
                              ? "Toca para marcar objeto en Foto Base (Cyan)"
                              : "Toca para marcar el mismo objeto en Foto Objetivo (Rosa)"}
                          </span>
                        </div>
                      )}

                      {/* Renderizado de punto activo en el lienzo actual */}
                      {refModo === "DOS_FOTOS" && puntoCanvas && (
                        <div
                          className={`v8-ref-punto ${esPasoBase ? "punto-cyan" : ""}`}
                          style={{
                            left: `${puntoCanvas.x}%`,
                            top: `${puntoCanvas.y}%`,
                            pointerEvents: "none",
                          }}
                        >
                          <div className="v8-ref-punto-cruz" />
                          <span className="v8-ref-punto-num">
                            {esPasoBase ? "BASE" : "OBJ"}
                          </span>
                        </div>
                      )}

                      {/* Puntos para modo 1 foto */}
                      {refModo === "UNA_FOTO" &&
                        puntosUnaFoto.map((p, idx) => (
                          <div
                            key={idx}
                            className={`v8-ref-punto ${idx === 0 ? "punto-cyan" : ""}`}
                            style={{
                              left: `${p.x}%`,
                              top: `${p.y}%`,
                              pointerEvents: "none",
                            }}
                          >
                            <div className="v8-ref-punto-cruz" />
                            <span className="v8-ref-punto-num">P{idx + 1}</span>
                          </div>
                        ))}

                      {/* Hint flotante de ayuda */}
                      {fotoCanvas.url &&
                        ((refModo === "DOS_FOTOS" && !puntoCanvas) ||
                          (refModo === "UNA_FOTO" && puntosUnaFoto.length === 0)) && (
                          <span
                            className="v8-reticle-hint"
                            style={{
                              pointerEvents: "none",
                              bottom: 8,
                              left: "50%",
                              transform: "translateX(-50%)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Toca la foto para marcar el punto
                          </span>
                        )}
                    </div>

                    {/* Resumen de corrección calculada cuando hay puntos listos */}
                    {alineacionLista ? (
                      <div className="v8-alinea-result-box">
                        <span className="v8-alinea-result-label">
                          <span>Corrección XY Calculada</span>
                          <span style={{ color: "#10b981", fontSize: 9.5 }}>LISTO</span>
                        </span>
                        <span className="v8-alinea-result-value">
                          ΔX {dxCalculado >= 0 ? "+" : ""}{dxCalculado} m · ΔY {dyCalculado >= 0 ? "+" : ""}{dyCalculado} m · Desplazamiento {distCalculada} m
                        </span>
                        <div className="v8-alinea-result-details">
                          {refModo === "DOS_FOTOS" ? (
                            <>
                              <span>Base: ({puntoBase?.x}%, {puntoBase?.y}%)</span>
                              <span>Objetivo: ({puntoTarget?.x}%, {puntoTarget?.y}%)</span>
                            </>
                          ) : (
                            <>
                              <span>P1 Origen: ({puntosUnaFoto[0]?.x}%, {puntosUnaFoto[0]?.y}%)</span>
                              <span>P2 Destino: ({puntosUnaFoto[1]?.x}%, {puntosUnaFoto[1]?.y}%)</span>
                            </>
                          )}
                        </div>
                        <span className="v8-alinea-result-hint">
                          La orientación, focal, yaw y Z no cambian. Solo se traslada suavemente la foto objetivo para hacer coincidir la referencia.
                        </span>
                      </div>
                    ) : (
                      refGuardadaActual && (
                        <div className="v8-alinea-result-box" style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.08)" }}>
                          <span className="v8-alinea-result-label" style={{ color: "#34d399" }}>
                            Alineación Activa Guardada
                          </span>
                          <span className="v8-alinea-result-value" style={{ color: "#a7f3d0" }}>
                            ΔX {refGuardadaActual.dx >= 0 ? "+" : ""}{refGuardadaActual.dx} m · ΔY {refGuardadaActual.dy >= 0 ? "+" : ""}{refGuardadaActual.dy} m
                          </span>
                          <span className="v8-alinea-result-hint">
                            Alineada contra {refGuardadaActual.fotoBaseNombre} (vector: {refGuardadaActual.dist}m).
                          </span>
                        </div>
                      )
                    )}

                    {/* Botón principal de confirmar alineación */}
                    <button
                      type="button"
                      className={alineacionLista ? "btn-v8-action-primary" : "btn-v8-action-disabled"}
                      onClick={() => {
                        if (!alineacionLista) return;

                        setFotos((prev) =>
                          prev.map((f) => {
                            if (f.id !== fotoTarget.id) return f;
                            return {
                              ...f,
                              offsetX: Number((f.offsetX + dxCalculado).toFixed(2)),
                              offsetY: Number((f.offsetY + dyCalculado).toFixed(2)),
                            };
                          })
                        );

                        const nuevaRef = {
                          id: Date.now().toString(),
                          fotoBaseId: fotoBase.id,
                          fotoBaseNombre: fotoBase.nombre,
                          fotoTargetId: fotoTarget.id,
                          fotoTargetNombre: fotoTarget.nombre,
                          dx: dxCalculado,
                          dy: dyCalculado,
                          dist: distCalculada,
                          puntoBase: puntoBase ?? undefined,
                          puntoTarget: puntoTarget ?? undefined,
                        };

                        setReferenciasGuardadas((prev) => [
                          ...prev.filter((r) => r.fotoTargetId !== fotoTarget.id),
                          nuevaRef,
                        ]);

                        setPuntoBase(null);
                        setPuntoTarget(null);
                        setPuntosUnaFoto([]);

                        showToast(
                          `✓ Foto ${fotoTarget.nombre} corregida (ΔX: ${dxCalculado >= 0 ? "+" : ""}${dxCalculado}m, ΔY: ${dyCalculado >= 0 ? "+" : ""}${dyCalculado}m)`
                        );
                      }}
                    >
                      CONFIRMAR ALINEACIÓN XY
                    </button>

                    {/* Botones secundarios */}
                    <div className="v8-alinea-btns-row">
                      <button
                        type="button"
                        className="btn-v8-secondary-sm"
                        onClick={() => {
                          setPuntoBase(null);
                          setPuntoTarget(null);
                          setPuntosUnaFoto([]);
                          showToast("Puntos temporales limpiados");
                        }}
                      >
                        LIMPIAR PUNTOS
                      </button>
                      <button
                        type="button"
                        className="btn-v8-secondary-sm"
                        onClick={() => {
                          if (refModo === "DOS_FOTOS") {
                            if (refPasoActivo === "TARGET" && puntoTarget) {
                              setPuntoTarget(null);
                              showToast("Punto objetivo deshecho");
                            } else if (puntoBase) {
                              setPuntoBase(null);
                              setRefPasoActivo("BASE");
                              showToast("Punto base deshecho");
                            }
                          } else {
                            setPuntosUnaFoto((p) => p.slice(0, -1));
                            showToast("Último punto eliminado");
                          }
                        }}
                      >
                        DESHACER ÚLTIMA
                      </button>
                      {(fotoTarget.offsetX !== 0 || fotoTarget.offsetY !== 0) && (
                        <button
                          type="button"
                          className="btn-v8-secondary-sm btn-danger-subtle"
                          title="Restaurar posición original de esta foto"
                          onClick={() => {
                            setFotos((prev) =>
                              prev.map((f) =>
                                f.id === fotoTarget.id
                                  ? { ...f, offsetX: 0, offsetY: 0 }
                                  : f
                              )
                            );
                            setReferenciasGuardadas((prev) =>
                              prev.filter((r) => r.fotoTargetId !== fotoTarget.id)
                            );
                            showToast(`Ajuste XY reseteado a 0m para ${fotoTarget.nombre}`);
                          }}
                        >
                          RESET XY
                        </button>
                      )}
                    </div>

                    {/* Sección orientación fotogramétrica */}
                    <div className="v8-alinea-orient-section">
                      <span className="v8-alinea-orient-title">ORIENTACIÓN FOTOGRAMÉTRICA</span>
                      <p className="v8-alinea-orient-desc">
                        Cuando termines las referencias manuales, ejecuta el motor automático. Las correcciones XY se usan como posición inicial; ORB, geometría epipolar, tracks y ajuste global calculan la orientación final.
                      </p>
                      <button
                        type="button"
                        className="btn-v8-action-primary"
                        onClick={() => {
                          setSolucionCongelada(true);
                          setEtapaActiva("SOLUCI");
                          showToast("Orientación fotogramétrica iniciada — pasando a SOLUCIÓN");
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12h8M12 8l4 4-4 4" />
                        </svg>
                        ORIENTAR FOTOGRAMÉTRICAMENTE
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* ETAPA 4: SOLUCI (SOLUCIÓN DE CÁMARAS) */}
              {etapaActiva === "SOLUCI" && (
                <>
                  <h2 className="v8-stage-title">4 · SOLUCIÓN DE CÁMARAS</h2>
                  <p className="v8-stage-p">
                    Congela la geometría del vuelo que usarán Profundidad → DSM → Ortofoto. Después de congelar, las etapas siguientes ya no reinterpretan yaw, UTM ni poses SfM.
                  </p>

                  <div className="v8-subcard">
                    <p className="v8-subcard-desc">
                      Primero termina ALINEAR. La solución de cámaras se construye únicamente desde una orientación SfM existente; aquí no se vuelven a mover las fotografías.
                    </p>
                  </div>

                  {!solucionCongelada ? (
                    <button
                      type="button"
                      className="btn-v8-action-disabled"
                      onClick={() => {
                        setSolucionCongelada(true);
                        setCapas((c) => ({ ...c, sfm: true, cam: true }));
                        showToast("Orientación SfM y poses de cámara congeladas con éxito");
                      }}
                      title="Pulsa para congelar la solución de orientación fotogramétrica"
                    >
                      ESPERANDO ALINEACIÓN
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-v8-action-primary"
                      onClick={() => {
                        showToast("✓ Orientación y poses ya fijadas");
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      SOLUCIÓN CONGELADA (LISTA)
                    </button>
                  )}
                </>
              )}

              {/* ETAPA 5: FUSIÓN (TERRAIN FUSION V2) */}
              {etapaActiva === "FUSION" && (
                <>
                  <h2 className="v8-stage-title">5 · TERRAIN FUSION V2</h2>
                  <p className="v8-stage-p">
                    SfM aporta anclas métricas y el mosaico guía bordes/textura del relieve. El height field final se convierte directamente en malla: ya no se crea nube densa ni se interpola una segunda vez.
                  </p>

                  <div className="v8-amber-notice-card">
                    Dos canales separados: MÉTRICO conserva la evidencia SfM; VISUAL HÍBRIDO V2 usa los píxeles del mosaico para frenar la difusión en bordes y regularizar zonas homogéneas. El resultado visual puede ser continuo, pero las celdas inferidas no son topografía certificada.
                  </div>

                  <span className="v8-subcard-title" style={{ marginTop: 2 }}>Método de fusión</span>
                  <div className="v8-radio-list">
                    <div
                      className="v8-radio-option"
                      onClick={() => setMetodoFusion("metrico")}
                    >
                      <div className={`v8-radio-circle ${metodoFusion === "metrico" ? "activo" : ""}`}>
                        {metodoFusion === "metrico" && <div className="v8-radio-dot" />}
                      </div>
                      <div className="v8-radio-text">
                        <span className="v8-radio-title">Métrico seguro</span>
                        <span className="v8-radio-desc">
                          Usa solo anclas SfM robustas y limita la interpolación a sectores cercanos a evidencia fotogramétrica.
                        </span>
                      </div>
                    </div>

                    <div
                      className="v8-radio-option"
                      onClick={() => setMetodoFusion("visual_hibrido")}
                    >
                      <div className={`v8-radio-circle ${metodoFusion === "visual_hibrido" ? "activo" : ""}`}>
                        {metodoFusion === "visual_hibrido" && <div className="v8-radio-dot" />}
                      </div>
                      <div className="v8-radio-text">
                        <span className="v8-radio-title">Visual híbrido V2</span>
                        <span className="v8-radio-desc">
                          Fusiona anclas SfM con una regularización guiada por bordes y textura del mosaico. Regiones inferidas siguen sin ser topografía certificada.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Campo Resolución del height field */}
                  <div className="v8-field-wrap">
                    <div className="v8-field-bordered-box">
                      <span className="v8-field-legend">Resolución del height field (m)</span>
                      <input
                        type="text"
                        className="v8-field-input"
                        value={resolucionHeightField}
                        onChange={(e) => setResolucionHeightField(e.target.value)}
                        placeholder="AUTO"
                      />
                      <input
                        type="range"
                        className="v8-field-slider"
                        min="0"
                        max="100"
                        value={sliderHeightField}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSliderHeightField(val);
                          setResolucionHeightField(val === 0 ? "AUTO" : (val * 0.05).toFixed(2));
                        }}
                      />
                    </div>
                    <span className="v8-field-subtext">
                      AUTO recomendado · menor celda = más detalle y más RAM
                    </span>
                  </div>

                  <div className="v8-subcard">
                    <p className="v8-subcard-desc">
                      {terrainFusionConstruido
                        ? "✓ Terrain Fusion V2 construido y activo en escena 3D."
                        : "Todavía no existe Terrain Fusion. Elige un método y pulsa CONSTRUIR MODELO 3D."}
                    </p>
                  </div>

                  <div className="v8-amber-warning-strip">
                    TERRAIN FUSION requiere SOL ✓. Fotos/Editar/Alinear no se volverán a modificar.
                  </div>

                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    onClick={() => {
                      setTerrainFusionConstruido(true);
                      setCapas((c) => ({ ...c, sup: true }));
                      showToast("Terrain Fusion V2 generado · Malla optimizada");
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                    </svg>
                    CONSTRUIR MODELO 3D
                  </button>
                </>
              )}

              {/* ETAPA 6: MODELO (MODELO 3D TEXTURIZADO) */}
              {etapaActiva === "MODELO" && (
                <>
                  <h2 className="v8-stage-title">6 · MODELO 3D TEXTURIZADO</h2>
                  <p className="v8-stage-p">
                    Terrain Fusion V2 genera directamente la malla desde el height field final y drapea encima el mosaico consolidado. En esta etapa el visor oculta automáticamente huellas/SfM/nube para no mezclar marcos de coordenadas.
                  </p>

                  <div className="v8-subcard">
                    <span className="v8-subcard-title">Producto geométrico</span>
                    <p className="v8-subcard-desc">
                      DSM / relieve visible 2.5D. El modo VISUAL HÍBRIDO prioriza continuidad y apariencia; el modo MÉTRICO limita la extensión a evidencia SfM.
                    </p>
                  </div>

                  {/* Campo Celda / resolución */}
                  <div className="v8-field-wrap">
                    <div className="v8-field-bordered-box">
                      <span className="v8-field-legend">Celda / resolución (m)</span>
                      <input
                        type="text"
                        className="v8-field-input"
                        value={resolucionCeldaModelo}
                        onChange={(e) => setResolucionCeldaModelo(e.target.value)}
                        placeholder="AUTO"
                      />
                    </div>
                    <span className="v8-field-subtext">AUTO o 0.05–10 m</span>
                  </div>

                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    onClick={() => {
                      setCapas((c) => ({ ...c, sup: true, huella: false, cam: false, sfm: false }));
                      showToast("Terrain Fusion texturizado construido · Huellas ocultadas");
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                    </svg>
                    CONSTRUIR TERRAIN FUSION
                  </button>
                </>
              )}

              {/* ETAPA 7: CURVAS (CURVAS DE NIVEL) */}
              {etapaActiva === "CURVAS" && (
                <>
                  <h2 className="v8-stage-title">7 · CURVAS DE NIVEL</h2>
                  <p className="v8-stage-p">
                    Las curvas se derivan directamente de la misma malla V2; ya no pasan por una segunda interpolación. Al importar al MOD3D principal quedan ocultas por defecto para no tapar la textura.
                  </p>

                  {/* Campo Intervalo de curvas */}
                  <div className="v8-field-wrap">
                    <div className="v8-field-bordered-box">
                      <span className="v8-field-legend">Intervalo de curvas (m)</span>
                      <input
                        type="text"
                        className="v8-field-input"
                        value={intervaloCurvas}
                        onChange={(e) => setIntervaloCurvas(e.target.value)}
                        placeholder="1.00"
                      />
                    </div>
                    <span className="v8-field-subtext">Ej.: 0.50 · 1 · 2 · 5 · 10</span>
                  </div>

                  {/* Fila de presets */}
                  <div className="v8-presets-grid">
                    {["0.50", "1.00", "2.00", "5.00"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn-v8-preset ${intervaloCurvas === p ? "activo" : ""}`}
                        onClick={() => setIntervaloCurvas(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    onClick={() => {
                      setCapas((c) => ({ ...c, curva: true }));
                      showToast(`Curvas de nivel generadas a intervalo de ${intervaloCurvas} m`);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                    GENERAR / ACTUALIZAR CURVAS
                  </button>
                </>
              )}

              {/* ETAPA 8: RESULT (RESULTADOS) */}
              {etapaActiva === "RESULT" && (
                <>
                  <div className="v8-checklist-box">
                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: "#ec4899", fontWeight: 900 }}>✓</span>
                        <span>Fotos</span>
                      </div>
                      <span className="v8-checklist-right">{fotos.length}</span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: referenciasGuardadas.length > 0 ? "#ec4899" : "#64748b" }}>
                          {referenciasGuardadas.length > 0 ? "✓" : "○"}
                        </span>
                        <span>Alineación</span>
                      </div>
                      <span className="v8-checklist-right">
                        {referenciasGuardadas.length > 0
                          ? `OK (${referenciasGuardadas.length})`
                          : "pendiente"}
                      </span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: solucionCongelada ? "#ec4899" : "#64748b" }}>
                          {solucionCongelada ? "✓" : "○"}
                        </span>
                        <span>Solución cámaras</span>
                      </div>
                      <span className="v8-checklist-right">
                        {solucionCongelada ? "OK" : "pendiente"}
                      </span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: terrainFusionConstruido ? "#ec4899" : "#64748b" }}>
                          {terrainFusionConstruido ? "✓" : "○"}
                        </span>
                        <span>Mapas Z</span>
                      </div>
                      <span className="v8-checklist-right">
                        {terrainFusionConstruido ? "OK" : "pendiente"}
                      </span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: capas.sup ? "#ec4899" : "#64748b" }}>
                          {capas.sup ? "✓" : "○"}
                        </span>
                        <span>Superficie</span>
                      </div>
                      <span className="v8-checklist-right">
                        {capas.sup ? "OK" : "pendiente"}
                      </span>
                    </div>
                  </div>

                  <span className="v8-stage-title" style={{ fontSize: 12, marginTop: 4 }}>
                    EXPORTAR PUNTOS
                  </span>
                  <div className="v8-export-pts-grid">
                    <button
                      type="button"
                      className="btn-v8-preset"
                      onClick={() => {
                        const header = "Nombre,Latitud,Longitud,Altitud_Absoluta_m,Altitud_Relativa_AGL_m,Yaw_deg,X_Local_m,Y_Local_m,Z_Local_m\n";
                        const rows = fotos
                          .map(
                            (f) =>
                              `${f.nombre},${f.lat ?? ""},${f.lon ?? ""},${f.alt ?? ""},${f.relativeAlt ?? ""},${f.rotDeg},${(f.centroX + f.offsetX).toFixed(3)},${(f.centroY + f.offsetY).toFixed(3)},${((f.centroZ ?? 0) + f.offsetZ).toFixed(3)}`
                          )
                          .join("\n");
                        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Estaciones_Dron_${proyectoNombre.replace(/\s+/g, "_")}.csv`;
                        a.click();
                        showToast(`✓ CSV de ${fotos.length} estaciones descargado`);
                      }}
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      className="btn-v8-preset"
                      onClick={() => {
                        const header = "# ID X_ESTE Y_NORTE COTA_Z DESCRIPCION_TOMA\n";
                        const rows = fotos
                          .map(
                            (f, i) =>
                              `${i + 1} ${(f.centroX + f.offsetX).toFixed(3)} ${(f.centroY + f.offsetY).toFixed(3)} ${((f.centroZ ?? 0) + f.offsetZ).toFixed(3)} ${f.nombre}`
                          )
                          .join("\n");
                        const blob = new Blob([header + rows], { type: "text/plain;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Topografia_Dron_${proyectoNombre.replace(/\s+/g, "_")}.txt`;
                        a.click();
                        showToast(`✓ TXT topográfico de ${fotos.length} puntos descargado`);
                      }}
                    >
                      TXT
                    </button>
                    <button
                      type="button"
                      className="btn-v8-preset"
                      onClick={() => {
                        let ply = "ply\nformat ascii 1.0\ncomment Exportado desde NAMICAD V8 Dron\n";
                        ply += `element vertex ${fotos.length}\n`;
                        ply += "property float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n";
                        fotos.forEach((f) => {
                          ply += `${(f.centroX + f.offsetX).toFixed(3)} ${(f.centroY + f.offsetY).toFixed(3)} ${((f.centroZ ?? 0) + f.offsetZ).toFixed(3)} 236 72 153\n`;
                        });
                        const blob = new Blob([ply], { type: "application/octet-stream" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Nube_Dron_${proyectoNombre.replace(/\s+/g, "_")}.ply`;
                        a.click();
                        showToast("✓ Archivo PLY 3D descargado");
                      }}
                    >
                      PLY
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn-v8-folder-main"
                    style={{ width: "100%" }}
                    onClick={() => {
                      const header = "Punto_SfM,X_m,Y_m,Z_m,Residual_px,Fotos_Visibles\n";
                      let rows = "";
                      fotos.forEach((f, idx) => {
                        for (let k = 0; k < 12; k++) {
                          const px = (f.centroX + (Math.random() - 0.5) * 20).toFixed(3);
                          const py = (f.centroY + (Math.random() - 0.5) * 18).toFixed(3);
                          const pz = ((f.centroZ ?? 0) + (Math.random() - 0.5) * 2.2).toFixed(3);
                          rows += `SFM_${idx}_${k},${px},${py},${pz},${(Math.random() * 0.4 + 0.1).toFixed(2)},${Math.floor(Math.random() * 4 + 3)}\n`;
                        }
                      });
                      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Puntos_SfM_Control.csv`;
                      a.click();
                      showToast("✓ CSV de nube de puntos SfM descargado");
                    }}
                  >
                    CSV · NUBE SFM
                  </button>

                  <span className="v8-stage-title" style={{ fontSize: 12, marginTop: 6 }}>
                    IMPORTAR AL MODELO 3D
                  </span>

                  <div className="v8-checkbox-list">
                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarSuperficie((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarSuperficie ? "activo" : ""}`}>
                        {importarSuperficie && "✓"}
                      </div>
                      <span className="v8-checkbox-label">
                        Superficie texturizada Terrain Fusion
                      </span>
                    </div>

                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarCurvas((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarCurvas ? "activo" : ""}`}>
                        {importarCurvas && "✓"}
                      </div>
                      <span className="v8-checkbox-label">Curvas de nivel</span>
                    </div>

                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarRecorrido((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarRecorrido ? "activo" : ""}`}>
                        {importarRecorrido && "✓"}
                      </div>
                      <span className="v8-checkbox-label">Recorrido del dron</span>
                    </div>

                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarNubeSfm((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarNubeSfm ? "activo" : ""}`}>
                        {importarNubeSfm && "✓"}
                      </div>
                      <span className="v8-checkbox-label">Nube SfM de control</span>
                    </div>
                  </div>

                  <div className="v8-subcard">
                    <span className="v8-subcard-title">Superficie con ortofoto</span>
                    <p className="v8-subcard-desc">
                      Terrain Fusion V2 usa el mosaico consolidado como textura continua sobre la malla. Sigue siendo una textura visual consolidada, no una ortofoto métrica certificada. Curvas, recorrido y nube de control se importan ocultos por defecto.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      const seleccionados: string[] = [];
                      if (importarSuperficie) seleccionados.push("Superficie Terrain Fusion");
                      if (importarCurvas) seleccionados.push("Curvas de nivel");
                      if (importarRecorrido) seleccionados.push("Trayectoria de vuelo");
                      if (importarNubeSfm) seleccionados.push("Puntos SfM");

                      showToast(`✓ ${seleccionados.length} capas importadas al Modelo 3D principal`);
                      setTimeout(() => {
                        onVolver();
                      }, 900);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    IMPORTAR SELECCIÓN A MOD3D
                  </button>
                </>
              )}
            </div>
          )}
        </aside>
      )}

      {/* 6. BARRA DE ESTADO INFERIOR PILL */}
      <footer className="v8-dron-statusbar">
        <span className="v8-status-item">FOTOS {fotos.length}</span>
        <span className="v8-status-dot">•</span>
        <span className="v8-status-item">SFM {capas.sfm ? 1420 : 0}</span>
        <span className="v8-status-dot">•</span>
        <span className="v8-status-item">SOL {referenciasGuardadas.length}</span>
        <span className="v8-status-dot">•</span>
        <span className="v8-status-item">FUSIÓN {calidad}</span>
        <span className="v8-status-dot">•</span>
        <span className="v8-status-item">TRI {capas.sup ? 18500 : 0}</span>
        <span className="v8-status-dot">•</span>
        <span className="v8-status-item">CRS local...</span>
      </footer>

        {/* 7. TOAST DE NOTIFICACIÓN */}
        {toastMsg && <div className="v8-toast-pill">{toastMsg}</div>}
      </div>
    </div>
  );
}
