import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { abrirMallaTaller3D } from "./utils.js";

test.describe("persistencia local", () => {
  test("un cambio en un campo numerico sobrevive a un recargue de pagina", async ({ page }) => {
    await abrirMallaTaller3D(page);
    const campoCota = page.locator('.campo:has(label:has-text("Cota de cresta")) input');
    await campoCota.fill("4777");
    await campoCota.blur();
    await page.waitForTimeout(150);

    // recargar vuelve al Dashboard (el "espacio" activo es estado en memoria, no persistido) —
    // el valor sigue vivo en localStorage, asi que reentrar al mismo modulo debe mostrarlo de nuevo.
    await page.reload();
    await abrirMallaTaller3D(page);
    await expect(page.locator('.campo:has(label:has-text("Cota de cresta")) input')).toHaveValue("4777");
  });

  test("exportar el proyecto genera un respaldo JSON real con los datos actuales, y Limpiar borra el campo", async ({ page }) => {
    await abrirMallaTaller3D(page);
    const campoCota = page.locator('.campo:has(label:has-text("Cota de cresta")) input');
    await campoCota.fill("4999");
    await campoCota.blur();
    await page.waitForTimeout(150);

    // el export vive en el modal "Perfil" del Dashboard, no dentro del modulo — recargar es la
    // forma real en que un usuario vuelve al Dashboard (localStorage sobrevive la recarga).
    await page.goto("/");
    await page.locator('.mine-nav-item:has-text("Perfil")').click();
    const descargaPromise = page.waitForEvent("download");
    await page.locator('button:has-text("⬇ Exportar")').click();
    const descarga = await descargaPromise;
    const ruta = await descarga.path();
    expect(ruta).toBeTruthy();
    const contenido = JSON.parse(readFileSync(ruta!, "utf-8"));
    expect(contenido.formato).toBe("suite-mineria-proyecto");
    expect(contenido.datos["suite-mineria:malla.entrada"].cotaCresta).toBe(4999);

    // Limpiar borra el localStorage del proyecto entero
    page.once("dialog", (d) => d.accept());
    await page.locator('button:has-text("✕ Limpiar")').click();
    await page.waitForTimeout(400); // Limpiar recarga la pagina sola
    await abrirMallaTaller3D(page);
    await expect(page.locator('.campo:has(label:has-text("Cota de cresta")) input')).not.toHaveValue("4999");
  });
});
