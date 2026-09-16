import { test, expect } from "@playwright/test";

test.describe("Verificación Hub de Estereografía, Taller y Resiliencia", () => {
  test("1. Carga de HubEstereografia, navegación a Taller y retorno al Dashboard", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(`[PAGEERROR] ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`[CONSOLE] ${m.text()}`);
    });

    await page.goto("/");
    await page.waitForTimeout(600);

    // 1. Abrir Estereografía desde el Dashboard
    const cardEstereo = page.locator('.mine-module-card:has-text("Estereografía")');
    await expect(cardEstereo).toBeVisible();
    await cardEstereo.click();

    // 2. Debe abrir el HUB de Estereografía (estilo idéntico a Topografía con 3D en vivo y estudios)
    await expect(page.locator('text=Estereografía y Cinemática')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=MODELO 3D EN VIVO')).toBeVisible();
    await expect(page.locator('text=NUEVO ESTUDIO ESTRUCTURAL')).toBeVisible();
    await expect(page.locator('text=Talud Sur Banco 4200')).toBeVisible();

    // 3. Abrir un estudio existente para entrar al taller de trabajo 2D
    const estudioItem = page.locator('.portal-project-card:has-text("Talud Sur Banco 4200")');
    await expect(estudioItem).toBeVisible();
    await estudioItem.click();

    // 4. Debe abrir el Taller de Estereografía con el canvas 2D y el nombre del estudio en el encabezado
    await expect(page.locator('.estereo-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.estereo-header:has-text("Talud Sur Banco 4200")')).toBeVisible();
    await expect(page.locator('button:has-text("Red 2D")').first()).toBeVisible();

    // 5. Probar el botón de volver en el taller -> debe volver al Hub
    const btnVolverTaller = page.locator('.estereo-btn-volver');
    await expect(btnVolverTaller).toBeVisible();
    await btnVolverTaller.click();

    // 6. Estamos de vuelta en el Hub de Estereografía
    await expect(page.locator('text=NUEVO ESTUDIO ESTRUCTURAL')).toBeVisible({ timeout: 5000 });

    // 7. Probar el botón de volver en el Hub (Suite Minera) -> debe volver al Dashboard
    const btnVolverDashboard = page.locator('button:has-text("Suite Minera")');
    await expect(btnVolverDashboard).toBeVisible();
    await btnVolverDashboard.click();

    // 8. Regreso exitoso al Dashboard
    await expect(page.locator('.mine-module-card:has-text("Estereografía")')).toBeVisible({ timeout: 5000 });

    expect(errores).toEqual([]);
  });

  test("2. Resiliencia contra valores nulos o corruptos en localStorage", async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(`[PAGEERROR] ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`[CONSOLE] ${m.text()}`);
    });

    // Inyectar datos nulos y corruptos en las claves persistidas
    await page.addInitScript(() => {
      localStorage.setItem("suite-mineria:estereografia.discontinuidades", "null");
      localStorage.setItem("suite-mineria:estereografia.talud", "null");
      localStorage.setItem("suite-mineria:estereografia.anguloFriccion_grados", "null");
      localStorage.setItem("suite-mineria:estereografia.proyeccion", "null");
      localStorage.setItem("suite-mineria:estereografia.proyectosLista", "null");
    });

    await page.goto("/");
    await page.waitForTimeout(600);

    // El Dashboard debe cargar perfectamente sin crashear
    const cardEstereo = page.locator('.mine-module-card:has-text("Estereografía")');
    await expect(cardEstereo).toBeVisible();
    await cardEstereo.click();

    // El Hub debe cargar con los proyectos iniciales sin pantalla blanca
    await expect(page.locator('text=Estereografía y Cinemática')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=NUEVO ESTUDIO ESTRUCTURAL')).toBeVisible();

    expect(errores).toEqual([]);
  });
});
