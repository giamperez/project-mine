import { test, expect } from "@playwright/test";

const MODULOS = ["Diseño de Malla", "Topografía", "Geomecánica", "Estereografía", "Acarreo", "Modelo de Bloques"];
const RESOLUCIONES = [
  { width: 360, height: 800, nombre: "mobile" },
  { width: 768, height: 1024, nombre: "tablet" },
  { width: 1280, height: 900, nombre: "desktop" },
];

test.describe("navegacion basica", () => {
  for (const resolucion of RESOLUCIONES) {
    test(`la app carga y mantiene el layout estable en ${resolucion.nombre} (${resolucion.width}x${resolucion.height})`, async ({ browser }) => {
      const page = await browser.newPage({ viewport: { width: resolucion.width, height: resolucion.height } });
      const errores: string[] = [];
      page.on("pageerror", (e) => errores.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(`[console] ${m.text()}`);
      });

      await page.goto("/");
      await expect(page.locator(".mine-app-title")).toHaveText("Suite Minera");
      await expect(page.locator(".mine-dashboard")).toBeVisible();
      await expect(page.locator(".mine-cards-list .mine-module-card")).toHaveCount(7);

      const card = page.locator(".mine-module-card").first();
      await expect(card).toBeVisible();
      const bounding = await card.boundingBox();
      expect(bounding, `el módulo no debe desbordar el ancho en ${resolucion.nombre}`).not.toBeNull();
      expect(bounding!.width).toBeGreaterThan(180);

      await page.locator('.mine-module-card:has-text("Diseño de Malla")').click();
      await expect(page.locator("h1")).toContainText("Diseño de Malla");
      await page.locator('.btn-portal-back').click();

      expect(errores, `errores de consola/pagina en ${resolucion.nombre}: ${errores.join(" | ")}`).toEqual([]);
      await page.close();
    });
  }

  test("la app carga y los 6 modulos son alcanzables sin errores de consola", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`[console] ${m.text()}`);
    });

    await page.goto("/");
    await expect(page.locator(".mine-app-title")).toHaveText("Suite Minera");

    for (const modulo of MODULOS) {
      await page.locator(`.mine-module-card:has-text("${modulo}")`).click();
      await expect(page.locator("h1")).toContainText(modulo);
      await page.locator('.btn-portal-back').click();
    }

    expect(errores, `errores de consola/pagina durante la navegacion: ${errores.join(" | ")}`).toEqual([]);
  });
});
