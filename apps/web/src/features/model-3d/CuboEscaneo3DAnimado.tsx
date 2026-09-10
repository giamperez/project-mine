import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  size?: number;
  color?: string;
}

export default function CuboEscaneo3DAnimado({ size = 84, color = "#ec4899" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    const width = size;
    const height = size;

    // Escena y cámara con perspectiva isométrica
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    contenedor.appendChild(renderer.domElement);

    const hexColor = parseInt(color.replace("#", ""), 16);

    // Iluminación
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const pointLight = new THREE.PointLight(hexColor, 3, 15);
    pointLight.position.set(2, 3, 4);
    scene.add(ambient, pointLight);

    // Grupo raíz
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. CUBO INTERNO (GIRATORIO)
    const grupoCubo = new THREE.Group();
    rootGroup.add(grupoCubo);

    // Caras semi-transparentes del cubo
    const geomBox = new THREE.BoxGeometry(1.65, 1.65, 1.65);
    const matCaras = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.35,
    });
    const meshCubo = new THREE.Mesh(geomBox, matCaras);
    grupoCubo.add(meshCubo);

    // Aristas gruesas neon del cubo
    const edges = new THREE.EdgesGeometry(geomBox);
    const matEdges = new THREE.LineBasicMaterial({
      color: 0xff69b4,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });
    const lineEdges = new THREE.LineSegments(edges, matEdges);
    grupoCubo.add(lineEdges);

    // Núcleo brillante en el centro
    const geomCore = new THREE.OctahedronGeometry(0.4, 0);
    const matCore = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const meshCore = new THREE.Mesh(geomCore, matCore);
    grupoCubo.add(meshCore);

    // 2. CORNER BRACKETS / GUÍAS DE ENFOQUE EXTERNAS (Escáner)
    const grupoBrackets = new THREE.Group();
    rootGroup.add(grupoBrackets);

    const matBracket = new THREE.LineBasicMaterial({
      color: hexColor,
      linewidth: 2.5,
      transparent: true,
      opacity: 0.85,
    });

    const bSize = 1.35;
    const bLen = 0.55;
    const rCorner = 0.18;

    // Función para crear las 4 esquinas exteriores tipo scanner
    const crearBracketEsquina = (sx: number, sy: number) => {
      const pts: THREE.Vector3[] = [];
      pts.push(new THREE.Vector3(sx * (bSize - bLen), sy * bSize, 0));
      pts.push(new THREE.Vector3(sx * (bSize - rCorner), sy * bSize, 0));
      pts.push(new THREE.Vector3(sx * bSize, sy * (bSize - rCorner), 0));
      pts.push(new THREE.Vector3(sx * bSize, sy * (bSize - bLen), 0));
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.Line(geom, matBracket);
    };

    grupoBrackets.add(crearBracketEsquina(-1, 1));  // Top-Left
    grupoBrackets.add(crearBracketEsquina(1, 1));   // Top-Right
    grupoBrackets.add(crearBracketEsquina(-1, -1)); // Bottom-Left
    grupoBrackets.add(crearBracketEsquina(1, -1));  // Bottom-Right

    // 3. ANILLO / PLANO LÁSER DE ESCANEO PULSANTE
    const geomScan = new THREE.RingGeometry(0.05, 1.3, 32);
    const matScan = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const meshScan = new THREE.Mesh(geomScan, matScan);
    meshScan.rotation.x = Math.PI / 2;
    rootGroup.add(meshScan);

    // Animación de bucle
    let reqId = 0;
    let t = 0;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      t += 0.024;

      // Rotación suave del cubo en múltiples ejes
      grupoCubo.rotation.y = t * 0.9;
      grupoCubo.rotation.x = 0.45 + Math.sin(t * 0.5) * 0.15;
      grupoCubo.rotation.z = Math.cos(t * 0.4) * 0.1;

      // Levitación suave vertical
      grupoCubo.position.y = Math.sin(t * 1.4) * 0.08;

      // Pulso suave del escáner exterior
      const scaleBracket = 1 + Math.sin(t * 2) * 0.035;
      grupoBrackets.scale.set(scaleBracket, scaleBracket, 1);

      // Movimiento arriba y abajo del haz láser de escaneo
      meshScan.position.y = Math.sin(t * 1.8) * 1.1;
      matScan.opacity = 0.15 + Math.abs(Math.sin(t * 1.8)) * 0.2;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [size, color]);

  return (
    <div
      ref={mountRef}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter: "drop-shadow(0 0 14px rgba(236, 72, 153, 0.65))",
        cursor: "pointer",
      }}
    />
  );
}
