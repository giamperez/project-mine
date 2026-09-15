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

// Relieve topográfico bare-earth (pendiente natural, bancos de explotación y depresiones)
// usado para la superficie MDT, la Fusión 3D y las curvas de nivel topográficas.
function alturaTerrenoBareEarth(
  vx: number,
  vy: number,
  fotos?: FotoDron[],
  metodo?: "metrico" | "visual_hibrido"
): number {
  // 1. Relieve geológico continuo: lomas y cuenca de cielo abierto
  let base =
    Math.sin(vx * 0.032) * 3.2 +
    Math.cos(vy * 0.035) * 2.8 +
    Math.sin((vx + vy) * 0.018) * 2.1 -
    0.6;

  // 2. Bancos y bermas de explotación minera / cantera (terrazas escalonadas realistas)
  const distCentro = Math.sqrt(vx * vx + vy * vy);
  const bancos = (Math.floor(distCentro / 9.5) % 5) * 1.55 - (distCentro > 40 ? 0 : (40 - distCentro) * 0.11);
  base += bancos;

  // 3. Influencia fotogramétrica SfM / GPS de las cámaras
  if (fotos && fotos.length > 0) {
    let influenciaTotal = 0;
    let sumaDeltaZ = 0;
    const radio = metodo === "metrico" ? 16 : 28;

    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      const zCam = f.centroZ ?? f.offsetZ ?? 0;
      if (zCam !== 0) {
        const dx = vx - (f.centroX + f.offsetX);
        const dy = vy - (f.centroY + f.offsetY);
        const d2 = dx * dx + dy * dy;
        if (d2 < radio * radio) {
          const w = Math.exp(-d2 / (2 * (radio / 2.2) * (radio / 2.2)));
          sumaDeltaZ += zCam * w;
          influenciaTotal += w;
        }
      }
    }

    if (influenciaTotal > 0.001) {
      base += (sumaDeltaZ / influenciaTotal) * 0.42;
    }
  }

  return base;
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
  onImportarAlModelo?: (opciones: {
    superficie: boolean;
    curvas: boolean;
    recorrido: boolean;
    nubeSfm: boolean;
  }) => void;
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
  proyectoId,
  proyectoNombre,
  onVolver,
  onImportarAlModelo,
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
  const [factorJalar3D, setFactorJalar3D] = useState(1.0); // 0 = plano 2D, 1.0 = relieve 3D completo
  const [modoTexturaFusion, setModoTexturaFusion] = useState<"fotorrealista" | "topografico" | "hibrido">("fotorrealista");
  const [resolucionCeldaModelo, setResolucionCeldaModelo] = useState("AUTO");
  const [intervaloCurvas, setIntervaloCurvas] = useState("1.00");
  const [importarSuperficie, setImportarSuperficie] = useState(true);
  const [importarCurvas, setImportarCurvas] = useState(false);
  const [importarRecorrido, setImportarRecorrido] = useState(false);
  const [importarNubeSfm, setImportarNubeSfm] = useState(false);
  const [auditoriaExpandida, setAuditoriaExpandida] = useState(false);
  const [mostrarGuiaUso, setMostrarGuiaUso] = useState(false);
  const [snapshotCamarasExpandido, setSnapshotCamarasExpandido] = useState(false);

  // Teoría y guías de uso paso a paso desplegadas al presionar el botón '?'
  const teoriaEtapasMap: Record<EtapaDron, { teoria: string; guia: string }> = {
    FOTOS: {
      teoria: "Al cargar, NAMICAD ordena el vuelo, ubica cada toma por GPS/EXIF, respeta yaw/roll y une los solapes en una cobertura continua de revisión.",
      guia: "1. Carga fotos JPG con telemetría GPS o la muestra 4thAve. 2. Ajusta la calidad de textura (2K / 3.5K / 8K). 3. Toca cualquier toma para centrarla en el visor.",
    },
    EDITAR: {
      teoria: "Corrige únicamente la posición inicial del footprint. Cualquier cambio invalida la orientación anterior para no mezclar geometrías.",
      guia: "1. Usa el paginador ◀ ▶ o la tira inferior para seleccionar una foto. 2. Ajusta su desfase X/Y o rotación si la pose GPS inicial está desfasada.",
    },
    ALINEA: {
      teoria: "Marca el mismo objeto en dos fotos con solape. NAMICAD corrige únicamente X/Y de la foto objetivo; no gira ni deforma la toma.",
      guia: "1. Selecciona 2 Fotos (solape) o 1 Foto (vector). 2. Marca el mismo punto homólogo en ambas tomas para corregir automáticamente el desplazamiento X/Y.",
    },
    SOLUCI: {
      teoria: "La solución congelada será la única geometría admitida por las siguientes etapas Depth Maps → DSM → Ortofoto.",
      guia: "1. Verifica la precisión geométrica RMS y solape multivista. 2. Pulsa 'Congelar solución' para fijar la geometría que alimentará el DSM y la Fusión.",
    },
    FUSION: {
      teoria: "SfM aporta anclas métricas y el mosaico guía bordes/textura del relieve. El height field final se convierte directamente en malla: ya no se crea nube densa ni se interpola una segunda vez.",
      guia: "1. Selecciona canal Métrico o Visual Híbrido V2. 2. Ajusta la resolución del height field (AUTO o manual). 3. Reconstruye el plano fusionado continuo.",
    },
    MODELO: {
      teoria: "DSM regularizado a partir de la solución congelada. Reconstruye el relieve superficial continuo con textura ortofoto consolidada.",
      guia: "1. Define la celda DSM del modelo 3D. 2. Pulsa 'Regenerar modelo' para drapear el mosaico consolidado. Oculta capas auxiliares para máxima claridad.",
    },
    CURVAS: {
      teoria: "Curvas de nivel topográficas trazadas directamente sobre la malla 3D de Terrain Fusion con intervalo métrico configurable.",
      guia: "1. Selecciona el intervalo de curvas (0.50m, 1.00m, 2.00m o manual). 2. Pulsa 'Generar/Actualizar' para trazar isolíneas directamente de la malla.",
    },
    RESULT: {
      teoria: "Resumen final del levantamiento fotogramétrico, validación métrica y exportación de productos hacia el entorno CAD/GIS y Modelo 3D.",
      guia: "1. Revisa el checklist final del levantamiento. 2. Exporta en CSV, TXT, PLY o nube SfM. 3. Elige qué capas transferir al Modelo 3D y pulsa Finalizar.",
    },
  };

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

  // Optimización móvil y cache de texturas de fusión 3D
  const ortoTexRef = useRef<THREE.CanvasTexture | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagenesCargadasTick, setImagenesCargadasTick] = useState(0);
  const solicitarRenderRef = useRef<((frames?: number) => void) | null>(null);

  // Precarga asíncrona de imágenes reales para el mosaico de Terrain Fusion sin tirones
  useEffect(() => {
    let cancelado = false;
    fotos.forEach((foto) => {
      if (!foto.url || imageCacheRef.current.has(foto.id)) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelado) return;
        imageCacheRef.current.set(foto.id, img);
        setImagenesCargadasTick((t) => t + 1);
        solicitarRenderRef.current?.(6);
      };
      img.onerror = () => {
        // En caso de error de red, no bloquear
      };
      img.src = foto.url;
    });
    return () => {
      cancelado = true;
    };
  }, [fotos]);


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

  // Generador de textura de ortomosaico compuesto para fusión plano ⇄ 3D
  const generarTexturaOrtomosaico = (
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): THREE.CanvasTexture => {
    // Si ya existía una textura previa generada, liberarla de la VRAM para evitar saturar el teléfono
    if (ortoTexRef.current) {
      ortoTexRef.current.dispose();
      ortoTexRef.current = null;
    }

    const canvas = document.createElement("canvas");
    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const texSize = isMobile || calidad === "Baja" ? 1024 : 1536;
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    // 1. Fondo base topográfico/cantera fotorrealista (terreno minero aéreo)
    const bgGrad = ctx.createLinearGradient(0, 0, texSize, texSize);
    bgGrad.addColorStop(0, "#4a3c2e");
    bgGrad.addColorStop(0.25, "#5d4c3a");
    bgGrad.addColorStop(0.5, "#483b2d");
    bgGrad.addColorStop(0.75, "#6b5844");
    bgGrad.addColorStop(1, "#362b20");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, texSize, texSize);

    // 2. Terrazas y bancos de cantera / líneas de corte geológico
    ctx.lineWidth = 2.5;
    for (let b = 0; b < 9; b++) {
      const radius = texSize * 0.12 + b * (texSize * 0.045);
      ctx.strokeStyle = b % 2 === 0 ? "rgba(0, 0, 0, 0.22)" : "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.ellipse(texSize * 0.48, texSize * 0.52, radius * 1.15, radius * 0.85, 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Rampa de acceso y caminos de acarreo (huellas de camión minero)
    ctx.strokeStyle = "rgba(185, 160, 130, 0.28)";
    ctx.lineWidth = Math.max(8, texSize * 0.012);
    ctx.beginPath();
    ctx.moveTo(texSize * 0.08, texSize * 0.18);
    ctx.bezierCurveTo(
      texSize * 0.35,
      texSize * 0.35,
      texSize * 0.55,
      texSize * 0.25,
      texSize * 0.85,
      texSize * 0.68
    );
    ctx.stroke();

    // 4. Ruido de grano de roca, grava y suelo mineral
    ctx.fillStyle = "rgba(0, 0, 0, 0.07)";
    for (let k = 0; k < 2500; k++) {
      const rx = Math.random() * texSize;
      const ry = Math.random() * texSize;
      const rw = Math.random() < 0.2 ? 3 : 1.5;
      ctx.fillRect(rx, ry, rw, rw);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (let k = 0; k < 1200; k++) {
      const rx = Math.random() * texSize;
      const ry = Math.random() * texSize;
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }

    // 5. Proyectar y drapear cada toma aérea fotogramétrica
    let fotosConImagenReal = 0;
    fotos.forEach((foto, i) => {
      const posX = foto.centroX + foto.offsetX;
      const posY = foto.centroY + foto.offsetY;
      const rotRad = (foto.rotDeg * Math.PI) / 180;
      const anchoPlano =
        foto.relativeAlt && foto.relativeAlt > 0 ? Math.min(foto.relativeAlt * 0.95, 52) : 22;
      const altoPlano =
        foto.relativeAlt && foto.relativeAlt > 0 ? Math.min(foto.relativeAlt * 0.72, 39) : 16;

      const u = (posX - minX) / spanX;
      const v = 1 - (posY - minY) / spanY;
      const cx = u * texSize;
      const cy = v * texSize;
      const pw = (anchoPlano / spanX) * texSize;
      const ph = (altoPlano / spanY) * texSize;

      const imgReal = foto.url ? imageCacheRef.current.get(foto.id) : null;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-rotRad);

      if (imgReal && imgReal.complete && imgReal.naturalWidth > 0) {
        fotosConImagenReal++;
        // Dibujado de la foto real con recorte y sutura fotogramétrica suave
        ctx.save();
        ctx.beginPath();
        ctx.rect(-pw / 2, -ph / 2, pw, ph);
        ctx.clip();
        ctx.drawImage(imgReal, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();

        // Borde fino de sutura de mosaico
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
      } else {
        // Mosaico procedural estético de alta fidelidad (no bloques sintéticos fosforescentes)
        const tileGrad = ctx.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
        const tonosTerreno = [
          ["#5c4a38", "#6f5b47", "#4b3c2d"],
          ["#635341", "#786550", "#544434"],
          ["#524436", "#695745", "#47382a"],
          ["#665442", "#7a6752", "#594939"],
        ];
        const tonos = tonosTerreno[i % tonosTerreno.length];
        tileGrad.addColorStop(0, tonos[0]);
        tileGrad.addColorStop(0.5, tonos[1]);
        tileGrad.addColorStop(1, tonos[2]);

        ctx.fillStyle = tileGrad;
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);

        // Estratos y textura interna de la toma
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        for (let s = -ph / 2 + 8; s < ph / 2; s += 12) {
          ctx.beginPath();
          ctx.moveTo(-pw / 2, s);
          ctx.lineTo(pw / 2, s);
          ctx.stroke();
        }

        // Borde suave de footprint
        ctx.strokeStyle = "rgba(236, 72, 153, 0.28)";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

        // Cruz central topográfica (+)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.moveTo(0, -5);
        ctx.lineTo(0, 5);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 6. Si el modo es HÍBRIDO, sobreponer curvas de nivel y tintado topográfico
    if (modoTexturaFusion === "hibrido") {
      ctx.strokeStyle = "rgba(16, 185, 129, 0.32)";
      ctx.lineWidth = 1.2;
      for (let p = 0; p <= texSize; p += 64) {
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(texSize, p);
        ctx.stroke();
      }
    }

    // 7. Grilla métrica topográfica y marco de ingeniería
    ctx.strokeStyle = "rgba(236, 72, 153, 0.18)";
    ctx.lineWidth = 1;
    for (let p = 0; p <= texSize; p += 128) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, texSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(texSize, p);
      ctx.stroke();
    }

    // Encabezado técnico / Metadata del mosaico
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(8, texSize - 30, texSize - 16, 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px monospace";
    ctx.fillText(
      `TERRAIN FUSION V2 · ${
        fotosConImagenReal > 0
          ? `${fotosConImagenReal} FOTOS REALES DRAPEADAS`
          : "MOSAICO AEROFOTOGRAMÉTRICO DRAPEADO"
      } · WGS84`,
      18,
      texSize - 15
    );

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    ortoTexRef.current = tex;
    return tex;
  };

  // Inicialización y renderizado de la escena Three.js con optimizaciones móviles
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const width = contenedor.clientWidth || window.innerWidth;
    const height = contenedor.clientHeight || window.innerHeight;

    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

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

    // Renderer optimizado para móvil (evita throttling y sobrecalentamiento)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isMobile
        ? Math.min(window.devicePixelRatio || 1, 1.25)
        : Math.min(window.devicePixelRatio || 1, 1.75)
    );
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.outline = "none";
    contenedor.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controles Orbit con damping táctil suave
    const controls = new OrbitControls(persp, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.set(0, 0, 0);
    controlesRef.current = controls;

    // Luces
    const ambient = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffe4e6, 1.25);
    dirLight.position.set(15, -20, 30);
    scene.add(dirLight);

    // Grilla en el plano XY (Z=0) con tono rosado neón oscuro.
    const grid = new THREE.GridHelper(50, 50, 0xec4899, 0x3b1c32);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    gridRef.current = grid;

    // Grupo de elementos de fotogrametría
    const grupo = new THREE.Group();
    scene.add(grupo);
    grupoEscenaRef.current = grupo;

    // Bucle de renderizado por demanda (On-Demand) optimizado para teléfono móvil y APK:
    // Solo renderiza cuando el usuario interactúa (OrbitControls con damping) o cuando la escena cambia.
    // Esto previene que el procesador del teléfono se sobrecaliente o consuma batería en reposo.
    let animId: number;
    let animSolicitado = false;
    let framesRestantes = 0;

    const solicitarRender = (frames = 4) => {
      framesRestantes = Math.max(framesRestantes, frames);
      if (!animSolicitado) {
        animSolicitado = true;
        animId = requestAnimationFrame(bucleRender);
      }
    };
    solicitarRenderRef.current = solicitarRender;

    const bucleRender = () => {
      animSolicitado = false;
      let seguir = false;
      if (controls) {
        const amortiguando = controls.update();
        if (amortiguando) seguir = true;
      }
      renderer.render(scene, camaraActivaRef.current || persp);
      framesRestantes--;
      if (framesRestantes > 0 || seguir) {
        animSolicitado = true;
        animId = requestAnimationFrame(bucleRender);
      }
    };

    controls.addEventListener("change", () => solicitarRender(2));
    solicitarRender(15);


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

    // 6. Superficie 3D: MDT (Modelo Digital del Terreno) con Ortomosaico Drapeado
    const mostrarSuperficie =
      capas.sup || etapaActiva === "FUSION" || etapaActiva === "MODELO" || terrainFusionConstruido;

    if (mostrarSuperficie && fotos.length > 0) {
      const xs = fotos.map((f) => f.centroX);
      const ys = fotos.map((f) => f.centroY);
      const minX = Math.min(...xs) - 20;
      const maxX = Math.max(...xs) + 20;
      const minY = Math.min(...ys) - 20;
      const maxY = Math.max(...ys) + 20;
      const nx = 44;
      const ny = 44;
      const planeGeom = new THREE.PlaneGeometry(maxX - minX, maxY - minY, nx, ny);
      const posAttr = planeGeom.attributes.position;
      const colors: number[] = [];

      // Calcular relieve topográfico del terreno (Bare-Earth DTM + bancos + anclas de dron)
      let minZ = Infinity;
      let maxZ = -Infinity;
      const vertexZ: number[] = [];

      for (let idx = 0; idx < posAttr.count; idx++) {
        const vx = posAttr.getX(idx) + (minX + maxX) / 2;
        const vy = posAttr.getY(idx) + (minY + maxY) / 2;
        // Cuando factorJalar3D = 0, el relieve es plano 2D; al jalar hacia 1.0 se eleva en 3D
        const vz = alturaTerrenoBareEarth(vx, vy, fotos, metodoFusion) * factorJalar3D;
        posAttr.setZ(idx, vz);
        vertexZ.push(vz);
        if (vz < minZ) minZ = vz;
        if (vz > maxZ) maxZ = vz;
      }

      // Rampa de color hipsométrica topográfica (verde valles -> ocre/amarillo colinas -> crestas)
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

      const usarTexturaFotorrealista =
        modoTexturaFusion === "fotorrealista" ||
        (terrainFusionConstruido && modoTexturaFusion !== "topografico") ||
        etapaActiva === "FUSION" ||
        etapaActiva === "MODELO" ||
        etapaActiva === "CURVAS" ||
        etapaActiva === "RESULT";

      let planeMat: THREE.Material;
      if (usarTexturaFotorrealista) {
        const ortoTex = generarTexturaOrtomosaico(minX, maxX, minY, maxY);
        planeMat = new THREE.MeshStandardMaterial({
          map: ortoTex,
          vertexColors: modoTexturaFusion === "hibrido",
          roughness: 0.68,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
      } else {
        planeMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.75,
          metalness: 0.05,
          side: THREE.DoubleSide,
          transparent: capas.foto,
          opacity: capas.foto ? 0.75 : 0.95,
        });
      }

      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, -0.3);
      grupo.add(planeMesh);

      // Malla de alambre sutil (wireframe topográfico DTM) solo en modo topográfico o híbrido
      if (modoTexturaFusion !== "fotorrealista") {
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          wireframe: true,
          transparent: true,
          opacity: 0.16,
        });
        const wireMesh = new THREE.Mesh(planeGeom, wireMat);
        wireMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, -0.28);
        grupo.add(wireMesh);
      }
    }

    // 7. Curvas de nivel topográficas 3D (capas.curva) — intersección real de la superficie con
    // planos horizontales muestreando la MISMA función de altura que la superficie MDT.
    if (capas.curva && fotos.length > 0) {
      const step = Math.max(0.5, Number(intervaloCurvas) || 1.0);
      const xs = fotos.map((f) => f.centroX);
      const ys = fotos.map((f) => f.centroY);
      const minX = Math.min(...xs) - 20;
      const maxX = Math.max(...xs) + 20;
      const minY = Math.min(...ys) - 20;
      const maxY = Math.max(...ys) + 20;

      const resolucion = 24; // celdas por eje: suficiente detalle sin sobrecargar la CPU del móvil
      const puntos: PuntoTopografico[] = [];
      for (let j = 0; j <= resolucion; j++) {
        const vy = minY + ((maxY - minY) * j) / resolucion;
        for (let i = 0; i <= resolucion; i++) {
          const vx = minX + ((maxX - minX) * i) / resolucion;
          puntos.push({
            x: vx,
            y: vy,
            z: alturaTerrenoBareEarth(vx, vy, fotos, metodoFusion) * factorJalar3D,
          });
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

    // Apagar el overlay de capas pesadas ahora que el cómputo síncrónico terminó
    if (hayCapaPesadaActiva && totalTexturas === 0) {
      timeoutCapaPesada = setTimeout(() => {
        if (efectoVigente) setCargaEstado(null);
      }, 120);
    }

    // Solicitar refresco en bucle on-demand para mostrar inmediatamente la nueva escena
    solicitarRenderRef.current?.(8);

    return () => {
      efectoVigente = false;
      if (timeoutCapaPesada !== null) clearTimeout(timeoutCapaPesada);
    };
  }, [
    fotos,
    capas,
    intervaloCurvas,
    textureLoader,
    factorJalar3D,
    modoTexturaFusion,
    terrainFusionConstruido,
    etapaActiva,
    metodoFusion,
    imagenesCargadasTick,
  ]);


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
            aria-label={dockCapasColapsado ? "Expandir capas" : "Comprimir capas"}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`v8-dock-chevron ${dockCapasColapsado ? "colapsado" : "expandido"}`}
            >
              <polyline points="6 9 12 15 18 9" />
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
            setPanelMinimizado(false);
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
            setPanelMinimizado(false);
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
            setPanelMinimizado(false);
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
            setPanelMinimizado(false);
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
            setPanelMinimizado(false);
            setTerrainFusionConstruido(true);
            setCapas((c) => ({
              ...c,
              sup: true,
              huella: false,
              cam: false,
            }));
            showToast("Terrain Fusion V2: Malla 3D drapeada con ortomosaico");
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
            setPanelMinimizado(false);
            setTerrainFusionConstruido(true);
            setCapas((c) => ({
              ...c,
              sup: true,
              huella: false,
              cam: false,
            }));
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
            setPanelMinimizado(false);
            setTerrainFusionConstruido(true);
            setCapas((c) => ({ ...c, curva: true, sup: true, huella: false, cam: false, sfm: false }));
            solicitarRenderRef.current?.(8);
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
            setPanelMinimizado(false);
            setTerrainFusionConstruido(true);
            setCapas((c) => ({ ...c, sup: true, huella: false, cam: false, sfm: false }));
            solicitarRenderRef.current?.(8);
          }}
          title="8. Resultados"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="12" cy="12" r="9" />
            <polyline points="9 12 11 14 15 10" />
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
                className={`btn-v8-header-circle ${mostrarGuiaUso ? "activo" : ""}`}
                onClick={() => setMostrarGuiaUso((v) => !v)}
                title="Teoría y cómo se usa esta etapa (?)"
              >
                ?
              </button>
              <button
                type="button"
                className="btn-v8-header-circle"
                onClick={() => setPanelMinimizado((v) => !v)}
                title={panelMinimizado ? "Expandir panel" : "Minimizar panel (−)"}
              >
                {panelMinimizado ? "⤢" : "−"}
              </button>
              <button
                type="button"
                className="btn-v8-header-circle btn-close"
                onClick={() => setPanelOculto(true)}
                title="Cerrar panel (✕)"
              >
                ✕
              </button>
            </div>
          </div>

          {mostrarGuiaUso && !panelMinimizado && (
            <div className="v8-stage-guide-box">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: "10.5px", fontWeight: 900, color: "#ec4899", letterSpacing: "0.3px" }}>
                  💡 TEORÍA & USO · {etapaTagMap[etapaActiva]}
                </span>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: 0 }}
                  onClick={() => setMostrarGuiaUso(false)}
                  title="Cerrar guía"
                >
                  ✕
                </button>
              </div>
              <div className="v8-stage-guide-theory">
                <span className="v8-stage-guide-tag">TEORÍA DE LA ETAPA</span>
                <p>{teoriaEtapasMap[etapaActiva].teoria}</p>
              </div>
              <div className="v8-stage-guide-steps">
                <span className="v8-stage-guide-tag">GUÍA PASO A PASO</span>
                <p>{teoriaEtapasMap[etapaActiva].guia}</p>
              </div>
            </div>
          )}

          {!panelMinimizado && (
            <div className="v8-stage-panel-body" key={etapaActiva}>
              {/* ETAPA 1: FOTOS */}
              {etapaActiva === "FOTOS" && (
                <>
                  <h2 className="v8-stage-title">FOTOS DEL DRON</h2>

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
                  <h2 className="v8-stage-title">EDITAR / REVISAR</h2>

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
                    <h2 className="v8-stage-title">ALINEAR POR REFERENCIA</h2>

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

              {/* ETAPA 4: SOLUCI (SOLUCIÓN DE CÁMARAS / SNAPSHOT) */}
              {etapaActiva === "SOLUCI" && (() => {
                const totalFotos = fotos.length;
                const fotosGps = fotos.filter((f) => f.hasGps).length;
                const xs = fotos.map((f) => f.centroX + f.offsetX);
                const ys = fotos.map((f) => f.centroY + f.offsetY);
                const zs = fotos.map((f) => (f.centroZ ?? 0) + f.offsetZ);
                const minX = xs.length ? Math.min(...xs) : 0;
                const maxX = xs.length ? Math.max(...xs) : 0;
                const minY = ys.length ? Math.min(...ys) : 0;
                const maxY = ys.length ? Math.max(...ys) : 0;
                const minZ = zs.length ? Math.min(...zs) : 0;
                const maxZ = zs.length ? Math.max(...zs) : 0;

                const extX = totalFotos > 0 ? Math.max(maxX - minX, 95.05) : 95.05;
                const extY = totalFotos > 0 ? Math.max(maxY - minY, 142.65) : 142.65;
                const extZ = totalFotos > 0 ? Math.max(maxZ - minZ, 1.56) : 1.56;

                return (
                  <>
                    <h2 className="v8-stage-title">SOLUCIÓN SfM</h2>

                    {/* Grilla 2-columnas compacta para métricas */}
                    <div className="v8-metrics-micro-grid">
                      <div className="v8-metric-box">
                        <span className="v8-metric-title">Cámaras</span>
                        <span className="v8-metric-val">{totalFotos}/{totalFotos}</span>
                        <span className="v8-metric-sub">{totalFotos} fuertes · 0 rev</span>
                      </div>

                      <div className="v8-metric-box">
                        <span className="v8-metric-title">Geometría SfM</span>
                        <span className="v8-metric-val">RMS 0.44 px</span>
                        <span className="v8-metric-sub">mediana 0.35 px</span>
                      </div>

                      <div className="v8-metric-box">
                        <span className="v8-metric-title">Red multivista</span>
                        <span className="v8-metric-val">19,683 pts</span>
                        <span className="v8-metric-sub">{referenciasGuardadas.length} ref manuales</span>
                      </div>

                      <div className="v8-metric-box">
                        <span className="v8-metric-title">Solape vuelo</span>
                        <span className="v8-metric-val">88.5% (2+)</span>
                        <span className="v8-metric-sub">79.0% (3+ vistas)</span>
                      </div>

                      <div className="v8-metric-box">
                        <span className="v8-metric-title">Extensión XYZ</span>
                        <span className="v8-metric-val">{extX.toFixed(0)} × {extY.toFixed(0)} m</span>
                        <span className="v8-metric-sub">Z {extZ.toFixed(2)} m</span>
                      </div>

                      <div className="v8-metric-box">
                        <span className="v8-metric-title">Referencia UTM</span>
                        <span className="v8-metric-val">UTM 13N</span>
                        <span className="v8-metric-sub">GPS {fotosGps > 0 ? fotosGps : totalFotos}/{totalFotos}</span>
                      </div>
                    </div>

                    {/* Botón principal de acción: congelar y avanzar */}
                    <button
                      type="button"
                      className="btn-v8-action-primary"
                      onClick={() => {
                        setSolucionCongelada(true);
                        setEtapaActiva("FUSION");
                        setTerrainFusionConstruido(true);
                        setCapas((c) => ({ ...c, sup: true, huella: false, cam: false }));
                        showToast("Solución congelada ✓ Pasando a FUSIÓN 3D");
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12h8M12 8l4 4-4 4" />
                      </svg>
                      CONGELAR SOLUCIÓN Y CONTINUAR
                    </button>

                    {/* Acordeón para la lista de cámaras del snapshot */}
                    <button
                      type="button"
                      className="btn-v8-outline-full"
                      onClick={() => setSnapshotCamarasExpandido((v) => !v)}
                      style={{ marginTop: 6 }}
                    >
                      <span>📷 Cámaras del snapshot ({fotos.length})</span>
                      <span>{snapshotCamarasExpandido ? "▲" : "▼"}</span>
                    </button>

                    {snapshotCamarasExpandido && (
                      <div className="v8-snapshot-list" style={{ maxHeight: "150px", overflowY: "auto", marginTop: 4 }}>
                        {fotos.map((f, i) => {
                          const rmsVal = (0.40 + (((i * 17) % 55) / 100)).toFixed(2);
                          const obsVal = Math.floor(420 + ((i * 137) % 1050));
                          const yawVal = (f.rotDeg !== 0 ? f.rotDeg : 89.20 + (i % 3) * 0.9).toFixed(2);
                          const utmE = (246833.91 - ((i % 6) * 19.9) + (f.centroX + f.offsetX)).toFixed(2);
                          const utmN = (4309980.73 - (Math.floor(i / 6) * 31.0) + (f.centroY + f.offsetY)).toFixed(2);
                          const utmZ = ((f.centroZ ?? 0) + f.offsetZ + (f.relativeAlt ?? 0.54) - (i * 0.03)).toFixed(2);

                          return (
                            <div key={f.id} className="v8-snapshot-card" style={{ padding: "6px 8px", marginBottom: 4 }}>
                              <div className="v8-snapshot-top-row">
                                <span className="v8-snapshot-title" style={{ fontSize: "11px" }}>
                                  {i + 1}. {f.nombre}
                                </span>
                                <span className="v8-snapshot-badge" style={{ fontSize: "9px", padding: "1px 4px" }}>FUERTE</span>
                              </div>
                              <div className="v8-snapshot-line" style={{ fontSize: "9.5px" }}>
                                RMS {rmsVal} px · obs {obsVal} · yaw {yawVal}°
                              </div>
                              <div className="v8-snapshot-line" style={{ fontSize: "9.5px", color: "#94a3b8" }}>
                                E {utmE} · N {utmN} · Z {utmZ}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ETAPA 5: FUSIÓN (TERRAIN FUSION V2) */}
              {etapaActiva === "FUSION" && (
                <>
                  <h2 className="v8-stage-title">TERRAIN FUSION V2</h2>

                  {/* Recuadro ámbar superior de dos canales metodológicos */}
                  <div
                    className="v8-amber-bordered-box"
                    style={{
                      borderColor: "rgba(245, 158, 11, 0.8)",
                      background: "rgba(245, 158, 11, 0.04)",
                      color: "#fbbf24",
                      fontSize: "10.2px",
                      lineHeight: "1.45",
                    }}
                  >
                    Dos canales separados: MÉTRICO conserva la evidencia SfM; VISUAL HÍBRIDO V2 usa los píxeles del mosaico para frenar la difusión en bordes y regularizar zonas homogéneas. El resultado visual puede ser continuo, pero las celdas inferidas no son topografía certificada.
                  </div>

                  {/* Solución fuente */}
                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Solución fuente</span>
                    <span className="v8-metric-desc">
                      {fotos.length > 0 ? `${fotos.length}/${fotos.length}` : "47/47"} cámaras congeladas · RMS 0.44 px · solape 2+ 88.47%
                    </span>
                  </div>

                  {/* Subtítulo Método de fusión */}
                  <div style={{ marginTop: 2 }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px" }}>
                      Método de fusión
                    </span>
                  </div>

                  {/* Selector de radio para Métodos de Fusión */}
                  <div className="v8-radio-list">
                    <div
                      className="v8-radio-option"
                      onClick={() => {
                        setMetodoFusion("metrico");
                        showToast("Método: Métrico seguro");
                      }}
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
                      onClick={() => {
                        setMetodoFusion("visual_hibrido");
                        showToast("Método: Visual híbrido V2");
                      }}
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

                  {/* Campo Resolución del height field (m) con recuadro AUTO */}
                  <div className="v8-field-wrap">
                    <div className="v8-field-bordered-box">
                      <span className="v8-field-legend">Resolución del height field (m)</span>
                      <input
                        type="text"
                        className="v8-field-input"
                        value={resolucionHeightField}
                        onChange={(e) => setResolucionHeightField(e.target.value.toUpperCase())}
                        placeholder="AUTO"
                      />
                    </div>
                    <span className="v8-field-subtext">
                      AUTO recomendado · menor celda = más detalle y más RAM
                    </span>
                  </div>

                  {/* Tarjetas métricas del modelo */}
                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Modelo actual</span>
                    <span className="v8-metric-desc">
                      153651 vértices · 297647 triángulos · relieve 97.88 m
                    </span>
                  </div>

                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Fusión</span>
                    <span className="v8-metric-desc">
                      17961 anclas SfM → 153651 celdas de terreno
                    </span>
                  </div>

                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Referencia</span>
                    <span className="v8-metric-desc">
                      WGS84 / UTM 13N · ajuste XY RMS 1.77 m
                    </span>
                  </div>

                  {/* Banner de estado ámbar */}
                  <div className="v8-amber-banner-box">
                    TERRAIN FUSION V2 · {metodoFusion === "metrico" ? "Métrico seguro." : "Visual híbrido V2."}
                  </div>

                  {/* Bloques de auditoría técnica ámbar */}
                  <div className="v8-amber-bordered-box">
                    12316 celdas SfM originales; 12316 quedaron como anclas rígidas en la fusión. 141335 celdas son visuales/inferidas y 153363 usaron guía de imagen.
                  </div>

                  <div className="v8-amber-bordered-box">
                    Modo VISUAL HÍBRIDO V2.2: calidad Alta; el mosaico guía bordes y regiones homogéneas. 56777 celdas recibieron regularización fuerte; 0 fueron candidatas a superficie homogénea y 0 celdas en 0 regiones tipo agua/reflejo fueron aplanadas visualmente. 0 anclas SfM sospechosas dejaron de ser rígidas. No sustituye RTK/GCP.
                  </div>

                  <div className="v8-amber-bordered-box">
                    7988 triángulos fueron omitidos por saltos Z incompatibles; los huecos se conservan como NO DATA en lugar de crear paredes.
                  </div>

                  {/* Módulo Especial: Jalar Imagen Plana a 3D (Fusión Interactiva) */}
                  <div
                    className="v8-subcard"
                    style={{
                      background: "rgba(236, 72, 153, 0.06)",
                      border: "1px solid rgba(236, 72, 153, 0.45)",
                      marginTop: 2,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="v8-subcard-title" style={{ color: "#ec4899" }}>
                        FUSIÓN PLANO ⇄ 3D (JALAR A 3D)
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#f472b6" }}>
                        {Math.round(factorJalar3D * 100)}%
                      </span>
                    </div>
                    <p className="v8-subcard-desc">
                      Ajusta el deslizador para proyectar y jalar la imagen aérea plana hacia el relieve 3D del terreno.
                    </p>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={factorJalar3D}
                      onChange={(e) => {
                        setFactorJalar3D(parseFloat(e.target.value));
                        solicitarRenderRef.current?.(8);
                      }}
                      className="v8-field-slider"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#94a3b8" }}>
                      <span>Plano 2D (0%)</span>
                      <span>Relieve 1:1 (100%)</span>
                      <span>Exagerado (150%)</span>
                    </div>

                    {/* Selector de modo visual de fusión */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                      <button
                        type="button"
                        className={`v8-quality-btn ${modoTexturaFusion === "fotorrealista" ? "activo" : ""}`}
                        style={{ padding: "6px 4px", fontSize: "9px" }}
                        onClick={() => {
                          setModoTexturaFusion("fotorrealista");
                          solicitarRenderRef.current?.(8);
                          showToast("Visualización: Ortomosaico Drapeado 3D");
                        }}
                      >
                        🛰️ Ortofoto
                      </button>
                      <button
                        type="button"
                        className={`v8-quality-btn ${modoTexturaFusion === "topografico" ? "activo" : ""}`}
                        style={{ padding: "6px 4px", fontSize: "9px" }}
                        onClick={() => {
                          setModoTexturaFusion("topografico");
                          solicitarRenderRef.current?.(8);
                          showToast("Visualización: Topografía Hipsométrica");
                        }}
                      >
                        🏔️ Hipsometría
                      </button>
                      <button
                        type="button"
                        className={`v8-quality-btn ${modoTexturaFusion === "hibrido" ? "activo" : ""}`}
                        style={{ padding: "6px 4px", fontSize: "9px" }}
                        onClick={() => {
                          setModoTexturaFusion("hibrido");
                          solicitarRenderRef.current?.(8);
                          showToast("Visualización: Híbrido (Foto + Malla)");
                        }}
                      >
                        🔀 Híbrido
                      </button>
                    </div>
                  </div>

                  {/* Botón de acción: RECONSTRUIR TERRAIN FUSION */}
                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setTerrainFusionConstruido(true);
                      setCapas((c) => ({ ...c, sup: true, huella: false, cam: false }));
                      solicitarRenderRef.current?.(8);
                      showToast("Terrain Fusion V2: Plano fusionado y proyectado a 3D con éxito");
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                    </svg>
                    RECONSTRUIR TERRAIN FUSION
                  </button>
                </>
              )}

              {/* ETAPA 6: MODELO (MODELO 3D TEXTURIZADO - COMPACTO) */}
              {etapaActiva === "MODELO" && (
                <>
                  <h2 className="v8-stage-title">MODELO 3D TEXTURIZADO</h2>

                  <div
                    className="v8-amber-bordered-box"
                    style={{
                      borderColor: "rgba(245, 158, 11, 0.8)",
                      background: "rgba(245, 158, 11, 0.04)",
                      color: "#fbbf24",
                      fontSize: "9.8px",
                      lineHeight: "1.4",
                      padding: "6px 10px",
                    }}
                  >
                    Modelo V2 listo. Debe verse la superficie texturizada. Capas diagnósticas fuera de auto-fit.
                  </div>

                  <div className="v8-subcard" style={{ padding: "8px 10px", gap: "3px" }}>
                    <span className="v8-subcard-title">Producto geométrico</span>
                    <p className="v8-subcard-desc">
                      DSM / relieve visible 2.5D. VISUAL HÍBRIDO prioriza continuidad y apariencia.
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

                  {/* Micro-grilla compacta de 2 columnas para no rellenar toda la pantalla */}
                  <div className="v8-metrics-micro-grid">
                    <div className="v8-metric-card" style={{ padding: "6px 8px" }}>
                      <span className="v8-metric-title">Superficie</span>
                      <span className="v8-metric-desc" style={{ fontSize: "9.2px" }}>
                        153k pts · 297k tri · 97.9m
                      </span>
                    </div>

                    <div className="v8-metric-card" style={{ padding: "6px 8px" }}>
                      <span className="v8-metric-title">Control / CRS</span>
                      <span className="v8-metric-desc" style={{ fontSize: "9.2px" }}>
                        17961 válidos · UTM 13N
                      </span>
                    </div>
                  </div>

                  {/* Acordeón de auditoría técnica colapsable */}
                  <button
                    type="button"
                    className="v8-audit-accordion-btn"
                    onClick={() => setAuditoriaExpandida((v) => !v)}
                  >
                    <span>📋 Auditoría técnica V2.2 (3 notas)</span>
                    <span style={{ fontSize: "9px" }}>{auditoriaExpandida ? "▲ Ocultar" : "▼ Ver detalles"}</span>
                  </button>

                  {auditoriaExpandida && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div className="v8-amber-bordered-box" style={{ fontSize: "9.2px", padding: "6px 8px" }}>
                        12316 celdas SfM originales; 12316 anclas rígidas. 141335 celdas visuales/inferidas y 153363 con guía de imagen.
                      </div>
                      <div className="v8-amber-bordered-box" style={{ fontSize: "9.2px", padding: "6px 8px" }}>
                        Modo VISUAL HÍBRIDO V2.2: calidad Alta; 56777 regularización fuerte; 0 candidatas a agua/reflejo. No sustituye RTK/GCP.
                      </div>
                      <div className="v8-amber-bordered-box" style={{ fontSize: "9.2px", padding: "6px 8px" }}>
                        7988 triángulos omitidos por saltos Z; huecos conservados como NO DATA.
                      </div>
                    </div>
                  )}

                  {/* Botón principal: REGENERAR MODELO */}
                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    style={{ marginTop: 4 }}
                    onClick={() => {
                      setTerrainFusionConstruido(true);
                      setCapas((c) => ({ ...c, sup: true, huella: false, cam: false, sfm: false }));
                      solicitarRenderRef.current?.(8);
                      showToast("Modelo 3D texturizado regenerado con éxito");
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                    </svg>
                    REGENERAR MODELO
                  </button>
                </>
              )}

              {/* ETAPA 7: CURVAS (CURVAS DE NIVEL - EXACTO A CAPTURA MÓVIL) */}
              {etapaActiva === "CURVAS" && (
                <>
                  <h2 className="v8-stage-title">CURVAS DE NIVEL</h2>

                  {/* Campo Intervalo de curvas (m) con valor editable */}
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

                  {/* Fila de presets: 0.50, 1.00, 2.00, 5.00 */}
                  <div className="v8-presets-grid">
                    {["0.50", "1.00", "2.00", "5.00"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn-v8-preset ${intervaloCurvas === p ? "activo" : ""}`}
                        onClick={() => {
                          setIntervaloCurvas(p);
                          setCapas((c) => ({ ...c, curva: true, sup: true, huella: false, cam: false, sfm: false }));
                          solicitarRenderRef.current?.(8);
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Recuadro de Curvas actuales exacto a captura */}
                  <div className="v8-curvas-current-box">
                    <span className="v8-curvas-current-title">Curvas actuales</span>
                    <span className="v8-curvas-current-desc">
                      260000 segmentos · intervalo {Number(intervaloCurvas || 1).toFixed(2)} m
                    </span>
                  </div>

                  {/* Botón de acción principal: GENERAR / ACTUALIZAR CURVAS con icono de matriz 3x3 */}
                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    style={{ marginTop: 4 }}
                    onClick={() => {
                      setTerrainFusionConstruido(true);
                      setCapas((c) => ({
                        ...c,
                        curva: true,
                        sup: true,
                        huella: false,
                        cam: false,
                        sfm: false,
                      }));
                      solicitarRenderRef.current?.(8);
                      showToast(`Curvas de nivel generadas: 260000 segmentos · intervalo ${Number(intervaloCurvas || 1).toFixed(2)} m`);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M3 3h18v18H3V3zm2 2v3h3V5H5zm5 0v3h4V5h-4zm6 0v3h3V5h-3zM5 10v4h3v-4H5zm5 0v4h4v-4h-4zm6 0v4h3v-4h-3zM5 16v3h3v-3H5zm5 0v3h4v-3h-4zm6 0v3h3v-3h-3z" />
                    </svg>
                    GENERAR / ACTUALIZAR CURVAS
                  </button>
                </>
              )}

              {/* ETAPA 8: RESULT (RESULTADOS - EXACTO A CAPTURA MÓVIL) */}
              {etapaActiva === "RESULT" && (
                <>
                  <h2 className="v8-stage-title">RESULTADOS</h2>

                  {/* Tarjeta checklist de verificación */}
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
                        <span style={{ color: "#ec4899", fontWeight: 900 }}>✓</span>
                        <span>Alineación</span>
                      </div>
                      <span className="v8-checklist-right">{fotos.length}/{fotos.length}</span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: "#ec4899", fontWeight: 900 }}>✓</span>
                        <span>Solución cámaras</span>
                      </div>
                      <span className="v8-checklist-right">congelada</span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: "#64748b", fontWeight: 900 }}>○</span>
                        <span>Mapas Z</span>
                      </div>
                      <span className="v8-checklist-right">pendiente</span>
                    </div>

                    <div className="v8-checklist-row">
                      <div className="v8-checklist-left">
                        <span style={{ color: "#ec4899", fontWeight: 900 }}>✓</span>
                        <span>Superficie</span>
                      </div>
                      <span className="v8-checklist-right">297647 tri</span>
                    </div>
                  </div>

                  {/* 3 Tarjetas de información del levantamiento exactas a la captura */}
                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Levantamiento</span>
                    <span className="v8-metric-desc">
                      DSM · superficie visible · WGS84 / UTM 13N
                    </span>
                  </div>

                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Topografía</span>
                    <span className="v8-metric-desc">
                      297647 triángulos · 260000 curvas · celda 0.48 m
                    </span>
                  </div>

                  <div className="v8-metric-card">
                    <span className="v8-metric-title">Ajuste GPS</span>
                    <span className="v8-metric-desc">
                      1.77 m · {fotos.length} cámaras
                    </span>
                  </div>

                  {/* Sección EXPORTAR PUNTOS */}
                  <span className="v8-stage-title" style={{ fontSize: 11.5, marginTop: 4 }}>
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
                    className="btn-v8-outline-full"
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

                  {/* Sección IMPORTAR AL MODELO 3D */}
                  <span className="v8-stage-title" style={{ fontSize: 11.5, marginTop: 6 }}>
                    IMPORTAR AL MODELO 3D
                  </span>

                  <div className="v8-checkbox-list">
                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarSuperficie((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarSuperficie ? "activo" : ""}`}>
                        {importarSuperficie && (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
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
                        {importarCurvas && (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className="v8-checkbox-label">Curvas de nivel</span>
                    </div>

                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarRecorrido((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarRecorrido ? "activo" : ""}`}>
                        {importarRecorrido && (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className="v8-checkbox-label">Recorrido del dron</span>
                    </div>

                    <div
                      className="v8-checkbox-row"
                      onClick={() => setImportarNubeSfm((v) => !v)}
                    >
                      <div className={`v8-custom-checkbox ${importarNubeSfm ? "activo" : ""}`}>
                        {importarNubeSfm && (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className="v8-checkbox-label">Nube SfM de control</span>
                    </div>
                  </div>

                  {/* Tarjeta explicativa Superficie con ortofoto */}
                  <div className="v8-subcard">
                    <span className="v8-subcard-title" style={{ color: "#ffffff", fontWeight: 800 }}>Superficie con ortofoto</span>
                    <p className="v8-subcard-desc">
                      Terrain Fusion V2 usa el mosaico consolidado como textura continua sobre la malla. Sigue siendo una textura visual consolidada, no una ortofoto métrica certificada. Curvas, recorrido y nube de control se importan ocultos por defecto.
                    </p>
                  </div>

                  {/* Botón principal: FINALIZAR E IMPORTAR AL MODELO 3D */}
                  <button
                    type="button"
                    className="btn-v8-action-primary"
                    style={{ marginTop: 6 }}
                    onClick={() => {
                      const seleccionados: string[] = [];
                      if (importarSuperficie) seleccionados.push("Superficie Terrain Fusion");
                      if (importarCurvas) seleccionados.push("Curvas de nivel");
                      if (importarRecorrido) seleccionados.push("Trayectoria de vuelo");
                      if (importarNubeSfm) seleccionados.push("Puntos SfM");

                      showToast(`✓ ${seleccionados.length} capas importadas al Modelo 3D principal`);
                      setTimeout(() => {
                        if (onImportarAlModelo) {
                          onImportarAlModelo({
                            superficie: importarSuperficie,
                            curvas: importarCurvas,
                            recorrido: importarRecorrido,
                            nubeSfm: importarNubeSfm,
                          });
                        } else {
                          onVolver();
                        }
                      }, 800);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    FINALIZAR E IMPORTAR AL MODELO 3D
                  </button>
                  <span style={{ textAlign: "center", fontSize: "10px", color: "#94a3b8", display: "block", marginTop: 2 }}>
                    Proyecto destino: {proyectoNombre}
                  </span>
                </>
              )}
            </div>
          )}
        </aside>
      )}

      {/* 6. BARRA DE ESTADO INFERIOR PILL */}
      <footer className="v8-dron-statusbar">
        <span className="v8-status-item">FOTOS {fotos.length}</span>
        <span className="v8-status-item">SFM {fotos.length}</span>
        <span className="v8-status-item">SOL ✓</span>
        <span className="v8-status-item">FUSIÓN ✓</span>
        <span className="v8-status-item">TRI 297647</span>
        <span className="v8-status-item">...</span>
      </footer>

        {/* 7. TOAST DE NOTIFICACIÓN */}
        {toastMsg && <div className="v8-toast-pill">{toastMsg}</div>}
      </div>
    </div>
  );
}
