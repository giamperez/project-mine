/**
 * Lector de wireframes en el formato ASCII de intercambio de Datamine: un archivo de puntos
 * (pointid,x,y,z) y un archivo de triangulos (triangleid,p1,p2,p3) que referencia esos ids.
 * No cubre el formato binario nativo de Datamine (.dm), solo el CSV de exportacion/importacion.
 */

export interface Wireframe3D {
  id: string;
  nombre: string;
  vertices: { x: number; y: number; z: number }[];
  triangulos: [number, number, number][];
}

function esFilaNumerica(campos: string[]): boolean {
  return campos.every((c) => c.trim() !== "" && !Number.isNaN(Number(c)));
}

function partirLineas(texto: string): string[][] {
  return texto
    .split(/\r\n|\r|\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .map((linea) => linea.split(","));
}

/**
 * Parsea el par de archivos puntos/triangulos y arma la malla resultante.
 * Descarta (sin lanzar) triangulos que referencien ids de punto inexistentes, para tolerar
 * archivos parciales o exportaciones incompletas.
 */
export function leerWireframeDatamine(
  textoPuntos: string,
  textoTriangulos: string,
  nombre = "Wireframe"
): Wireframe3D | null {
  const filasPuntos = partirLineas(textoPuntos);
  const filasTriangulos = partirLineas(textoTriangulos);
  if (filasPuntos.length === 0 || filasTriangulos.length === 0) return null;

  const inicioPuntos = esFilaNumerica(filasPuntos[0]) ? 0 : 1;
  const inicioTriangulos = esFilaNumerica(filasTriangulos[0]) ? 0 : 1;

  const idAIndice = new Map<string, number>();
  const vertices: { x: number; y: number; z: number }[] = [];
  for (const fila of filasPuntos.slice(inicioPuntos)) {
    if (fila.length < 4) continue;
    const [pointId, x, y, z] = fila;
    idAIndice.set(pointId.trim(), vertices.length);
    vertices.push({ x: Number(x), y: Number(y), z: Number(z) });
  }
  if (vertices.length === 0) return null;

  const triangulos: [number, number, number][] = [];
  for (const fila of filasTriangulos.slice(inicioTriangulos)) {
    if (fila.length < 4) continue;
    const [, p1, p2, p3] = fila;
    const i1 = idAIndice.get(p1.trim());
    const i2 = idAIndice.get(p2.trim());
    const i3 = idAIndice.get(p3.trim());
    if (i1 === undefined || i2 === undefined || i3 === undefined) continue;
    triangulos.push([i1, i2, i3]);
  }
  if (triangulos.length === 0) return null;

  return { id: `wireframe-${Date.now()}`, nombre, vertices, triangulos };
}
