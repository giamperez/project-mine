import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

function djiSamplePlugin() {
  const dir = "C:\\Users\\gpere\\Downloads\\4thAve";
  return {
    name: "vite-dji-sample-server",
    configureServer(server: any) {
      server.middlewares.use("/api/dji-samples", (req: any, res: any) => {
        try {
          if (!fs.existsSync(dir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Carpeta no encontrada", path: dir }));
            return;
          }
          // readdirSync no garantiza orden de vuelo; se ordena por nombre (natural) para que la
          // trayectoria conecte las tomas en secuencia y no haga zigzag entre puntos aleatorios.
          const files = fs
            .readdirSync(dir)
            .filter((f) => f.toUpperCase().endsWith(".JPG"))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ files, total: files.length, path: dir }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      server.middlewares.use("/api/dji-photo", (req: any, res: any) => {
        try {
          const url = new URL(req.url, "http://localhost");
          const fileName = url.searchParams.get("file");
          if (!fileName) {
            res.statusCode = 400;
            res.end("Falta file");
            return;
          }
          const filePath = path.join(dir, path.basename(fileName));
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end("No encontrado");
            return;
          }
          res.setHeader("Content-Type", "image/jpeg");
          fs.createReadStream(filePath).pipe(res);
        } catch (e: any) {
          res.statusCode = 500;
          res.end(e.message);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    djiSamplePlugin(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true }, // sirve el manifest/service worker tambien en `npm run dev`, para poder probar instalacion/offline sin hacer build
      // Precachea todo el bundle (app shell + assets) para que la suite funcione sin conexion
      // despues de la primera visita — critico en mina/subterraneo, donde el sitio suele no tener
      // señal. Los datos del proyecto ya se guardan en localStorage (ver usePersistedState.ts);
      // esto cubre la otra mitad: que el CODIGO de la app tambien cargue offline.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // Tres.js + los modulos ya suman un bundle grande (~830kB); subir el limite por defecto
        // de Workbox (2MB) para que igual se precachee en vez de omitirse silenciosamente.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: "Suite Minera",
        short_name: "Suite Minera",
        description: "Suite de ingenieria minera: malla y voladura, topografia, geomecanica, estereografia, acarreo y modelo de bloques.",
        start_url: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#12161c",
        theme_color: "#12161c",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    host: true, // expone en la red local para probar desde un celular real
    port: 5180,
  },
});
