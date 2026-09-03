import { describe, expect, it } from "vitest";
import { leerPuntosLAS } from "../src/io/lasReader.js";

const TAMANO_CABECERA_12 = 227;
const LONGITUD_REGISTRO_FORMATO0 = 20;

/** Construye un LAS 1.2 sintetico (formato de punto 0) con puntos {x,y,z,clasificacion} dados, escala fija 0.01, offset 0. */
function construirLAS(puntos: Array<{ x: number; y: number; z: number; clasificacion: number }>): ArrayBuffer {
  const offsetDatos = TAMANO_CABECERA_12;
  const buffer = new ArrayBuffer(offsetDatos + puntos.length * LONGITUD_REGISTRO_FORMATO0);
  const vista = new DataView(buffer);

  "LASF".split("").forEach((c, i) => vista.setUint8(i, c.charCodeAt(0)));
  vista.setUint8(24, 1); // version mayor
  vista.setUint8(25, 2); // version menor
  vista.setUint16(94, TAMANO_CABECERA_12, true);
  vista.setUint32(96, offsetDatos, true);
  vista.setUint8(104, 0); // formato de punto 0, sin comprimir
  vista.setUint16(105, LONGITUD_REGISTRO_FORMATO0, true);
  vista.setUint32(107, puntos.length, true);
  vista.setFloat64(131, 0.01, true); // escala X
  vista.setFloat64(139, 0.01, true); // escala Y
  vista.setFloat64(147, 0.01, true); // escala Z
  vista.setFloat64(155, 0, true); // offset X
  vista.setFloat64(163, 0, true); // offset Y
  vista.setFloat64(171, 0, true); // offset Z

  puntos.forEach((p, i) => {
    const base = offsetDatos + i * LONGITUD_REGISTRO_FORMATO0;
    vista.setInt32(base, Math.round(p.x / 0.01), true);
    vista.setInt32(base + 4, Math.round(p.y / 0.01), true);
    vista.setInt32(base + 8, Math.round(p.z / 0.01), true);
    vista.setUint8(base + 15, p.clasificacion);
  });

  return buffer;
}

describe("leerPuntosLAS", () => {
  it("lee X/Y/Z reales aplicando escala+offset del header (formato de punto 0)", () => {
    const buffer = construirLAS([
      { x: 100.5, y: 200.25, z: 50.1, clasificacion: 2 },
      { x: 101.0, y: 201.0, z: 50.5, clasificacion: 2 },
    ]);
    const r = leerPuntosLAS(buffer, { maximoPuntos: 100 });
    expect(r.numeroPuntosOriginal).toBe(2);
    expect(r.puntos).toHaveLength(2);
    expect(r.puntos[0].x).toBeCloseTo(100.5, 6);
    expect(r.puntos[0].y).toBeCloseTo(200.25, 6);
    expect(r.puntos[0].z).toBeCloseTo(50.1, 6);
  });

  it("con clasificacion=2 (terreno) presente, filtra por defecto y descarta el resto", () => {
    const buffer = construirLAS([
      { x: 0, y: 0, z: 10, clasificacion: 2 }, // terreno
      { x: 1, y: 0, z: 15, clasificacion: 5 }, // vegetacion alta
      { x: 2, y: 0, z: 10.5, clasificacion: 2 }, // terreno
    ]);
    const r = leerPuntosLAS(buffer, { maximoPuntos: 100 });
    expect(r.seFiltroPorTerreno).toBe(true);
    expect(r.numeroPuntosCandidatos).toBe(2);
    expect(r.puntos).toHaveLength(2);
    expect(r.puntos.every((p) => p.z === 10 || p.z === 10.5)).toBe(true);
  });

  it("sin ningun punto clasificado como terreno, usa todos (no filtra) — comun en nubes de fotogrametria sin clasificar", () => {
    const buffer = construirLAS([
      { x: 0, y: 0, z: 10, clasificacion: 0 },
      { x: 1, y: 0, z: 15, clasificacion: 1 },
      { x: 2, y: 0, z: 12, clasificacion: 0 },
    ]);
    const r = leerPuntosLAS(buffer, { maximoPuntos: 100 });
    expect(r.seFiltroPorTerreno).toBe(false);
    expect(r.puntos).toHaveLength(3);
  });

  it("soloTerreno=false desactiva el filtro aunque haya puntos clasificados como terreno", () => {
    const buffer = construirLAS([
      { x: 0, y: 0, z: 10, clasificacion: 2 },
      { x: 1, y: 0, z: 15, clasificacion: 5 },
    ]);
    const r = leerPuntosLAS(buffer, { soloTerreno: false, maximoPuntos: 100 });
    expect(r.seFiltroPorTerreno).toBe(false);
    expect(r.puntos).toHaveLength(2);
  });

  it("decima uniformemente cuando el numero de puntos candidatos supera maximoPuntos", () => {
    const puntos = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: 0, z: 0, clasificacion: 0 }));
    const buffer = construirLAS(puntos);
    const r = leerPuntosLAS(buffer, { maximoPuntos: 100 });
    expect(r.numeroPuntosOriginal).toBe(1000);
    expect(r.puntos.length).toBeLessThanOrEqual(100);
    expect(r.puntos.length).toBeGreaterThan(0);
  });

  it("rechaza un archivo sin la firma LASF", () => {
    const buffer = new ArrayBuffer(300);
    expect(() => leerPuntosLAS(buffer)).toThrow(/LASF/);
  });

  it("rechaza un formato de punto marcado como comprimido (bit 7, tipico de un .laz mal renombrado a .las)", () => {
    const buffer = construirLAS([{ x: 0, y: 0, z: 0, clasificacion: 0 }]);
    const vista = new DataView(buffer);
    vista.setUint8(104, 0x80); // formato 0 con bit de compresion activo
    expect(() => leerPuntosLAS(buffer)).toThrow(/comprimido/);
  });
});
