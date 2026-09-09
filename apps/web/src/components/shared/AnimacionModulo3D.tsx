import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ModuloId } from "../../Dashboard.js";

interface Props {
  moduloId: ModuloId;
  color: string;
  size?: number;
}

export default function AnimacionModulo3D({ moduloId, color, size = 84 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    const width = size;
    const height = size;

    // Escena, cámara y renderizador transparente
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 8.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    contenedor.appendChild(renderer.domElement);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const hexColor = parseInt(color.replace("#", ""), 16);
    const dirLight = new THREE.DirectionalLight(hexColor, 3);
    dirLight.position.set(4, 8, 6);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(hexColor, 2.5, 12);
    pointLight.position.set(-3, 2, 3);
    scene.add(pointLight);

    // Grupo contenedor para rotación suave
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const meshesParaLimpiar: THREE.Object3D[] = [];

    const matGlow = new THREE.MeshBasicMaterial({
      color: hexColor,
    });
    const matWire = new THREE.MeshBasicMaterial({
      color: hexColor,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    const matTrans = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    if (moduloId === "malla") {
      // FORMA 3D EXACTA AL ICONO DE MALLA: Anillos concéntricos de voladura + retículo + taladros
      const blastGroup = new THREE.Group();

      // 3 Anillos concéntricos luminosos
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 8, 36), matGlow);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 8, 32), matGlow);
      const r3 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 24), matGlow);
      r1.rotation.x = Math.PI / 2;
      r2.rotation.x = Math.PI / 2;
      r3.rotation.x = Math.PI / 2;
      blastGroup.add(r1, r2, r3);

      // Centro detonador
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), matGlow);
      blastGroup.add(core);

      // Ejes en cruz de disparo
      const axisGeo = new THREE.CylinderGeometry(0.04, 0.04, 5.2, 8);
      const axisX = new THREE.Mesh(axisGeo, matGlow);
      axisX.rotation.z = Math.PI / 2;
      const axisZ = new THREE.Mesh(axisGeo, matGlow);
      axisZ.rotation.x = Math.PI / 2;
      blastGroup.add(axisX, axisZ);

      // Taladros verticales hacia abajo
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        const x = Math.cos(angle) * 1.6;
        const z = Math.sin(angle) * 1.6;
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8), matWire);
        hole.position.set(x, -0.7, z);
        blastGroup.add(hole);
      }

      rootGroup.add(blastGroup);
      meshesParaLimpiar.push(blastGroup);
    } else if (moduloId === "topografia") {
      // FORMA 3D EXACTA AL ICONO DE TOPOGRAFÍA: Curvas de nivel escalonadas TIN
      const topoGroup = new THREE.Group();

      // 4 Niveles de curvas topográficas flotantes
      const radios = [2.6, 2.0, 1.4, 0.7];
      radios.forEach((r, idx) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 36), matGlow);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = (idx - 1.5) * 0.7;
        topoGroup.add(ring);

        // Malla interior
        const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 16), matTrans);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = (idx - 1.5) * 0.7;
        topoGroup.add(disc);
      });

      rootGroup.add(topoGroup);
      meshesParaLimpiar.push(topoGroup);
    } else if (moduloId === "geomecanica") {
      // FORMA 3D EXACTA AL ICONO DE GEOMECÁNICA: Onda de pulso sísmico y macizo
      const geoGroup = new THREE.Group();

      // Bloque de roca fracturado
      const cube = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), matWire);
      geoGroup.add(cube);

      // Plano de falla diagonal dorado
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), matTrans);
      plane.rotation.set(Math.PI / 4, Math.PI / 6, 0);
      geoGroup.add(plane);

      // Anillo de pulso sismográfico
      const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 8, 32), matGlow);
      pulseRing.rotation.x = Math.PI / 2;
      geoGroup.add(pulseRing);

      rootGroup.add(geoGroup);
      meshesParaLimpiar.push(geoGroup);
    } else if (moduloId === "estereografia") {
      // FORMA 3D EXACTA AL ICONO DE ESTEREOGRAFÍA: Red de Schmidt con círculos polares
      const stGroup = new THREE.Group();

      // Esfera exterior
      const sph = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), matWire);
      stGroup.add(sph);

      // Anillos polares
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 8, 32), matGlow);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 8, 32), matGlow);
      ring1.rotation.x = Math.PI / 2;
      ring2.rotation.y = Math.PI / 2;
      stGroup.add(ring1, ring2);

      // Polos luminosos
      const pole1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), matGlow);
      pole1.position.set(1.1, 1.1, 1.1);
      const pole2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), matGlow);
      pole2.position.set(-1.1, 0.8, -1.1);
      stGroup.add(pole1, pole2);

      rootGroup.add(stGroup);
      meshesParaLimpiar.push(stGroup);
    } else if (moduloId === "acarreo") {
      // FORMA 3D EXACTA AL ICONO DE ACARREO: Dumper minero estilizado
      const truckGroup = new THREE.Group();

      // Tolva y chasis
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.3), matTrans);
      const tolva = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.4), matWire);
      tolva.position.set(-0.4, 0.6, 0);
      tolva.rotation.z = -0.15;
      const cabina = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.0), matGlow);
      cabina.position.set(0.7, 0.55, 0);
      truckGroup.add(chassis, tolva, cabina);

      // 4 Ruedas mineras
      const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
      const w1 = new THREE.Mesh(wheelGeo, matGlow);
      w1.rotation.x = Math.PI / 2;
      w1.position.set(0.7, -0.4, 0.75);
      const w2 = new THREE.Mesh(wheelGeo, matGlow);
      w2.rotation.x = Math.PI / 2;
      w2.position.set(0.7, -0.4, -0.75);
      const w3 = new THREE.Mesh(wheelGeo, matGlow);
      w3.rotation.x = Math.PI / 2;
      w3.position.set(-0.7, -0.4, 0.75);
      const w4 = new THREE.Mesh(wheelGeo, matGlow);
      w4.rotation.x = Math.PI / 2;
      w4.position.set(-0.7, -0.4, -0.75);
      truckGroup.add(w1, w2, w3, w4);

      rootGroup.add(truckGroup);
      meshesParaLimpiar.push(truckGroup);
    } else {
      // FORMA 3D EXACTA AL ICONO DE BLOQUES: Cubo mineral de recursos / voxel grid
      const blockGroup = new THREE.Group();

      for (let x = -0.7; x <= 0.7; x += 1.4) {
        for (let y = -0.7; y <= 0.7; y += 1.4) {
          for (let z = -0.7; z <= 0.7; z += 1.4) {
            const cube = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), matTrans);
            const edge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), matWire);
            cube.position.set(x, y, z);
            edge.position.set(x, y, z);
            blockGroup.add(cube, edge);
          }
        }
      }

      rootGroup.add(blockGroup);
      meshesParaLimpiar.push(blockGroup);
    }

    // Loop de rotación orbital suave
    let animationFrameId: number;
    let clock = new THREE.Clock();

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      rootGroup.rotation.y += delta * 0.65;
      rootGroup.rotation.x = Math.sin(time * 0.7) * 0.15;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      meshesParaLimpiar.forEach((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [moduloId, color, size]);

  return (
    <div
      ref={mountRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    />
  );
}
