import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
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
  },
});
