import type { CondicionVia, EntradaAcarreo } from "@suite/core";

interface Props {
  entrada: EntradaAcarreo;
  onCambiarEntrada: (nueva: EntradaAcarreo) => void;
  oculto?: boolean;
}

const OPCIONES_VIA: Array<{ valor: CondicionVia; etiqueta: string }> = [
  { valor: "buena", etiqueta: "Buena (RR≈2%)" },
  { valor: "regular", etiqueta: "Regular (RR≈4%)" },
  { valor: "pobre", etiqueta: "Pobre (RR≈6%)" },
];

export default function PanelDatosAcarreo({ entrada, onCambiarEntrada, oculto }: Props) {
  const set = <K extends keyof EntradaAcarreo>(campo: K, valor: EntradaAcarreo[K]) =>
    onCambiarEntrada({ ...entrada, [campo]: valor });

  return (
    <div className="panel-form" data-oculto={oculto}>
      <fieldset>
        <legend>Ruta</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Distancia unidireccional (m)</label>
            <input
              type="number"
              min={10}
              value={entrada.distanciaUnidireccional_m}
              onChange={(e) => set("distanciaUnidireccional_m", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Pendiente promedio (%)</label>
            <input
              type="number"
              step={0.5}
              value={entrada.pendientePromedio_pct}
              onChange={(e) => set("pendientePromedio_pct", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="campo">
          <label>Condición de la vía</label>
          <select value={entrada.condicionVia} onChange={(e) => set("condicionVia", e.target.value as CondicionVia)}>
            {OPCIONES_VIA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Camión</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Capacidad (t)</label>
            <input
              type="number"
              min={1}
              value={entrada.capacidadCamion_ton}
              onChange={(e) => set("capacidadCamion_ton", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Peso vacío (kg)</label>
            <input
              type="number"
              min={1000}
              value={entrada.pesoVacioCamion_kg}
              onChange={(e) => set("pesoVacioCamion_kg", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="fila-dos">
          <div className="campo">
            <label>Potencia (kW)</label>
            <input
              type="number"
              min={1}
              value={entrada.potenciaCamion_kW}
              onChange={(e) => set("potenciaCamion_kW", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Velocidad máxima (km/h)</label>
            <input
              type="number"
              min={1}
              value={entrada.velocidadMaxima_kmh ?? 60}
              onChange={(e) => set("velocidadMaxima_kmh", Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Carguío</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Capacidad de balde (t)</label>
            <input
              type="number"
              min={0.5}
              value={entrada.capacidadBalde_ton}
              onChange={(e) => set("capacidadBalde_ton", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Ciclo de una baldada (s)</label>
            <input
              type="number"
              min={1}
              value={entrada.tiempoCicloCargador_s}
              onChange={(e) => set("tiempoCicloCargador_s", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="campo">
          <label>Número de cargadores</label>
          <input
            type="number"
            min={1}
            value={entrada.numeroCargadores}
            onChange={(e) => set("numeroCargadores", Number(e.target.value))}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Operación</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Tiempo de descarga (s)</label>
            <input
              type="number"
              min={0}
              value={entrada.tiempoDescarga_s}
              onChange={(e) => set("tiempoDescarga_s", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Tiempo de colas/esperas (s)</label>
            <input
              type="number"
              min={0}
              value={entrada.tiempoColas_s ?? 60}
              onChange={(e) => set("tiempoColas_s", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="campo">
          <label>Número de camiones (vacío = flota óptima)</label>
          <input
            type="number"
            min={1}
            placeholder="óptimo automático"
            value={entrada.numeroCamiones ?? ""}
            onChange={(e) => set("numeroCamiones", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
      </fieldset>
    </div>
  );
}
