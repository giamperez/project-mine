import { defineConfig, devices } from "@playwright/test";

/**
 * Suite de regresion E2E de la suite minera — cubre los flujos mas complejos y con mas historial
 * de bugs reales (editor tactil CAD, persistencia local, kriging, import de formatos). No busca
 * cobertura total de cada modulo; busca que un cambio futuro en estas partes avise si algo se
 * rompio, en vez de depender de verificacion manual cada vez.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // un unico servidor de desarrollo compartido: correr en serie evita contencion de CPU/compilacion bajo demanda de Vite
  retries: 0,
  timeout: 45000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5183",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
