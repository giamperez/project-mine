import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Ocultar pantalla de carga inicial tan pronto la app está lista
const splash = document.getElementById("app-splash");
if (splash) {
  splash.classList.add("splash-fade-out");
  setTimeout(() => {
    if (splash.parentNode) {
      splash.parentNode.removeChild(splash);
    }
  }, 450);
}

