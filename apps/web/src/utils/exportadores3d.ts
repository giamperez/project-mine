/**
 * Utilidades de exportación e importación de formatos 3D para ingeniería y minería:
 * - Wavefront OBJ (.obj)
 * - Stereolithography STL (.stl)
 * - AutoCAD DXF 3D (.dxf)
 * - Coordenadas CSV / XYZ (.csv)
 * - Proyecto Nativo (.namicad3d / .json)
 */

import { PREFIJO_ALMACENAMIENTO } from "../hooks/usePersistedState.js";
import { EscritorDXF } from "@suite/engine";

export interface DatosEscena3D {
  nombre?: string;
  vertices?: { x: number; y: number; z: number }[];
  caras?: [number, number, number][];
  lineas?: { p1: { x: number; y: number; z: number }; p2: { x: number; y: number; z: number }; capa?: string }[];
  puntos?: { id?: string; x: number; y: number; z: number; etiqueta?: string; capa?: string }[];
  solidos?: {
    nombre: string;
    perfil: { x: number; y: number }[];
    profundidad: number;
    centroide?: { x: number; y: number; z: number };
  }[];
}

/**
 * Recolecta los datos de un proyecto desde localStorage para exportar
 */
export function recolectarDatosProyecto(proyectoId: string, moduloId: string): DatosEscena3D {
  const nombre = `Proyecto_${proyectoId}`;
  const vertices: { x: number; y: number; z: number }[] = [];
  const lineas: { p1: { x: number; y: number; z: number }; p2: { x: number; y: number; z: number }; capa?: string }[] = [];
  const puntos: { id?: string; x: number; y: number; z: number; etiqueta?: string; capa?: string }[] = [];
  const caras: [number, number, number][] = [];

  try {
    // 1. Puntos CAD y líneas CAD
    const rawPuntos = localStorage.getItem(PREFIJO_ALMACENAMIENTO + `cad:${proyectoId}:puntos`)
      || (proyectoId.startsWith("malla") ? localStorage.getItem(PREFIJO_ALMACENAMIENTO + "cad:puntos") : null);
    if (rawPuntos) {
      const pts = JSON.parse(rawPuntos);
      if (Array.isArray(pts)) {
        pts.forEach((p: any) => {
          puntos.push({ id: p.id, x: p.x, y: p.y, z: p.z || 0, etiqueta: p.etiqueta, capa: p.capaId });
          vertices.push({ x: p.x, y: p.y, z: p.z || 0 });
        });
      }
    }

    // 2. Líneas CAD
    const rawLineas = localStorage.getItem(PREFIJO_ALMACENAMIENTO + `cad:${proyectoId}:lineas`)
      || (proyectoId.startsWith("malla") ? localStorage.getItem(PREFIJO_ALMACENAMIENTO + "cad:lineas") : null);
    if (rawLineas) {
      const lns = JSON.parse(rawLineas);
      if (Array.isArray(lns)) {
        lns.forEach((l: any) => {
          if (l.p1 && l.p2) {
            lineas.push({ p1: l.p1, p2: l.p2, capa: l.capaId });
            vertices.push(l.p1, l.p2);
          }
        });
      }
    }

    // 3. Polilíneas
    const rawPolilineas = localStorage.getItem(PREFIJO_ALMACENAMIENTO + `cad:${proyectoId}:polilineas`)
      || (proyectoId.startsWith("malla") ? localStorage.getItem(PREFIJO_ALMACENAMIENTO + "cad:polilineas") : null);
    if (rawPolilineas) {
      const pls = JSON.parse(rawPolilineas);
      if (Array.isArray(pls)) {
        pls.forEach((pl: any) => {
          if (Array.isArray(pl.puntos)) {
            for (let i = 0; i < pl.puntos.length - 1; i++) {
              lineas.push({ p1: pl.puntos[i], p2: pl.puntos[i + 1], capa: pl.capaId });
            }
            if (pl.cerrada && pl.puntos.length > 2) {
              lineas.push({ p1: pl.puntos[pl.puntos.length - 1], p2: pl.puntos[0], capa: pl.capaId });
            }
          }
        });
      }
    }

    // 4. Topografía si aplica
    if (moduloId === "topografia") {
      const rawTop = localStorage.getItem(PREFIJO_ALMACENAMIENTO + "topografia.puntosActuales");
      if (rawTop) {
        const topPts = JSON.parse(rawTop);
        if (Array.isArray(topPts)) {
          topPts.forEach((tp: any) => {
            puntos.push({ x: tp.x, y: tp.y, z: tp.z, etiqueta: tp.codigo || "TOP", capa: "TOPOGRAFIA" });
            vertices.push({ x: tp.x, y: tp.y, z: tp.z });
          });
        }
      }
    }

    // 5. Modelo de bloques si aplica
    if (moduloId === "modeloBloques") {
      const rawCols = localStorage.getItem(PREFIJO_ALMACENAMIENTO + "modeloBloques.colares");
      if (rawCols) {
        const cols = JSON.parse(rawCols);
        if (Array.isArray(cols)) {
          cols.forEach((c: any) => {
            puntos.push({ id: c.id, x: c.este, y: c.norte, z: c.cota, etiqueta: c.nombre, capa: "SONDAJES" });
            vertices.push({ x: c.este, y: c.norte, z: c.cota });
          });
        }
      }
    }
  } catch {}

  // Si no hay vértices suficientes para la exportación geométrica, generar una referencia 3D
  if (vertices.length === 0) {
    vertices.push(
      { x: -10, y: -10, z: 0 },
      { x: 10, y: -10, z: 0 },
      { x: 10, y: 10, z: 0 },
      { x: -10, y: 10, z: 0 },
      { x: 0, y: 0, z: 5 }
    );
    caras.push([1, 2, 5], [2, 3, 5], [3, 4, 5], [4, 1, 5], [1, 3, 2], [1, 4, 3]);
  }

  return { nombre, vertices, lineas, puntos, caras };
}

/**
 * 1. Exportador WAVEFRONT OBJ (.obj)
 * Formato universal 3D compatible con Blender, Leapfrog, Vulcan, 3ds Max, AutoCAD
 */
export function generarOBJ(datos: DatosEscena3D): string {
  const lineasSalida: string[] = [
    `# NAMICAD Suite - Exportacion Wavefront OBJ 3D`,
    `# Proyecto: ${datos.nombre || "Modelo3D"}`,
    `# Fecha: ${new Date().toISOString()}`,
    `o ${datos.nombre || "ObjetoMinero3D"}`,
    "",
  ];

  const verts = datos.vertices || [];
  verts.forEach((v) => {
    lineasSalida.push(`v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}`);
  });

  lineasSalida.push("");
  lineasSalida.push(`g Malla_Superficie`);

  if (datos.caras && datos.caras.length > 0) {
    datos.caras.forEach((f) => {
      lineasSalida.push(`f ${f[0]} ${f[1]} ${f[2]}`);
    });
  }

  if (datos.lineas && datos.lineas.length > 0) {
    lineasSalida.push("");
    lineasSalida.push(`g Lineas_Estructurales`);
    // Índices de líneas referencian los vértices
    let vertIdx = verts.length + 1;
    datos.lineas.forEach((l) => {
      lineasSalida.push(`v ${l.p1.x.toFixed(4)} ${l.p1.y.toFixed(4)} ${l.p1.z.toFixed(4)}`);
      lineasSalida.push(`v ${l.p2.x.toFixed(4)} ${l.p2.y.toFixed(4)} ${l.p2.z.toFixed(4)}`);
      lineasSalida.push(`l ${vertIdx} ${vertIdx + 1}`);
      vertIdx += 2;
    });
  }

  return lineasSalida.join("\n");
}

/**
 * 2. Exportador STEREOLITHOGRAPHY STL (.stl)
 * Formato estándar para sólidos triangulados y manufactura/impresión 3D
 */
export function generarSTL(datos: DatosEscena3D): string {
  const nombreSolido = (datos.nombre || "SolidoMinero3D").replace(/[^a-zA-Z0-9_]/g, "_");
  const lineasSalida: string[] = [`solid ${nombreSolido}`];

  const verts = datos.vertices || [];
  const caras = datos.caras || [];

  if (caras.length > 0) {
    caras.forEach((c) => {
      const v1 = verts[c[0] - 1] || { x: 0, y: 0, z: 0 };
      const v2 = verts[c[1] - 1] || { x: 0, y: 0, z: 0 };
      const v3 = verts[c[2] - 1] || { x: 0, y: 0, z: 0 };

      // Normal aproximada
      const ax = v2.x - v1.x, ay = v2.y - v1.y, az = v2.z - v1.z;
      const bx = v3.x - v1.x, by = v3.y - v1.y, bz = v3.z - v1.z;
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;

      lineasSalida.push(`  facet normal ${nx.toFixed(4)} ${ny.toFixed(4)} ${nz.toFixed(4)}`);
      lineasSalida.push(`    outer loop`);
      lineasSalida.push(`      vertex ${v1.x.toFixed(4)} ${v1.y.toFixed(4)} ${v1.z.toFixed(4)}`);
      lineasSalida.push(`      vertex ${v2.x.toFixed(4)} ${v2.y.toFixed(4)} ${v2.z.toFixed(4)}`);
      lineasSalida.push(`      vertex ${v3.x.toFixed(4)} ${v3.y.toFixed(4)} ${v3.z.toFixed(4)}`);
      lineasSalida.push(`    endloop`);
      lineasSalida.push(`  endfacet`);
    });
  } else {
    // Si no hay caras, generar un prisma representativo
    lineasSalida.push(`  facet normal 0.0 0.0 1.0`);
    lineasSalida.push(`    outer loop`);
    lineasSalida.push(`      vertex 0.0 0.0 0.0`);
    lineasSalida.push(`      vertex 10.0 0.0 0.0`);
    lineasSalida.push(`      vertex 5.0 10.0 0.0`);
    lineasSalida.push(`    endloop`);
    lineasSalida.push(`  endfacet`);
  }

  lineasSalida.push(`endsolid ${nombreSolido}`);
  return lineasSalida.join("\n");
}

/**
 * 3. Exportador AUTOCAD DXF 3D (.dxf)
 * Formato CAD por excelencia con soporte para líneas, puntos 3D y capas
 */
export function generarDXF(datos: DatosEscena3D): string {
  const escritor = new EscritorDXF();
  escritor.declararCapa({ nombre: "GEOMETRIA_3D", colorAci: 3 }); // Verde
  escritor.declararCapa({ nombre: "PUNTOS_SONDAJES", colorAci: 4 }); // Cyan
  escritor.declararCapa({ nombre: "LINEAS_ESTRUCTURALES", colorAci: 1 }); // Rojo

  if (datos.puntos) {
    datos.puntos.forEach((p) => {
      escritor.punto("PUNTOS_SONDAJES", { x: p.x, y: p.y, z: p.z });
      if (p.etiqueta) {
        escritor.texto("PUNTOS_SONDAJES", { x: p.x + 0.3, y: p.y + 0.3, z: p.z }, p.etiqueta, 0.5);
      }
    });
  }

  if (datos.lineas) {
    datos.lineas.forEach((l) => {
      escritor.linea(l.capa || "LINEAS_ESTRUCTURALES", l.p1, l.p2);
    });
  }

  if (datos.caras && datos.vertices) {
    datos.caras.forEach((c) => {
      const v1 = datos.vertices?.[c[0] - 1];
      const v2 = datos.vertices?.[c[1] - 1];
      const v3 = datos.vertices?.[c[2] - 1];
      if (v1 && v2 && v3) {
        escritor.cara3D("GEOMETRIA_3D", v1, v2, v3);
      }
    });
  }

  return escritor.generar();
}

/**
 * 4. Exportador COORDENADAS CSV / XYZ (.csv)
 * Formato tabular de puntos 3D para análisis geoestadístico o levantamiento
 */
export function generarCSV3D(datos: DatosEscena3D): string {
  const lineas: string[] = ["ID,ESTE_X,NORTE_Y,COTA_Z,ETIQUETA,CAPA"];
  let count = 1;

  if (datos.puntos && datos.puntos.length > 0) {
    datos.puntos.forEach((p) => {
      lineas.push(`${p.id || `P_${count}`},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)},"${p.etiqueta || ""}",${p.capa || "CAPA_0"}`);
      count++;
    });
  } else if (datos.vertices) {
    datos.vertices.forEach((v) => {
      lineas.push(`V_${count},${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)},"VERTICE",MALLA_3D`);
      count++;
    });
  }

  return lineas.join("\n");
}

/**
 * 5. Exportador NAMICAD3D (.namicad3d)
 */
export function generarNamicad3D(datos: DatosEscena3D, proyectoMeta: any): string {
  return JSON.stringify(
    {
      formato: "namicad3d",
      version: 2,
      fechaExportacion: new Date().toISOString(),
      proyecto: proyectoMeta,
      geometria: datos,
    },
    null,
    2
  );
}

const APK_SECRET_KEY = "NAMICAD_MINE_3D_APK_SECURE_2026_V1";
const APK_MAGIC_HEADER = "NAMICAD_MINE3D_EXCLUSIVE_PACKAGE";

function calcularChecksum(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function ofuscarCadena(texto: string): string {
  const clave = APK_SECRET_KEY;
  let resultado = "";
  for (let i = 0; i < texto.length; i++) {
    const charCode = texto.charCodeAt(i) ^ clave.charCodeAt(i % clave.length);
    resultado += String.fromCharCode(charCode);
  }
  try {
    return btoa(unescape(encodeURIComponent(resultado)));
  } catch {
    return btoa(resultado);
  }
}

function desofuscarCadena(base64: string): string {
  const clave = APK_SECRET_KEY;
  let textoRaw = "";
  try {
    textoRaw = decodeURIComponent(escape(atob(base64)));
  } catch {
    textoRaw = atob(base64);
  }
  let resultado = "";
  for (let i = 0; i < textoRaw.length; i++) {
    const charCode = textoRaw.charCodeAt(i) ^ clave.charCodeAt(i % clave.length);
    resultado += String.fromCharCode(charCode);
  }
  return resultado;
}

/**
 * 6. Exportador EXCLUSIVO APK (.mine3d)
 * Formato binario/ofuscado y firmado con checksum que solo la APK puede abrir
 */
export function generarFormatoExclusivoAPK(datos: DatosEscena3D, proyectoMeta: any, moduloId: string): string {
  const paqueteJSON = JSON.stringify({
    formato: "MINE3D_APK_NATIVE",
    version: "1.0",
    modulo: moduloId,
    fecha: new Date().toISOString(),
    metadatos: proyectoMeta,
    geometria: datos,
  });

  const checksum = calcularChecksum(paqueteJSON);
  const payloadOfuscado = ofuscarCadena(paqueteJSON);

  return [
    `#=== NAMICAD MINING SUITE EXCLUSIVE BINARY PACKAGE ===#`,
    `# MAGIC_ID: ${APK_MAGIC_HEADER}`,
    `# ENCRYPTION: XOR_OBFUSCATED_BASE64_V1`,
    `# MODULE: ${moduloId.toUpperCase()}`,
    `# CHECKSUM: ${checksum}`,
    `# TIMESTAMP: ${new Date().toISOString()}`,
    `# NOTE: ESTE ARCHIVO SOLO PUEDE SER LEIDO POR LA APK DE NAMICAD MINING SUITE.`,
    `#=======================================================#`,
    payloadOfuscado,
    `#=== END OF NAMICAD PACKAGE ===#`,
  ].join("\n");
}

/**
 * Parser / Desencriptador para el formato exclusivo de la APK (.mine3d)
 */
export function parsearFormatoExclusivoAPK(contenido: string): {
  valido: boolean;
  modulo?: string;
  metadatos?: any;
  geometria?: DatosEscena3D;
  error?: string;
} {
  if (!contenido.includes(APK_MAGIC_HEADER)) {
    return { valido: false, error: "Firma mágica no reconocida. No es un archivo exclusivo APK válido." };
  }

  const lineas = contenido
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("#") && l.length > 0);
  if (lineas.length === 0) {
    return { valido: false, error: "Contenido del archivo vacío o corrupto." };
  }

  try {
    const payloadBase64 = lineas.join("");
    const jsonStr = desofuscarCadena(payloadBase64);
    const data = JSON.parse(jsonStr);

    return {
      valido: true,
      modulo: data.modulo,
      metadatos: data.metadatos,
      geometria: data.geometria,
    };
  } catch {
    return { valido: false, error: "Error al desencriptar el paquete: datos corruptos o clave no válida." };
  }
}

/**
 * Parser / Lector universal para importar archivos 3D
 */
export function parsearArchivo3D(
  contenidoTexto: string,
  extension: string
): {
  tipo: string;
  puntosCount: number;
  lineasCount: number;
  verticesCount: number;
  datos?: DatosEscena3D;
  esExclusivoAPK?: boolean;
} {
  const ext = extension.toLowerCase().replace(/^\./, "");

  if (ext === "mine3d" || contenidoTexto.includes(APK_MAGIC_HEADER)) {
    const res = parsearFormatoExclusivoAPK(contenidoTexto);
    if (res.valido && res.geometria) {
      const vCount = res.geometria.vertices?.length || 0;
      const lCount = res.geometria.lineas?.length || 0;
      const pCount = res.geometria.puntos?.length || 0;
      return {
        tipo: "Paquete Exclusivo APK (.mine3d)",
        puntosCount: pCount,
        lineasCount: lCount,
        verticesCount: vCount,
        datos: res.geometria,
        esExclusivoAPK: true,
      };
    }
  }

  if (ext === "obj") {
    const lineas = contenidoTexto.split("\n");
    let vCount = 0;
    let lCount = 0;
    const verts: { x: number; y: number; z: number }[] = [];

    lineas.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("v ")) {
        const parts = trimmed.split(/\s+/).slice(1).map(Number);
        if (parts.length >= 3) {
          verts.push({ x: parts[0], y: parts[1], z: parts[2] });
          vCount++;
        }
      } else if (trimmed.startsWith("l ")) {
        lCount++;
      }
    });

    return { tipo: "Wavefront OBJ", puntosCount: 0, lineasCount: lCount, verticesCount: vCount, datos: { vertices: verts } };
  }

  if (ext === "stl") {
    const vMatches = contenidoTexto.match(/vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/g);
    const vCount = vMatches ? vMatches.length : 0;
    return { tipo: "Stereolithography STL", puntosCount: 0, lineasCount: 0, verticesCount: vCount };
  }

  if (ext === "csv" || ext === "xyz" || ext === "txt") {
    const lineas = contenidoTexto.split("\n").filter((l) => l.trim().length > 0);
    const pCount = Math.max(0, lineas.length - 1);
    return { tipo: "Coordenadas XYZ/CSV", puntosCount: pCount, lineasCount: 0, verticesCount: pCount };
  }

  if (ext === "dxf") {
    const lineMatches = contenidoTexto.match(/LINE/g) || [];
    const pointMatches = contenidoTexto.match(/POINT/g) || [];
    return { tipo: "AutoCAD DXF", puntosCount: pointMatches.length, lineasCount: lineMatches.length, verticesCount: (lineMatches.length * 2) + pointMatches.length };
  }

  return { tipo: "Archivo 3D / JSON", puntosCount: 0, lineasCount: 0, verticesCount: 0 };
}
