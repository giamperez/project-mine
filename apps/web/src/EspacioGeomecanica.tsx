import { useMemo, useState } from "react";
import {
  calcularEstabilidadPlanar,
  calcularHoekBrown,
  calcularQ,
  calcularRMR,
  gsiDesdeRMR89,
  type AlteracionJunta,
  type CondicionAgua,
  type CondicionDiscontinuidad,
  type EntradaEstabilidadPlanar,
  type FactorAgua,
  type FactorEsfuerzos,
  type NumeroFamiliasJuntas,
  type OrientacionRespectoTalud,
  type RugosidadJunta,
} from "@suite/core";
import type { EstadoCapa } from "@suite/engine";
import PanelDatosGeomecanica from "./components/PanelDatosGeomecanica.js";
import PanelResultadosGeomecanica from "./components/PanelResultadosGeomecanica.js";
import Visor3DGeomecanica from "./components/Visor3DGeomecanica.js";
import { usePersistedState } from "./hooks/usePersistedState.js";

type Pestana = "datos" | "3d" | "resultados";

export interface EntradaGeomecanicaUI {
  // RMR
  resistenciaUCS_MPa: number;
  rqd_pct: number;
  espaciamientoDiscontinuidades_mm: number;
  condicionDiscontinuidad: CondicionDiscontinuidad;
  condicionAgua: CondicionAgua;
  orientacion: OrientacionRespectoTalud;
  // Q
  jn: NumeroFamiliasJuntas;
  jr: RugosidadJunta;
  ja: AlteracionJunta;
  jw: FactorAgua;
  srf: FactorEsfuerzos;
  // Hoek-Brown
  mi: number;
  factorPerturbacion: number;
  pesoUnitarioRoca_kNm3: number;
  gsiManual: number | null;
  // Talud
  alturaTalud_m: number;
  anguloCaraTalud_grados: number;
  anguloPlanoFalla_grados: number;
  usarHoekBrownParaEstabilidad: boolean;
  cohesionManual_kPa: number;
  anguloFriccionManual_grados: number;
}

const ENTRADA_INICIAL: EntradaGeomecanicaUI = {
  resistenciaUCS_MPa: 80,
  rqd_pct: 75,
  espaciamientoDiscontinuidades_mm: 400,
  condicionDiscontinuidad: "rugosa_poco_meteorizada",
  condicionAgua: "humedo",
  orientacion: "regular",
  jn: "tres_familias",
  jr: "rugosa_ondulada",
  ja: "paredes_sanas",
  jw: "flujo_medio",
  srf: "esfuerzo_medio",
  mi: 12,
  factorPerturbacion: 0.7,
  pesoUnitarioRoca_kNm3: 26,
  gsiManual: null,
  alturaTalud_m: 40,
  anguloCaraTalud_grados: 60,
  anguloPlanoFalla_grados: 48,
  usarHoekBrownParaEstabilidad: true,
  cohesionManual_kPa: 50,
  anguloFriccionManual_grados: 30,
};

export default function EspacioGeomecanica() {
  const [pestana, setPestana] = useState<Pestana>("datos");
  const [capas, setCapas] = useState<EstadoCapa[]>([]);
  const [entrada, setEntrada] = usePersistedState<EntradaGeomecanicaUI>("geomecanica.entrada", ENTRADA_INICIAL);

  const rmr = useMemo(
    () =>
      calcularRMR({
        resistenciaUCS_MPa: entrada.resistenciaUCS_MPa,
        rqd_pct: entrada.rqd_pct,
        espaciamientoDiscontinuidades_mm: entrada.espaciamientoDiscontinuidades_mm,
        condicionDiscontinuidad: entrada.condicionDiscontinuidad,
        condicionAgua: entrada.condicionAgua,
        orientacion: entrada.orientacion,
      }),
    [
      entrada.resistenciaUCS_MPa,
      entrada.rqd_pct,
      entrada.espaciamientoDiscontinuidades_mm,
      entrada.condicionDiscontinuidad,
      entrada.condicionAgua,
      entrada.orientacion,
    ]
  );

  const q = useMemo(
    () =>
      calcularQ({
        rqd_pct: entrada.rqd_pct,
        jn: entrada.jn,
        jr: entrada.jr,
        ja: entrada.ja,
        jw: entrada.jw,
        srf: entrada.srf,
      }),
    [entrada.rqd_pct, entrada.jn, entrada.jr, entrada.ja, entrada.jw, entrada.srf]
  );

  const gsiCalculadoDesdeRMR = gsiDesdeRMR89(rmr.rmr);
  const gsiEfectivo = entrada.gsiManual ?? gsiCalculadoDesdeRMR;

  const hoekBrown = useMemo(
    () =>
      calcularHoekBrown({
        gsi: gsiEfectivo,
        mi: entrada.mi,
        resistenciaUCS_MPa: entrada.resistenciaUCS_MPa,
        factorPerturbacion: entrada.factorPerturbacion,
        pesoUnitarioRoca_kNm3: entrada.pesoUnitarioRoca_kNm3,
        alturaTalud_m: entrada.alturaTalud_m,
      }),
    [gsiEfectivo, entrada.mi, entrada.resistenciaUCS_MPa, entrada.factorPerturbacion, entrada.pesoUnitarioRoca_kNm3, entrada.alturaTalud_m]
  );

  const entradaEstabilidad: EntradaEstabilidadPlanar = useMemo(
    () => ({
      alturaTalud_m: entrada.alturaTalud_m,
      anguloCaraTalud_grados: entrada.anguloCaraTalud_grados,
      anguloPlanoFalla_grados: entrada.anguloPlanoFalla_grados,
      pesoUnitarioRoca_kNm3: entrada.pesoUnitarioRoca_kNm3,
      cohesion_kPa: entrada.usarHoekBrownParaEstabilidad ? hoekBrown.cohesionEquivalente_MPa * 1000 : entrada.cohesionManual_kPa,
      anguloFriccion_grados: entrada.usarHoekBrownParaEstabilidad
        ? hoekBrown.anguloFriccionEquivalente_grados
        : entrada.anguloFriccionManual_grados,
    }),
    [
      entrada.alturaTalud_m,
      entrada.anguloCaraTalud_grados,
      entrada.anguloPlanoFalla_grados,
      entrada.pesoUnitarioRoca_kNm3,
      entrada.usarHoekBrownParaEstabilidad,
      entrada.cohesionManual_kPa,
      entrada.anguloFriccionManual_grados,
      hoekBrown,
    ]
  );

  const estabilidad = useMemo(() => calcularEstabilidadPlanar(entradaEstabilidad), [entradaEstabilidad]);

  return (
    <>
      <main className="app-main">
        <PanelDatosGeomecanica
          entrada={entrada}
          onCambiarEntrada={setEntrada}
          gsiCalculadoDesdeRMR={gsiCalculadoDesdeRMR}
          oculto={pestana !== "datos"}
        />

        <div className="visor-contenedor" data-oculto={pestana !== "3d"}>
          <Visor3DGeomecanica entrada={entradaEstabilidad} resultado={estabilidad} onCapas={setCapas} />
          <div className="capas-leyenda">
            {capas.map((c) => (
              <div className="item" key={c.id}>
                <span className="swatch" style={{ background: c.color }} />
                {c.nombre}
              </div>
            ))}
          </div>
        </div>

        <PanelResultadosGeomecanica rmr={rmr} q={q} hoekBrown={hoekBrown} estabilidad={estabilidad} oculto={pestana !== "resultados"} />
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
