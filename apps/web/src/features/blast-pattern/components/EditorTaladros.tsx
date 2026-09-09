import { useMemo, useState } from "react";
import type { Punto2D, Taladro } from "@suite/core";
import { EditorPoligono2D } from "../../../components/shared/index.js";

/** Envoltorio con x,y a nivel superior (requerido por EditorPoligono2D<T extends Punto2D>) sobre
 * un Taladro real, cuya posicion vive anidada en collar/fondo. */
interface PuntoTaladro extends Punto2D {
  taladro: Taladro;
}

interface DefaultsTaladroNuevo {
  cotaCresta: number;
  profundidad_m: number;
  diametroMm: number;
  taco_m: number;
  longitudCarga_m: number;
}

interface Props {
  taladros: Taladro[];
  onCambiarTaladros: (nuevos: Taladro[]) => void;
  onRegenerarGrilla: () => void;
  defaults: DefaultsTaladroNuevo;
  /** true si la grilla actual es una edicion manual (no la generada por formula). */
  esManual: boolean;
}

let contadorTaladroManual = 0;

function aPuntoTaladro(t: Taladro): PuntoTaladro {
  return { x: t.collar.x, y: t.collar.y, taladro: t };
}

/** Reconstruye el Taladro sincronizando collar/fondo con el x,y actual del punto (lo unico que el editor puede cambiar). */
function sincronizarTaladro(p: PuntoTaladro): Taladro {
  return {
    ...p.taladro,
    collar: { ...p.taladro.collar, x: p.x, y: p.y },
    fondo: { ...p.taladro.fondo, x: p.x, y: p.y },
  };
}

/**
 * Adaptador sobre EditorPoligono2D en modo "puntos libres" para editar taladros individuales de
 * la malla ya generada: tocar agrega un taladro suelto (util en bordes irregulares u obstaculos),
 * arrastrar reposiciona uno existente y "Eliminar" lo saca del patron — sin afectar los demas.
 * "Regenerar grilla automatica" descarta toda edicion manual y vuelve al calculo por formula.
 */
export default function EditorTaladros({ taladros, onCambiarTaladros, onRegenerarGrilla, defaults, esManual }: Props) {
  const [profundidadNueva, setProfundidadNueva] = useState(defaults.profundidad_m);

  const puntos = useMemo(() => taladros.map(aPuntoTaladro), [taladros]);

  function crearPuntoTaladro(x: number, y: number): PuntoTaladro {
    contadorTaladroManual++;
    const nuevo: Taladro = {
      id: `M-${contadorTaladroManual}`,
      fila: -1,
      columna: -1,
      collar: { x, y, z: defaults.cotaCresta },
      fondo: { x, y, z: defaults.cotaCresta - profundidadNueva },
      profundidad_m: profundidadNueva,
      diametroMm: defaults.diametroMm,
      taco_m: defaults.taco_m,
      longitudCarga_m: defaults.longitudCarga_m,
    };
    return { x, y, taladro: nuevo };
  }

  function handleCambiarPuntos(nuevos: PuntoTaladro[]) {
    onCambiarTaladros(nuevos.map(sincronizarTaladro));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="editor2d-toolbar">
        <div className="editor2d-modos" style={{ alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Profundidad taladro nuevo (m)</label>
          <input
            type="number"
            style={{
              width: 90,
              minHeight: 34,
              background: "var(--bg-elevado)",
              border: "1px solid var(--borde)",
              borderRadius: 8,
              padding: "4px 8px",
              color: "inherit",
            }}
            value={profundidadNueva}
            onChange={(e) => setProfundidadNueva(Number(e.target.value))}
          />
        </div>
        <div className="editor2d-modos" style={{ alignItems: "center" }}>
          {esManual && <span style={{ fontSize: 12, color: "var(--texto-tenue)" }}>Grilla editada manualmente</span>}
          <button className="btn" type="button" onClick={onRegenerarGrilla} disabled={!esManual}>
            🔄 Regenerar grilla automática
          </button>
        </div>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <EditorPoligono2D<PuntoTaladro>
          puntos={puntos}
          onCambiarPuntos={handleCambiarPuntos}
          crearPunto={crearPuntoTaladro}
          conectado={false}
          etiquetaPunto={(p) => p.taladro.id}
        />
      </div>
    </div>
  );
}
