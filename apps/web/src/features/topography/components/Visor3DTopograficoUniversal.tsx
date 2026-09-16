import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TipoMotorTopo } from "../motoresTopograficos.js";

interface Visor3DTopograficoProps {
  motorId: TipoMotorTopo;
  datos: any;
  resultados: any;
}

/**
 * Crea una etiqueta de texto flotante en 3D basada en Sprite con Canvas 2D en estilo monocromo CAD.
 */
function crearEtiqueta3DSprite(
  texto: string,
  colorTexto = "#06b6d4",
  colorFondo = "rgba(13, 17, 24, 0.92)",
  colorBorde = "rgba(6, 182, 212, 0.4)"
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = colorFondo;
    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(4, 4, 312, 92, 12);
    } else {
      ctx.rect(4, 4, 312, 92);
    }
    ctx.fill();
    ctx.strokeStyle = colorBorde;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = colorTexto;
    ctx.font = "bold 34px 'SF Pro Display', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, 160, 52);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  return sprite;
}

export function Visor3DTopograficoUniversal({ motorId, datos, resultados }: Visor3DTopograficoProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor || !resultados) return;

    const width = contenedor.clientWidth || 640;
    const height = 400;

    // Escena en fondo monocromo carbon
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1017);
    scene.fog = new THREE.FogExp2(0x0c1017, 0.0025);

    // Cámara
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(60, 50, 70);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    contenedor.innerHTML = "";
    contenedor.appendChild(renderer.domElement);

    // Controles Orbitales
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    // Iluminación técnica neutral
    const ambLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight1.position.set(100, 200, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.7);
    dirLight2.position.set(-100, -50, -100);
    scene.add(dirLight2);

    let maxDim = 50;

    if (motorId === "CV" && resultados.tabla && resultados.tabla.length > 1) {
      // 1. CURVA VERTICAL (CV): Calzada extruida en 3D en gris asfalto con eje blanco
      const tabla = resultados.tabla;
      const minX = tabla[0].progresivaNum;
      const maxX = tabla[tabla.length - 1].progresivaNum;
      const midX = (minX + maxX) / 2;
      const cotas = tabla.map((t: any) => t.cotaCurva);
      const minCota = Math.min(...cotas);
      const maxCota = Math.max(...cotas);
      const midZ = (minCota + maxCota) / 2;
      const anchoCalzada = 6.0;

      maxDim = Math.max(maxX - minX, 30);

      const roadGeom = new THREE.BufferGeometry();
      const vertices: number[] = [];
      const indices: number[] = [];

      tabla.forEach((t: any, idx: number) => {
        const x = t.progresivaNum - midX;
        const z = t.cotaCurva - midZ;
        vertices.push(x, z, -anchoCalzada / 2);
        vertices.push(x, z, anchoCalzada / 2);

        if (idx < tabla.length - 1) {
          const base = idx * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }
      });

      roadGeom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      roadGeom.setIndex(indices);
      roadGeom.computeVertexNormals();

      const roadMat = new THREE.MeshStandardMaterial({
        color: 0x1a222d,
        roughness: 0.6,
        metalness: 0.2,
        side: THREE.DoubleSide,
        wireframe,
      });
      const roadMesh = new THREE.Mesh(roadGeom, roadMat);
      scene.add(roadMesh);

      // Línea de eje en blanco nítido
      const ejePts = tabla.map((t: any) => new THREE.Vector3(t.progresivaNum - midX, t.cotaCurva - midZ + 0.05, 0));
      const ejeGeom = new THREE.BufferGeometry().setFromPoints(ejePts);
      const ejeLine = new THREE.Line(ejeGeom, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.5 }));
      scene.add(ejeLine);

      // Tangentes PVI en línea plateada discontinua
      const pvcProg = resultados.pvcProgNum - midX;
      const pvcY = resultados.pvcCota - midZ;
      const pvtProg = resultados.pvtProgNum - midX;
      const pvtY = resultados.pvtCota - midZ;
      const pviProg = (pvcProg + pvtProg) / 2;
      const pviY = (datos.cotaPVI || midZ) - midZ;

      const tangGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pvcProg, pvcY, 0),
        new THREE.Vector3(pviProg, pviY, 0),
        new THREE.Vector3(pvtProg, pvtY, 0),
      ]);
      const tangLine = new THREE.Line(tangGeom, new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 2, gapSize: 1 }));
      tangLine.computeLineDistances();
      scene.add(tangLine);

      // Etiquetas 3D técnicas
      const spPvc = crearEtiqueta3DSprite("PVC", "#ffffff");
      spPvc.position.set(pvcProg, pvcY + 4, 0);
      spPvc.scale.set(6, 2, 1);
      scene.add(spPvc);

      const spPvi = crearEtiqueta3DSprite("PVI", "#e2e8f0");
      spPvi.position.set(pviProg, pviY + 5, 0);
      spPvi.scale.set(6, 2, 1);
      scene.add(spPvi);

      const spPvt = crearEtiqueta3DSprite("PVT", "#ffffff");
      spPvt.position.set(pvtProg, pvtY + 4, 0);
      spPvt.scale.set(6, 2, 1);
      scene.add(spPvt);

      camera.position.set(0, maxDim * 0.5, maxDim * 0.8);
      controls.target.set(0, 0, 0);
    } else if (motorId === "CH" && resultados.tabla && resultados.tabla.length > 1) {
      // 2. CURVA HORIZONTAL (CH): Corredor en planta 3D
      const tabla = resultados.tabla;
      const { estePC, nortePC, estePI, nortePI, estePT, nortePT, esteCentro, norteCentro } = resultados;
      const cx = (estePC + estePT) / 2;
      const cy = (nortePC + nortePT) / 2;

      maxDim = Math.max(Math.hypot(estePT - estePC, nortePT - nortePC), 40);

      // Eje en blanco
      const arcPts = tabla.map((t: any) => new THREE.Vector3(t.este - cx, 0.05, -(t.norte - cy)));
      const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPts);
      const arcLine = new THREE.Line(arcGeom, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.5 }));
      scene.add(arcLine);

      // Calzada curvada
      const ancho = 7.0;
      const roadGeom = new THREE.BufferGeometry();
      const verts: number[] = [];
      const inds: number[] = [];

      tabla.forEach((t: any, i: number) => {
        const x = t.este - cx;
        const z = -(t.norte - cy);
        const dx = t.este - esteCentro;
        const dy = t.norte - norteCentro;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = (dx / dist) * (ancho / 2);
        const nz = -(dy / dist) * (ancho / 2);

        verts.push(x + nx, 0, z + nz);
        verts.push(x - nx, 0, z - nz);

        if (i < tabla.length - 1) {
          const b = i * 2;
          inds.push(b, b + 1, b + 2);
          inds.push(b + 1, b + 3, b + 2);
        }
      });

      roadGeom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      roadGeom.setIndex(inds);
      roadGeom.computeVertexNormals();

      const roadMesh = new THREE.Mesh(
        roadGeom,
        new THREE.MeshStandardMaterial({ color: 0x1a222d, side: THREE.DoubleSide, wireframe })
      );
      scene.add(roadMesh);

      // Tangentes PC -> PI -> PT en gris plateado
      const tanPts = [
        new THREE.Vector3(estePC - cx, 0.1, -(nortePC - cy)),
        new THREE.Vector3(estePI - cx, 0.1, -(nortePI - cy)),
        new THREE.Vector3(estePT - cx, 0.1, -(nortePT - cy)),
      ];
      const tanLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(tanPts),
        new THREE.LineBasicMaterial({ color: 0x64748b })
      );
      scene.add(tanLine);

      // Etiquetas PC, PI, PT
      const spPC = crearEtiqueta3DSprite("PC", "#ffffff");
      spPC.position.set(estePC - cx, 4, -(nortePC - cy));
      spPC.scale.set(6, 2, 1);
      scene.add(spPC);

      const spPI = crearEtiqueta3DSprite("PI", "#e2e8f0");
      spPI.position.set(estePI - cx, 5, -(nortePI - cy));
      spPI.scale.set(6, 2, 1);
      scene.add(spPI);

      const spPT = crearEtiqueta3DSprite("PT", "#ffffff");
      spPT.position.set(estePT - cx, 4, -(nortePT - cy));
      spPT.scale.set(6, 2, 1);
      scene.add(spPT);

      camera.position.set(0, maxDim * 1.1, maxDim * 0.9);
      controls.target.set(0, 0, 0);
    } else if ((motorId === "AREA" || motorId === "POL") && resultados.tabla && resultados.tabla.length > 2) {
      // 3. ÁREA / POLIGONAL: Prisma 3D extruido en titanio ahumado con estacas de esquina
      const pts = motorId === "AREA" ? resultados.puntos : resultados.tabla;
      const cx = pts.reduce((a: number, p: any) => a + Number(p.este), 0) / pts.length;
      const cy = pts.reduce((a: number, p: any) => a + Number(p.norte), 0) / pts.length;

      const pts2D = pts.map((p: any) => new THREE.Vector2(Number(p.este) - cx, -(Number(p.norte) - cy)));
      const shape = new THREE.Shape(pts2D);

      const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
        depth: 4.0,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.3,
        bevelThickness: 0.3,
      });

      const polyMat = new THREE.MeshStandardMaterial({
        color: 0x243042,
        roughness: 0.4,
        metalness: 0.3,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        wireframe,
      });
      const polyMesh = new THREE.Mesh(extrudeGeom, polyMat);
      polyMesh.rotation.x = -Math.PI / 2;
      scene.add(polyMesh);

      // Estacas perimétricas en cada vértice
      pts.forEach((p: any, idx: number) => {
        const px = Number(p.este) - cx;
        const pz = -(Number(p.norte) - cy);

        const poste = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 7, 12),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 })
        );
        poste.position.set(px, 3.5, pz);
        scene.add(poste);

        const esfera = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        esfera.position.set(px, 7.5, pz);
        scene.add(esfera);

        const label = crearEtiqueta3DSprite(p.id || p.punto || p.estacion || `P${idx + 1}`, "#ffffff");
        label.position.set(px, 9.5, pz);
        label.scale.set(6, 2, 1);
        scene.add(label);
      });

      // Centroide si existe
      if (resultados.centroideEste) {
        const centX = resultados.centroideEste - cx;
        const centZ = -(resultados.centroideNorte - cy);

        const centCol = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 10, 16),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
        );
        centCol.position.set(centX, 5, centZ);
        scene.add(centCol);

        const centSp = crearEtiqueta3DSprite(
          `CENTROIDE (${resultados.areaM2 ? resultados.areaM2.toFixed(1) + " m²" : ""})`,
          "#ffffff"
        );
        centSp.position.set(centX, 12, centZ);
        centSp.scale.set(10, 3, 1);
        scene.add(centSp);
      }

      maxDim = Math.max(...pts.map((p: any) => Math.hypot(Number(p.este) - cx, Number(p.norte) - cy)), 30);
      camera.position.set(maxDim * 1.2, maxDim * 1.3, maxDim * 1.4);
      controls.target.set(0, 2, 0);
    } else if (motorId === "BUZ" && resultados.tabla && resultados.tabla.length > 0) {
      // 4. REPLANTEO DE BUZONES (BUZ): Concreto arquitectónico, cotas de fondo y tuberías en gris acero
      const perfil = resultados.perfil || [];
      const pIni = perfil[0]?.progresivaNum || 0;
      const pFin = perfil[perfil.length - 1]?.progresivaNum || 65;
      const midProg = (pIni + pFin) / 2;

      const cotaRef = perfil[0]?.cotaFondo || 98.5;
      maxDim = Math.max(pFin - pIni, 40);

      // Terreno de referencia
      const terrainGeom = new THREE.PlaneGeometry(maxDim * 1.4, 30, 20, 4);
      const terrainMat = new THREE.MeshStandardMaterial({
        color: 0x161d27,
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      });
      const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
      terrainMesh.rotation.x = -Math.PI / 2;
      terrainMesh.position.set(0, (perfil[0]?.cotaTerreno || 100) - cotaRef, 0);
      scene.add(terrainMesh);

      // Buzones cilíndricos de concreto en gris mineral
      perfil.forEach((pt: any, idx: number) => {
        const x = pt.progresivaNum - midProg;
        const yFondo = pt.cotaFondo - cotaRef;
        const yTerreno = pt.cotaTerreno - cotaRef;
        const alturaBuzon = Math.max(0.5, yTerreno - yFondo);
        const radioBuzon = 1.2;

        const buzonGeom = new THREE.CylinderGeometry(radioBuzon, radioBuzon, alturaBuzon, 24);
        const buzonMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.5,
          metalness: 0.1,
          transparent: true,
          opacity: 0.8,
          wireframe,
        });
        const buzonMesh = new THREE.Mesh(buzonGeom, buzonMat);
        buzonMesh.position.set(x, yFondo + alturaBuzon / 2, 0);
        scene.add(buzonMesh);

        // Brocal de tapa
        const tapaGeom = new THREE.CylinderGeometry(radioBuzon + 0.08, radioBuzon + 0.08, 0.25, 24);
        const tapaMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const tapaMesh = new THREE.Mesh(tapaGeom, tapaMat);
        tapaMesh.position.set(x, yTerreno + 0.12, 0);
        scene.add(tapaMesh);

        const label = crearEtiqueta3DSprite(
          `${pt.nombre || `BZ-${idx}`}: F=${pt.cotaFondo.toFixed(2)}m (H=${alturaBuzon.toFixed(2)}m)`,
          "#ffffff"
        );
        label.position.set(x, yTerreno + 2.8, 0);
        label.scale.set(8, 2.5, 1);
        scene.add(label);
      });

      // Tuberías de enlace en acero gris
      for (let i = 0; i < perfil.length - 1; i++) {
        const p1 = perfil[i];
        const p2 = perfil[i + 1];

        const x1 = p1.progresivaNum - midProg;
        const y1 = p1.cotaFondo - cotaRef;
        const x2 = p2.progresivaNum - midProg;
        const y2 = p2.cotaFondo - cotaRef;

        const v1 = new THREE.Vector3(x1, y1, 0);
        const v2 = new THREE.Vector3(x2, y2, 0);
        const dist = v1.distanceTo(v2);

        const tubeGeom = new THREE.CylinderGeometry(0.35, 0.35, dist, 16);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.3,
          metalness: 0.4,
          wireframe,
        });
        const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
        tubeMesh.position.copy(v1).lerp(v2, 0.5);
        tubeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(v2, v1).normalize());
        scene.add(tubeMesh);
      }

      camera.position.set(0, maxDim * 0.6, maxDim * 0.9);
      controls.target.set(0, 0, 0);
    } else if (motorId === "PEN" && resultados.tabla && resultados.tabla.length > 1) {
      // 5. PENDIENTE Y EMPLANTILLADO (PEN)
      const tabla = resultados.tabla;
      const minX = tabla[0].distancia;
      const maxX = tabla[tabla.length - 1].distancia;
      const midX = (minX + maxX) / 2;
      const cotaBase = resultados.cotaInicial || 100;
      maxDim = Math.max(maxX - minX, 40);

      const ptsRasante = tabla.map((t: any) => new THREE.Vector3(t.distancia - midX, t.cotaRasante - cotaBase, 0));
      const lineGeom = new THREE.BufferGeometry().setFromPoints(ptsRasante);
      const lineMesh = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.5 }));
      scene.add(lineMesh);

      // Crucetas de emplantillado en blanco y gris
      tabla.forEach((t: any) => {
        const x = t.distancia - midX;
        const y = t.cotaRasante - cotaBase;

        const poste = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 3, 8),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
        );
        poste.position.set(x, y + 1.5, 0);
        scene.add(poste);

        const cruceta = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 0.22, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
        );
        cruceta.position.set(x, y + 2.8, 0);
        scene.add(cruceta);

        const lbl = crearEtiqueta3DSprite(`${t.progresivaStr} (${t.cotaRasante.toFixed(2)}m)`, "#ffffff");
        lbl.position.set(x, y + 4.2, 0);
        lbl.scale.set(6, 2, 1);
        scene.add(lbl);
      });

      camera.position.set(0, maxDim * 0.5, maxDim * 0.8);
      controls.target.set(0, 0, 0);
    } else if (motorId === "NIV" && resultados.tabla && resultados.tabla.length > 0) {
      // 6. NIVELACIÓN COMPUESTA (NIV)
      const tabla = resultados.tabla;
      const cotaIni = resultados.cotaInicial || 100;
      const distMax = resultados.distanciaTotalM || 100;
      const midD = distMax / 2;
      maxDim = Math.max(distMax, 40);

      const ptsComp = tabla.map((t: any) => new THREE.Vector3(t.progresivaNum - midD, t.cotaCorr - cotaIni, 0));
      const lineMesh = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ptsComp),
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.5 })
      );
      scene.add(lineMesh);

      tabla.forEach((t: any) => {
        const x = t.progresivaNum - midD;
        const y = t.cotaCorr - cotaIni;

        const mira = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 4, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
        );
        mira.position.set(x, y + 2, 0);
        scene.add(mira);

        const lbl = crearEtiqueta3DSprite(`${t.punto}: ${t.cotaCorr.toFixed(3)}m`, "#ffffff");
        lbl.position.set(x, y + 5, 0);
        lbl.scale.set(6, 2, 1);
        scene.add(lbl);
      });

      camera.position.set(0, maxDim * 0.5, maxDim * 0.8);
      controls.target.set(0, 0, 0);
    } else if (motorId === "COO" && resultados.puntosVisor) {
      // 7. COORDENADAS (COO)
      const { p1, p2Directo } = resultados.puntosVisor;
      const midE = (p1.este + p2Directo.este) / 2;
      const midN = (p1.norte + p2Directo.norte) / 2;
      maxDim = Math.max(resultados.distanciaInversa || 100, 30);

      const x1 = p1.este - midE;
      const z1 = -(p1.norte - midN);
      const x2 = p2Directo.este - midE;
      const z2 = -(p2Directo.norte - midN);

      const v1 = new THREE.Vector3(x1, 1, z1);
      const v2 = new THREE.Vector3(x2, 1, z2);
      const dist = v1.distanceTo(v2);

      const arrowGeom = new THREE.CylinderGeometry(0.35, 0.35, dist, 16);
      const arrowMesh = new THREE.Mesh(arrowGeom, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3 }));
      arrowMesh.position.copy(v1).lerp(v2, 0.5);
      arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(v2, v1).normalize());
      scene.add(arrowMesh);

      [
        { x: x1, z: z1, name: "P1 (Base)", col: 0x64748b },
        { x: x2, z: z2, name: "P2 (Radiado)", col: 0x94a3b8 },
      ].forEach((p) => {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 16), new THREE.MeshStandardMaterial({ color: p.col }));
        ped.position.set(p.x, 1, p.z);
        scene.add(ped);

        const lbl = crearEtiqueta3DSprite(p.name, "#ffffff");
        lbl.position.set(p.x, 4.5, p.z);
        lbl.scale.set(7, 2.5, 1);
        scene.add(lbl);
      });

      camera.position.set(maxDim * 0.8, maxDim * 0.9, maxDim * 0.8);
      controls.target.set(0, 0, 0);
    }

    // Grilla 3D de suelo técnica
    const gridHelper = new THREE.GridHelper(maxDim * 2.5, 25, 0x475569, 0x1e2634);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!contenedor) return;
      const w = contenedor.clientWidth || width;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      });
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [motorId, datos, resultados, wireframe]);

  return (
    <div className="topo-3d-universal-wrapper">
      <div className="topo-3d-controls-overlay">
        <button
          type="button"
          className={`topo-3d-btn-pill ${wireframe ? "active" : ""}`}
          onClick={() => setWireframe(!wireframe)}
          title="Alternar estructura alámbrica o sólida"
        >
          {wireframe ? "SÓLIDO" : "ESTRUCTURA ALÁMBRICA"}
        </button>
      </div>

      <div ref={mountRef} className="topo-3d-viewport-canvas" />

      <div className="topo-3d-hint-bar">
        <span>Orbitar [Arrastrar] · Zoom [Rueda / Pellizco] · Encuadre [Clic Derecho]</span>
      </div>
    </div>
  );
}
