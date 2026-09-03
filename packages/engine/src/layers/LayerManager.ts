import * as THREE from "three";

export interface DefinicionCapa {
  id: string;
  nombre: string;
  color?: string;
  visible?: boolean;
  bloqueada?: boolean;
  opacidad?: number;
  /** Carpeta para agrupar en el panel de capas (p.ej. "Topografía", "Sondajes"). Default "General". */
  carpeta?: string;
  /** Tipo/categoria para filtrar en el panel de capas (p.ej. "topografia", "sondajes", "texto"). Default "general". */
  tipo?: string;
}

export interface EstadoCapa extends Required<Omit<DefinicionCapa, "color">> {
  color: string;
  grupo: THREE.Group;
}

/**
 * Gestiona las capas tipo CAD de la escena. Cada capa es un THREE.Group con metadatos
 * (visible, bloqueada, color, opacidad). Convencion de id: `layer.{vertical}.{modulo}.{contenido}`.
 */
export class LayerManager {
  private capas = new Map<string, EstadoCapa>();
  private escena: THREE.Scene;

  constructor(escena: THREE.Scene) {
    this.escena = escena;
  }

  crearCapa(def: DefinicionCapa): EstadoCapa {
    const existente = this.capas.get(def.id);
    if (existente) return existente;
    const grupo = new THREE.Group();
    grupo.name = def.id;
    grupo.visible = def.visible ?? true;
    this.escena.add(grupo);
    const estado: EstadoCapa = {
      id: def.id,
      nombre: def.nombre,
      color: def.color ?? "#ffffff",
      visible: def.visible ?? true,
      bloqueada: def.bloqueada ?? false,
      opacidad: def.opacidad ?? 1,
      carpeta: def.carpeta ?? "General",
      tipo: def.tipo ?? "general",
      grupo,
    };
    this.capas.set(def.id, estado);
    return estado;
  }

  obtenerCapa(id: string): EstadoCapa | undefined {
    return this.capas.get(id);
  }

  listarCapas(): EstadoCapa[] {
    return Array.from(this.capas.values());
  }

  toggleVisible(id: string, visible?: boolean): void {
    const capa = this.capas.get(id);
    if (!capa) return;
    capa.visible = visible ?? !capa.visible;
    capa.grupo.visible = capa.visible;
  }

  setColor(id: string, color: string): void {
    const capa = this.capas.get(id);
    if (!capa) return;
    capa.color = color;
    capa.grupo.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (material && "color" in material) {
        material.color.set(color);
      }
    });
  }

  setOpacidad(id: string, opacidad: number): void {
    const capa = this.capas.get(id);
    if (!capa) return;
    capa.opacidad = Math.min(Math.max(opacidad, 0), 1);
    capa.grupo.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const aplicar = (m: THREE.Material) => {
        m.transparent = capa.opacidad < 1;
        m.opacity = capa.opacidad;
      };
      if (Array.isArray(material)) material.forEach(aplicar);
      else if (material) aplicar(material);
    });
  }

  bloquear(id: string, bloqueada = true): void {
    const capa = this.capas.get(id);
    if (!capa) return;
    capa.bloqueada = bloqueada;
  }

  limpiarCapa(id: string): void {
    const capa = this.capas.get(id);
    if (!capa) return;
    while (capa.grupo.children.length > 0) {
      const child = capa.grupo.children.pop()!;
      capa.grupo.remove(child);
      disposeRecursivo(child);
    }
  }

  eliminarCapa(id: string): void {
    const capa = this.capas.get(id);
    if (!capa) return;
    this.limpiarCapa(id);
    this.escena.remove(capa.grupo);
    this.capas.delete(id);
  }
}

function disposeRecursivo(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material?.dispose();
    }
  });
}
