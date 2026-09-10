import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { usePersistedState, PREFIJO_ALMACENAMIENTO } from "../../hooks/usePersistedState.js";
import { ModalImportarExportar3D } from "../../components/shared/index.js";
import { descargarTexto } from "../../utils/descargar.js";
import type { ProyectoModelo3D } from "./types.js";
import CuboEscaneo3DAnimado from "./CuboEscaneo3DAnimado.js";
import EspacioDronFotogrametria from "./EspacioDronFotogrametria.js";

interface Props {
  proyectoId: string;
  onVolverAlPortal: () => void;
}

export interface Capa3DItem {
  id: string;
  nombre: string;
  tipo: "superficie" | "sondajes" | "bloques" | "galeria" | "dxf" | "nube";
  visible: boolean;
  color: string;
  opacidad: number;
  elementosCount: number;
}

type TabInferior = "escena" | "importar" | "analizar" | "vista" | null;
type ModoVisor = "editar" | "modelar";

export default function EspacioModelo3D({ proyectoId, onVolverAlPortal }: Props) {
  const [proyectos, setProyectos] = usePersistedState<ProyectoModelo3D[]>("modelo3d.listaProyectos", []);
  const proyecto = proyectos.find((p) => p.id === proyectoId);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const camaraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlesRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const objetosCapasRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Capas 3D del proyecto (inicia en 0 capas como en la captura)
  const [capas, setCapas] = useState<Capa3DItem[]>([]);
  const [modalInicioAbierto, setModalInicioAbierto] = useState(true);

  // Estados de interfaz de usuario
  const [modoVisor, setModoVisor] = useState<ModoVisor>("editar");
  const [docksVisibles, setDocksVisibles] = useState(true);
  const [tabInferior, setTabInferior] = useState<TabInferior>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Estados para Modal de Importar / Exportar 3D
  const [modal3DAbierto, setModal3DAbierto] = useState(false);
  const [modoModal3D, setModoModal3D] = useState<"importar" | "exportar">("importar");

  // Estados para Panel Control V3 (Cota, selección y corte visual)
  const [panelV3Abierto, setPanelV3Abierto] = useState(false);
  const [objetoSeleccionado, setObjetoSeleccionado] = useState<string | null>(null);
  const [planoCotaActivo, setPlanoCotaActivo] = useState(true);
  const [cotaCentral, setCotaCentral] = useState("0.000");
  const [cotaAbajo, setCotaAbajo] = useState("5.000");
  const [cotaArriba, setCotaArriba] = useState("5.000");

  // Estados para Panel V8 · SUPERFICIE (Realismo de terreno, InfraWorks, Drone)
  const [panelV8Abierto, setPanelV8Abierto] = useState(false);
  const [modalDronProAbierto, setModalDronProAbierto] = useState(false);
  const [espacioDronAbierto, setEspacioDronAbierto] = useState(false);
  const [realismoSuperficie, setRealismoSuperficie] = useState(false);
  const [modoVisualTerreno, setModoVisualTerreno] = useState<"realista" | "hipsometrico" | "satelital">("realista");
  const [mostrarTriangulacion, setMostrarTriangulacion] = useState(false);

  // Sliders Luz y Material V8
  const [relieveVal, setRelieveVal] = useState(1.15);
  const [azimutVal, setAzimutVal] = useState(315);
  const [elevacionVal, setElevacionVal] = useState(42);
  const [brilloVal, setBrilloVal] = useState(1.00);
  const [saturacionVal, setSaturacionVal] = useState(1.00);
  const [contrasteVal, setContrasteVal] = useState(1.06);
  const [gammaVal, setGammaVal] = useState(1.00);
  const [nitidezVal, setNitidezVal] = useState(22);

  // Ajustes de render
  const [modoAlambrico, setModoAlambrico] = useState(false);
  const [grillaVisible, setGrillaVisible] = useState(true);
  const [ejesVisibles, setEjesVisibles] = useState(true);
  const [autoRotar, setAutoRotar] = useState(false);

  // Referencias a helpers 3D y luces
  const grillaObjRef = useRef<THREE.GridHelper | null>(null);
  const ejesObjRef = useRef<THREE.Group | null>(null);
  const planoCotaVisualRef = useRef<THREE.Group | null>(null);
  const luzDireccionalRef = useRef<THREE.DirectionalLight | null>(null);

  function notificar(msg: string) {
    setNotificacion(msg);
    setTimeout(() => setNotificacion(null), 2800);
  }

  function togglePlanoCota() {
    const nuevo = !planoCotaActivo;
    setPlanoCotaActivo(nuevo);
    if (!nuevo && rendererRef.current) {
      rendererRef.current.clippingPlanes = [];
      notificar("Plano de cota desactivado.");
    }
  }

  function aplicarCorteVisual() {
    if (!rendererRef.current) return;
    if (!planoCotaActivo) {
      rendererRef.current.clippingPlanes = [];
      notificar("Plano de corte desactivado.");
      return;
    }
    const cc = parseFloat(cotaCentral) || 0;
    const ab = parseFloat(cotaAbajo) || 5;
    const ar = parseFloat(cotaArriba) || 5;
    const zMin = cc - ab;
    const zMax = cc + ar;

    const planoInf = new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMin);
    const planoSup = new THREE.Plane(new THREE.Vector3(0, 0, -1), zMax);

    rendererRef.current.localClippingEnabled = true;
    rendererRef.current.clippingPlanes = [planoInf, planoSup];
    notificar(`✓ Corte visual aplicado [${zMin.toFixed(1)}m a ${zMax.toFixed(1)}m]`);
  }

  // Inicialización de Three.js
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    const ancho = contenedor.clientWidth || window.innerWidth;
    const alto = contenedor.clientHeight || window.innerHeight;

    // Escena Z-Up (estándar de ingeniería minera y topografía)
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    const escena = new THREE.Scene();
    escena.background = new THREE.Color("#0c0d14");
    escenaRef.current = escena;

    // Cámara con ángulo isométrico
    const camara = new THREE.PerspectiveCamera(50, ancho / alto, 0.1, 5000);
    camara.up.set(0, 0, 1);
    camara.position.set(45, -45, 35);
    camaraRef.current = camara;

    // Renderer WebGL antialiased
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(ancho, alto);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    contenedor.appendChild(renderer.domElement);

    // Controles orbitales táctiles y ratón
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.06;
    controles.screenSpacePanning = true;
    controles.maxDistance = 1500;
    controles.minDistance = 2;
    controles.target.set(0, 0, 0);
    controles.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlesRef.current = controles;

    // Iluminación ambiental y direccional
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.7);
    const luzDireccional1 = new THREE.DirectionalLight(0xffe4e6, 0.9);
    luzDireccional1.position.set(60, 40, 80);
    const luzDireccional2 = new THREE.DirectionalLight(0xec4899, 0.4);
    luzDireccional2.position.set(-50, -60, -30);
    escena.add(luzAmbiente, luzDireccional1, luzDireccional2);
    luzDireccionalRef.current = luzDireccional1;

    // Grilla Isométrica Minera en plano XY
    const grilla = new THREE.GridHelper(100, 25, 0xec4899, 0x27273a);
    grilla.rotateX(Math.PI / 2);
    grilla.position.set(0, 0, 0);
    escena.add(grilla);
    grillaObjRef.current = grilla;

    // Ejes de coordenadas 3D neon compactos (X: Pink, Y: Gold, Z: Cyan)
    const grupoEjes = new THREE.Group();
    const crearEje = (dir: THREE.Vector3, color: number, longitud: number) => {
      const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(longitud)]);
      const mat = new THREE.LineBasicMaterial({ color, linewidth: 1.5, transparent: true, opacity: 0.8 });
      return new THREE.Line(geom, mat);
    };
    const longitudEje = 12; // Tamaño más pequeño y proporcionado
    grupoEjes.add(crearEje(new THREE.Vector3(1, 0, 0), 0xec4899, longitudEje)); // X (Este)
    grupoEjes.add(crearEje(new THREE.Vector3(0, 1, 0), 0xf59e0b, longitudEje)); // Y (Norte)
    grupoEjes.add(crearEje(new THREE.Vector3(0, 0, 1), 0x06b6d4, longitudEje)); // Z (Cota)
    escena.add(grupoEjes);
    ejesObjRef.current = grupoEjes;

    // 1. Superficie TIN demo
    const geomTIN = new THREE.PlaneGeometry(50, 50, 16, 16);
    const posAttr = geomTIN.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const zVal = Math.sin(vx * 0.15) * Math.cos(vy * 0.15) * 4.5 + Math.sin(vx * 0.3) * 1.5;
      posAttr.setZ(i, zVal + 5);
    }
    geomTIN.computeVertexNormals();
    const matTIN = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.4,
      metalness: 0.1,
      wireframe: false,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const meshTIN = new THREE.Mesh(geomTIN, matTIN);
    meshTIN.castShadow = true;
    meshTIN.receiveShadow = true;
    escena.add(meshTIN);
    objetosCapasRef.current.set("capa-tin", meshTIN);

    // 2. Sondajes DDH demo
    const grupoDDH = new THREE.Group();
    const coordsDDH = [
      { x: -12, y: -10, z0: 8, len: 25 },
      { x: 0, y: -5, z0: 9, len: 28 },
      { x: 14, y: -8, z0: 7, len: 22 },
      { x: -8, y: 12, z0: 6, len: 24 },
      { x: 10, y: 14, z0: 8.5, len: 30 },
    ];
    coordsDDH.forEach((d) => {
      const geomCil = new THREE.CylinderGeometry(0.35, 0.35, d.len, 12);
      geomCil.rotateX(Math.PI / 2);
      const matCil = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.5 });
      const meshCil = new THREE.Mesh(geomCil, matCil);
      meshCil.position.set(d.x, d.y, d.z0 - d.len / 2);
      grupoDDH.add(meshCil);
    });
    escena.add(grupoDDH);
    objetosCapasRef.current.set("capa-ddh", grupoDDH);

    // 3. Modelo de Bloques demo
    const grupoBloques = new THREE.Group();
    const geomBloque = new THREE.BoxGeometry(2.4, 2.4, 2.4);
    const coloresLeyes = [0x06b6d4, 0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899];
    for (let bx = -2; bx <= 2; bx++) {
      for (let by = -2; by <= 2; by++) {
        for (let bz = -2; bz <= 0; bz++) {
          if (Math.random() > 0.35) {
            const colorRnd = coloresLeyes[Math.floor(Math.random() * coloresLeyes.length)];
            const matB = new THREE.MeshStandardMaterial({ color: colorRnd, roughness: 0.5, transparent: true, opacity: 0.8 });
            const mB = new THREE.Mesh(geomBloque, matB);
            mB.position.set(bx * 2.8, by * 2.8, bz * 2.8 - 4);
            grupoBloques.add(mB);
          }
        }
      }
    }
    escena.add(grupoBloques);
    objetosCapasRef.current.set("capa-bloques", grupoBloques);

    // 4. Galería / Wireframe demo
    const grupoGal = new THREE.Group();
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-20, -20, -10),
      new THREE.Vector3(-10, -5, -8),
      new THREE.Vector3(0, 10, -7),
      new THREE.Vector3(15, 18, -6),
    ]);
    const geomTubo = new THREE.TubeGeometry(curva, 32, 1.8, 10, false);
    const matTubo = new THREE.MeshStandardMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.9 });
    const meshTubo = new THREE.Mesh(geomTubo, matTubo);
    meshTubo.visible = false;
    grupoGal.add(meshTubo);
    escena.add(grupoGal);
    objetosCapasRef.current.set("capa-galeria", grupoGal);

    // 5. HELPER VISUAL DEL PLANO DE COTA
    const grupoPlanoCota = new THREE.Group();
    grupoPlanoCota.name = "helper-plano-cota";

    const tamPlano = 80;
    // Superficie horizontal translúcida rosada
    const geomPlanoCentral = new THREE.PlaneGeometry(tamPlano, tamPlano);
    const matPlanoCentral = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const meshPlanoCentral = new THREE.Mesh(geomPlanoCentral, matPlanoCentral);
    grupoPlanoCota.add(meshPlanoCentral);

    // Borde neón brillante
    const geomBorde = new THREE.EdgesGeometry(geomPlanoCentral);
    const matBorde = new THREE.LineBasicMaterial({ color: 0xff69b4, linewidth: 2 });
    const lineBorde = new THREE.LineSegments(geomBorde, matBorde);
    grupoPlanoCota.add(lineBorde);

    // Grilla sobre el plano
    const grillaPlano = new THREE.GridHelper(tamPlano, 16, 0xff69b4, 0xec4899);
    grillaPlano.rotateX(Math.PI / 2);
    (grillaPlano.material as THREE.Material).transparent = true;
    (grillaPlano.material as THREE.Material).opacity = 0.3;
    (grillaPlano.material as THREE.Material).depthWrite = false;
    grupoPlanoCota.add(grillaPlano);

    // Bounding box del rango vertical
    const geomRango = new THREE.BoxGeometry(tamPlano, tamPlano, 10);
    const edgesRango = new THREE.EdgesGeometry(geomRango);
    const matRango = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });
    const lineRango = new THREE.LineSegments(edgesRango, matRango);
    grupoPlanoCota.add(lineRango);

    escena.add(grupoPlanoCota);
    planoCotaVisualRef.current = grupoPlanoCota;

    // Bucle de renderizado
    let frame = 0;
    const animar = () => {
      animFrameIdRef.current = requestAnimationFrame(animar);
      controles.update();
      frame++;
      renderer.render(escena, camara);
    };
    animar();

    // Redimensionamiento responsivo
    const handleResize = () => {
      if (!contenedor) return;
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      if (w === 0 || h === 0) return;
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(contenedor);

    return () => {
      resizeObs.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
      escenaRef.current = null;
      camaraRef.current = null;
      rendererRef.current = null;
      controlesRef.current = null;
    };
  }, []);

  // Sincronizar visibilidad y opacidad de capas con Three.js
  useEffect(() => {
    capas.forEach((c) => {
      const obj = objetosCapasRef.current.get(c.id);
      if (obj) {
        obj.visible = c.visible;
        obj.traverse((hijo) => {
          if (hijo instanceof THREE.Mesh) {
            if (Array.isArray(hijo.material)) {
              hijo.material.forEach((m) => {
                m.opacity = c.opacidad;
                m.wireframe = modoAlambrico;
              });
            } else if (hijo.material) {
              hijo.material.opacity = c.opacidad;
              hijo.material.wireframe = modoAlambrico;
            }
          }
        });
      }
    });
  }, [capas, modoAlambrico]);

  // Sincronizar autoRotar con OrbitControls
  useEffect(() => {
    if (controlesRef.current) {
      controlesRef.current.autoRotate = autoRotar;
      controlesRef.current.autoRotateSpeed = 2.0;
    }
  }, [autoRotar]);

  // Sincronizar grilla y ejes
  useEffect(() => {
    if (grillaObjRef.current) grillaObjRef.current.visible = grillaVisible;
    if (ejesObjRef.current) ejesObjRef.current.visible = ejesVisibles;
  }, [grillaVisible, ejesVisibles]);

  // Sincronizar plano de cota visual 3D
  useEffect(() => {
    const grupo = planoCotaVisualRef.current;
    if (!grupo) return;

    grupo.visible = planoCotaActivo;

    if (planoCotaActivo) {
      const cc = parseFloat(cotaCentral) || 0;
      const ab = parseFloat(cotaAbajo) || 5;
      const ar = parseFloat(cotaArriba) || 5;
      const altura = Math.max(ar + ab, 0.2);
      const centroZ = cc + (ar - ab) / 2;

      // Actualizar Z de cada elemento del helper visual
      const centralMesh = grupo.children[0];
      const bordeLine = grupo.children[1];
      const grilla = grupo.children[2];
      const rangoBox = grupo.children[3];

      if (centralMesh) centralMesh.position.set(0, 0, cc);
      if (bordeLine) bordeLine.position.set(0, 0, cc);
      if (grilla) grilla.position.set(0, 0, cc);

      if (rangoBox) {
        rangoBox.position.set(0, 0, centroZ);
        rangoBox.scale.set(1, 1, altura / 10);
      }
    }
  }, [cotaCentral, cotaAbajo, cotaArriba, planoCotaActivo]);

  // Sincronizar iluminación y triangulación V8 Superficie
  useEffect(() => {
    if (luzDireccionalRef.current) {
      const phi = ((90 - elevacionVal) * Math.PI) / 180;
      const theta = (azimutVal * Math.PI) / 180;
      const r = 100;
      luzDireccionalRef.current.position.set(
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi)
      );
      luzDireccionalRef.current.intensity = brilloVal * 1.1;
    }

    const meshTIN = objetosCapasRef.current.get("capa-tin");
    if (meshTIN && meshTIN instanceof THREE.Mesh) {
      if (meshTIN.material) {
        meshTIN.material.wireframe = mostrarTriangulacion;
      }
    }
  }, [azimutVal, elevacionVal, brilloVal, mostrarTriangulacion]);

  // Contadores
  const visiblesCount = useMemo(() => capas.filter((c) => c.visible).length, [capas]);
  const elementosCount = useMemo(
    () => capas.reduce((acc, c) => (c.visible ? acc + c.elementosCount : acc), 0),
    [capas]
  );

  // Acciones de Cámara
  function encuadrarTodo() {
    if (!camaraRef.current || !controlesRef.current) return;
    camaraRef.current.position.set(45, -45, 35);
    controlesRef.current.target.set(0, 0, 0);
    controlesRef.current.update();
    notificar("Vista centrada e isométrica.");
  }

  function setVistaCamara(tipo: "top" | "front" | "right" | "iso") {
    if (!camaraRef.current || !controlesRef.current) return;
    const dist = 55;
    if (tipo === "top") {
      camaraRef.current.position.set(0, 0, dist);
    } else if (tipo === "front") {
      camaraRef.current.position.set(0, -dist, 0);
    } else if (tipo === "right") {
      camaraRef.current.position.set(dist, 0, 0);
    } else {
      camaraRef.current.position.set(45, -45, 35);
    }
    controlesRef.current.target.set(0, 0, 0);
    controlesRef.current.update();
    notificar(`Vista cambiada a: ${tipo.toUpperCase()}`);
  }

  function toggleVisibilidadCapa(id: string) {
    setCapas((actuales) =>
      actuales.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  }

  function handleImportarModal() {
    setModoModal3D("importar");
    setModal3DAbierto(true);
  }

  function handleExportarModal() {
    setModoModal3D("exportar");
    setModal3DAbierto(true);
  }

  function handleProyectoImportado(nombre: string, nuevoId: string, detalles: string) {
    // Añadir una nueva capa 3D con el nombre del archivo
    const nuevaCapa: Capa3DItem = {
      id: `capa-${Date.now()}`,
      nombre: `Importado: ${nombre}`,
      tipo: "dxf",
      visible: true,
      color: "#ec4899",
      opacidad: 1,
      elementosCount: 120,
    };
    setCapas((prev) => [nuevaCapa, ...prev]);
    notificar(`✓ Geometría 3D "${nombre}" importada a la escena.`);
  }

  // Vista especializada: V8 · DRON (Fotogrametría + Topografía)
  if (espacioDronAbierto) {
    return (
      <EspacioDronFotogrametria
        proyectoId={proyectoId}
        proyectoNombre={proyecto?.nombre || "h"}
        onVolver={() => setEspacioDronAbierto(false)}
      />
    );
  }

  return (
    <div className="m3d-taller-viewport-root">
      {/* Notificación flotante */}
      {notificacion && (
        <div className="dashboard-toast m3d-toast-pink">
          <span className="cad-toast-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="cad-toast-text">{notificacion.replace(/^[✓🗑️🎯\s]+/, "")}</span>
        </div>
      )}

      {/* 1. BARRA SUPERIOR (HEADER) */}
      <header className="m3d-header-exact">
        <div className="m3d-header-left">
          <button type="button" className="btn-m3d-back" onClick={onVolverAlPortal} title="Volver al portal">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="m3d-header-titles">
            <h1 className="m3d-header-title">{proyecto?.nombre || "t"}</h1>
            <span className="m3d-header-sub">MODELO 3D · {capas.length} capas</span>
          </div>
        </div>

        <div className="m3d-header-right-icons">
          <button
            type="button"
            className="btn-m3d-header-icon"
            title="V8 · Superficie y realismo de terreno"
            onClick={() => {
              setPanelV8Abierto((v) => !v);
              setPanelV3Abierto(false);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
          </button>

          <button
            type="button"
            className="btn-m3d-header-icon"
            title="Encuadrar modelo en pantalla"
            onClick={encuadrarTodo}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. FILA DE CONTROLES SUPERIORES (Estadísticas, Modos, Cámaras y Ocultar) */}
      <div className="m3d-top-controls-row">
        <div className="m3d-top-left-group">
          {/* Card de contadores visibles/elementos */}
          <div className="m3d-pill-stats-card">
            <div className="m3d-stat-cell">
              <span className="m3d-stat-val">{visiblesCount}</span>
              <span className="m3d-stat-lbl">visibles</span>
            </div>
            <div className="m3d-stat-cell">
              <span className="m3d-stat-val">{elementosCount}</span>
              <span className="m3d-stat-lbl">elementos</span>
            </div>
          </div>

          {/* Botones de Modo */}
          <div className="m3d-mode-buttons-row">
            <button
              type="button"
              className={`btn-m3d-mode ${modoVisor === "editar" ? "activo" : ""}`}
              onClick={() => {
                setModoVisor("editar");
                notificar("Modo EDITAR 3D activado.");
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              EDITAR 3D
            </button>

            <button
              type="button"
              className={`btn-m3d-mode ${modoVisor === "modelar" ? "activo" : ""}`}
              onClick={() => {
                setModoVisor("modelar");
                notificar("Modo MODELAR activado.");
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              MODELAR
            </button>
          </div>
        </div>

        <div className="m3d-top-right-group">
          {/* Card de navegación de vista 3D */}
          <div className="m3d-pill-tools-bar">
            <button
              type="button"
              className="btn-m3d-tool-icon"
              title="Centrar y enfocar"
              onClick={encuadrarTodo}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>

            <button
              type="button"
              className="btn-m3d-tool-icon"
              title="Vista isométrica 3D"
              onClick={() => setVistaCamara("iso")}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </button>

            <button
              type="button"
              className={`btn-m3d-tool-icon ${autoRotar ? "activo" : ""}`}
              title="Órbita de rotación automática"
              onClick={() => {
                setAutoRotar((r) => !r);
                notificar(!autoRotar ? "Rotación automática ON" : "Rotación automática OFF");
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
          </div>

          {/* Botón Ocultar / Mostrar Docks */}
          <button
            type="button"
            className="btn-m3d-ocultar-toggle"
            onClick={() => setDocksVisibles((v) => !v)}
          >
            {docksVisibles ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {/* 3. VIEWPORT 3D CANVAS (THREE.JS) */}
      <div className="m3d-canvas-container" ref={contenedorRef} />

      {/* 4. DOCKS LATERALES FLOTANTES EN FORMA DE PESTAÑAS CURVAS (LEFT & RIGHT) */}
      {docksVisibles && (
        <>
          {/* PANEL FLOTANTE LATERAL CONTROL V3 (EXACTO A LA CAPTURA) */}
          {panelV3Abierto && (
            <div className="m3d-panel-v3">
              <div className="m3d-panel-v3-header">
                <div className="m3d-panel-v3-titles">
                  <span className="m3d-panel-v3-title">CONTROL V3</span>
                  <span className="m3d-panel-v3-sub">Cota, selección y órbita local</span>
                </div>
                <button
                  type="button"
                  className="btn-m3d-panel-v3-ocultar"
                  onClick={() => setPanelV3Abierto(false)}
                >
                  Ocultar
                </button>
              </div>

              <div className="m3d-panel-v3-divider" />

              <div className="m3d-panel-v3-section">
                <span className="m3d-panel-v3-sec-title">Objeto seleccionado</span>
                {objetoSeleccionado && (
                  <span className="m3d-panel-v3-obj-badge">{objetoSeleccionado}</span>
                )}
              </div>

              <div className="m3d-panel-v3-divider" />

              <div className="m3d-panel-v3-toggle-row">
                <div className="m3d-toggle-labels">
                  <span className="m3d-toggle-title">Plano de cota</span>
                  <span className="m3d-toggle-sub">Visualiza solo un rango vertical.</span>
                </div>
                <div
                  className={`m3d-toggle-switch ${planoCotaActivo ? "activo" : ""}`}
                  onClick={togglePlanoCota}
                  title={planoCotaActivo ? "Desactivar plano de cota" : "Activar plano de cota"}
                >
                  <div className="m3d-toggle-thumb" />
                </div>
              </div>

              <div className="m3d-input-box">
                <label>Cota central</label>
                <input
                  type="text"
                  value={cotaCentral}
                  onChange={(e) => setCotaCentral(e.target.value)}
                  placeholder="0.000"
                />
              </div>

              <div className="m3d-input-grid-2">
                <div className="m3d-input-box">
                  <label>Abajo (m)</label>
                  <input
                    type="text"
                    value={cotaAbajo}
                    onChange={(e) => setCotaAbajo(e.target.value)}
                    placeholder="5.000"
                  />
                </div>
                <div className="m3d-input-box">
                  <label>Arriba (m)</label>
                  <input
                    type="text"
                    value={cotaArriba}
                    onChange={(e) => setCotaArriba(e.target.value)}
                    placeholder="5.000"
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-m3d-corte-action"
                onClick={aplicarCorteVisual}
              >
                Aplicar corte visual
              </button>
            </div>
          )}

          {/* PANEL FLOTANTE LATERAL V8 · SUPERFICIE (EXACTO A LA CAPTURA) */}
          {panelV8Abierto && (
            <div className="m3d-panel-v8">
              <div className="m3d-panel-v8-header">
                <div className="m3d-panel-v8-titles">
                  <span className="m3d-panel-v8-title">V8 · SUPERFICIE</span>
                  <span className="m3d-panel-v8-sub">
                    Realismo de terreno. Apagado conserva exactamente la visualización normal.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-m3d-panel-v8-ocultar"
                  onClick={() => setPanelV8Abierto(false)}
                >
                  Ocultar
                </button>
              </div>

              {/* Botón V8 · DRON PRO */}
              <button
                type="button"
                className="btn-m3d-v8-dron"
                onClick={() => setEspacioDronAbierto(true)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8V5a1 1 0 0 1 1-1h3" />
                  <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
                  <path d="M4 16v3a1 1 0 0 0 1 1h3" />
                  <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
                  <path d="M12 7l5 2.8v5.6L12 18.2l-5-2.8V9.8z" />
                  <path d="M12 7v5.6" />
                  <path d="M12 12.6l5-2.8" />
                  <path d="M12 12.6l-5-2.8" />
                </svg>
                <span>V8 · DRON PRO</span>
              </button>

              <p className="m3d-v8-dron-desc">
                Abre el espacio independiente de fotogrametría. Nivel A valida el vuelo y Nivel B realiza feature matching, RANSAC, poses refinadas, nube dispersa y ortofoto base, sin modificar la escena actual.
              </p>

              {/* Fila Realismo de superficie con switch */}
              <div className="m3d-v8-row-toggle">
                <div className="m3d-v8-icon-label">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                  </svg>
                  <span>Realismo de superficie</span>
                </div>
                <div
                  className={`m3d-toggle-switch ${realismoSuperficie ? "activo" : ""}`}
                  onClick={() => setRealismoSuperficie((v) => !v)}
                  title={realismoSuperficie ? "Desactivar realismo" : "Activar realismo"}
                >
                  <div className="m3d-toggle-thumb" />
                </div>
              </div>

              <div className="m3d-panel-v8-divider" />

              {/* 1. ESCOGER TOPOGRAFÍA */}
              <div className="m3d-v8-section">
                <span className="m3d-v8-sec-title">1. Escoger topografía</span>
                <p className="m3d-v8-info-p">
                  V8 solo ofrece mallas identificadas como topografía/terreno; no aplica la textura a cualquier sólido minero.
                </p>
                <p className="m3d-v8-warning-p">
                  No hay una superficie triangulada reconocida. Importa IMX o genera superficie desde XYZ.
                </p>

                <button
                  type="button"
                  className="btn-m3d-v8-infraworks"
                  onClick={() => notificar("Seleccionar FBX + POS + IMX de InfraWorks...")}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Paquete InfraWorks · FBX + POS + IMX
                </button>

                <p className="m3d-v8-subnote">
                  Selecciona juntos los archivos del mismo export. NAMICAD reconstruye el mosaico satelital incrustado en FBX, usa POS para georreferenciar y el IMX para la superficie.
                </p>

                <div className="m3d-v8-grid-2-btns">
                  <button
                    type="button"
                    className="btn-m3d-v8-secondary"
                    onClick={() => notificar("Importar IMX...")}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 12 15 15" />
                    </svg>
                    IMX
                  </button>

                  <button
                    type="button"
                    className="btn-m3d-v8-secondary"
                    onClick={() => notificar("Importar Ortofoto (JPG/PNG)...")}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Ortofoto
                  </button>
                </div>

                <p className="m3d-v8-subnote">
                  IMX: malla real de InfraWorks. Ortofoto: JPG/PNG. Primero selecciona una topografía; la imagen no se proyecta hasta confirmar su georreferenciación.
                </p>
              </div>

              <div className="m3d-panel-v8-divider" />

              {/* 2. MODO VISUAL */}
              <div className="m3d-v8-section">
                <span className="m3d-v8-sec-title">2. Modo visual</span>

                <div className="m3d-v8-modes-row">
                  <button
                    type="button"
                    className={`btn-m3d-v8-mode-pill ${modoVisualTerreno === "realista" ? "activo" : ""}`}
                    onClick={() => setModoVisualTerreno("realista")}
                  >
                    Relieve realista
                  </button>
                  <button
                    type="button"
                    className={`btn-m3d-v8-mode-pill ${modoVisualTerreno === "hipsometrico" ? "activo" : ""}`}
                    onClick={() => setModoVisualTerreno("hipsometrico")}
                  >
                    Hipsométrico
                  </button>
                  <button
                    type="button"
                    className={`btn-m3d-v8-mode-pill ${modoVisualTerreno === "satelital" ? "activo" : ""}`}
                    onClick={() => setModoVisualTerreno("satelital")}
                  >
                    Satelital
                  </button>
                </div>

                <div className="m3d-v8-row-toggle" style={{ marginTop: "12px" }}>
                  <div className="m3d-v8-icon-label">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <span>Mostrar triangulación</span>
                  </div>
                  <div
                    className={`m3d-toggle-switch ${mostrarTriangulacion ? "activo" : ""}`}
                    onClick={() => setMostrarTriangulacion((v) => !v)}
                  >
                    <div className="m3d-toggle-thumb" />
                  </div>
                </div>

                <p className="m3d-v8-subnote">
                  Apagado recomendado para Satelital, Híbrido y Render Pro. No afecta las curvas de nivel que estén en otra capa.
                </p>
              </div>

              <div className="m3d-panel-v8-divider" />

              {/* 3. LUZ Y MATERIAL */}
              <div className="m3d-v8-section">
                <span className="m3d-v8-sec-title">3. Luz y material</span>

                <div className="m3d-v8-slider-group">
                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Relieve {relieveVal.toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.05"
                      value={relieveVal}
                      onChange={(e) => setRelieveVal(parseFloat(e.target.value))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Sol · azimut {azimutVal}°</div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={azimutVal}
                      onChange={(e) => setAzimutVal(parseInt(e.target.value, 10))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Sol · elevación {elevacionVal}°</div>
                    <input
                      type="range"
                      min="5"
                      max="90"
                      step="1"
                      value={elevacionVal}
                      onChange={(e) => setElevacionVal(parseInt(e.target.value, 10))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Brillo {brilloVal.toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.05"
                      value={brilloVal}
                      onChange={(e) => setBrilloVal(parseFloat(e.target.value))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Saturación {saturacionVal.toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.5"
                      step="0.05"
                      value={saturacionVal}
                      onChange={(e) => setSaturacionVal(parseFloat(e.target.value))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Contraste {contrasteVal.toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.02"
                      value={contrasteVal}
                      onChange={(e) => setContrasteVal(parseFloat(e.target.value))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Gamma {gammaVal.toFixed(2)}</div>
                    <input
                      type="range"
                      min="0.4"
                      max="2.2"
                      step="0.05"
                      value={gammaVal}
                      onChange={(e) => setGammaVal(parseFloat(e.target.value))}
                      className="m3d-v8-range"
                    />
                  </div>

                  <div className="m3d-v8-slider-item">
                    <div className="m3d-v8-slider-label">Nitidez {nitidezVal}%</div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={nitidezVal}
                      onChange={(e) => setNitidezVal(parseInt(e.target.value, 10))}
                      className="m3d-v8-range"
                    />
                  </div>
                </div>

                <div className="m3d-v8-render-pro-card">
                  Render Pro V26 prioriza la ortofoto real, añade iluminación neutra, contraste, gamma y nitidez. La triangulación puede desactivarse para un aspecto fotorealista de vuelo dron.
                </div>
              </div>
            </div>
          )}

          {/* DOCK IZQUIERDO */}
          <div className="m3d-dock-left">
            <button
              type="button"
              className={`m3d-flap-btn ${panelV3Abierto ? "activo" : ""}`}
              title="V3: Control de cota, selección y órbita"
              onClick={() => {
                setPanelV3Abierto((v) => !v);
                setPanelV8Abierto(false);
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>V3</span>
            </button>

            <button
              type="button"
              className={`m3d-flap-btn ${panelV8Abierto ? "activo" : ""}`}
              title="V8: Superficie y realismo de terreno"
              onClick={() => {
                setPanelV8Abierto((v) => !v);
                setPanelV3Abierto(false);
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              <span>V8</span>
            </button>

            <button
              type="button"
              className="m3d-flap-btn"
              title="V9: Modelo de Bloques"
              onClick={() => {
                toggleVisibilidadCapa("capa-bloques");
                notificar("Modelo de bloques alternado.");
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>V9</span>
            </button>
          </div>

          {/* DOCK DERECHO */}
          <div className="m3d-dock-right">
            <button
              type="button"
              className="m3d-flap-btn"
              title="V4: Relieve Topográfico"
              onClick={() => {
                toggleVisibilidadCapa("capa-tin");
                notificar("Relieve topográfico alternado.");
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              <span>V4</span>
            </button>

            <button
              type="button"
              className="m3d-flap-btn"
              title="V5: Dibujo / Edición de líneas 3D"
              onClick={() => notificar("Herramienta V5: Trazado 3D activado.")}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>V5</span>
            </button>

            <button
              type="button"
              className="m3d-flap-btn"
              title="V6: Galerías y Túneles"
              onClick={() => {
                toggleVisibilidadCapa("capa-galeria");
                notificar("Galería / Túnel alternado.");
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span>V6</span>
            </button>

            <button
              type="button"
              className="m3d-flap-btn"
              title="V7: Exportar formatos 3D (.mine3d, .obj, .dxf, .stl, .csv)"
              onClick={handleExportarModal}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>V7</span>
            </button>
          </div>
        </>
      )}

      {/* 5. CAJÓN / DRAWER INFERIOR DESPLEGABLE SEGÚN PESTAÑA ACTIVA */}
      {tabInferior && (
        <div className="m3d-bottom-drawer-backdrop" onClick={() => setTabInferior(null)}>
          <div className="m3d-bottom-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="m3d-drawer-header">
              <h2 className="m3d-drawer-title">
                {tabInferior === "escena" && "CAPAS Y ELEMENTOS 3D"}
                {tabInferior === "analizar" && "ANÁLISIS TÉCNICO Y VOLUMETRÍA"}
                {tabInferior === "vista" && "AJUSTES DE VISUALIZACIÓN Y CÁMARA"}
              </h2>
              <button type="button" className="btn-m3d-drawer-close" onClick={() => setTabInferior(null)}>
                ✕
              </button>
            </div>

            {/* CONTENIDO DEL DRAWER: ESCENA */}
            {tabInferior === "escena" && (
              <div className="m3d-drawer-body">
                <p className="m3d-drawer-desc">Gestiona la visibilidad y apariencia de las capas del modelo 3D:</p>
                <div className="m3d-layers-list">
                  {capas.map((capa) => (
                    <div key={capa.id} className="m3d-layer-item">
                      <div className="m3d-layer-info">
                        <span className="m3d-layer-dot" style={{ background: capa.color }} />
                        <div>
                          <strong className="m3d-layer-name">{capa.nombre}</strong>
                          <span className="m3d-layer-meta">{capa.elementosCount} elementos ({capa.tipo.toUpperCase()})</span>
                        </div>
                      </div>

                      <div className="m3d-layer-actions">
                        <button
                          type="button"
                          className={`btn-m3d-layer-eye ${capa.visible ? "activo" : ""}`}
                          onClick={() => toggleVisibilidadCapa(capa.id)}
                          title={capa.visible ? "Ocultar capa" : "Mostrar capa"}
                        >
                          {capa.visible ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CONTENIDO DEL DRAWER: ANALIZAR */}
            {tabInferior === "analizar" && (
              <div className="m3d-drawer-body">
                <div className="m3d-analisis-grid">
                  <div className="m3d-analisis-card">
                    <span className="m3d-kpi-num">184,250 m³</span>
                    <span className="m3d-kpi-label">VOLUMEN TOTAL TIN</span>
                  </div>
                  <div className="m3d-analisis-card">
                    <span className="m3d-kpi-num">497,475 t</span>
                    <span className="m3d-kpi-label">TONELAJE ESTIMADO (2.7 t/m³)</span>
                  </div>
                  <div className="m3d-analisis-card">
                    <span className="m3d-kpi-num">1.18% Cu</span>
                    <span className="m3d-kpi-label">LEY PROMEDIO ESTIMADA</span>
                  </div>
                  <div className="m3d-analisis-card">
                    <span className="m3d-kpi-num">3,850 - 4,210 m</span>
                    <span className="m3d-kpi-label">RANGO DE ELEVACIÓN Z</span>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO DEL DRAWER: VISTA */}
            {tabInferior === "vista" && (
              <div className="m3d-drawer-body">
                <div className="m3d-view-presets-section">
                  <span className="m3d-section-title">ÁNGULOS DE CÁMARA</span>
                  <div className="m3d-view-buttons-row">
                    <button type="button" className="btn-m3d-view-opt" onClick={() => setVistaCamara("top")}>
                      PLANTA (Z)
                    </button>
                    <button type="button" className="btn-m3d-view-opt" onClick={() => setVistaCamara("front")}>
                      FRONTAL (Y)
                    </button>
                    <button type="button" className="btn-m3d-view-opt" onClick={() => setVistaCamara("right")}>
                      LATERAL (X)
                    </button>
                    <button type="button" className="btn-m3d-view-opt" onClick={() => setVistaCamara("iso")}>
                      ISOMÉTRICA
                    </button>
                  </div>

                  <span className="m3d-section-title" style={{ marginTop: "14px" }}>MODOS DE RENDERIZADO</span>
                  <div className="m3d-view-buttons-row">
                    <button
                      type="button"
                      className={`btn-m3d-view-opt ${modoAlambrico ? "activo" : ""}`}
                      onClick={() => setModoAlambrico((a) => !a)}
                    >
                      {modoAlambrico ? "ALÁMBRICO ON" : "SÓLIDO"}
                    </button>
                    <button
                      type="button"
                      className={`btn-m3d-view-opt ${grillaVisible ? "activo" : ""}`}
                      onClick={() => setGrillaVisible((g) => !g)}
                    >
                      GRILLA {grillaVisible ? "ON" : "OFF"}
                    </button>
                    <button
                      type="button"
                      className={`btn-m3d-view-opt ${ejesVisibles ? "activo" : ""}`}
                      onClick={() => setEjesVisibles((e) => !e)}
                    >
                      EJES XYZ {ejesVisibles ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. BARRA INFERIOR DE NAVEGACIÓN (Escena, Importar, Analizar, Vista) */}
      <nav className="m3d-bottom-navbar">
        <button
          type="button"
          className={`m3d-bottom-nav-item ${tabInferior === "escena" ? "activo" : ""}`}
          onClick={() => setTabInferior((t) => (t === "escena" ? null : "escena"))}
        >
          <div className="m3d-nav-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span>Escena</span>
        </button>

        <button
          type="button"
          className="m3d-bottom-nav-item"
          onClick={handleImportarModal}
        >
          <div className="m3d-nav-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
          </div>
          <span>Importar</span>
        </button>

        <button
          type="button"
          className={`m3d-bottom-nav-item ${tabInferior === "analizar" ? "activo" : ""}`}
          onClick={() => setTabInferior((t) => (t === "analizar" ? null : "analizar"))}
        >
          <div className="m3d-nav-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </div>
          <span>Analizar</span>
        </button>

        <button
          type="button"
          className={`m3d-bottom-nav-item ${tabInferior === "vista" ? "activo" : ""}`}
          onClick={() => setTabInferior((t) => (t === "vista" ? null : "vista"))}
        >
          <div className="m3d-nav-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span>Vista</span>
        </button>
      </nav>

      {/* 7. MODAL MULTI-FORMATO 3D (.MINE3D, .OBJ, .DXF, .STL, .CSV, .NAMICAD3D) */}
      {modal3DAbierto && (
        <ModalImportarExportar3D
          abierto={modal3DAbierto}
          modoInicial={modoModal3D}
          soloModo={modoModal3D}
          proyectoId={proyectoId}
          proyectoNombre={proyecto?.nombre || "Modelo_3D"}
          moduloId="modelo3d"
          colorTema="#ec4899"
          onCerrar={() => setModal3DAbierto(false)}
          onProyectoImportado={handleProyectoImportado}
        />
      )}

      {/* 8. MODAL DE BIENVENIDA / ESCENA LISTA AL INICIO (EXACTO AL MOCKUP) */}
      {modalInicioAbierto && (
        <div className="m3d-welcome-backdrop">
          <div className="m3d-welcome-card">
            <button
              type="button"
              className="btn-m3d-welcome-close"
              onClick={() => setModalInicioAbierto(false)}
              title="Cerrar aviso"
            >
              ✕
            </button>

            <div className="m3d-welcome-icon-wrap">
              <CuboEscaneo3DAnimado size={96} color="#ec4899" />
            </div>

            <h2 className="m3d-welcome-title">Escena lista</h2>
            <p className="m3d-welcome-desc">
              Importa un modelo de bloques, sondajes, curvas o una pareja PT/TR.
            </p>

            <button
              type="button"
              className="btn-m3d-welcome-action"
              onClick={() => {
                setModalInicioAbierto(false);
                handleImportarModal();
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zm-1 9v4h-2v-4H8l4-4 4 4h-2z" />
              </svg>
              Importar datos
            </button>
          </div>
        </div>
      )}

      {/* 9. MODAL V8 · DRON PRO - ESPACIO DE FOTOGRAMETRÍA INDEPENDIENTE */}
      {modalDronProAbierto && (
        <div className="m3d-welcome-backdrop" onClick={() => setModalDronProAbierto(false)}>
          <div className="m3d-dron-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="m3d-dron-modal-header">
              <div className="m3d-dron-modal-badge">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8V5a1 1 0 0 1 1-1h3" />
                  <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
                  <path d="M4 16v3a1 1 0 0 0 1 1h3" />
                  <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
                  <path d="M12 7l5 2.8v5.6L12 18.2l-5-2.8V9.8z" />
                  <path d="M12 7v5.6" />
                  <path d="M12 12.6l5-2.8" />
                  <path d="M12 12.6l-5-2.8" />
                </svg>
                <span>V8 · DRON PRO</span>
              </div>
              <button
                type="button"
                className="btn-m3d-welcome-close"
                onClick={() => setModalDronProAbierto(false)}
                title="Cerrar fotogrametría"
              >
                ✕
              </button>
            </div>

            <h3 className="m3d-dron-title">Espacio Independiente de Fotogrametría</h3>
            <p className="m3d-dron-sub">
              Abre el espacio independiente de fotogrametría. Nivel A valida el vuelo y Nivel B realiza feature matching, RANSAC, poses refinadas, nube dispersa y ortofoto base, sin modificar la escena actual.
            </p>

            <div className="m3d-dron-levels">
              <div className="m3d-dron-level-card">
                <div className="m3d-dron-level-tag">NIVEL A · VALIDACIÓN DE VUELO</div>
                <div className="m3d-dron-level-items">
                  <div className="m3d-dron-check-item">
                    <span className="dot-ok" /> Solapamiento frontal recomendado: &ge; 75%
                  </div>
                  <div className="m3d-dron-check-item">
                    <span className="dot-ok" /> Solapamiento lateral recomendado: &ge; 65%
                  </div>
                  <div className="m3d-dron-check-item">
                    <span className="dot-ok" /> Telemetría GPS / EXIF y altitud de vuelo AGL
                  </div>
                </div>
              </div>

              <div className="m3d-dron-level-card">
                <div className="m3d-dron-level-tag">NIVEL B · RECONSTRUCCIÓN SFM</div>
                <div className="m3d-dron-level-items">
                  <div className="m3d-dron-check-item">
                    <span className="dot-pink" /> Feature Matching (detección de puntos homólogos)
                  </div>
                  <div className="m3d-dron-check-item">
                    <span className="dot-pink" /> Filtrado RANSAC y corrección geométrica
                  </div>
                  <div className="m3d-dron-check-item">
                    <span className="dot-pink" /> Poses refinadas (Bundle Adjustment SfM)
                  </div>
                  <div className="m3d-dron-check-item">
                    <span className="dot-pink" /> Nube dispersa y ortofoto base georreferenciada
                  </div>
                </div>
              </div>
            </div>

            <div className="m3d-dron-actions">
              <button
                type="button"
                className="btn-m3d-dron-primary"
                onClick={() => {
                  notificar("Cargando set de imágenes fotogramétricas de vuelo dron...");
                  setModalDronProAbierto(false);
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Importar imágenes de vuelo
              </button>
              <button
                type="button"
                className="btn-m3d-dron-secondary"
                onClick={() => setModalDronProAbierto(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
