import * as THREE from "three";
import { viridis, type LayerManager, type EstadoCapa } from "@suite/engine";
import type { ResultadoVoladura, Taladro } from "@suite/core";
import { CAPAS, MODULO_ID } from "./etiquetas.js";

interface FragmentoRoca {
  mesh: THREE.Mesh;
  origen: THREE.Vector3;
  velocidad: THREE.Vector3;
  rotacionVel: THREE.Vector3;
  sueloZ: number;
}

interface HumoPuff {
  mesh: THREE.Mesh;
  origen: THREE.Vector3;
  velocidad: THREE.Vector3;
  escalaMax: number;
}

interface ExplosionVoladura {
  taladroId: string;
  tiempoDetonacion_ms: number;
  collar: THREE.Vector3;
  marcadorMesh: THREE.Mesh;
  destelloMesh: THREE.Mesh;
  ondaMesh: THREE.Mesh;
  fragmentos: FragmentoRoca[];
  humos: HumoPuff[];
}

/**
 * Controla la animación física y visual de la voladura y la excavación del túnel:
 * - Destellos y bolas de fuego en el momento de detonación
 * - Ondas de choque superficiales
 * - Expulsión balística y colapso de fragmentos de roca hacia el piso
 * - Revelación de la galería/túnel excavado y nuevo frente
 * - Crecimiento progresivo de la pila de escombros (muckpile)
 * - Nubes volumétricas de polvo y gases
 */
export class SecuenciaAnimador {
  private explosiones: ExplosionVoladura[] = [];
  private muckpileMesh: THREE.Mesh | null = null;
  private tunelMesh: THREE.Mesh | null = null;
  private duracionTotal_ms = 1;

  constructor(readonly capa: EstadoCapa) {}

  establecerExplosiones(
    explosiones: ExplosionVoladura[],
    muckpileMesh?: THREE.Mesh,
    tunelMesh?: THREE.Mesh,
    duracionTotal_ms?: number
  ): void {
    this.explosiones = explosiones;
    this.muckpileMesh = muckpileMesh ?? null;
    this.tunelMesh = tunelMesh ?? null;
    this.duracionTotal_ms = Math.max(duracionTotal_ms ?? 1, 1);
  }

  // Compatibilidad con código anterior
  establecerMarcadores(_marcadores: any[]): void {}

  actualizarTiempo(tiempoActual_ms: number): void {
    const progresoGlobal = Math.min(Math.max(tiempoActual_ms / this.duracionTotal_ms, 0), 1);

    // Actualizar crecimiento del túnel excavado y pila de escombros (muckpile)
    if (this.muckpileMesh) {
      this.muckpileMesh.visible = progresoGlobal > 0.05;
      const escalaMuck = Math.min(progresoGlobal * 1.25, 1);
      this.muckpileMesh.scale.set(escalaMuck, escalaMuck, escalaMuck);
    }

    if (this.tunelMesh) {
      this.tunelMesh.visible = true;
      (this.tunelMesh.material as THREE.MeshStandardMaterial).opacity = 0.4 + 0.6 * progresoGlobal;
    }

    for (const exp of this.explosiones) {
      const delta_ms = tiempoActual_ms - exp.tiempoDetonacion_ms;
      const deltaSec = delta_ms / 1000;

      if (delta_ms < 0) {
        // 1. Estado PRE-DETONACIÓN (Taladro esperando orden de fuego)
        exp.marcadorMesh.visible = true;
        (exp.marcadorMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        exp.marcadorMesh.scale.setScalar(1);
        exp.destelloMesh.visible = false;
        exp.ondaMesh.visible = false;
        for (const f of exp.fragmentos) f.mesh.visible = false;
        for (const h of exp.humos) h.mesh.visible = false;
      } else {
        // 2. Estado EN/POST DETONACIÓN

        // A. Destello de bola de fuego (110ms)
        if (delta_ms <= 110) {
          exp.destelloMesh.visible = true;
          const tDestello = delta_ms / 110;
          const scale = 1 + 5.2 * (1 - Math.abs(tDestello - 0.25));
          exp.destelloMesh.scale.setScalar(scale);
          (exp.destelloMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - tDestello * 1.2);
        } else {
          exp.destelloMesh.visible = false;
        }

        // B. Onda de choque expansiva en el suelo/frente (360ms)
        if (delta_ms <= 360) {
          exp.ondaMesh.visible = true;
          const tOnda = delta_ms / 360;
          exp.ondaMesh.scale.set(1 + 6.5 * tOnda, 1 + 6.5 * tOnda, 1);
          (exp.ondaMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - tOnda));
        } else {
          exp.ondaMesh.visible = false;
        }

        // C. Marcador de collar colapsa y se destruye (180ms)
        if (delta_ms <= 180) {
          const tColapso = delta_ms / 180;
          exp.marcadorMesh.scale.setScalar(Math.max(0.01, 1.8 * (1 - tColapso)));
          (exp.marcadorMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.5 * (1 - tColapso);
        } else {
          exp.marcadorMesh.visible = false;
        }

        // D. Fragmentación y trayectoria balística de roca hacia el piso del túnel
        for (const f of exp.fragmentos) {
          f.mesh.visible = true;
          const tF = deltaSec * 3.8;
          const posX = f.origen.x + f.velocidad.x * tF;
          const posY = f.origen.y + f.velocidad.y * tF;
          const posZ = f.origen.z + f.velocidad.z * tF - 0.5 * 15.0 * tF * tF;

          if (posZ <= f.sueloZ) {
            // Roca impacta en el suelo y forma parte del muckpile
            f.mesh.position.set(posX, posY, f.sueloZ + Math.random() * 0.2);
          } else {
            // Vuelo libre y rotación dinámica de fragmentos
            f.mesh.position.set(posX, posY, posZ);
            f.mesh.rotation.x += f.rotacionVel.x * 0.08;
            f.mesh.rotation.y += f.rotacionVel.y * 0.08;
          }
        }

        // E. Humo, polvo y gases de voladura (1600ms)
        if (delta_ms <= 1600) {
          const tHumo = delta_ms / 1600;
          for (const h of exp.humos) {
            h.mesh.visible = true;
            const tH = deltaSec * 1.8;
            h.mesh.position.set(
              h.origen.x + h.velocidad.x * tH,
              h.origen.y + h.velocidad.y * tH,
              h.origen.z + h.velocidad.z * tH
            );
            const scaleH = 1 + h.escalaMax * tHumo;
            h.mesh.scale.setScalar(scaleH);
            (h.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 * (1 - tHumo));
          }
        } else {
          for (const h of exp.humos) h.mesh.visible = false;
        }
      }
    }
  }
}

/** Mapa de color viridis tipo isocrona */
function colorPorTiempo(t: number, tMax: number): THREE.Color {
  const frac = tMax > 0 ? THREE.MathUtils.clamp(t / tMax, 0, 1) : 0;
  const { r, g, b } = viridis(frac);
  return new THREE.Color(r, g, b);
}

/**
 * Crea la geometría arqueada del túnel / galería (perfil herradura / baúl)
 */
function crearGeometriaTunel(
  ancho: number,
  alto: number,
  longitudAvance: number
): THREE.BufferGeometry {
  const puntosPerfil: THREE.Vector2[] = [];
  const segmentosArco = 16;
  const radioArco = ancho / 2;
  const altoRecto = Math.max(alto - radioArco, 0.5);

  // Piso
  puntosPerfil.push(new THREE.Vector2(-ancho / 2, 0));
  puntosPerfil.push(new THREE.Vector2(ancho / 2, 0));
  // Hastial derecho
  puntosPerfil.push(new THREE.Vector2(ancho / 2, altoRecto));
  // Corona arqueada
  for (let i = 0; i <= segmentosArco; i++) {
    const ang = (Math.PI * i) / segmentosArco;
    const x = Math.cos(ang) * radioArco;
    const y = altoRecto + Math.sin(ang) * radioArco;
    puntosPerfil.push(new THREE.Vector2(x, y));
  }
  // Hastial izquierdo
  puntosPerfil.push(new THREE.Vector2(-ancho / 2, altoRecto));
  puntosPerfil.push(new THREE.Vector2(-ancho / 2, 0));

  const forma = new THREE.Shape(puntosPerfil);
  const extrudeSettings = {
    depth: longitudAvance,
    bevelEnabled: false,
    steps: 1,
  };

  const geo = new THREE.ExtrudeGeometry(forma, extrudeSettings);
  // Orientar con Z hacia arriba y Y como avance
  geo.rotateX(Math.PI / 2);
  return geo;
}

/**
 * Construye la simulación física y visual completa de la voladura y el túnel resultante en 3D
 */
export function construirEscenaSecuencia(
  layerManager: LayerManager,
  resultado: ResultadoVoladura,
  taladros: Taladro[]
): SecuenciaAnimador {
  const capa = layerManager.crearCapa({
    id: CAPAS.secuencia,
    nombre: "Secuencia y Colapso 3D",
    color: "#f97316",
  });
  layerManager.limpiarCapa(CAPAS.secuencia);

  const collarPorId = new Map(taladros.map((t) => [t.id, t.collar]));
  const fondoPorId = new Map(taladros.map((t) => [t.id, t.fondo]));
  const explosiones: ExplosionVoladura[] = [];

  // Calcular dimensiones del frente / túnel a partir de los taladros
  const xs = taladros.map((t) => t.collar.x);
  const ys = taladros.map((t) => t.collar.y);
  const zs = taladros.map((t) => t.collar.z);

  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 6);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 6);
  const minZ = Math.min(...zs, 0);
  const maxZ = Math.max(...zs, 5);

  const centroX = (minX + maxX) / 2;
  const centroY = (minY + maxY) / 2;
  const anchoTunel = Math.max(maxX - minX + 1.2, 4.5);
  const altoTunel = Math.max(maxZ - minZ + 1.0, 4.0);
  const longitudAvance = 3.5;

  // 1. Túnel excavado resultante (Cavidad de avance)
  const geoTunel = crearGeometriaTunel(anchoTunel, altoTunel, longitudAvance);
  const matTunel = new THREE.MeshStandardMaterial({
    color: 0x272e38,
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.85,
    wireframe: false,
  });
  const tunelMesh = new THREE.Mesh(geoTunel, matTunel);
  tunelMesh.position.set(centroX, centroY, minZ);
  capa.grupo.add(tunelMesh);

  // 2. Marco del nuevo frente de avance (nuevo Face de roca)
  const geoFrenteNuevo = new THREE.PlaneGeometry(anchoTunel * 0.95, altoTunel * 0.95);
  const matFrenteNuevo = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.9,
    metalness: 0.1,
  });
  const frenteNuevoMesh = new THREE.Mesh(geoFrenteNuevo, matFrenteNuevo);
  frenteNuevoMesh.rotateX(Math.PI / 2);
  frenteNuevoMesh.position.set(centroX, centroY + longitudAvance, minZ + altoTunel / 2);
  capa.grupo.add(frenteNuevoMesh);

  // 3. Pila de escombros de roca (Muckpile) sobre el piso del túnel
  const geoMuckpile = new THREE.ConeGeometry(anchoTunel * 0.45, altoTunel * 0.55, 18);
  geoMuckpile.rotateX(Math.PI / 2); // Acostado a lo largo del piso
  const matMuckpile = new THREE.MeshStandardMaterial({
    color: 0x473d31,
    roughness: 0.95,
    metalness: 0.05,
  });
  const muckpileMesh = new THREE.Mesh(geoMuckpile, matMuckpile);
  muckpileMesh.scale.set(1.2, 0.7, 0.45);
  muckpileMesh.position.set(centroX, centroY + longitudAvance * 0.35, minZ + 0.6);
  muckpileMesh.visible = false;
  capa.grupo.add(muckpileMesh);

  // Geometrías y materiales reutilizables
  const geoMarcador = new THREE.SphereGeometry(0.35, 14, 14);
  const geoDestello = new THREE.SphereGeometry(0.65, 12, 12);
  const geoOnda = new THREE.RingGeometry(0.2, 1.2, 24);
  geoOnda.rotateX(-Math.PI / 2);

  const geoRoca1 = new THREE.DodecahedronGeometry(0.28, 0);
  const geoRoca2 = new THREE.BoxGeometry(0.36, 0.3, 0.24);
  const geoHumo = new THREE.SphereGeometry(0.65, 8, 8);

  const matRoca1 = new THREE.MeshStandardMaterial({
    color: 0x423b35,
    roughness: 0.9,
    metalness: 0.1,
  });
  const matRoca2 = new THREE.MeshStandardMaterial({
    color: 0x5a5045,
    roughness: 0.85,
    metalness: 0.15,
  });

  for (const carga of resultado.cargas) {
    const collar = collarPorId.get(carga.taladroId);
    if (!collar) continue;

    const fondo = fondoPorId.get(carga.taladroId);
    const sueloZ = fondo ? Math.min(fondo.z, collar.z) : minZ;

    const colorIso = colorPorTiempo(carga.tiempoDetonacion_ms, resultado.duracionTotalSecuencia_ms);

    // Marcador de collar del taladro
    const matMarcador = new THREE.MeshStandardMaterial({
      color: colorIso,
      emissive: colorIso,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });
    const marcadorMesh = new THREE.Mesh(geoMarcador, matMarcador);
    marcadorMesh.position.set(collar.x, collar.y, collar.z + 0.3);
    capa.grupo.add(marcadorMesh);

    // Destello de bola de fuego
    const matDestello = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 1,
    });
    const destelloMesh = new THREE.Mesh(geoDestello, matDestello);
    destelloMesh.position.set(collar.x, collar.y, collar.z + 0.6);
    destelloMesh.visible = false;
    capa.grupo.add(destelloMesh);

    // Onda de choque
    const matOnda = new THREE.MeshBasicMaterial({
      color: 0xffeedd,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ondaMesh = new THREE.Mesh(geoOnda, matOnda);
    ondaMesh.position.set(collar.x, collar.y, collar.z + 0.05);
    ondaMesh.visible = false;
    capa.grupo.add(ondaMesh);

    // Fragmentos de roca hacia el piso del túnel (8 rocas por taladro)
    const fragmentos: FragmentoRoca[] = [];
    const numRocas = 8;
    for (let r = 0; r < numRocas; r++) {
      const geoR = r % 2 === 0 ? geoRoca1 : geoRoca2;
      const matR = r % 2 === 0 ? matRoca1 : matRoca2;
      const meshRoca = new THREE.Mesh(geoR, matR.clone());
      meshRoca.scale.setScalar(0.7 + Math.random() * 0.6);
      meshRoca.visible = false;
      capa.grupo.add(meshRoca);

      // Proyección hacia afuera del frente y caída al piso
      const angulo = Math.random() * Math.PI * 2;
      const velHorizontal = 1.5 + Math.random() * 4.5;
      const velVertical = 2.5 + Math.random() * 5.0;

      fragmentos.push({
        mesh: meshRoca,
        origen: new THREE.Vector3(collar.x, collar.y, collar.z + 0.2),
        velocidad: new THREE.Vector3(
          Math.cos(angulo) * velHorizontal,
          Math.sin(angulo) * velHorizontal,
          velVertical
        ),
        rotacionVel: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        sueloZ: minZ,
      });
    }

    // Nubes de humo y polvo
    const humos: HumoPuff[] = [];
    const numHumos = 3;
    for (let h = 0; h < numHumos; h++) {
      const matHumo = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.55,
      });
      const meshHumo = new THREE.Mesh(geoHumo, matHumo);
      meshHumo.visible = false;
      capa.grupo.add(meshHumo);

      const angH = Math.random() * Math.PI * 2;
      humos.push({
        mesh: meshHumo,
        origen: new THREE.Vector3(collar.x, collar.y, collar.z + 0.5),
        velocidad: new THREE.Vector3(
          Math.cos(angH) * 1.5,
          Math.sin(angH) * 1.5,
          1.8 + Math.random() * 2.2
        ),
        escalaMax: 4.5 + Math.random() * 2.8,
      });
    }

    explosiones.push({
      taladroId: carga.taladroId,
      tiempoDetonacion_ms: carga.tiempoDetonacion_ms,
      collar: new THREE.Vector3(collar.x, collar.y, collar.z),
      marcadorMesh,
      destelloMesh,
      ondaMesh,
      fragmentos,
      humos,
    });
  }

  const animador = new SecuenciaAnimador(capa);
  animador.establecerExplosiones(
    explosiones,
    muckpileMesh,
    tunelMesh,
    resultado.duracionTotalSecuencia_ms
  );
  return animador;
}
