import { useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import HubTopografia from "./HubTopografia.js";
import ModalNuevoProyectoTopo from "./ModalNuevoProyectoTopo.js";
import TallerMotorTopografico from "./TallerMotorTopografico.js";
import {
  type ProyectoTopografico,
  type TipoMotorTopo,
} from "./motoresTopograficos.js";

interface EspacioTopografiaProps {
  onVolverDashboard?: () => void;
  onVolverAlPortal?: () => void;
}

export default function EspacioTopografia({
  onVolverDashboard,
  onVolverAlPortal,
}: EspacioTopografiaProps) {
  const [vista, setVista] = useState<"hub" | "nuevo" | "taller">("hub");
  const [proyectoActivo, setProyectoActivo] = useState<ProyectoTopografico | null>(null);

  const [proyectos, setProyectos] = usePersistedState<ProyectoTopografico[]>(
    "topografia.proyectosLista",
    []
  );

  function handleVolverPrincipal() {
    if (onVolverDashboard) {
      onVolverDashboard();
    } else if (onVolverAlPortal) {
      onVolverAlPortal();
    } else {
      setVista("hub");
    }
  }

  function handleAbrirProyecto(p: ProyectoTopografico) {
    setProyectoActivo(p);
    setVista("taller");
  }

  function handleCrearProyecto(nombre: string, motorId: TipoMotorTopo) {
    const nuevoProj: ProyectoTopografico = {
      id: "proj-" + Math.random().toString(36).substr(2, 9),
      nombre,
      motorId,
      datum: "WGS 84",
      zonaUtm: "18S",
      fechaCreacion: new Date().toISOString(),
      fechaModificacion: new Date().toISOString(),
      datosMotor: {},
    };
    setProyectos([nuevoProj, ...proyectos]);
    setProyectoActivo(nuevoProj);
    setVista("taller");
  }

  function handleGuardarProyecto(pActualizado: ProyectoTopografico) {
    setProyectos((prev) => {
      const existe = prev.some((p) => p.id === pActualizado.id);
      if (existe) {
        return prev.map((p) => (p.id === pActualizado.id ? pActualizado : p));
      }
      return [pActualizado, ...prev];
    });
    setProyectoActivo(pActualizado);
  }

  return (
    <div className="espacio-topografia-shell">
      {vista === "hub" && (
        <HubTopografia
          onVolverDashboard={handleVolverPrincipal}
          onAbrirProyecto={handleAbrirProyecto}
          onNuevoProyecto={() => setVista("nuevo")}
        />
      )}

      {vista === "nuevo" && (
        <ModalNuevoProyectoTopo
          onVolver={() => setVista("hub")}
          onCrearProyecto={handleCrearProyecto}
        />
      )}

      {vista === "taller" && proyectoActivo && (
        <TallerMotorTopografico
          key={proyectoActivo.id}
          proyecto={proyectoActivo}
          onVolver={() => setVista("hub")}
          onGuardarProyecto={handleGuardarProyecto}
        />
      )}
    </div>
  );
}
