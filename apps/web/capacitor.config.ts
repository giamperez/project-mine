import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.suiteminera.app",
  appName: "Suite Minera",
  webDir: "dist",
  android: {
    // WebGL/Three.js necesita aceleracion por hardware en el WebView; mixed content solo si en
    // algun momento se sirve un recurso http:// dentro de la app https/file (no deberia hacer falta).
    allowMixedContent: false,
  },
};

export default config;
