import React, { useState, useRef } from "react";
import { descargarTexto } from "../../utils/descargar.js";
import {
  recolectarDatosProyecto,
  generarOBJ,
  generarSTL,
  generarDXF,
  generarCSV3D,
  generarNamicad3D,
  generarFormatoExclusivoAPK,
  parsearArchivo3D,
  type DatosEscena3D,
} from "../../utils/exportadores3d.js";

export type ModoModal3D = "importar" | "exportar";

export type FormatoExportacion3D = "mine3d" | "obj" | "dxf" | "stl" | "csv" | "namicad3d" | "json";

interface Props {
  abierto: boolean;
  modoInicial?: ModoModal3D;
  soloModo?: ModoModal3D;
  proyectoId: string;
  proyectoNombre: string;
  moduloId: string;
  colorTema?: string;
  onCerrar: () => void;
  onProyectoImportado?: (nombre: string, nuevoId: string, detalles: string) => void;
}

export default function ModalImportarExportar3D({
  abierto,
  modoInicial = "exportar",
  soloModo,
  proyectoId,
  proyectoNombre,
  moduloId,
  colorTema = "#ec4899",
  onCerrar,
  onProyectoImportado,
}: Props) {
  const [modo, setModo] = useState<ModoModal3D>(soloModo || modoInicial);
  const [formatoExp, setFormatoExp] = useState<FormatoExportacion3D>("mine3d");
  const [nombreArchivo, setNombreArchivo] = useState(proyectoNombre || "Modelo_3D");
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<{
    file: File;
    texto: string;
    info: ReturnType<typeof parsearArchivo3D>;
  } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!abierto) return null;

  function notificar(msg: string) {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 3500);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const texto = String(lector.result);
        const ext = file.name.substring(file.name.lastIndexOf("."));
        const info = parsearArchivo3D(texto, ext);
        setArchivoSeleccionado({ file, texto, info });
        setCargando(false);
      } catch {
        setCargando(false);
        notificar("Error al procesar el archivo seleccionado.");
      }
    };
    lector.readAsText(file);
  }

  function procesarImportacion() {
    if (!archivoSeleccionado) return;

    const file = archivoSeleccionado.file;
    const nuevoId = `${moduloId}-${Date.now()}`;
    const nombreBase = file.name.replace(/\.[^.]+$/, "");
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    let detalles = `Formato: ${archivoSeleccionado.info.tipo}`;
    if (archivoSeleccionado.info.verticesCount > 0) {
      detalles += ` • ${archivoSeleccionado.info.verticesCount} vértices`;
    }

    if (onProyectoImportado) {
      onProyectoImportado(nombreBase, nuevoId, detalles);
    }

    notificar(`✓ "${file.name}" importado exitosamente como nuevo proyecto.`);
    setTimeout(() => {
      onCerrar();
    }, 1200);
  }

  function procesarExportacion() {
    setCargando(true);
    const datos = recolectarDatosProyecto(proyectoId, moduloId);
    datos.nombre = nombreArchivo;

    const nombreLimpio = nombreArchivo.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    let contenido = "";
    let mimeType = "text/plain";
    let nombreFinal = `${nombreLimpio}.${formatoExp}`;

    switch (formatoExp) {
      case "mine3d":
        contenido = generarFormatoExclusivoAPK(datos, { id: proyectoId, nombre: nombreArchivo }, moduloId);
        mimeType = "application/octet-stream";
        break;
      case "obj":
        contenido = generarOBJ(datos);
        mimeType = "model/obj";
        break;
      case "dxf":
        contenido = generarDXF(datos);
        mimeType = "application/dxf";
        break;
      case "stl":
        contenido = generarSTL(datos);
        mimeType = "model/stl";
        break;
      case "csv":
        contenido = generarCSV3D(datos);
        mimeType = "text/csv";
        break;
      case "namicad3d":
        contenido = generarNamicad3D(datos, { id: proyectoId, nombre: nombreArchivo });
        mimeType = "application/json";
        break;
      case "json":
        contenido = JSON.stringify(datos, null, 2);
        mimeType = "application/json";
        break;
    }

    descargarTexto(nombreFinal, contenido, mimeType);
    setCargando(false);
    notificar(`✓ Archivo "${nombreFinal}" generado y descargado.`);
  }

  return (
    <div className="modal-overlay-backdrop" onClick={onCerrar}>
      <div className="modal-card-3d-suite" onClick={(e) => e.stopPropagation()}>
        {/* Header con pestañas o título único si soloModo está activo */}
        <div className="modal-3d-header">
          {soloModo ? (
            <div className="modal-3d-title-locked" style={{ color: colorTema }}>
              {soloModo === "importar" ? (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>IMPORTAR ARCHIVO 3D</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>EXPORTAR ARCHIVO 3D</span>
                </>
              )}
            </div>
          ) : (
            <div className="modal-3d-tabs">
              <button
                type="button"
                className={`modal-3d-tab-btn ${modo === "importar" ? "activo" : ""}`}
                style={{
                  color: modo === "importar" ? colorTema : "#94a3b8",
                  borderColor: modo === "importar" ? colorTema : "transparent",
                }}
                onClick={() => {
                  setModo("importar");
                  setArchivoSeleccionado(null);
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                IMPORTAR 3D
              </button>

              <button
                type="button"
                className={`modal-3d-tab-btn ${modo === "exportar" ? "activo" : ""}`}
                style={{
                  color: modo === "exportar" ? colorTema : "#94a3b8",
                  borderColor: modo === "exportar" ? colorTema : "transparent",
                }}
                onClick={() => setModo("exportar")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                EXPORTAR 3D
              </button>
            </div>
          )}

          <button type="button" className="btn-modal-close" onClick={onCerrar}>
            ✕
          </button>
        </div>

        {/* Mensaje de notificación toast si aplica */}
        {mensajeExito && (
          <div className="modal-toast-banner" style={{ borderColor: colorTema, color: "#fff", background: `${colorTema}25` }}>
            {mensajeExito}
          </div>
        )}

        {/* CONTENIDO: PESTAÑA IMPORTAR */}
        {modo === "importar" && (
          <div className="modal-3d-body">
            <p className="modal-3d-desc">
              Carga geometría 3D, mallas, nubes de puntos o archivos mineros para visualizarlos en capas independientes.
            </p>

            {/* Zona de Carga / Dropzone */}
            <div
              className="dropzone-3d-box"
              style={{ borderColor: archivoSeleccionado ? colorTema : "#334155" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".obj,.stl,.dxf,.csv,.xyz,.txt,.dm,.pt,.tr,.las,.laz,.namicad3d,.json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

              <div className="dropzone-icon-circle" style={{ background: `${colorTema}20`, color: colorTema }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>

              {archivoSeleccionado ? (
                <div className="dropzone-file-info">
                  <strong style={{ color: "#fff", fontSize: "14px" }}>{archivoSeleccionado.file.name}</strong>
                  <span style={{ color: colorTema, fontSize: "12px", fontWeight: 600 }}>
                    {archivoSeleccionado.info.tipo} ({(archivoSeleccionado.file.size / 1024).toFixed(1)} KB)
                  </span>
                  {archivoSeleccionado.info.verticesCount > 0 && (
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                      ✓ {archivoSeleccionado.info.verticesCount} vértices / puntos detectados
                    </span>
                  )}
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <strong>Toca aquí para seleccionar un archivo 3D</strong>
                  <span>o arrastra tu archivo a esta ventana</span>
                </div>
              )}
            </div>

            {/* Formatos Soportados Badges */}
            <div className="formatos-chips-container">
              <span className="formato-chip" style={{ borderColor: colorTema, color: "#fff", background: `${colorTema}25` }}>
                🔒 Formato APK (.mine3d)
              </span>
              <span className="formato-chip">OBJ 3D</span>
              <span className="formato-chip">AutoCAD DXF</span>
              <span className="formato-chip">STL Sólido</span>
              <span className="formato-chip">Datamine PT/TR</span>
              <span className="formato-chip">LiDAR LAS/LAZ</span>
              <span className="formato-chip">CSV / XYZ</span>
              <span className="formato-chip">Namicad3D</span>
            </div>

            {archivoSeleccionado && (
              <button
                type="button"
                className="btn-modal-action-primary"
                style={{
                  background: `linear-gradient(135deg, ${colorTema}, ${colorTema}cc)`,
                  boxShadow: `0 6px 20px ${colorTema}50`,
                }}
                onClick={procesarImportacion}
                disabled={cargando}
              >
                {cargando ? "Procesando geometría..." : "CONFIRMAR E IMPORTAR GEOMETRÍA 3D"}
              </button>
            )}
          </div>
        )}

        {/* CONTENIDO: PESTAÑA EXPORTAR */}
        {modo === "exportar" && (
          <div className="modal-3d-body">
            <p className="modal-3d-desc">
              Elige el formato de exportación adecuado para intercambiar con AutoCAD, Leapfrog, Vulcan, Blender o software minero.
            </p>

            <div className="campo-nombre-export">
              <label>Nombre del archivo de salida:</label>
              <input
                type="text"
                value={nombreArchivo}
                onChange={(e) => setNombreArchivo(e.target.value)}
                placeholder="Nombre del archivo"
              />
            </div>

            {/* Grid de Formatos de Exportación */}
            <div className="formatos-export-grid">
              <div
                className={`formato-card-option ${formatoExp === "mine3d" ? "seleccionado" : ""}`}
                style={{
                  borderColor: formatoExp === "mine3d" ? colorTema : "#334155",
                  background: formatoExp === "mine3d" ? `${colorTema}18` : "#090e1a",
                }}
                onClick={() => setFormatoExp("mine3d")}
              >
                <div className="formato-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={colorTema} strokeWidth="2.2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <strong style={{ color: "#fff" }}>Paquete Exclusivo APK (.mine3d)</strong>
                  </div>
                  <span className="formato-tag" style={{ background: `${colorTema}33`, color: colorTema }}>
                    EXCLUSIVO APK / ENCRIPTADO
                  </span>
                </div>
                <p>Formato propietario protegido con checksum criptográfico. Solo puede ser abierto e interpretado por la APK.</p>
              </div>

              <div
                className={`formato-card-option ${formatoExp === "obj" ? "seleccionado" : ""}`}
                style={{ borderColor: formatoExp === "obj" ? colorTema : "#334155" }}
                onClick={() => setFormatoExp("obj")}
              >
                <div className="formato-card-header">
                  <strong>Wavefront 3D (.obj)</strong>
                  <span className="formato-tag">MALLAS</span>
                </div>
                <p>Malla poligonal y caras 3D compatible con Blender, Leapfrog, Vulcan y visualizadores.</p>
              </div>

              <div
                className={`formato-card-option ${formatoExp === "dxf" ? "seleccionado" : ""}`}
                style={{ borderColor: formatoExp === "dxf" ? colorTema : "#334155" }}
                onClick={() => setFormatoExp("dxf")}
              >
                <div className="formato-card-header">
                  <strong>AutoCAD 3D (.dxf)</strong>
                  <span className="formato-tag">CAD / MINA</span>
                </div>
                <p>Líneas, polilíneas 3D, puntos y capas nativas para AutoCAD, Civil 3D y Datamine.</p>
              </div>

              <div
                className={`formato-card-option ${formatoExp === "stl" ? "seleccionado" : ""}`}
                style={{ borderColor: formatoExp === "stl" ? colorTema : "#334155" }}
                onClick={() => setFormatoExp("stl")}
              >
                <div className="formato-card-header">
                  <strong>Stereolithography (.stl)</strong>
                  <span className="formato-tag">SÓLIDOS</span>
                </div>
                <p>Geometría de superficie triangulada estándar para manufactura, sólidos y CAD.</p>
              </div>

              <div
                className={`formato-card-option ${formatoExp === "csv" ? "seleccionado" : ""}`}
                style={{ borderColor: formatoExp === "csv" ? colorTema : "#334155" }}
                onClick={() => setFormatoExp("csv")}
              >
                <div className="formato-card-header">
                  <strong>Coordenadas (.csv)</strong>
                  <span className="formato-tag">TABLA</span>
                </div>
                <p>Vértices Este, Norte, Cota Z y etiquetas para Excel, QGIS o Geoestadística.</p>
              </div>

              <div
                className={`formato-card-option ${formatoExp === "namicad3d" ? "seleccionado" : ""}`}
                style={{ borderColor: formatoExp === "namicad3d" ? colorTema : "#334155" }}
                onClick={() => setFormatoExp("namicad3d")}
              >
                <div className="formato-card-header">
                  <strong>Proyecto (.namicad3d)</strong>
                  <span className="formato-tag">SUITE COMPLETA</span>
                </div>
                <p>Archivo nativo completo con capas, configuraciones y geometría persistente.</p>
              </div>
            </div>

            <button
              type="button"
              className="btn-modal-action-primary"
              style={{
                background: `linear-gradient(135deg, ${colorTema}, ${colorTema}cc)`,
                boxShadow: `0 6px 20px ${colorTema}50`,
                marginTop: "16px",
              }}
              onClick={procesarExportacion}
              disabled={cargando}
            >
              {cargando ? "Generando formato 3D..." : `DESCARGAR EN FORMATO .${formatoExp.toUpperCase()}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
