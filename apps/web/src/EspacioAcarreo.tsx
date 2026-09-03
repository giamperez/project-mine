import { useMemo, useState } from "react";
import { disenarAcarreo, type EntradaAcarreo } from "@suite/core";
import type { EstadoCapa } from "@suite/engine";
import PanelDatosAcarreo from "./components/PanelDatosAcarreo.js";
import PanelResultadosAcarreo from "./components/PanelResultadosAcarreo.js";
import Visor3DAcarreo from "./components/Visor3DAcarreo.js";
import EditorRutaAcarreo, { type PuntoRuta } from "./components/EditorRutaAcarreo.js";
import { usePersistedState } from "./hooks/usePersistedState.js";

type Pestana = "datos" | "3d" | "resultados";
type ModoVisor = "3d" | "editar2d";

const ENTRADA_INICIAL: EntradaAcarreo = {
  distanciaUnidireccional_m: 2500,
  pendientePromedio_pct: 8,
  condicionVia: "regular",
  capacidadCamion_ton: 220,
  pesoVacioCamion_kg: 180000,
  potenciaCamion_kW: 1900,
  velocidadMaxima_kmh: 60,
  capacidadBalde_ton: 40,
  tiempoCicloCargador_s: 30,
  tiempoDescarga_s: 60,
  tiempoColas_s: 60,
  numeroCargadores: 1,
};

export default function EspacioAcarreo() {
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [modoVisor, setModoVisor] = useState<ModoVisor>("3d");
  const [capas, setCapas] = useState<EstadoCapa[]>([]);
  const [entrada, setEntrada] = usePersistedState<EntradaAcarreo>("acarreo.entrada", ENTRADA_INICIAL);
  const [ruta, setRuta] = usePersistedState<PuntoRuta[]>("acarreo.ruta", []);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const resultado = useMemo(() => disenarAcarreo(entrada), [entrada]);

  function handleAplicarRuta(distancia_m: number, pendiente_pct: number) {
    setEntrada({ ...entrada, distanciaUnidireccional_m: Math.round(distancia_m), pendientePromedio_pct: Number(pendiente_pct.toFixed(1)) });
    setMensaje(`Distancia y pendiente aplicadas desde la ruta: ${distancia_m.toFixed(0)} m, ${pendiente_pct.toFixed(1)}%.`);
  }

  return (
    <>
      {mensaje && (
        <div className="advertencia" style={{ margin: "8px 14px 0", cursor: "pointer" }} onClick={() => setMensaje(null)}>
          {mensaje} (toca para cerrar)
        </div>
      )}

      <main className="app-main">
        <PanelDatosAcarreo entrada={entrada} onCambiarEntrada={setEntrada} oculto={pestana !== "datos"} />

        <div className="visor-contenedor" data-oculto={pestana !== "3d"}>
          <div className="visor-modo-toggle">
            <button type="button" data-activo={modoVisor === "3d"} onClick={() => setModoVisor("3d")}>
              Vista 3D
            </button>
            <button type="button" data-activo={modoVisor === "editar2d"} onClick={() => setModoVisor("editar2d")}>
              ✏ Dibujar ruta tocando
            </button>
          </div>
          <div className="visor-contenido">
            <div style={{ display: modoVisor === "3d" ? "contents" : "none" }}>
              <Visor3DAcarreo entrada={entrada} onCapas={setCapas} />
              <div className="capas-leyenda">
                {capas.map((c) => (
                  <div className="item" key={c.id}>
                    <span className="swatch" style={{ background: c.color }} />
                    {c.nombre}
                  </div>
                ))}
                <div className="item">
                  <span className="swatch" style={{ background: "#22c55e" }} />
                  Carguío
                </div>
                <div className="item">
                  <span className="swatch" style={{ background: "#f97316" }} />
                  Descarga
                </div>
              </div>
            </div>
            {modoVisor === "editar2d" && <EditorRutaAcarreo ruta={ruta} onCambiarRuta={setRuta} onAplicar={handleAplicarRuta} />}
          </div>
        </div>

        <PanelResultadosAcarreo resultado={resultado} oculto={pestana !== "resultados"} />
      </main>

      <nav className="tabs-inferior">
        <button type="button" data-activo={pestana === "datos"} onClick={() => setPestana("datos")}>
          Datos
        </button>
        <button type="button" data-activo={pestana === "3d"} onClick={() => setPestana("3d")}>
          Vista 3D
        </button>
        <button type="button" data-activo={pestana === "resultados"} onClick={() => setPestana("resultados")}>
          Resultados
        </button>
      </nav>
    </>
  );
}
