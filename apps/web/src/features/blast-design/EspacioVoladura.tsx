import { useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import HubVoladura from "./HubVoladura.js";
import SeleccionMallaVoladura from "./SeleccionMallaVoladura.js";
import TallerVoladura from "./TallerVoladura.js";
import {
  type ProyectoVoladura,
  type SnapshotMallaVoladura,
  PROYECTOS_VOLADURA_INICIALES,
  crearProyectoVoladura,
} from "./proyectosVoladura.js";

interface EspacioVoladuraProps {
  onVolverDashboard?: () => void;
}

export default function EspacioVoladura({ onVolverDashboard }: EspacioVoladuraProps = {}) {
  const [vista, setVista] = useState<"hub" | "seleccion" | "taller">("hub");
  const [proyectoActivo, setProyectoActivo] = useState<ProyectoVoladura | null>(null);

  const [proyectos, setProyectos] = usePersistedState<ProyectoVoladura[]>(
    "voladura.proyectosLista",
    () => PROYECTOS_VOLADURA_INICIALES
  );

  function handleAbrirProyecto(p: ProyectoVoladura) {
    setProyectoActivo(p);
    setVista("taller");
  }

  function handleMallaSeleccionada(snapshot: SnapshotMallaVoladura) {
    const nuevoProyecto = crearProyectoVoladura(`Voladura ${proyectos.length + 1}`, snapshot);
    setProyectos([nuevoProyecto, ...proyectos]);
    setProyectoActivo(nuevoProyecto);
    setVista("taller");
  }

  function handleGuardarProyecto(pActualizado: ProyectoVoladura) {
    setProyectos((prev) => {
      const existe = prev.some((p) => p.id === pActualizado.id);
      if (existe) return prev.map((p) => (p.id === pActualizado.id ? pActualizado : p));
      return [pActualizado, ...prev];
    });
    setProyectoActivo(pActualizado);
  }

  return (
    <div className="espacio-voladura-shell">
      {vista === "hub" && (
        <HubVoladura
          onVolverDashboard={() => (onVolverDashboard ? onVolverDashboard() : setVista("hub"))}
          onAbrirProyecto={handleAbrirProyecto}
          onNuevoProyecto={() => setVista("seleccion")}
        />
      )}

      {vista === "seleccion" && (
        <SeleccionMallaVoladura onVolver={() => setVista("hub")} onMallaSeleccionada={handleMallaSeleccionada} />
      )}

      {vista === "taller" && proyectoActivo && (
        <TallerVoladura
          key={proyectoActivo.id}
          proyecto={proyectoActivo}
          onVolver={() => setVista("hub")}
          onGuardarProyecto={handleGuardarProyecto}
        />
      )}
    </div>
  );
}
