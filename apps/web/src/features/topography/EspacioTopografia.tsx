import { useMemo, useState } from "react";
import { calcularVolumenCorteRelleno, generarCurvasNivel, triangularSuperficie, type Punto2D, type PuntoTopografico } from "@suite/core";
import { exportarCurvasNivelDXF, exportarSuperficieDXF, importarPuntosDesdeCSV } from "@suite/mining-topography";
import { leerPuntosLAS, type EstadoCapa, type ResultadoLecturaLAS } from "@suite/engine";
import Visor3DTopografia from "./components/Visor3DTopografia.js";
import PanelDatosTopografia from "./components/PanelDatosTopografia.js";
import PanelResultadosTopografia from "./components/PanelResultadosTopografia.js";
import EditorSuperficieReferenciaPlana from "./components/EditorSuperficieReferenciaPlana.js";
import { descargarTexto } from "../../utils/descargar.js";
import { esArchivoLAS, esArchivoLAZ, leerArchivoTabularComoTexto } from "../../utils/leerArchivo.js";
import { generarReferenciaDemo, generarTerrenoDemo } from "../../data/demoTerreno.js";
import { usePersistedState } from "../../hooks/usePersistedState.js";

function resumenLecturaNubeDePuntos(r: ResultadoLecturaLAS): string {
  const partes = [`${r.numeroPuntosOriginal.toLocaleString()} puntos en el archivo`];
  if (r.seFiltroPorTerreno) partes.push(`filtrado a ${r.numeroPuntosCandidatos.toLocaleString()} clasificados como terreno`);
  if (r.puntos.length < r.numeroPuntosCandidatos) partes.push(`decimado a ${r.puntos.length.toLocaleString()} para trabajar en el navegador`);
  return ` (${partes.join(", ")})`;
}

/**
 * Resuelve un archivo importado a puntos {x,y,z} + un resumen para mostrarle al usuario.
 * LAS/LAZ se manejan aparte de CSV/Excel/KML porque decima (nubes de dron pueden traer millones
 * de puntos) y puede filtrar solo terreno — informacion que vale la pena mostrar, no perder
 * silenciosamente. LAZ ademas se importa dinamicamente: arrastra ~90kB de WASM (laz-perf) que no
 * tiene sentido cargar salvo que alguien realmente suba un .laz.
 */
async function resolverPuntosImportados(archivo: File): Promise<{ puntos: PuntoTopografico[]; resumenExtra: string }> {
  if (esArchivoLAS(archivo)) {
    const r = leerPuntosLAS(await archivo.arrayBuffer());
    return { puntos: r.puntos, resumenExtra: resumenLecturaNubeDePuntos(r) };
  }
  if (esArchivoLAZ(archivo)) {
    const { leerPuntosLAZ } = await import("@suite/engine/src/io/lazReader.js");
    const r = await leerPuntosLAZ(await archivo.arrayBuffer());
    return { puntos: r.puntos, resumenExtra: resumenLecturaNubeDePuntos(r) };
  }
  const texto = await leerArchivoTabularComoTexto(archivo);
  return { puntos: importarPuntosDesdeCSV(texto), resumenExtra: "" };
}

type Pestana = "datos" | "3d" | "resultados";
type ModoVisor = "3d" | "editar2d";

export default function EspacioTopografia() {
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [modoVisor, setModoVisor] = useState<ModoVisor>("3d");
  const [capas, setCapas] = useState<EstadoCapa[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [puntosActuales, setPuntosActuales] = usePersistedState<PuntoTopografico[]>("topografia.puntosActuales", () =>
    generarTerrenoDemo()
  );
  const [puntosReferencia, setPuntosReferencia] = usePersistedState<PuntoTopografico[] | null>(
    "topografia.puntosReferencia",
    () => generarReferenciaDemo()
  );
  const [intervaloCurvas_m, setIntervaloCurvas_m] = usePersistedState("topografia.intervaloCurvas_m", 5);
  const [resolucionGrilla_m, setResolucionGrilla_m] = usePersistedState("topografia.resolucionGrilla_m", 2);

  const [poligonoReferencia, setPoligonoReferencia] = usePersistedState<Punto2D[]>("topografia.poligonoReferencia", () =>
    generarReferenciaDemo().map((p) => ({ x: p.x, y: p.y }))
  );
  const [elevacionReferencia_m, setElevacionReferencia_m] = usePersistedState("topografia.elevacionReferencia_m", 108);

  const superficieActual = useMemo(() => triangularSuperficie(puntosActuales), [puntosActuales]);
  const superficieReferencia = useMemo(
    () => (puntosReferencia && puntosReferencia.length >= 3 ? triangularSuperficie(puntosReferencia) : null),
    [puntosReferencia]
  );

  const curvasNivel = useMemo(
    () => generarCurvasNivel({ superficie: superficieActual, intervalo_m: intervaloCurvas_m }),
    [superficieActual, intervaloCurvas_m]
  );

  const resultadoVolumen = useMemo(
    () =>
      superficieReferencia
        ? calcularVolumenCorteRelleno({ superficieActual, superficieDiseno: superficieReferencia, resolucionGrilla_m })
        : null,
    [superficieActual, superficieReferencia, resolucionGrilla_m]
  );

  async function handleImportarActual(archivo: File) {
    const { puntos, resumenExtra } = await resolverPuntosImportados(archivo);
    if (puntos.length < 3) {
      setMensaje("El archivo debe tener al menos 3 puntos x,y,z.");
      return;
    }
    setPuntosActuales(puntos);
    setMensaje(`Levantamiento importado: ${puntos.length} puntos.${resumenExtra}`);
  }

  async function handleImportarReferencia(archivo: File) {
    const { puntos, resumenExtra } = await resolverPuntosImportados(archivo);
    if (puntos.length < 3) {
      setMensaje("El archivo de referencia debe tener al menos 3 puntos x,y,z.");
      return;
    }
    setPuntosReferencia(puntos);
    setMensaje(`Superficie de referencia importada: ${puntos.length} puntos.${resumenExtra}`);
  }

  function handleExportarCurvasDXF() {
    descargarTexto("curvas-nivel.dxf", exportarCurvasNivelDXF(curvasNivel), "application/dxf");
  }

  function handleExportarSuperficieDXF() {
    descargarTexto("superficie.dxf", exportarSuperficieDXF(superficieActual), "application/dxf");
  }

  function handleAplicarPoligonoReferencia() {
    if (poligonoReferencia.length < 3) return;
    setPuntosReferencia(poligonoReferencia.map((p) => ({ x: p.x, y: p.y, z: elevacionReferencia_m })));
    setMensaje(`Superficie de referencia aplicada: ${poligonoReferencia.length} vértices a cota ${elevacionReferencia_m} m.`);
    setModoVisor("3d");
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
        <PanelDatosTopografia
          puntosActuales={puntosActuales}
          puntosReferencia={puntosReferencia}
          intervaloCurvas_m={intervaloCurvas_m}
          resolucionGrilla_m={resolucionGrilla_m}
          onImportarActual={handleImportarActual}
          onImportarReferencia={handleImportarReferencia}
          onQuitarReferencia={() => setPuntosReferencia(null)}
          onCambiarIntervalo={setIntervaloCurvas_m}
          onCambiarResolucion={setResolucionGrilla_m}
          oculto={pestana !== "datos"}
        />

        <div className="visor-contenedor" data-oculto={pestana !== "3d"}>
          <div className="visor-modo-toggle">
            <button type="button" data-activo={modoVisor === "3d"} onClick={() => setModoVisor("3d")}>
              Vista 3D
            </button>
            <button type="button" data-activo={modoVisor === "editar2d"} onClick={() => setModoVisor("editar2d")}>
              ✏ Dibujar referencia 2D
            </button>
          </div>
          <div className="visor-contenido">
            <div style={{ display: modoVisor === "3d" ? "contents" : "none" }}>
              <Visor3DTopografia
                superficie={superficieActual}
                curvasNivel={curvasNivel}
                superficieReferencia={superficieReferencia}
                onCapas={setCapas}
              />
              <div className="capas-leyenda">
                {capas.map((c) => (
                  <div className="item" key={c.id}>
                    <span className="swatch" style={{ background: c.color }} />
                    {c.nombre}
                  </div>
                ))}
              </div>
            </div>
            {modoVisor === "editar2d" && (
              <EditorSuperficieReferenciaPlana
                poligono={poligonoReferencia}
                onCambiarPoligono={setPoligonoReferencia}
                elevacion_m={elevacionReferencia_m}
                onCambiarElevacion={setElevacionReferencia_m}
                onAplicar={handleAplicarPoligonoReferencia}
              />
            )}
          </div>
        </div>

        <PanelResultadosTopografia
          resultadoVolumen={resultadoVolumen}
          numeroCurvas={curvasNivel.length}
          onExportarCurvasDXF={handleExportarCurvasDXF}
          onExportarSuperficieDXF={handleExportarSuperficieDXF}
          oculto={pestana !== "resultados"}
        />
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
