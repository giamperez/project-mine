import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrirModulo } from "./utils.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test.describe("import de formatos de archivo", () => {
  test("Excel (.xlsx) importa collares en Modelo de Bloques", async ({ page }) => {
    await abrirModulo(page, "Modelo de Bloques");
    await page.waitForTimeout(300);

    await page.locator('input[type="file"]').first().setInputFiles(path.join(FIXTURES, "collares.xlsx"));
    await page.waitForTimeout(400);

    await expect(page.locator(".advertencia").first()).toContainText("3 collares importados");
    await expect(page.locator('.dato:has-text("Sondajes") b')).toHaveText("3");
  });

  test("KML y KMZ importan los mismos puntos (proyectados a UTM) en Topografia", async ({ page }) => {
    await abrirModulo(page, "Topografía");
    await page.waitForTimeout(300);

    const inputPuntos = page.locator('input[type="file"]').first();

    await inputPuntos.setInputFiles(path.join(FIXTURES, "campo.kml"));
    await page.waitForTimeout(300);
    const puntosKml = await page.evaluate(() => localStorage.getItem("suite-mineria:topografia.puntosActuales"));

    await inputPuntos.setInputFiles(path.join(FIXTURES, "campo.kmz"));
    await page.waitForTimeout(300);
    const puntosKmz = await page.evaluate(() => localStorage.getItem("suite-mineria:topografia.puntosActuales"));

    expect(puntosKml).toBe(puntosKmz);
    expect(JSON.parse(puntosKml!)).toHaveLength(3);
  });

  test("LAS y LAZ del mismo levantamiento producen los mismos puntos en Topografia", async ({ page }) => {
    await abrirModulo(page, "Topografía");
    await page.waitForTimeout(300);

    const inputPuntos = page.locator('input[type="file"]').first();

    await inputPuntos.setInputFiles(path.join(FIXTURES, "nube-puntos.las"));
    await page.waitForTimeout(400);
    const puntosLas = await page.evaluate(() => localStorage.getItem("suite-mineria:topografia.puntosActuales"));

    await inputPuntos.setInputFiles(path.join(FIXTURES, "nube-puntos.laz"));
    await page.waitForTimeout(1500); // primera carga del WASM de laz-perf por red
    const puntosLaz = await page.evaluate(() => localStorage.getItem("suite-mineria:topografia.puntosActuales"));

    expect(puntosLaz).toBe(puntosLas);
  });
});
