import { useState } from "react";
import Dashboard, { type ModuloId } from "./Dashboard.js";
import { ModuloPortal } from "./components/shared/index.js";
import { EspacioMalla } from "./features/blast-pattern/index.js";
import { EspacioTopografia } from "./features/topography/index.js";
import { EspacioGeomecanica } from "./features/geomechanics/index.js";
import { EspacioEstereografia } from "./features/stereonet/index.js";
import { EspacioAcarreo } from "./features/haulage/index.js";
import { EspacioModeloBloques } from "./features/block-model/index.js";
import { EspacioModelo3D } from "./features/model-3d/index.js";

type Espacio = "dashboard" | ModuloId;

export default function App() {
  const [espacio, setEspacio] = useState<Espacio>("dashboard");
  const [vistaModulo, setVistaModulo] = useState<"portal" | "taller">("portal");

  const [mallaActivaId, setMallaActivaId] = useState<string>("malla-1");
  const [proyectoModelo3DId, setProyectoModelo3DId] = useState<string>("");

  function seleccionarModulo(m: ModuloId) {
    setEspacio(m);
    setVistaModulo("portal");
  }

  function abrirTaller(id?: string) {
    if (id) {
      setMallaActivaId(id);
      setProyectoModelo3DId(id);
    }
    setVistaModulo("taller");
  }

  return (
    <div className="app-shell" data-espacio={espacio} data-vista={vistaModulo}>
      {espacio === "dashboard" && <Dashboard onSeleccionarModulo={(m) => seleccionarModulo(m)} />}

      {espacio !== "dashboard" && vistaModulo === "portal" && (
        <ModuloPortal
          key={espacio}
          moduloId={espacio}
          onVolverDashboard={() => setEspacio("dashboard")}
          onAbrirTaller={(id) => abrirTaller(id)}
        />
      )}

      {espacio !== "dashboard" && vistaModulo === "taller" && (
        <>
          {espacio === "malla" && (
            <EspacioMalla
              key={mallaActivaId}
              proyectoId={mallaActivaId}
              onVolverAlPortal={() => setVistaModulo("portal")}
            />
          )}
          {espacio === "topografia" && <EspacioTopografia />}
          {espacio === "geomecanica" && <EspacioGeomecanica />}
          {espacio === "estereografia" && <EspacioEstereografia />}
          {espacio === "acarreo" && <EspacioAcarreo />}
          {espacio === "modeloBloques" && <EspacioModeloBloques />}
          {espacio === "modelo3d" && (
            <EspacioModelo3D
              key={proyectoModelo3DId}
              proyectoId={proyectoModelo3DId}
              onVolverAlPortal={() => setVistaModulo("portal")}
            />
          )}
        </>
      )}
    </div>
  );
}
