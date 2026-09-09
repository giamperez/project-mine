import type {
  AlteracionJunta,
  CondicionAgua,
  CondicionDiscontinuidad,
  FactorAgua,
  FactorEsfuerzos,
  NumeroFamiliasJuntas,
  OrientacionRespectoTalud,
  RugosidadJunta,
} from "@suite/core";
import {
  OPCIONES_AGUA_RMR,
  OPCIONES_CONDICION_DISCONTINUIDAD,
  OPCIONES_JA,
  OPCIONES_JN,
  OPCIONES_JR,
  OPCIONES_JW,
  OPCIONES_ORIENTACION,
  OPCIONES_SRF,
} from "../../../data/geomechanicsOptions.js";
import type { EntradaGeomecanicaUI } from "../EspacioGeomecanica.js";

interface Props {
  entrada: EntradaGeomecanicaUI;
  onCambiarEntrada: (nueva: EntradaGeomecanicaUI) => void;
  gsiCalculadoDesdeRMR: number;
  oculto?: boolean;
}

export default function PanelDatosGeomecanica({ entrada, onCambiarEntrada, gsiCalculadoDesdeRMR, oculto }: Props) {
  const set = <K extends keyof EntradaGeomecanicaUI>(campo: K, valor: EntradaGeomecanicaUI[K]) =>
    onCambiarEntrada({ ...entrada, [campo]: valor });

  return (
    <div className="panel-form" data-oculto={oculto}>
      <fieldset>
        <legend>RMR — Bieniawski (1989)</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>UCS roca intacta (MPa)</label>
            <input
              type="number"
              min={0}
              value={entrada.resistenciaUCS_MPa}
              onChange={(e) => set("resistenciaUCS_MPa", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>RQD (%)</label>
            <input type="number" min={0} max={100} value={entrada.rqd_pct} onChange={(e) => set("rqd_pct", Number(e.target.value))} />
          </div>
        </div>
        <div className="campo">
          <label>Espaciamiento de discontinuidades (mm)</label>
          <input
            type="number"
            min={1}
            value={entrada.espaciamientoDiscontinuidades_mm}
            onChange={(e) => set("espaciamientoDiscontinuidades_mm", Number(e.target.value))}
          />
        </div>
        <div className="campo">
          <label>Condición de discontinuidades</label>
          <select
            value={entrada.condicionDiscontinuidad}
            onChange={(e) => set("condicionDiscontinuidad", e.target.value as CondicionDiscontinuidad)}
          >
            {OPCIONES_CONDICION_DISCONTINUIDAD.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Agua subterránea</label>
          <select value={entrada.condicionAgua} onChange={(e) => set("condicionAgua", e.target.value as CondicionAgua)}>
            {OPCIONES_AGUA_RMR.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Orientación de discontinuidades vs. talud</label>
          <select value={entrada.orientacion} onChange={(e) => set("orientacion", e.target.value as OrientacionRespectoTalud)}>
            {OPCIONES_ORIENTACION.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Q — Barton, Lien &amp; Lunde (1974)</legend>
        <p style={{ fontSize: 12, color: "var(--texto-tenue)", margin: "0 0 10px" }}>Usa el mismo RQD ingresado arriba.</p>
        <div className="campo">
          <label>Jn — número de familias de juntas</label>
          <select value={entrada.jn} onChange={(e) => set("jn", e.target.value as NumeroFamiliasJuntas)}>
            {OPCIONES_JN.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Jr — rugosidad de la junta</label>
          <select value={entrada.jr} onChange={(e) => set("jr", e.target.value as RugosidadJunta)}>
            {OPCIONES_JR.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Ja — alteración de la junta</label>
          <select value={entrada.ja} onChange={(e) => set("ja", e.target.value as AlteracionJunta)}>
            {OPCIONES_JA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Jw — factor de reducción por agua</label>
          <select value={entrada.jw} onChange={(e) => set("jw", e.target.value as FactorAgua)}>
            {OPCIONES_JW.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>SRF — factor de reducción por esfuerzos</label>
          <select value={entrada.srf} onChange={(e) => set("srf", e.target.value as FactorEsfuerzos)}>
            {OPCIONES_SRF.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Hoek-Brown (Hoek, Carranza-Torres &amp; Corkum, 2002)</legend>
        <div className="campo">
          <label>GSI {entrada.gsiManual === null ? `(= RMR - 5 = ${gsiCalculadoDesdeRMR})` : "(manual)"}</label>
          <div className="fila-dos">
            <input
              type="number"
              min={0}
              max={100}
              value={entrada.gsiManual ?? gsiCalculadoDesdeRMR}
              onChange={(e) => set("gsiManual", Number(e.target.value))}
            />
            <button className="btn" type="button" onClick={() => set("gsiManual", null)} disabled={entrada.gsiManual === null}>
              Usar RMR-5
            </button>
          </div>
        </div>
        <div className="fila-dos">
          <div className="campo">
            <label>mi (constante de la roca intacta)</label>
            <input type="number" min={1} value={entrada.mi} onChange={(e) => set("mi", Number(e.target.value))} />
          </div>
          <div className="campo">
            <label>D (factor de perturbación, 0-1)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={entrada.factorPerturbacion}
              onChange={(e) => set("factorPerturbacion", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="campo">
          <label>Peso unitario de la roca (kN/m³)</label>
          <input
            type="number"
            min={1}
            value={entrada.pesoUnitarioRoca_kNm3}
            onChange={(e) => set("pesoUnitarioRoca_kNm3", Number(e.target.value))}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Geometría del talud</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Altura del talud (m)</label>
            <input type="number" min={1} value={entrada.alturaTalud_m} onChange={(e) => set("alturaTalud_m", Number(e.target.value))} />
          </div>
          <div className="campo">
            <label>Ángulo de la cara (°)</label>
            <input
              type="number"
              min={1}
              max={89}
              value={entrada.anguloCaraTalud_grados}
              onChange={(e) => set("anguloCaraTalud_grados", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="campo">
          <label>Ángulo del plano de falla (°)</label>
          <input
            type="number"
            min={1}
            max={89}
            value={entrada.anguloPlanoFalla_grados}
            onChange={(e) => set("anguloPlanoFalla_grados", Number(e.target.value))}
          />
        </div>
        <div className="campo">
          <label>
            <input
              type="checkbox"
              checked={entrada.usarHoekBrownParaEstabilidad}
              onChange={(e) => set("usarHoekBrownParaEstabilidad", e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Usar c'/φ' equivalentes de Hoek-Brown
          </label>
        </div>
        {!entrada.usarHoekBrownParaEstabilidad && (
          <div className="fila-dos">
            <div className="campo">
              <label>Cohesión manual (kPa)</label>
              <input
                type="number"
                min={0}
                value={entrada.cohesionManual_kPa}
                onChange={(e) => set("cohesionManual_kPa", Number(e.target.value))}
              />
            </div>
            <div className="campo">
              <label>Ángulo de fricción manual (°)</label>
              <input
                type="number"
                min={0}
                max={89}
                value={entrada.anguloFriccionManual_grados}
                onChange={(e) => set("anguloFriccionManual_grados", Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
