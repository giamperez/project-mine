/**
 * Escritor DXF minimo (formato R12 ASCII) para maxima compatibilidad con AutoCAD y visores DXF.
 * Solo implementa las entidades que los modulos necesitan exportar (POINT, LINE, CIRCLE, TEXT,
 * POLYLINE 2D/3D via VERTEX/SEQEND). No pretende cubrir el estandar DXF completo.
 */

export interface CapaDxf {
  nombre: string;
  /** Codigo de color ACI (AutoCAD Color Index), 1-255. 7 = blanco/negro por defecto. */
  colorAci?: number;
}

export interface PuntoDxf {
  x: number;
  y: number;
  z?: number;
}

type Codigo = [number, string | number];

export class EscritorDXF {
  private capas = new Map<string, CapaDxf>();
  private entidades: Codigo[][] = [];

  declararCapa(capa: CapaDxf): void {
    this.capas.set(capa.nombre, capa);
  }

  private asegurarCapa(nombre: string): void {
    if (!this.capas.has(nombre)) this.capas.set(nombre, { nombre, colorAci: 7 });
  }

  punto(capa: string, p: PuntoDxf): void {
    this.asegurarCapa(capa);
    this.entidades.push([
      [0, "POINT"],
      [8, capa],
      [10, p.x],
      [20, p.y],
      [30, p.z ?? 0],
    ]);
  }

  linea(capa: string, a: PuntoDxf, b: PuntoDxf): void {
    this.asegurarCapa(capa);
    this.entidades.push([
      [0, "LINE"],
      [8, capa],
      [10, a.x],
      [20, a.y],
      [30, a.z ?? 0],
      [11, b.x],
      [21, b.y],
      [31, b.z ?? 0],
    ]);
  }

  circulo(capa: string, centro: PuntoDxf, radio: number): void {
    this.asegurarCapa(capa);
    this.entidades.push([
      [0, "CIRCLE"],
      [8, capa],
      [10, centro.x],
      [20, centro.y],
      [30, centro.z ?? 0],
      [40, radio],
    ]);
  }

  /** Cara triangular 3D (entidad 3DFACE, repite el ultimo vertice — convencion DXF para triangulos). */
  cara3D(capa: string, a: PuntoDxf, b: PuntoDxf, c: PuntoDxf): void {
    this.asegurarCapa(capa);
    this.entidades.push([
      [0, "3DFACE"],
      [8, capa],
      [10, a.x],
      [20, a.y],
      [30, a.z ?? 0],
      [11, b.x],
      [21, b.y],
      [31, b.z ?? 0],
      [12, c.x],
      [22, c.y],
      [32, c.z ?? 0],
      [13, c.x],
      [23, c.y],
      [33, c.z ?? 0],
    ]);
  }

  texto(capa: string, posicion: PuntoDxf, contenido: string, altura = 0.5): void {
    this.asegurarCapa(capa);
    this.entidades.push([
      [0, "TEXT"],
      [8, capa],
      [10, posicion.x],
      [20, posicion.y],
      [30, posicion.z ?? 0],
      [40, altura],
      [1, contenido],
    ]);
  }

  /** Polilinea 2D/3D (formato POLYLINE/VERTEX/SEQEND, compatible con DXF R12). */
  polilinea(capa: string, puntos: PuntoDxf[], cerrada = false): void {
    this.asegurarCapa(capa);
    const flags = cerrada ? 1 : 0;
    const bloque: Codigo[] = [
      [0, "POLYLINE"],
      [8, capa],
      [66, 1],
      [70, flags],
    ];
    this.entidades.push(bloque);
    for (const p of puntos) {
      this.entidades.push([
        [0, "VERTEX"],
        [8, capa],
        [10, p.x],
        [20, p.y],
        [30, p.z ?? 0],
      ]);
    }
    this.entidades.push([[0, "SEQEND"]]);
  }

  generar(): string {
    const lineas: string[] = [];
    const emitir = (codigo: number, valor: string | number) => {
      lineas.push(String(codigo));
      lineas.push(typeof valor === "number" ? formatearNumero(valor) : valor);
    };

    lineas.push("0", "SECTION", "2", "TABLES");
    lineas.push("0", "TABLE", "2", "LAYER", "70", String(this.capas.size || 1));
    for (const capa of this.capas.values()) {
      lineas.push("0", "LAYER", "2", capa.nombre, "70", "0", "62", String(capa.colorAci ?? 7), "6", "CONTINUOUS");
    }
    lineas.push("0", "ENDTAB", "0", "ENDSEC");

    lineas.push("0", "SECTION", "2", "ENTITIES");
    for (const entidad of this.entidades) {
      for (const [codigo, valor] of entidad) {
        emitir(codigo, valor);
      }
    }
    lineas.push("0", "ENDSEC", "0", "EOF");

    return lineas.join("\n");
  }
}

function formatearNumero(n: number): string {
  return Number.isFinite(n) ? n.toFixed(6) : "0.000000";
}
