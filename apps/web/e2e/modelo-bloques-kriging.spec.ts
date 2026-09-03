import { test, expect } from "@playwright/test";
import { abrirModulo } from "./utils.js";

test.describe("Modelo de Bloques: metodo de interpolacion", () => {
  test("cambiar a Kriging, auto-ajustar el variograma, y ver el toggle de varianza solo en modo Kriging", async ({ page }) => {
    await abrirModulo(page, "Modelo de Bloques");
    await page.waitForTimeout(300);

    const bloquesAntes = await page.locator('.dato:has-text("Bloques en la grilla") b').innerText();

    // el toggle de varianza (dentro del visor 3D) NO deberia existir en modo IDW
    await expect(page.locator('button:has-text("Varianza (kriging)")')).toHaveCount(0);

    await page.locator('button:has-text("Kriging ordinario")').click();
    await page.waitForTimeout(150);
    await page.locator('button:has-text("Auto-ajustar desde compositos")').click();
    await page.waitForTimeout(300);

    // el numero de bloques en la grilla no depende del metodo de interpolacion
    await expect(page.locator('.dato:has-text("Bloques en la grilla") b')).toHaveText(bloquesAntes);

    // el toggle de color por varianza aparece en Vista 3D solo cuando el metodo es Kriging
    await expect(page.locator('button:has-text("Varianza (kriging)")')).toBeVisible();
    await page.locator('button:has-text("Varianza (kriging)")').click();
    await expect(page.locator('button[data-activo="true"]:has-text("Varianza (kriging)")')).toBeVisible();
  });
});
