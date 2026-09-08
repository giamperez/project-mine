import { useRef } from "react";
import type { EntradaMallaPerforacion, ResultadoMallaPerforacion, TipoRoca } from "@suite/core";
import { TIPOS_ROCA } from "../data/presets.js";
import { useExplosivoGlobal } from "../hooks/useExplosivoGlobal.js";

function fmtNum(val: number | undefined, dec = 2, suf = " m"): string {
  if (val === undefined || val === null || !Number.isFinite(val) || isNaN(val)) {
    return `—${suf}`;
  }
  return `${val.toFixed(dec)}${suf}`;
}

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

  const { explosivo, catalogo, seleccionarPorId, actualizarParametros, propiedadesExplosivoCompat } = useExplosivoGlobal();

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

      {/* Explosivo Sincronizado - Catálogo Perú (EXSA / FAMESA) */}
      <fieldset>
        <legend style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Explosivo Industrial (Catálogo Perú)</span>
          <span style={{ fontSize: 10, color: "#f97316", background: "rgba(249,115,22,0.12)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
            {explosivo.fabricante}
          </span>
        </legend>
        <div className="campo">
          <label>Explosivo seleccionado</label>
          <select
            value={explosivo.id}
            onChange={(e) => {
              const id = e.target.value;
              seleccionarPorId(id);
              const found = catalogo.find((c) => c.id === id);
              if (found) {
                set("explosivo", {
                  nombre: found.nombre,
                  densidadGcm3: found.densidadGcm3,
                  fuerzaRelativaANFO: (found.rwsPeso || 100) / 100,
                });
              }
            }}
          >
            {catalogo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.fabricante}) · VOD {p.vodMs} m/s
              </option>
            ))}
          </select>
        </div>

        {/* Ficha técnica compacta del explosivo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            background: "rgba(7, 12, 22, 0.75)",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid rgba(249, 115, 22, 0.2)",
            fontSize: 11,
            marginBottom: 8,
          }}
        >
          <div>
            VOD: <b style={{ color: "#38bdf8" }}>{explosivo.vodMs} m/s</b>
          </div>
          <div>
            P. Det.: <b style={{ color: "#e2e8f0" }}>{explosivo.presionDetonacionKbar} kbar</b>
          </div>
          <div>
            RWS: <b style={{ color: "#10b981" }}>{explosivo.rwsPeso}% ANFO</b>
          </div>
          <div>
            Fuerza rel. (s): <b style={{ color: "#f97316" }}>{explosivo.fuerzaRelativaANFO.toFixed(2)}</b>
          </div>
        </div>

        <div className="fila-dos">
          <div className="campo">
            <label>Densidad carga (g/cm³)</label>
            <input
              type="number"
              step={0.02}
              min={0.5}
              value={explosivo.densidadGcm3}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                const dens = !isNaN(val) && val > 0 ? val : explosivo.densidadGcm3;
                actualizarParametros({ densidadGcm3: dens });
                set("explosivo", { ...propiedadesExplosivoCompat, densidadGcm3: dens });
              }}
            />
          </div>
          <div className="campo">
            <label>Fuerza rel. ANFO (s)</label>
            <input
              type="number"
              step={0.02}
              min={0.1}
              value={explosivo.fuerzaRelativaANFO}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                const s = !isNaN(val) && val > 0 ? val : explosivo.fuerzaRelativaANFO;
                actualizarParametros({ fuerzaRelativaANFO: s });
                set("explosivo", { ...propiedadesExplosivoCompat, fuerzaRelativaANFO: s });
              }}
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
            <b>{fmtNum(resultado.burdenAsh_m)}</b>
          </div>
          <div className="dato">
            <span>Burden máx. Langefors</span>
            <b>{fmtNum(resultado.burdenLangeforsMax_m)}</b>
          </div>
          <div className="dato">
            <span>Burden práctico</span>
            <b>{fmtNum(resultado.burdenLangeforsPractico_m)}</b>
          </div>
          <div className="dato">
            <span>Burden de diseño</span>
            <b>{fmtNum(resultado.burdenDiseno_m)}</b>
          </div>
          <div className="dato">
            <span>Espaciamiento</span>
            <b>{fmtNum(resultado.espaciamiento_m)}</b>
          </div>
          <div className="dato">
            <span>Razón rigidez H/B</span>
            <b>{fmtNum(resultado.razonRigidezHB, 2, "")}</b>
          </div>
          <div className="dato">
            <span>Sobreperforación</span>
            <b>{fmtNum(resultado.sobreperforacion_m)}</b>
          </div>
          <div className="dato">
            <span>Prof. de taladro</span>
            <b>{fmtNum(resultado.profundidadTaladro_m)}</b>
          </div>
          <div className="dato">
            <span>Taco</span>
            <b>{fmtNum(resultado.taco_m)}</b>
          </div>
          <div className="dato">
            <span>Long. de carga</span>
            <b>{fmtNum(resultado.longitudCarga_m)}</b>
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
