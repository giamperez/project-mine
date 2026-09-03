import { test, expect } from "@playwright/test";

/**
 * Regresion del modo "Tunel / galeria" de Diseno de Malla: arranque tipo Holmberg (metodo
 * simplificado de Jimeno et al. 1995, Tabla 22.2), geometria del frente, y el editor tactil de
 * zonas. Los valores B/E esperados fueron verificados a mano contra una app de referencia y contra
 * la fuente publicada (ver packages/core/tests/tunnelRound.test.ts) — este test protege que la UI
 * siga mostrando esos mismos numeros.
 */
test.describe("Diseño de Malla — modo Túnel (arranque Holmberg)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator('button:has-text("Túnel / galería (subterráneo)")').click();
    await page.waitForTimeout(200);
  });

  test("el arranque B1-B5/E1-E5 reproduce exactamente los valores verificados (4 alivios de 102mm)", async ({ page }) => {
    await page.locator('.campo:has(label:has-text("N° taladros de alivio")) input').fill("4");
    await page.locator('.campo:has(label:has-text("Diámetro individual de alivio")) input').fill("102");
    await page.locator('.campo:has(label:has-text("Avance objetivo")) input').fill("100");
    await page.waitForTimeout(150);

    await expect(page.locator('.dato:has-text("Diámetro equivalente") b')).toHaveText("204.0 mm");

    const filas = await page.locator(".tabla-taladros tbody tr").allInnerTexts();
    const esperado = [
      "1\t0.306\t0.433\t1.00",
      "2\t0.433\t0.918\t1.50",
      "3\t0.918\t1.947\t1.50",
      "4\t1.947\t4.131\t1.50",
      "5\t4.131\t8.763\t1.50",
    ];
    for (let i = 0; i < esperado.length; i++) {
      expect(filas[i]).toBe(esperado[i]);
    }
  });

  test("geometría de frente herradura calcula área/perímetro correctos", async ({ page }) => {
    await page.locator('.campo:has(label:has-text("Ancho")) input').fill("4.5");
    await page.locator('.campo:has(label:has-text("Alto total")) input').fill("4.5");
    await page.waitForTimeout(150);
    // radioCorona=2.25, alturaHastial=2.25: area=4.5*2.25+pi*2.25^2/2=18.077..., perimetro=4.5+2*2.25+pi*2.25=16.069...
    await expect(page.locator('.dato:has-text("Área") b').first()).toHaveText("18.08 m²");
    await expect(page.locator('.dato:has-text("Perímetro") b')).toHaveText("16.07 m");
  });

  test("tocar el frente agrega un taladro con la zona activa y actualiza la distribución por zonas", async ({ page }) => {
    const lienzo = page.locator(".editor2d-lienzo");
    await lienzo.waitFor({ state: "visible" });
    await page.locator('.editor2d-modos button:has-text("Alivios")').click();
    const caja = (await lienzo.boundingBox())!;
    await page.mouse.click(caja.x + caja.width / 2 - 40, caja.y + caja.height / 2);
    await page.waitForTimeout(150);

    await expect(page.locator('fieldset:has(legend:has-text("Distribución")) .dato:has-text("Alivios") b')).toHaveText("1");
    await expect(page.locator('legend:has-text("Taladros del frente")')).toContainText("1");
  });

  test("cambiar a Banco y volver a Túnel no rompe ninguno de los dos modos", async ({ page }) => {
    await page.locator('button:has-text("Banco (cielo abierto)")').click();
    await page.waitForTimeout(150);
    await expect(page.locator('.dato:has-text("Burden de diseño") b')).toBeVisible();
    await page.locator('button:has-text("Túnel / galería (subterráneo)")').click();
    await page.waitForTimeout(150);
    await expect(page.locator('legend:has-text("Distribución por zonas")')).toContainText("0 taladros dibujados");
  });
});
