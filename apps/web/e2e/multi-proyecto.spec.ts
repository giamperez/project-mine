import { test, expect } from "@playwright/test";
import { abrirMallaTaller3D } from "./utils.js";

async function abrirModalPerfil(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator('.mine-nav-item:has-text("Perfil")').click();
}

test.describe("multi-proyecto (guardar/cargar varias minas en el mismo dispositivo)", () => {
  test("guardar como, cambiar el activo, y cargar de vuelta restaura el guardado — sin tocar otros proyectos guardados", async ({ page }) => {
    await abrirMallaTaller3D(page);
    const campoCota = page.locator('.campo:has(label:has-text("Cota de cresta")) input');

    // proyecto "Mina A": cota 4100, guardado con nombre (el guardado vive en el modal "Perfil"
    // del Dashboard — recargar es la forma real en que un usuario vuelve alli desde el taller)
    await campoCota.fill("4100");
    await campoCota.blur();
    await page.waitForTimeout(150);
    await abrirModalPerfil(page);
    page.once("dialog", (d) => d.accept("Mina A"));
    await page.locator('button:has-text("💾 Guardar como…")').click();
    await expect(page.locator(".dashboard-toast")).toContainText('Guardado como "Mina A"');
    await expect(page.locator('.item-proyecto-modal:has-text("Mina A")')).toBeVisible();
    await page.locator(".btn-cerrar").click();

    // cambio el activo a 4200 SIN guardarlo con nombre (simula trabajo no respaldado)
    await abrirMallaTaller3D(page);
    await campoCota.fill("4200");
    await campoCota.blur();
    await page.waitForTimeout(150);

    // guardo un segundo proyecto "Mina B" con otro valor
    await campoCota.fill("4300");
    await campoCota.blur();
    await page.waitForTimeout(150);
    await abrirModalPerfil(page);
    page.once("dialog", (d) => d.accept("Mina B"));
    await page.locator('button:has-text("💾 Guardar como…")').click();
    await expect(page.locator('.item-proyecto-modal:has-text("Mina B")')).toBeVisible();

    // cargar "Mina A" (confirma el dialogo de reemplazo) y confirmar que restaura 4100
    page.once("dialog", (d) => d.accept());
    await page.locator('.item-proyecto-modal:has-text("Mina A") button:has-text("Cargar")').click();
    await page.waitForTimeout(600); // recarga la pagina sola
    await abrirMallaTaller3D(page);
    await expect(campoCota).toHaveValue("4100");

    // "Mina B" sigue existiendo en la lista tras cargar "Mina A"
    await abrirModalPerfil(page);
    await expect(page.locator('.item-proyecto-modal:has-text("Mina B")')).toBeVisible();

    // eliminar "Mina B" y confirmar que desaparece de la lista (sin afectar el proyecto activo)
    page.once("dialog", (d) => d.accept());
    await page.locator('.item-proyecto-modal:has-text("Mina B") button.btn-peligro').click();
    await expect(page.locator('.item-proyecto-modal:has-text("Mina B")')).toHaveCount(0);
    await page.locator(".btn-cerrar").click();
    await abrirMallaTaller3D(page);
    await expect(campoCota).toHaveValue("4100");
  });
});
