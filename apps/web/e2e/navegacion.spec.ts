import { test, expect } from "@playwright/test";

const MODULOS = ["Diseño de Malla", "Topografía", "Geomecánica", "Estereografía", "Acarreo", "Modelo de Bloques"];

test.describe("navegacion basica", () => {
  test("la app carga y los 6 modulos son alcanzables sin errores de consola", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`[console] ${m.text()}`);
    });

    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Suite Minera");

    for (const modulo of MODULOS) {
      await page.locator(`.mine-module-card:has-text("${modulo}")`).click();
      await expect(page.locator("h1")).toContainText(modulo);
      await page.locator('.btn-portal-back').click();
    }

    expect(errores, `errores de consola/pagina durante la navegacion: ${errores.join(" | ")}`).toEqual([]);
  });
});
