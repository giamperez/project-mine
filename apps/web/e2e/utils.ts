import type { Page } from "@playwright/test";

/**
 * Navega Dashboard -> Portal -> Taller para un modulo, replicando el flujo real de la app
 * (App.tsx: espacio "dashboard" -> ModuloPortal -> taller). El nombre debe ser un substring
 * del titulo de la tarjeta en Dashboard.tsx (ej. "Diseño de Malla", "Modelo de Bloques").
 */
export async function abrirModulo(page: Page, nombreTarjeta: string): Promise<void> {
  await page.goto("/");
  await page.locator(`.mine-module-card:has-text("${nombreTarjeta}")`).click();
  await page.locator(".btn-portal-primary").click();
}

/** Como abrirModulo, pero para Diseño de Malla entra ademas al taller 3D viejo (sale del editor CAD nuevo). */
export async function abrirMallaTaller3D(page: Page): Promise<void> {
  await abrirModulo(page, "Diseño de Malla");
  await page.locator('button:has-text("Render")').click();
}
