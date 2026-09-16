import { useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import HubEstereografia from "./HubEstereografia.js";
import ModalNuevoEstudioEstereo from "./ModalNuevoEstudioEstereo.js";
import TallerEstereografia from "./TallerEstereografia.js";
import {
  type ProyectoEstereografico,
  type TipoEscenarioEstereo,
  ESCENARIOS_ESTEREOGRAFIA,
  PROYECTOS_ESTEREOGRAFIA_INICIALES,
} from "./proyectosEstereografia.js";

interface EspacioEstereografiaProps {
  onVolverDashboard?: () => void;
  onVolverAlPortal?: () => void;
}

export default function EspacioEstereografia({
  onVolverDashboard,
  onVolverAlPortal,
}: EspacioEstereografiaProps = {}) {
  const [vista, setVista] = useState<"hub" | "nuevo" | "taller">("hub");
  const [proyectoActivo, setProyectoActivo] = useState<ProyectoEstereografico | null>(null);

  const [proyectos, setProyectos] = usePersistedState<ProyectoEstereografico[]>(
    "estereografia.proyectosLista",
    () => PROYECTOS_ESTEREOGRAFIA_INICIALES
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

  function handleAbrirProyecto(p: ProyectoEstereografico) {
    setProyectoActivo(p);
    setVista("taller");
  }

  function handleCrearProyecto(nombre: string, escenarioId: TipoEscenarioEstereo) {
    const esc = ESCENARIOS_ESTEREOGRAFIA.find((e) => e.id === escenarioId) || ESCENARIOS_ESTEREOGRAFIA[0];
    const nuevoProj: ProyectoEstereografico = {
      id: "est-" + Math.random().toString(36).substr(2, 9),
      nombre,
      escenarioId,
      talud: { ...esc.taludDefecto },
      anguloFriccion_grados: esc.anguloFriccionDefecto,
      toleranciaDireccion_grados: esc.toleranciaDefecto,
      discontinuidades: esc.discontinuidadesDefecto.map((d) => ({ ...d })),
      proyeccion: "schmidt",
      hemisferio: "inferior",
      elementos: "polos",
      modoDensidad: "ninguna",
      radioConteo_grados: 24,
      numeroFamilias: 4,
      rmrBasicoSMR: 50,
      discontinuidadSmrId: esc.discontinuidadesDefecto[0]?.id ?? null,
      tipoFallaSMR: "planar",
      metodoExcavacionSMR: "voladura_o_mecanico",
      fechaCreacion: new Date().toISOString(),
      fechaModificacion: new Date().toISOString(),
    };
    setProyectos([nuevoProj, ...proyectos]);
    setProyectoActivo(nuevoProj);
    setVista("taller");
  }

  function handleGuardarProyecto(pActualizado: ProyectoEstereografico) {
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
    <div className="espacio-estereografia-shell">
      {vista === "hub" && (
        <HubEstereografia
          onVolverDashboard={handleVolverPrincipal}
          onAbrirProyecto={handleAbrirProyecto}
          onNuevoProyecto={() => setVista("nuevo")}
        />
      )}

      {vista === "nuevo" && (
        <ModalNuevoEstudioEstereo
          onVolver={() => setVista("hub")}
          onCrearProyecto={handleCrearProyecto}
        />
      )}

      {vista === "taller" && proyectoActivo && (
        <TallerEstereografia
          key={proyectoActivo.id}
          proyecto={proyectoActivo}
          onVolver={() => setVista("hub")}
          onGuardarProyecto={handleGuardarProyecto}
        />
      )}
    </div>
  );
}
