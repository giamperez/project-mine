import { test, expect } from "@playwright/test";

/**
 * Regresion del editor CAD tactil (EditorPoligono2D), la pieza de UI mas compleja de la suite y la
 * que mas bugs reales tuvo durante el desarrollo (StrictMode, overflow CSS, coordenadas de
 * arrastre). Usa el editor de la cresta en Diseño de Malla como banco de pruebas — el mismo
 * componente se reutiliza en Topografia/Estereografia/Modelo de Bloques/Acarreo.
 */
test.describe("editor de poligono 2D (cresta, Diseño de Malla)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator('.visor-modo-toggle button:has-text("Dibujar cresta 2D")').click();
    await page.waitForTimeout(200);
  });

  test("agregar, medir, mover y eliminar un vertice; deshacer/rehacer", async ({ page }) => {
    const lienzo = page.locator(".editor2d-lienzo");
    const caja = (await lienzo.boundingBox())!;
    const cx = caja.x + caja.width / 2;
    const cy = caja.y + caja.height / 2;

    // estado inicial: rectangulo demo de 4 vertices
    await expect(page.locator(".editor2d-estado")).toContainText("4 vértices");

    // medir: dos puntos a 200px = 20m (escala 10px/m por defecto)
    await page.locator('button:has-text("📏 Medir")').click();
    await page.mouse.click(cx - 100, cy);
    await page.mouse.click(cx + 100, cy);
    await expect(page.locator(".editor2d-estado")).toContainText("Medición: 20.00 m");

    // agregar un 5to vertice
    await page.locator('button:has-text("✛ Agregar")').click();
    await page.mouse.click(cx, cy - 200);
    await expect(page.locator(".editor2d-estado")).toContainText("5 vértices");

    // deshacer el agregado
    await page.locator('button:has-text("↶ Deshacer")').click();
    await expect(page.locator(".editor2d-estado")).toContainText("4 vértices");

    // rehacer
    await page.locator('button:has-text("↷ Rehacer")').click();
    await expect(page.locator(".editor2d-estado")).toContainText("5 vértices");

    // mover el vertice recien agregado (click sin arrastrar lo selecciona en modo Mover)
    await page.locator('button:has-text("✥ Mover")').click();
    const circulo = page.locator(".editor2d-lienzo circle[r='6'], .editor2d-lienzo circle[r='8']").last();
    const cb = (await circulo.boundingBox())!;
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(cb.x + 60, cb.y + 40, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('button:has-text("✕ Eliminar")')).toBeVisible();

    // eliminar el seleccionado: vuelve a 4
    await page.locator('button:has-text("✕ Eliminar")').click();
    await expect(page.locator(".editor2d-estado")).toContainText("4 vértices");
  });

  test("atajo de teclado Escape deselecciona un vertice", async ({ page }) => {
    await page.locator('button:has-text("✥ Mover")').click();
    const circulo = page.locator(".editor2d-lienzo circle[r='6'], .editor2d-lienzo circle[r='8']").first();
    const cb = (await circulo.boundingBox())!;
    await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await expect(page.locator('button:has-text("✕ Eliminar")')).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator('button:has-text("✕ Eliminar")')).toHaveCount(0);
  });
});
