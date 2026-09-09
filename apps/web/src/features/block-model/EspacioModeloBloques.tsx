import { useMemo, useState } from "react";
import {
  ajustarVariograma,
  compositarSondaje,
  curvaLeyTonelaje,
  interpolarModeloBloques,
  variogramaExperimental,
  type ColarSondaje,
  type CompositoEnsayo,
  type DefinicionModeloBloques,
  type IntervaloEnsayo,
  type MetodoInterpolacion,
  type ModeloVariograma,
} from "@suite/core";
import { exportarCurvaLeyTonelajeCSV, importarColaresDesdeCSV, importarEnsayosDesdeCSV, type RangoLey } from "@suite/mining-block-model";
import type { LayerManager } from "@suite/engine";
import PanelDatosModeloBloques, { type ParametrosModeloUI } from "./components/PanelDatosModeloBloques.js";
import PanelResultadosModeloBloques from "./components/PanelResultadosModeloBloques.js";
import Visor3DModeloBloques from "./components/Visor3DModeloBloques.js";
import EditorColaresSondaje from "./components/EditorColaresSondaje.js";
import { PanelCapas } from "../../components/shared/index.js";
import { descargarTexto } from "../../utils/descargar.js";
import { leerArchivoTabularComoTexto } from "../../utils/leerArchivo.js";
import { generarSondajesDemo } from "../../data/demoBlockModel.js";
import { usePersistedState } from "../../hooks/usePersistedState.js";

type Pestana = "datos" | "3d" | "resultados";
type ModoVisor = "3d" | "editar2d";

const PARAMETROS_INICIALES: ParametrosModeloUI = {
  longitudComposito_m: 10,
  tamanoBloque_m: 10,
  radioBusqueda_m: 40,
  potencia: 2,
  densidad_ton_m3: 2.7,
  leyCorteVisor: 0.5,
};

/** Define la grilla de bloques automaticamente a partir de la envolvente de los sondajes (mas un margen). */
function definicionAutomatica(colares: ColarSondaje[], tamanoBloque_m: number): DefinicionModeloBloques {
  if (colares.length === 0) {
    return { origen: { x: 0, y: 0, z: 0 }, numeroBloques: { x: 1, y: 1, z: 1 }, tamanoBloque: { x: tamanoBloque_m, y: tamanoBloque_m, z: tamanoBloque_m } };
  }
  const margen = tamanoBloque_m * 2;
  const xMin = Math.min(...colares.map((c) => c.x)) - margen;
  const xMax = Math.max(...colares.map((c) => c.x)) + margen;
  const yMin = Math.min(...colares.map((c) => c.y)) - margen;
  const yMax = Math.max(...colares.map((c) => c.y)) + margen;
  const zMax = Math.max(...colares.map((c) => c.z)) + margen / 2;
  const zMin = Math.min(...colares.map((c) => c.z - c.profundidadTotal_m)) - margen / 2;

  return {
    origen: { x: xMin, y: yMin, z: zMin },
    numeroBloques: {
      x: Math.max(1, Math.ceil((xMax - xMin) / tamanoBloque_m)),
      y: Math.max(1, Math.ceil((yMax - yMin) / tamanoBloque_m)),
      z: Math.max(1, Math.ceil((zMax - zMin) / tamanoBloque_m)),
    },
    tamanoBloque: { x: tamanoBloque_m, y: tamanoBloque_m, z: tamanoBloque_m },
  };
}

export default function EspacioModeloBloques() {
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [modoVisor, setModoVisor] = useState<ModoVisor>("3d");
  const [capasVersion, setCapasVersion] = useState(0);
  const [layerManager, setLayerManager] = useState<LayerManager | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [parametros, setParametros] = usePersistedState<ParametrosModeloUI>("modeloBloques.parametros", PARAMETROS_INICIALES);

  const [colares, setColares] = usePersistedState<ColarSondaje[]>("modeloBloques.colares", () => generarSondajesDemo().colares);
  const [intervalos, setIntervalos] = usePersistedState<IntervaloEnsayo[]>(
    "modeloBloques.intervalos",
    () => generarSondajesDemo().intervalos
  );
  const [metodo, setMetodo] = usePersistedState<MetodoInterpolacion>("modeloBloques.metodo", "idw");
  const [variograma, setVariograma] = usePersistedState<ModeloVariograma>("modeloBloques.variograma", {
    tipo: "esferico",
    pepita: 0,
    meseta: 1,
    alcance_m: 50,
  });

  const compositos = useMemo<CompositoEnsayo[]>(
    () => colares.flatMap((c) => compositarSondaje(c, intervalos, parametros.longitudComposito_m)),
    [colares, intervalos, parametros.longitudComposito_m]
  );

  // Lags del variograma experimental derivados del radio de busqueda: cubre hasta ~2x el radio,
  // en 12 bins, para tener suficientes pares por bin sin necesitar mas controles del usuario.
  const puntosVariogramaExperimental = useMemo(() => {
    const tamanoLag_m = Math.max(parametros.radioBusqueda_m / 6, 0.5);
    return variogramaExperimental(
      compositos.map((c) => ({ x: c.x, y: c.y, z: c.z, valor: c.ley })),
      tamanoLag_m,
      12
    );
  }, [compositos, parametros.radioBusqueda_m]);

  function handleAutoAjustarVariograma() {
    const ajustado = ajustarVariograma(puntosVariogramaExperimental, variograma.tipo);
    if (!ajustado) {
      setMensaje("No hay suficientes datos para ajustar el variograma (se necesitan compositos en al menos 2 rangos de distancia).");
      return;
    }
    setVariograma(ajustado);
    setMensaje(
      `Variograma ajustado: pepita ${ajustado.pepita.toFixed(3)}, meseta ${ajustado.meseta.toFixed(3)}, alcance ${ajustado.alcance_m.toFixed(1)} m.`
    );
  }

  const definicion = useMemo(() => definicionAutomatica(colares, parametros.tamanoBloque_m), [colares, parametros.tamanoBloque_m]);

  const modelo = useMemo(
    () =>
      interpolarModeloBloques({
        compositos,
        definicion,
        metodo,
        potencia: parametros.potencia,
        variograma,
        radioBusqueda_m: parametros.radioBusqueda_m,
        numeroMinimoMuestras: 1,
      }),
    [compositos, definicion, metodo, parametros.potencia, variograma, parametros.radioBusqueda_m]
  );

  const rangoLey: RangoLey = useMemo(() => {
    const leyes = compositos.map((c) => c.ley);
    return leyes.length > 0 ? { min: Math.min(...leyes), max: Math.max(...leyes) } : { min: 0, max: 1 };
  }, [compositos]);

  const cortesTabla = useMemo(() => {
    const pasos = 6;
    const paso = (rangoLey.max - rangoLey.min) / pasos || 0.1;
    return Array.from({ length: pasos + 1 }, (_, i) => Number((rangoLey.min + i * paso).toFixed(3)));
  }, [rangoLey]);

  const curva = useMemo(() => {
    const volumenBloque = parametros.tamanoBloque_m ** 3;
    return curvaLeyTonelaje(modelo.bloques, volumenBloque, parametros.densidad_ton_m3, cortesTabla);
  }, [modelo, parametros.tamanoBloque_m, parametros.densidad_ton_m3, cortesTabla]);

  const bloquesEstimados = modelo.bloques.filter((b) => b.ley !== null).length;

  async function handleImportarColares(archivo: File) {
    const texto = await leerArchivoTabularComoTexto(archivo);
    const nuevos = importarColaresDesdeCSV(texto);
    if (nuevos.length === 0) {
      setMensaje("El archivo de collares debe tener filas 'id,x,y,z,profundidad[,azimut,inclinación]'.");
      return;
    }
    setColares(nuevos);
    setMensaje(`${nuevos.length} collares importados.`);
  }

  async function handleImportarEnsayos(archivo: File) {
    const texto = await leerArchivoTabularComoTexto(archivo);
    const nuevos = importarEnsayosDesdeCSV(texto);
    if (nuevos.length === 0) {
      setMensaje("El archivo de ensayos debe tener filas 'sondajeId,desde,hasta,ley'.");
      return;
    }
    setIntervalos(nuevos);
    setMensaje(`${nuevos.length} intervalos de ensayo importados.`);
  }

  function handleExportarCSV() {
    descargarTexto("curva-ley-tonelaje.csv", exportarCurvaLeyTonelajeCSV(curva), "text/csv");
  }

  function handleCapas() {
    setCapasVersion((v) => v + 1);
  }

  return (
    <>
      {mensaje && (
        <div className="advertencia" style={{ margin: "8px 14px 0", cursor: "pointer" }} onClick={() => setMensaje(null)}>
          {mensaje} (toca para cerrar)
        </div>
      )}

      <main className="app-main">
        <PanelDatosModeloBloques
          parametros={parametros}
          onCambiarParametros={setParametros}
          numeroColares={colares.length}
          numeroIntervalos={intervalos.length}
          numeroCompositos={compositos.length}
          numeroBloquesTotal={modelo.bloques.length}
          onImportarColares={handleImportarColares}
          onImportarEnsayos={handleImportarEnsayos}
          metodo={metodo}
          onCambiarMetodo={setMetodo}
          variograma={variograma}
          onCambiarVariograma={setVariograma}
          variogramaExperimental={puntosVariogramaExperimental}
          onAutoAjustarVariograma={handleAutoAjustarVariograma}
          oculto={pestana !== "datos"}
        />

        <div className="visor-contenedor" data-oculto={pestana !== "3d"}>
          <div className="visor-modo-toggle">
            <button type="button" data-activo={modoVisor === "3d"} onClick={() => setModoVisor("3d")}>
              Vista 3D
            </button>
            <button type="button" data-activo={modoVisor === "editar2d"} onClick={() => setModoVisor("editar2d")}>
              ✏ Ubicar sondajes tocando
            </button>
          </div>
          <div className="visor-contenido">
            <div style={{ display: modoVisor === "3d" ? "contents" : "none" }}>
              <Visor3DModeloBloques
                colares={colares}
                compositos={compositos}
                modelo={modelo}
                leyCorte={parametros.leyCorteVisor}
                rangoLey={rangoLey}
                esKriging={metodo === "kriging"}
                onCapas={handleCapas}
                onGestorCapas={setLayerManager}
              />
              <PanelCapas layers={layerManager} version={capasVersion} />
            </div>
            {modoVisor === "editar2d" && <EditorColaresSondaje colares={colares} onCambiarColares={setColares} />}
          </div>
        </div>

        <PanelResultadosModeloBloques
          curva={curva}
          bloquesEstimados={bloquesEstimados}
          bloquesTotal={modelo.bloques.length}
          onExportarCSV={handleExportarCSV}
          bloques={modelo.bloques}
          volumenBloque_m3={parametros.tamanoBloque_m ** 3}
          densidad_ton_m3={parametros.densidad_ton_m3}
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
