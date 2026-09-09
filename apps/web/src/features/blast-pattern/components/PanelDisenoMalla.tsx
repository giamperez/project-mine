import { useRef } from "react";
import type { EntradaMallaPerforacion, ResultadoMallaPerforacion, TipoRoca } from "@suite/core";
import { TIPOS_ROCA } from "../../../data/presets.js";
import { useExplosivoGlobal } from "../../../hooks/useExplosivoGlobal.js";

function fmtNum(val: number | undefined | null, dec = 2, suf = " m"): string {
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
      {/* 1. Geometría */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </span>
            <span>Geometría del Banco / Malla</span>
          </div>
          <button
            className="btn-seccion-action"
            type="button"
            title="Importar cresta desde archivo DXF"
            onClick={() => inputArchivoRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Importar DXF</span>
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".dxf"
              style={{ display: "none" }}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) onImportarDXF(archivo);
                e.target.value = "";
              }}
            />
          </button>
        </div>
        <div className="panel-seccion-body">
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
        </div>
      </div>

      {/* 2. Taladro y Roca */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </span>
            <span>Taladro y Roca</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="fila-dos">
            <div className="campo">
              <label>Diámetro taladro (mm)</label>
              <input
                type="number"
                min={25}
                value={entrada.diametroMm}
                onChange={(e) => set("diametroMm", Number(e.target.value))}
              />
            </div>
            <div className="campo">
              <label>Densidad roca (g/cm³)</label>
              <input
                type="number"
                step={0.05}
                min={1.5}
                max={4.5}
                value={entrada.densidadRocaGcm3}
                onChange={(e) => set("densidadRocaGcm3", Number(e.target.value))}
              />
            </div>
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
        </div>
      </div>

      {/* 3. Explosivo */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ background: "rgba(249,115,22,0.18)", color: "#f97316" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </span>
            <span>Explosivo (Catálogo Perú)</span>
          </div>
          <span className="panel-seccion-badge" style={{ color: "#f97316", background: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.3)" }}>
            {explosivo.fabricante}
          </span>
        </div>
        <div className="panel-seccion-body">
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              background: "linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.7) 100%)",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(249, 115, 22, 0.2)",
              fontSize: 11,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          >
            <div>
              VOD: <b style={{ color: "#38bdf8" }}>{explosivo.vodMs} m/s</b>
            </div>
            <div>
              P. Det.: <b style={{ color: "#e2e8f0" }}>{explosivo.presionDetonacionKbar} kbar</b>
            </div>
            <div>
              RWS: <b style={{ color: "#10b981" }}>{explosivo.rwsPeso}%</b>
            </div>
            <div>
              Fuerza: <b style={{ color: "#f97316" }}>{explosivo.fuerzaRelativaANFO.toFixed(2)}</b>
            </div>
          </div>

          <div className="fila-dos">
            <div className="campo">
              <label>Densidad (g/cm³)</label>
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
              <label>Fuerza rel. ANFO</label>
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
        </div>
      </div>

      {/* 4. Resultados */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ background: "rgba(56,189,248,0.18)", color: "#38bdf8" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
            </span>
            <span>Resultados de Diseño</span>
          </div>
          <span className="panel-seccion-badge">
            {resultado.taladros.length} taladros
          </span>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato dato-destacado">
              <span>Burden de diseño</span>
              <b style={{ color: "#f97316" }}>{fmtNum(resultado.burdenDiseno_m)}</b>
            </div>
            <div className="dato dato-destacado">
              <span>Espaciamiento</span>
              <b style={{ color: "#38bdf8" }}>{fmtNum(resultado.espaciamiento_m)}</b>
            </div>
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
        </div>
      </div>
    </div>
  );
}
