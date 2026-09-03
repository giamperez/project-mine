import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Convencion minera/topografica: X=Este, Y=Norte, Z=Cota (elevacion). Three.js por defecto es
// Y-up; lo cambiamos globalmente a Z-up para que el dominio (PuntoXYZ.z = elevacion) mapee 1:1
// a coordenadas de mundo sin remapeos por modulo.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export interface OpcionesSceneManager {
  contenedor: HTMLElement;
  colorFondo?: string;
  /** Tope de devicePixelRatio para no reventar el rendimiento en moviles de gama alta. */
  maxPixelRatio?: number;
}

/**
 * Envuelve escena, camara, renderer y controles de Three.js para que los modulos
 * no dependan directamente de Three (se puede cambiar de motor sin tocar los modulos).
 * Funciona igual con mouse (desktop) que con gestos tactiles (movil/tablet) via OrbitControls.
 */
export class SceneManager {
  readonly escena: THREE.Scene;
  readonly camara: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controles: OrbitControls;

  private contenedor: HTMLElement;
  private resizeObserver: ResizeObserver;
  private frameId: number | null = null;

  constructor(opciones: OpcionesSceneManager) {
    this.contenedor = opciones.contenedor;

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color(opciones.colorFondo ?? "#12161c");

    const { clientWidth: ancho, clientHeight: alto } = this.contenedor;
    this.camara = new THREE.PerspectiveCamera(55, Math.max(ancho, 1) / Math.max(alto, 1), 0.1, 10000);
    this.camara.up.set(0, 0, 1);
    this.camara.position.set(30, -30, 30);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const maxPR = opciones.maxPixelRatio ?? 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
    this.renderer.setSize(ancho, alto);
    this.renderer.localClippingEnabled = true; // habilita establecerPlanosCorte (plano de cota / corte visual)
    this.contenedor.appendChild(this.renderer.domElement);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    this.controles.screenSpacePanning = true;
    // Un dedo = orbita, dos dedos = pan+zoom (tactil); igual de usable en tablet/celular que con mouse.
    this.controles.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.6);
    const luzDireccional = new THREE.DirectionalLight(0xffffff, 0.8);
    luzDireccional.position.set(50, 80, 30);
    this.escena.add(luzAmbiente, luzDireccional);

    const grilla = new THREE.GridHelper(200, 40, 0x334155, 0x1e293b);
    grilla.rotateX(Math.PI / 2); // GridHelper nace en el plano XZ (Y-up); lo llevamos al plano XY (Z-up)
    this.escena.add(grilla);

    this.resizeObserver = new ResizeObserver(() => this.ajustarTamano());
    this.resizeObserver.observe(this.contenedor);
  }

  private ajustarTamano(): void {
    const { clientWidth: ancho, clientHeight: alto } = this.contenedor;
    if (ancho === 0 || alto === 0) return;
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(ancho, alto);
  }

  encuadrarObjeto(objeto: THREE.Object3D, margen = 1.5): void {
    const caja = new THREE.Box3().setFromObject(objeto);
    if (caja.isEmpty()) return;
    const centro = caja.getCenter(new THREE.Vector3());
    const tamano = caja.getSize(new THREE.Vector3());
    const radio = Math.max(tamano.x, tamano.y, tamano.z) * margen;
    this.camara.position.set(centro.x + radio, centro.y + radio, centro.z + radio);
    this.controles.target.copy(centro);
    this.controles.update();
  }

  /**
   * Corte visual global (plano de cota): oculta todo lo que quede fuera de [zMin, zMax] sin tocar
   * los datos (a diferencia de un recorte real que reduce el arreglo de bloques). Pasar null quita
   * el corte. Convencion Z-up: normal (0,0,1) mantiene z>=zMin, normal (0,0,-1) mantiene z<=zMax —
   * ver Three.js: un fragmento se descarta si normal·punto + constant < 0.
   */
  establecerPlanoCota(rango: { zMin: number; zMax: number } | null): void {
    if (!rango) {
      this.renderer.clippingPlanes = [];
      return;
    }
    this.renderer.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -rango.zMin),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), rango.zMax),
    ];
  }

  iniciarLoop(): void {
    const loop = () => {
      this.controles.update();
      this.renderer.render(this.escena, this.camara);
      this.frameId = requestAnimationFrame(loop);
    };
    loop();
  }

  destruir(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.controles.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.contenedor) {
      this.contenedor.removeChild(this.renderer.domElement);
    }
  }
}
