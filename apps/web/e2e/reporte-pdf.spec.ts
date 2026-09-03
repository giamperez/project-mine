import { test, expect } from "@playwright/test";
import { abrirMallaTaller3D } from "./utils.js";

test.describe("reporte PDF (Diseño de Malla)", () => {
  test("exportar reporte PDF genera un archivo real, sin errores de consola", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`[console] ${m.text()}`);
    });

    await abrirMallaTaller3D(page);
    const descargaPromise = page.waitForEvent("download");
    await page.locator('button:has-text("📄 Exportar reporte PDF")').click();
    const descarga = await descargaPromise;

    expect(descarga.suggestedFilename()).toBe("reporte-malla-perforacion.pdf");
    const ruta = await descarga.path();
    expect(ruta).toBeTruthy();

    const fs = await import("node:fs");
    const stats = fs.statSync(ruta!);
    expect(stats.size).toBeGreaterThan(10000); // un PDF de verdad, no un archivo vacio/corrupto

    expect(errores).toEqual([]);
  });
});
