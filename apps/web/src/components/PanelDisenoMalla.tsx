import { useRef } from "react";
import type { EntradaMallaPerforacion, ResultadoMallaPerforacion, TipoRoca } from "@suite/core";
import { EXPLOSIVOS_PRESET, TIPOS_ROCA } from "../data/presets.js";

interface Props {
  entrada: EntradaMallaPerforacion;
  onCambiarEntrada: (nueva: EntradaMallaPerforacion) => void;
  resultado: ResultadoMallaPerforacion;
  largoRectangulo: number;
  anchoRectangulo: number;
  onCambiarRectangulo: (largo: number, ancho: number) => void;
  onImportarDXF: (archivo: File) => void;
  onExportarDXF: () => void;
  onExportarCSV: () => void;
  onExportarPDF: () => void;
  oculto?: boolean;
}

export default function PanelDisenoMalla({
  entrada,
  onCambiarEntrada,
  resultado,
  largoRectangulo,
  anchoRectangulo,
  onCambiarRectangulo,
  onImportarDXF,
  onExportarDXF,
  onExportarCSV,
  onExportarPDF,
  oculto,
}: Props) {
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EntradaMallaPerforacion>(campo: K, valor: EntradaMallaPerforacion[K]) =>
    onCambiarEntrada({ ...entrada, [campo]: valor });

  const explosivoSeleccionado =
    EXPLOSIVOS_PRESET.find((e) => e.nombre === entrada.explosivo.nombre) ?? EXPLOSIVOS_PRESET[0];

  return (
    <div className="panel-form" data-oculto={oculto}>
      <fieldset>
        <legend>Geometría del banco</legend>
        <div className="fila-dos">
          <div className="campo">
            <label>Largo (cara libre) m</label>
            <input
              type="number"
              min={1}
              value={largoRectangulo}
              onChange={(e) => onCambiarRectangulo(Number(e.target.value), anchoRectangulo)}
            />
          </div>
          <div className="campo">
            <label>Ancho (hacia adentro) m</label>
            <input
              type="number"
              min={1}
              value={anchoRectangulo}
              onChange={(e) => onCambiarRectangulo(largoRectangulo, Number(e.target.value))}
            />
          </div>
        </div>
        <div className="fila-dos">
          <div className="campo">
            <label>Cota de cresta (m)</label>
            <input
              type="number"
              value={entrada.cotaCresta}
              onChange={(e) => set("cotaCresta", Number(e.target.value))}
            />
          </div>
          <div className="campo">
            <label>Altura de banco H (m)</label>
            <input
              type="number"
              min={0.5}
              value={entrada.alturaBanco_m}
              onChange={(e) => set("alturaBanco_m", Number(e.target.value))}
            />
          </div>
        </div>
        <button
          className="btn btn-archivo"
          type="button"
          onClick={() => inputArchivoRef.current?.click()}
        >
          Importar cresta desde DXF
          <input
            ref={inputArchivoRef}
            type="file"
            accept=".dxf"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) onImportarDXF(archivo);
              e.target.value = "";
            }}
          />
        </button>
      </fieldset>

      <fieldset>
        <legend>Taladro y roca</legend>
        <div className="campo">
          <label>Diámetro de taladro (mm)</label>
          <input
            type="number"
            min={25}
            value={entrada.diametroMm}
            onChange={(e) => set("diametroMm", Number(e.target.value))}
          />
        </div>
        <div className="campo">
          <label>Densidad de roca (g/cm³)</label>
          <input
            type="number"
            step={0.05}
            min={1.5}
            max={4.5}
            value={entrada.densidadRocaGcm3}
            onChange={(e) => set("densidadRocaGcm3", Number(e.target.value))}
          />
        </div>
        <div className="campo">
          <label>Tipo de roca (constante c de Langefors)</label>
          <select value={entrada.tipoRoca} onChange={(e) => set("tipoRoca", e.target.value as TipoRoca)}>
            {TIPOS_ROCA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Explosivo</legend>
        <div className="campo">
          <label>Tipo</label>
          <select
            value={explosivoSeleccionado.nombre}
            onChange={(e) => {
              const preset = EXPLOSIVOS_PRESET.find((p) => p.nombre === e.target.value)!;
              set("explosivo", { ...preset });
            }}
          >
            {EXPLOSIVOS_PRESET.map((p) => (
              <option key={p.nombre} value={p.nombre}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fila-dos">
          <div className="campo">
            <label>Densidad carga (g/cm³)</label>
            <input
              type="number"
              step={0.05}
              value={entrada.explosivo.densidadGcm3}
              onChange={(e) => set("explosivo", { ...entrada.explosivo, densidadGcm3: Number(e.target.value) })}
            />
          </div>
          <div className="campo">
            <label>Fuerza rel. ANFO (s)</label>
            <input
              type="number"
              step={0.05}
              value={entrada.explosivo.fuerzaRelativaANFO}
              onChange={(e) =>
                set("explosivo", { ...entrada.explosivo, fuerzaRelativaANFO: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Resultados de diseño <span className="badge">{resultado.taladros.length} taladros</span>
        </legend>
        <div className="resultados">
          <div className="dato">
            <span>Burden Ash</span>
            <b>{resultado.burdenAsh_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Burden máx. Langefors</span>
            <b>{resultado.burdenLangeforsMax_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Burden práctico</span>
            <b>{resultado.burdenLangeforsPractico_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Burden de diseño</span>
            <b>{resultado.burdenDiseno_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Espaciamiento</span>
            <b>{resultado.espaciamiento_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Razón rigidez H/B</span>
            <b>{resultado.razonRigidezHB.toFixed(2)}</b>
          </div>
          <div className="dato">
            <span>Sobreperforación</span>
            <b>{resultado.sobreperforacion_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Prof. de taladro</span>
            <b>{resultado.profundidadTaladro_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Taco</span>
            <b>{resultado.taco_m.toFixed(2)} m</b>
          </div>
          <div className="dato">
            <span>Long. de carga</span>
            <b>{resultado.longitudCarga_m.toFixed(2)} m</b>
          </div>
        </div>
        {resultado.advertencias.length > 0 && (
          <div className="advertencias">
            {resultado.advertencias.map((a, i) => (
              <div className="advertencia" key={i}>
                ⚠ {a}
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <div className="acciones">
        <button className="btn btn-primario" type="button" onClick={onExportarDXF}>
          Exportar DXF
        </button>
        <button className="btn" type="button" onClick={onExportarCSV}>
          Exportar CSV
        </button>
        <button className="btn" type="button" onClick={onExportarPDF}>
          📄 Exportar reporte PDF
        </button>
      </div>
    </div>
  );
}
