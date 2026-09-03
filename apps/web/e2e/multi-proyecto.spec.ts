import { test, expect } from "@playwright/test";

test.describe("multi-proyecto (guardar/cargar varias minas en el mismo dispositivo)", () => {
  test("guardar como, cambiar el activo, y cargar de vuelta restaura el guardado — sin tocar otros proyectos guardados", async ({ page }) => {
    await page.goto("/");
    const campoCota = page.locator('.campo:has(label:has-text("Cota de cresta")) input');

    // proyecto "Mina A": cota 4100, guardado con nombre
    await campoCota.fill("4100");
    await campoCota.blur();
    await page.waitForTimeout(150);
    await page.locator('button:has-text("💾 Proyecto")').click();
    page.once("dialog", (d) => d.accept("Mina A"));
    await page.locator('button:has-text("💾 Guardar como…")').click();
    await expect(page.locator(".menu-proyecto")).toContainText('Guardado como "Mina A"');
    await expect(page.locator(".menu-proyecto li:has-text(\"Mina A\")")).toBeVisible();

    // cambio el activo a 4200 SIN guardarlo con nombre (simula trabajo no respaldado)
    await campoCota.fill("4200");
    await campoCota.blur();
    await page.waitForTimeout(150);

    // guardo un segundo proyecto "Mina B" con otro valor
    await campoCota.fill("4300");
    await campoCota.blur();
    await page.waitForTimeout(150);
    page.once("dialog", (d) => d.accept("Mina B"));
    await page.locator('button:has-text("💾 Guardar como…")').click();
    await expect(page.locator(".menu-proyecto li:has-text(\"Mina B\")")).toBeVisible();

    // cargar "Mina A" (confirma el dialogo de reemplazo) y confirmar que restaura 4100
    page.once("dialog", (d) => d.accept());
    await page.locator('.menu-proyecto li:has-text("Mina A") button:has-text("Cargar")').click();
    await page.waitForTimeout(600); // recarga la pagina sola
    await expect(campoCota).toHaveValue("4100");

    // "Mina B" sigue existiendo en la lista tras cargar "Mina A"
    await page.locator('button:has-text("💾 Proyecto")').click();
    await expect(page.locator(".menu-proyecto li:has-text(\"Mina B\")")).toBeVisible();

    // eliminar "Mina B" y confirmar que desaparece de la lista (sin afectar el proyecto activo)
    page.once("dialog", (d) => d.accept());
    await page.locator('.menu-proyecto li:has-text("Mina B") button[aria-label="Eliminar proyecto guardado Mina B"]').click();
    await expect(page.locator(".menu-proyecto li:has-text(\"Mina B\")")).toHaveCount(0);
    await expect(campoCota).toHaveValue("4100");
  });
});
