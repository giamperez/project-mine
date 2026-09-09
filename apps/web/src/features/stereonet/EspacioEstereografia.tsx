import { useMemo, useState } from "react";
import { analizarEstereografia, type Discontinuidad, type TaludEstereografia } from "@suite/core";
import { exportarDiscontinuidadesCSV, importarDiscontinuidadesDesdeCSV } from "@suite/mining-stereonet";
import EstereogramaSVG from "./components/EstereogramaSVG.js";
import PanelDatosEstereografia from "./components/PanelDatosEstereografia.js";
import PanelResultadosEstereografia from "./components/PanelResultadosEstereografia.js";
import { descargarTexto } from "../../utils/descargar.js";
import { leerArchivoTabularComoTexto } from "../../utils/leerArchivo.js";
import { usePersistedState } from "../../hooks/usePersistedState.js";

type Pestana = "datos" | "estereograma" | "resultados";

const DISCONTINUIDADES_DEMO: Discontinuidad[] = [
  { id: "D-1", nombre: "J1", dip_grados: 40, dipDirection_grados: 185 },
  { id: "D-2", nombre: "J2", dip_grados: 65, dipDirection_grados: 260 },
  { id: "D-3", nombre: "J3", dip_grados: 75, dipDirection_grados: 10 },
  { id: "D-4", nombre: "J4", dip_grados: 55, dipDirection_grados: 150 },
];

let contadorDiscontinuidad = 100;

export default function EspacioEstereografia() {
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [discontinuidades, setDiscontinuidades] = usePersistedState<Discontinuidad[]>(
    "estereografia.discontinuidades",
    DISCONTINUIDADES_DEMO
  );
  const [talud, setTalud] = usePersistedState<TaludEstereografia>("estereografia.talud", { dip_grados: 60, dipDirection_grados: 180 });
  const [anguloFriccion_grados, setAnguloFriccion] = usePersistedState("estereografia.anguloFriccion_grados", 30);
  const [toleranciaDireccion_grados, setTolerancia] = usePersistedState("estereografia.toleranciaDireccion_grados", 20);
  const [modoAgregarTocando, setModoAgregarTocando] = useState(false);

  const resultado = useMemo(
    () =>
      analizarEstereografia({
        discontinuidades,
        talud,
        anguloFriccion_grados,
        toleranciaDireccion_grados,
      }),
    [discontinuidades, talud, anguloFriccion_grados, toleranciaDireccion_grados]
  );

  async function handleImportarCSV(archivo: File) {
    const texto = await leerArchivoTabularComoTexto(archivo);
    const nuevas = importarDiscontinuidadesDesdeCSV(texto);
    if (nuevas.length === 0) {
      setMensaje("El archivo debe tener filas 'nombre,dip,direccion_buzamiento'.");
      return;
    }
    setDiscontinuidades(nuevas);
    setMensaje(`${nuevas.length} discontinuidades importadas.`);
  }

  function handleExportarCSV() {
    descargarTexto("discontinuidades.csv", exportarDiscontinuidadesCSV(discontinuidades), "text/csv");
  }

  function handleTocarRed(dip_grados: number, dipDirection_grados: number) {
    contadorDiscontinuidad++;
    const nombre = `J${discontinuidades.length + 1}`;
    setDiscontinuidades((prev) => [
      ...prev,
      { id: `D-${contadorDiscontinuidad}`, nombre, dip_grados: Math.round(dip_grados * 10) / 10, dipDirection_grados: Math.round(dipDirection_grados) },
    ]);
    setMensaje(`${nombre} agregada: dip ${Math.round(dip_grados)}° / dirección ${Math.round(dipDirection_grados)}°.`);
  }

  return (
    <>
      {mensaje && (
        <div
          className="advertencia"
          style={{ margin: "8px 14px 0", cursor: "pointer" }}
          onClick={() => setMensaje(null)}
        >
          {mensaje} (toca para cerrar)
        </div>
      )}

      <main className="app-main">
        <PanelDatosEstereografia
          discontinuidades={discontinuidades}
          onCambiarDiscontinuidades={setDiscontinuidades}
          talud={talud}
          onCambiarTalud={setTalud}
          anguloFriccion_grados={anguloFriccion_grados}
          onCambiarAnguloFriccion={setAnguloFriccion}
          toleranciaDireccion_grados={toleranciaDireccion_grados}
          onCambiarTolerancia={setTolerancia}
          onImportarCSV={handleImportarCSV}
          onExportarCSV={handleExportarCSV}
          oculto={pestana !== "datos"}
        />

        <div className="visor-contenedor" data-oculto={pestana !== "estereograma"}>
          <div className="visor-modo-toggle">
            <button type="button" data-activo={!modoAgregarTocando} onClick={() => setModoAgregarTocando(false)}>
              Ver
            </button>
            <button type="button" data-activo={modoAgregarTocando} onClick={() => setModoAgregarTocando(true)}>
              ✏ Tocar para agregar polo
            </button>
          </div>
          <div className="visor-contenido" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <EstereogramaSVG
              discontinuidades={discontinuidades}
              talud={talud}
              anguloFriccion_grados={anguloFriccion_grados}
              analisis={resultado.analisisPlanoVuelco}
              tamanoPx={460}
              onTocarRed={modoAgregarTocando ? handleTocarRed : undefined}
            />
          </div>
        </div>

        <PanelResultadosEstereografia discontinuidades={discontinuidades} resultado={resultado} oculto={pestana !== "resultados"} />
      </main>

      <nav className="tabs-inferior">
        <button type="button" data-activo={pestana === "datos"} onClick={() => setPestana("datos")}>
          Datos
        </button>
        <button type="button" data-activo={pestana === "estereograma"} onClick={() => setPestana("estereograma")}>
          Estereograma
        </button>
        <button type="button" data-activo={pestana === "resultados"} onClick={() => setPestana("resultados")}>
          Resultados
        </button>
      </nav>
    </>
  );
}
