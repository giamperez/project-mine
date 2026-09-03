import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { leerPuntosLAZ } from "../src/io/lazReader.js";
import { leerPuntosLAS } from "../src/io/lasReader.js";

const DIR_FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Convierte un Buffer de Node a un ArrayBuffer "limpio" (Buffer.buffer puede compartir memoria con otros buffers del pool de Node). */
function aArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function cargarFixture(nombre: string): ArrayBuffer {
  return aArrayBuffer(readFileSync(path.join(DIR_FIXTURES, nombre)));
}

/**
 * Fixtures reales: tiles pequeños del point cloud "lion_takanawa" que Potree distribuye en su
 * propio repo (potree/potree, pointclouds/lion_takanawa_las y lion_takanawa_laz) como el MISMO
 * tile exportado en ambos formatos — permite verificar la descompresion LAZ comparandola contra
 * el LAS sin comprimir equivalente, ya verificado por lasReader.test.ts con datos sinteticos.
 */
const TILES = ["r007", "r010", "r011"];

describe("leerPuntosLAZ", () => {
  it.each(TILES)("descomprime %s.laz y reproduce los mismos puntos que %s.las sin comprimir (sin decimar/filtrar)", async (tile) => {
    const resultadoLas = leerPuntosLAS(cargarFixture(`${tile}.las`), { soloTerreno: false, maximoPuntos: 1e9 });
    const resultadoLaz = await leerPuntosLAZ(cargarFixture(`${tile}.laz`), { soloTerreno: false, maximoPuntos: 1e9 });

    expect(resultadoLaz.numeroPuntosOriginal).toBe(resultadoLas.numeroPuntosOriginal);
    expect(resultadoLaz.puntos).toHaveLength(resultadoLas.puntos.length);

    for (let i = 0; i < resultadoLas.puntos.length; i++) {
      // tolerancia de 1mm: la escala tipica de estos LAS es 0.001-0.01, asi que esto es "exacto"
      // salvo el ultimo bit de redondeo de punto flotante entre ambos caminos de lectura.
      expect(resultadoLaz.puntos[i].x).toBeCloseTo(resultadoLas.puntos[i].x, 2);
      expect(resultadoLaz.puntos[i].y).toBeCloseTo(resultadoLas.puntos[i].y, 2);
      expect(resultadoLaz.puntos[i].z).toBeCloseTo(resultadoLas.puntos[i].z, 2);
    }
  });

  it("rechaza un archivo cuya cabecera no marca compresion (deberia leerse con leerPuntosLAS)", async () => {
    await expect(leerPuntosLAZ(cargarFixture("r007.las"))).rejects.toThrow(/comprimido/);
  });

  it("decima cuando el numero de puntos supera maximoPuntos", async () => {
    const resultado = await leerPuntosLAZ(cargarFixture("r010.laz"), { soloTerreno: false, maximoPuntos: 5 });
    expect(resultado.puntos.length).toBeLessThanOrEqual(5);
    expect(resultado.puntos.length).toBeGreaterThan(0);
  });
});
