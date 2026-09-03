import { useState } from "react";
import Dashboard, { type ModuloId } from "./Dashboard.js";
import ModuloPortal from "./components/ModuloPortal.js";
import EspacioMalla from "./EspacioMalla.js";
import EspacioTopografia from "./EspacioTopografia.js";
import EspacioGeomecanica from "./EspacioGeomecanica.js";
import EspacioEstereografia from "./EspacioEstereografia.js";
import EspacioAcarreo from "./EspacioAcarreo.js";
import EspacioModeloBloques from "./EspacioModeloBloques.js";

type Espacio = "dashboard" | ModuloId;

export default function App() {
  const [espacio, setEspacio] = useState<Espacio>("dashboard");
  const [vistaModulo, setVistaModulo] = useState<"portal" | "taller">("portal");

  function seleccionarModulo(m: ModuloId) {
    setEspacio(m);
    setVistaModulo("portal");
  }

  return (
    <div className="app-shell" data-espacio={espacio} data-vista={vistaModulo}>
      {espacio === "dashboard" && <Dashboard onSeleccionarModulo={(m) => seleccionarModulo(m)} />}

      {espacio !== "dashboard" && vistaModulo === "portal" && (
        <ModuloPortal
          moduloId={espacio}
          onVolverDashboard={() => setEspacio("dashboard")}
          onAbrirTaller={() => setVistaModulo("taller")}
        />
      )}

      {espacio !== "dashboard" && vistaModulo === "taller" && (
        <>
          {espacio === "malla" && <EspacioMalla onVolverAlPortal={() => setVistaModulo("portal")} />}
          {espacio === "topografia" && <EspacioTopografia />}
          {espacio === "geomecanica" && <EspacioGeomecanica />}
          {espacio === "estereografia" && <EspacioEstereografia />}
          {espacio === "acarreo" && <EspacioAcarreo />}
          {espacio === "modeloBloques" && <EspacioModeloBloques />}
        </>
      )}
    </div>
  );
}
