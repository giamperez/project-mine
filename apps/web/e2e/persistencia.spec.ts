import { test, expect } from "@playwright/test";

test.describe("persistencia local", () => {
  test("un cambio en un campo numerico sobrevive a un recargue de pagina", async ({ page }) => {
    await page.goto("/");
    const campoCota = page.locator('.campo:has(label:has-text("Cota de cresta")) input');
    await campoCota.fill("4777");
    await campoCota.blur();
    await page.waitForTimeout(150);

    await page.reload();
    await expect(page.locator('.campo:has(label:has-text("Cota de cresta")) input')).toHaveValue("4777");
  });

  test("exportar el proyecto y reimportarlo restaura los datos tras el reinicio", async ({ page }) => {
    await page.goto("/");
    const campoCota = page.locator('.campo:has(label:has-text("Cota de cresta")) input');
    await campoCota.fill("4999");
    await campoCota.blur();
    await page.waitForTimeout(150);

    await page.locator('button:has-text("💾 Proyecto")').click();
    const descargaPromise = page.waitForEvent("download");
    await page.locator('button:has-text("Exportar proyecto")').click();
    const descarga = await descargaPromise;
    const rutaExportada = await descarga.path();
    expect(rutaExportada).toBeTruthy();

    // reiniciar el proyecto (borra localStorage) y confirmar que el valor se perdio
    page.once("dialog", (d) => d.accept());
    await page.locator('button:has-text("✕ Reiniciar todo")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.campo:has(label:has-text("Cota de cresta")) input')).not.toHaveValue("4999");

    // reimportar el respaldo exportado
    await page.locator('button:has-text("💾 Proyecto")').click();
    const inputImportar = page.locator('input[type="file"][accept=".json"]');
    await inputImportar.setInputFiles(rutaExportada!);
    await page.waitForTimeout(800); // el import recarga la pagina sola

    await expect(page.locator('.campo:has(label:has-text("Cota de cresta")) input')).toHaveValue("4999");
  });
});
