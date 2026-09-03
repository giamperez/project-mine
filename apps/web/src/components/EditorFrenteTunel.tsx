import { useState } from "react";
import { COLOR_ZONA_TUNEL, ETIQUETAS_ZONA_TUNEL, type TaladroTunel, type ZonaTaladroTunel } from "@suite/core";
import EditorPoligono2D from "./EditorPoligono2D.js";

interface Props {
  taladros: TaladroTunel[];
  onCambiarTaladros: (nuevos: TaladroTunel[]) => void;
}

const ORDEN_ZONAS: ZonaTaladroTunel[] = [
  "alivio",
  "cuadrante1",
  "cuadrante2",
  "cuadrante3",
  "cuadrante4",
  "produccion",
  "cuadrador",
  "corona",
  "recorte",
  "arrastre",
];

let contadorTaladroTunel = 0;

const ABREVIATURA_ZONA: Record<ZonaTaladroTunel, string> = {
  alivio: "AL",
  cuadrante1: "C1",
  cuadrante2: "C2",
  cuadrante3: "C3",
  cuadrante4: "C4",
  produccion: "PR",
  cuadrador: "CD",
  corona: "CO",
  recorte: "RC",
  arrastre: "AR",
};

/**
 * Adaptador sobre EditorPoligono2D en modo "puntos libres": cada toque coloca un taladro en la
 * zona seleccionada arriba (mismo lenguaje de zonas y colores que la app de referencia — alivio,
 * cuadrantes 1-4, produccion, cuadradores, corona, recorte/control, arrastres). Arrastrar
 * reposiciona un taladro sin cambiar su zona.
 */
export default function EditorFrenteTunel({ taladros, onCambiarTaladros }: Props) {
  const [zonaActiva, setZonaActiva] = useState<ZonaTaladroTunel>("alivio");

  function crearTaladro(x: number, y: number): TaladroTunel {
    contadorTaladroTunel++;
    return { id: `T${contadorTaladroTunel}`, x, y, zona: zonaActiva };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="editor2d-toolbar">
        <div className="editor2d-modos" style={{ flexWrap: "wrap" }}>
          {ORDEN_ZONAS.map((zona) => (
            <button
              key={zona}
              className="btn"
              type="button"
              data-activo={zonaActiva === zona}
              style={{ borderColor: COLOR_ZONA_TUNEL[zona] }}
              onClick={() => setZonaActiva(zona)}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLOR_ZONA_TUNEL[zona],
                  marginRight: 5,
                }}
              />
              {ETIQUETAS_ZONA_TUNEL[zona]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <EditorPoligono2D<TaladroTunel>
          puntos={taladros}
          onCambiarPuntos={onCambiarTaladros}
          crearPunto={crearTaladro}
          conectado={false}
          etiquetaPunto={(t) => `${ABREVIATURA_ZONA[t.zona]} ${t.id}`}
          colorPunto={(t) => COLOR_ZONA_TUNEL[t.zona]}
        />
      </div>
    </div>
  );
}
