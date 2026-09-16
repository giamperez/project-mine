import { useState, useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  type TipoMotorTopo,
  type ProyectoTopografico,
  MOTORES_TOPOGRAFICOS,
  calcularCurvaVertical,
  calcularCurvaHorizontal,
  calcularPoligonalCerrada,
  calcularNivelacionCompuesta,
  calcularCoordenadas,
  calcularPendiente,
  calcularAreaPorCoordenadas,
  calcularReplanteoBuzones,
  formatProgresiva,
} from "./motoresTopograficos.js";
import {
  IconoMotor,
  IconoGps,
  IconoReplanteo,
  IconoExportar,
  Icono3D,
  Icono2D,
  IconoGuardar,
  IconoRestaurar,
  IconoCompartir,
  IconoVolver,
  IconoChevronDown,
  IconoDxf,
  IconoCsv,
  IconoGeoJson,
  IconoCad3D,
  IconoPlus,
} from "./components/IconosTopograficos.js";
import { Visor3DTopograficoUniversal } from "./components/Visor3DTopograficoUniversal.js";
import {
  capturarPosicionGps,
  calcularGuiaReplanteo,
  type LecturaGpsActual,
} from "./utils/gpsTopografico.js";
import {
  generarDxfTopografico,
  generarCsvTopografico,
  generarGeoJsonTopografico,
  enviarACad3D,
  descargarArchivo,
} from "./utils/exportadoresTopograficos.js";

interface TallerMotorTopograficoProps {
  proyecto: ProyectoTopografico;
  onVolver: () => void;
  onGuardarProyecto: (p: ProyectoTopografico) => void;
}

export default function TallerMotorTopografico({
  proyecto,
  onVolver,
  onGuardarProyecto,
}: TallerMotorTopograficoProps) {
  const motorInfo = MOTORES_TOPOGRAFICOS.find((m) => m.id === proyecto.motorId) || MOTORES_TOPOGRAFICOS[4]; // Default CV

  const [nombre, setNombre] = useState(proyecto.nombre);
  const [datum, setDatum] = useState(proyecto.datum || "WGS 84");
  const [zonaUtm, setZonaUtm] = useState(proyecto.zonaUtm || "18S");
  const [guardadoStatus, setGuardadoStatus] = useState<"guardado" | "guardando">("guardado");
  const [mensajeToast, setMensajeToast] = useState<string | null>(null);
  const [vista3D, setVista3D] = useState(false);
  const [menuExportarAbierto, setMenuExportarAbierto] = useState(false);
  const [gpsCargando, setGpsCargando] = useState(false);
  const [gpsLectura, setGpsLectura] = useState<LecturaGpsActual | null>(null);
  const [modoReplanteo, setModoReplanteo] = useState(false);
  const [puntoReplanteoIdx, setPuntoReplanteoIdx] = useState(0);

  // Estado de datos según el motor
  const [datosMotor, setDatosMotor] = useState<Record<string, any>>(() => {
    if (proyecto.datosMotor && Object.keys(proyecto.datosMotor).length > 0) {
      return proyecto.datosMotor;
    }
    // Valores iniciales por defecto según motor
    switch (proyecto.motorId) {
      case "CV":
        return {
          progresivaPVI: "1+000.000",
          cotaPVI: 250.0,
          pendienteG1: 4.0,
          pendienteG2: -2.0,
          longitudL: 120.0,
          intervalo: 10.0,
        };
      case "CH":
        return {
          sentido: "Derecha",
          progresivaPI: "1+000.000",
          estePI: 500000.0,
          nortePI: 8660000.0,
          azimutEntrada_deg: 45.0,
          radioR: 120.0,
          deflexionDelta_deg: 38.0,
          intervaloReplanteo: 10.0,
        };
      case "POL":
        return {
          puntoInicial: { este: 345200.0, norte: 8675400.0, cota: 4120.0 },
          azimutInicial_deg: 48.5,
          sentido: "Horario",
          factorAngularC: 20,
          vertices: [
            { estacion: "E-1", anguloObservado_deg: 92.5, distancia_m: 85.4 },
            { estacion: "E-2", anguloObservado_deg: 88.2, distancia_m: 112.6 },
            { estacion: "E-3", anguloObservado_deg: 91.8, distancia_m: 78.9 },
            { estacion: "E-4", anguloObservado_deg: 87.5, distancia_m: 105.1 },
          ],
        };
      case "NIV":
        return {
          cotaInicial: 100.0,
          cotaFinalConocida: 100.0,
          factorCierre: 12,
          filas: [
            { id: "r-1", punto: "PC-01", vistaAtras: 1.5, vistaAdelante: 1.25, distanciaTramo: 100.0 },
            { id: "r-2", punto: "PC-02", vistaAtras: 1.325, vistaAdelante: 1.575, distanciaTramo: 100.0 },
          ],
        };
      case "COO":
        return {
          este1: 500000.0,
          norte1: 8660000.0,
          azimut_deg: 45.0,
          distanciaHorizontal: 100.0,
          este2: 500070.711,
          norte2: 8660070.711,
        };
      case "PEN":
        return {
          progresivaInicial: "0+000.000",
          cotaInicial: 100.0,
          pendientePct: 2.0,
          longitudHorizontal: 100.0,
          intervalo: 10.0,
        };
      case "AREA":
        return {
          puntos: [
            { id: "P1", este: 500000.0, norte: 8660000.0 },
            { id: "P2", este: 500100.0, norte: 8660000.0 },
            { id: "P3", este: 500100.0, norte: 8660080.0 },
            { id: "P4", este: 500000.0, norte: 8660080.0 },
          ],
        };
      case "BUZ":
        return {
          progresivaInicial: "0+000.000",
          cotaTerrenoInicial: 100.0,
          cotaFondoInicial: 98.5,
          buzones: [
            { id: "BZ-01", longitudDesdeAnterior: 30.0, pendienteDescendente: 1.0, cotaTerreno: 99.8, caidaAdicional: 0.0 },
            { id: "BZ-02", longitudDesdeAnterior: 35.0, pendienteDescendente: 1.0, cotaTerreno: 99.45, caidaAdicional: 0.0 },
          ],
        };
      default:
        return {};
    }
  });

  // Guardado automático y actualización
  useEffect(() => {
    setGuardadoStatus("guardando");
    const timeout = setTimeout(() => {
      onGuardarProyecto({
        ...proyecto,
        nombre,
        datum,
        zonaUtm,
        fechaModificacion: new Date().toISOString(),
        datosMotor,
      });
      setGuardadoStatus("guardado");
    }, 400);
    return () => clearTimeout(timeout);
  }, [nombre, datum, zonaUtm, datosMotor]);

  // Cálculo según el motor activo
  const resultados = useMemo(() => {
    switch (proyecto.motorId) {
      case "CV":
        return calcularCurvaVertical(datosMotor as any);
      case "CH":
        return calcularCurvaHorizontal(datosMotor as any);
      case "POL":
        return calcularPoligonalCerrada(datosMotor as any);
      case "NIV":
        return calcularNivelacionCompuesta(datosMotor as any);
      case "COO":
        return calcularCoordenadas(datosMotor as any);
      case "PEN":
        return calcularPendiente(datosMotor as any);
      case "AREA":
        return calcularAreaPorCoordenadas(datosMotor as any);
      case "BUZ":
        return calcularReplanteoBuzones(datosMotor as any);
      default:
        return null;
    }
  }, [proyecto.motorId, datosMotor]);

  function agregarFilaMotor(campo: string, nuevaFila: Record<string, any>) {
    setDatosMotor((prev: any) => ({ ...prev, [campo]: [...(prev[campo] || []), nuevaFila] }));
  }

  function quitarFilaMotor(campo: string, index: number) {
    setDatosMotor((prev: any) => ({
      ...prev,
      [campo]: (prev[campo] || []).filter((_: any, i: number) => i !== index),
    }));
  }

  function actualizarFilaMotor(campo: string, index: number, key: string, value: any) {
    setDatosMotor((prev: any) => {
      const arr = [...(prev[campo] || [])];
      arr[index] = { ...arr[index], [key]: value };
      return { ...prev, [campo]: arr };
    });
  }

  function handleRestaurar() {
    if (confirm("¿Deseas restaurar los valores iniciales predeterminados?")) {
      // Re-initialize
      setDatosMotor({});
      setMensajeToast("Parámetros restaurados a valores iniciales.");
      setTimeout(() => setMensajeToast(null), 3000);
    }
  }

  function handleCompartir() {
    const jsonStr = JSON.stringify({ proyecto, datosMotor, resultados }, null, 2);
    navigator.clipboard?.writeText(jsonStr);
    setMensajeToast("Datos y resultados copiados al portapapeles en formato JSON.");
    setTimeout(() => setMensajeToast(null), 3000);
  }

  function handleGuardarManual() {
    onGuardarProyecto({
      ...proyecto,
      nombre,
      datum,
      zonaUtm,
      fechaModificacion: new Date().toISOString(),
      datosMotor,
    });
    setMensajeToast("Proyecto guardado correctamente.");
    setTimeout(() => setMensajeToast(null), 3000);
  }

  async function handleCapturarGps() {
    setGpsCargando(true);
    try {
      const zonaNum = parseInt(zonaUtm) || 18;
      const lectura = await capturarPosicionGps(zonaNum);
      setGpsLectura(lectura);

      // Inserción o actualización inteligente según el motor
      if (proyecto.motorId === "AREA" || proyecto.motorId === "POL") {
        const campo = proyecto.motorId === "AREA" ? "puntos" : "vertices";
        const filas = datosMotor[campo] || [];
        const n = filas.length + 1;
        agregarFilaMotor(campo, {
          id: `GPS-${String(n).padStart(2, "0")}`,
          punto: `GPS-${String(n).padStart(2, "0")}`,
          estacion: `GPS-${String(n).padStart(2, "0")}`,
          este: lectura.este,
          norte: lectura.norte,
          distancia_m: 20,
          anguloObservado_deg: 90,
        });
      } else if (proyecto.motorId === "COO") {
        setDatosMotor((prev: any) => ({
          ...prev,
          este2: lectura.este,
          norte2: lectura.norte,
        }));
      } else if (proyecto.motorId === "BUZ") {
        const filas = datosMotor.buzones || [];
        const n = filas.length + 1;
        agregarFilaMotor("buzones", {
          id: `BZ-${String(n).padStart(2, "0")}`,
          longitudDesdeAnterior: 30,
          pendienteDescendente: 1.0,
          cotaTerreno: lectura.alt > 0 ? lectura.alt : 100,
          caidaAdicional: 0,
        });
      }

      setMensajeToast(
        `🛰️ GPS fijado: Este=${lectura.este.toFixed(3)}, Norte=${lectura.norte.toFixed(3)} (±${lectura.precisionM.toFixed(1)}m)`
      );
    } catch (err: any) {
      setMensajeToast(`⚠️ ${err.message || "Error al conectar con el sensor GPS."}`);
    } finally {
      setGpsCargando(false);
      setTimeout(() => setMensajeToast(null), 4000);
    }
  }

  function handleExportarDxf() {
    const dxfStr = generarDxfTopografico(proyecto.motorId, datosMotor, resultados, nombre);
    descargarArchivo(dxfStr, `${nombre.replace(/\s+/g, "_")}_3D.dxf`, "application/dxf");
    setMensajeToast("✅ Archivo AutoCAD DXF 3D descargado con capas técnicas.");
    setMenuExportarAbierto(false);
    setTimeout(() => setMensajeToast(null), 3000);
  }

  function handleExportarCsv() {
    const csvStr = generarCsvTopografico(proyecto.motorId, datosMotor, resultados);
    descargarArchivo(csvStr, `${nombre.replace(/\s+/g, "_")}_Puntos.csv`, "text/csv");
    setMensajeToast("✅ Puntos topográficos CSV para Colectora descargados.");
    setMenuExportarAbierto(false);
    setTimeout(() => setMensajeToast(null), 3000);
  }

  function handleExportarGeoJson() {
    const geoStr = generarGeoJsonTopografico(proyecto.motorId, datosMotor, resultados, zonaUtm);
    descargarArchivo(geoStr, `${nombre.replace(/\s+/g, "_")}.geojson`, "application/geo+json");
    setMensajeToast("✅ Archivo GeoJSON para Google Earth / SIG descargado.");
    setMenuExportarAbierto(false);
    setTimeout(() => setMensajeToast(null), 3000);
  }

  function handlePasarACad3D() {
    const total = enviarACad3D(proyecto.motorId, datosMotor, resultados, nombre);
    setMensajeToast(`🚀 ${total} entidades topográficas enviadas al Editor CAD 3D.`);
    setMenuExportarAbierto(false);
    setTimeout(() => setMensajeToast(null), 4000);
  }

  const listaPuntosReplanteo = useMemo(() => {
    if (!resultados) return [];
    const resAny = resultados as any;
    if (proyecto.motorId === "AREA" || proyecto.motorId === "POL") {
      return (resAny.tabla || []).map((t: any, i: number) => ({
        nombre: t.punto || t.estacion || `P${i + 1}`,
        este: Number(t.este) || 0,
        norte: Number(t.norte) || 0,
      }));
    }
    if (proyecto.motorId === "CH") {
      return (resAny.tabla || []).map((t: any) => ({
        nombre: `${t.etiqueta || ""} ${t.progresivaStr}`,
        este: Number(t.este) || 0,
        norte: Number(t.norte) || 0,
      }));
    }
    if (proyecto.motorId === "COO" && resAny.puntosVisor) {
      const { p1, p2Directo } = resAny.puntosVisor;
      return [
        { nombre: "P1 (Base)", este: p1.este, norte: p1.norte },
        { nombre: "P2 (Radiado)", este: p2Directo.este, norte: p2Directo.norte },
      ];
    }
    if (proyecto.motorId === "BUZ") {
      return (resAny.tabla || []).map((t: any) => ({
        nombre: `${t.id} (${t.progresivaStr})`,
        este: (datosMotor.cotaTerrenoInicial ? 500000 : 0) + (t.progresivaNum || 0),
        norte: 8660000,
      }));
    }
    return [];
  }, [proyecto.motorId, resultados, datosMotor]);

  const guiaReplanteo = useMemo(() => {
    if (!gpsLectura || listaPuntosReplanteo.length === 0) return null;
    const target = listaPuntosReplanteo[Math.min(puntoReplanteoIdx, listaPuntosReplanteo.length - 1)];
    if (!target) return null;
    return calcularGuiaReplanteo(gpsLectura, target, 0.2);
  }, [gpsLectura, listaPuntosReplanteo, puntoReplanteoIdx]);

  return (
    <div className="topo-taller-container">
      {/* Cabecera Taller con Acciones Rápidas */}
      <header className="topo-header topo-taller-header">
        <div className="topo-header-left-col">
          <button className="topo-btn-back" onClick={onVolver} title="Volver a Topografía">
            <IconoVolver size={18} />
          </button>
          <div className="topo-header-text">
            <h1 className="topo-header-title">{motorInfo.nombre}</h1>
            <p className="topo-header-subtitle">
              {datum} · Zona {zonaUtm} · cálculo dinámico
            </p>
          </div>
        </div>

        <div className="topo-header-right-actions">
          {/* Botón GPS */}
          <button
            type="button"
            className={`topo-btn-action-pill ${gpsLectura ? "active" : ""}`}
            onClick={handleCapturarGps}
            disabled={gpsCargando}
            title="Capturar coordenadas GPS actuales del dispositivo"
          >
            <IconoGps size={14} />
            {gpsCargando ? "BUSCANDO..." : gpsLectura ? `GPS ±${gpsLectura.precisionM.toFixed(1)}m` : "GPS CAMPO"}
          </button>

          {/* Botón Modo Replanteo HUD si hay puntos */}
          {listaPuntosReplanteo.length > 0 && (
            <button
              type="button"
              className={`topo-btn-action-pill ${modoReplanteo ? "active" : ""}`}
              onClick={() => setModoReplanteo(!modoReplanteo)}
              title="Activar panel de navegación y replanteo de precisión"
            >
              <IconoReplanteo size={14} /> REPLANTEO
            </button>
          )}

          {/* Menú Desplegable Exportar */}
          <div className="topo-export-dropdown-wrapper">
            <button
              type="button"
              className="topo-btn-action-pill highlight"
              onClick={() => setMenuExportarAbierto(!menuExportarAbierto)}
            >
              <IconoExportar size={14} /> EXPORTAR <IconoChevronDown size={11} />
            </button>
            {menuExportarAbierto && (
              <div className="topo-export-dropdown-menu">
                <button type="button" onClick={handleExportarDxf}>
                  <IconoDxf size={15} /> AutoCAD DXF 3D (.dxf)
                </button>
                <button type="button" onClick={handleExportarCsv}>
                  <IconoCsv size={15} /> Colector Topográfico CSV (.csv)
                </button>
                <button type="button" onClick={handleExportarGeoJson}>
                  <IconoGeoJson size={15} /> GeoJSON SIG (.geojson)
                </button>
                <hr className="topo-dropdown-divider" />
                <button type="button" onClick={handlePasarACad3D}>
                  <IconoCad3D size={15} /> Transferir a NAMICAD 3D
                </button>
              </div>
            )}
          </div>

          <div className="topo-header-badge-status">
            <span className="topo-status-dot">●</span> {guardadoStatus.toUpperCase()}
          </div>
        </div>
      </header>

      {mensajeToast && <div className="topo-toast-notification">{mensajeToast}</div>}

      <div className="topo-taller-body">
        <div className="topo-taller-col-left">
          {/* Card 1: PROYECTO ACTIVO */}
          <section className="topo-card topo-card-proyecto-activo">
            <div className="topo-card-header-row">
              <div className="topo-card-tag cyan flex-center">
                <span className="topo-icon-inline">
                  <IconoMotor id={proyecto.motorId} size={16} />
                </span>
                PROYECTO ACTIVO
              </div>
              <span className="topo-motor-pill-badge">{proyecto.motorId}</span>
            </div>
            <p className="topo-card-desc">{motorInfo.subtitulo}</p>

            <div className="topo-form-grid">
              <div className="topo-input-wrapper span-full">
                <label className="topo-label-float">Nombre del proyecto</label>
                <input
                  type="text"
                  className="topo-input-control"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>

              <div className="topo-input-wrapper">
                <label className="topo-label-float">Datum geodésico</label>
                <select
                  className="topo-input-control"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                >
                  <option value="WGS 84">WGS 84 (Mundial)</option>
                  <option value="PSAD56">PSAD56 (Provisional)</option>
                  <option value="SIRGAS">SIRGAS (América del Sur)</option>
                </select>
              </div>

              <div className="topo-input-wrapper">
                <label className="topo-label-float">Zona UTM</label>
                <select
                  className="topo-input-control"
                  value={zonaUtm}
                  onChange={(e) => setZonaUtm(e.target.value)}
                >
                  <option value="17S">Zona 17 Sur (Perú / Ecuador)</option>
                  <option value="18S">Zona 18 Sur (Perú Central / Lima)</option>
                  <option value="19S">Zona 19 Sur (Perú Sur / Bolivia / Chile)</option>
                  <option value="18N">Zona 18 Norte (Colombia / Caribe)</option>
                  <option value="19N">Zona 19 Norte (Venezuela)</option>
                </select>
              </div>
            </div>

            <div className="topo-actions-row">
              <button type="button" className="topo-btn-action" onClick={handleRestaurar}>
                <IconoRestaurar size={12} /> RESTAURAR
              </button>
              <button type="button" className="topo-btn-action" onClick={handleGuardarManual}>
                <IconoGuardar size={12} /> GUARDAR
              </button>
              <button type="button" className="topo-btn-action" onClick={handleCompartir}>
                <IconoCompartir size={12} /> COMPARTIR
              </button>
            </div>
          </section>

          {/* Card 2: DATOS DE CAMPO (Inputs del Motor) */}
          <section className="topo-card topo-card-datos-campo">
            <div className="topo-card-tag green">DATOS DE CAMPO</div>
            <h2 className="topo-card-title">{motorInfo.nombre}</h2>
            <p className="topo-card-desc">{motorInfo.descripcion}</p>

            {/* Renderizado de inputs dinámicos según motor */}
            {proyecto.motorId === "CV" && (
              <div className="topo-form-grid">
                <div className="topo-input-wrapper">
                  <label className="topo-label-float">Progresiva PVI</label>
                  <input
                    type="text"
                    className="topo-input-control"
                    value={datosMotor.progresivaPVI || ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, progresivaPVI: e.target.value })}
                  />
                  <span className="topo-input-subhint">Formato: 1+000.000</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Cota PVI</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.cotaPVI ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, cotaPVI: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Pendiente entrada g1</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.pendienteG1 ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, pendienteG1: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">%</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Pendiente salida g2</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.pendienteG2 ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, pendienteG2: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">%</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Longitud L</label>
                  <input
                    type="number"
                    step="0.1"
                    className="topo-input-control"
                    value={datosMotor.longitudL ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, longitudL: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Intervalo de cálculo</label>
                  <input
                    type="number"
                    step="0.1"
                    className="topo-input-control"
                    value={datosMotor.intervalo ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, intervalo: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>
              </div>
            )}

            {proyecto.motorId === "CH" && (
              <>
                <div className="topo-direccion-curva-wrapper">
                  <label className="topo-label-float static">DIRECCIÓN DE LA CURVA</label>
                  <div className="topo-segmented-control mini">
                    <button
                      type="button"
                      className={`topo-seg-btn ${(datosMotor.sentido || "Derecha") === "Izquierda" ? "active" : ""}`}
                      onClick={() => setDatosMotor({ ...datosMotor, sentido: "Izquierda" })}
                    >
                      Izquierda
                    </button>
                    <button
                      type="button"
                      className={`topo-seg-btn ${(datosMotor.sentido || "Derecha") === "Derecha" ? "active" : ""}`}
                      onClick={() => setDatosMotor({ ...datosMotor, sentido: "Derecha" })}
                    >
                      Derecha
                    </button>
                  </div>
                </div>

                <div className="topo-form-grid">
                  <div className="topo-input-wrapper">
                    <label className="topo-label-float">Progresiva PI</label>
                    <input
                      type="text"
                      className="topo-input-control"
                      value={datosMotor.progresivaPI || ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, progresivaPI: e.target.value })}
                    />
                    <span className="topo-input-subhint">Formato: 1+000.000</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Este PI</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.estePI ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, estePI: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Norte PI</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.nortePI ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, nortePI: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Azimut de entrada</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="topo-input-control"
                      value={datosMotor.azimutEntrada_deg ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, azimutEntrada_deg: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">°</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Radio R</label>
                    <input
                      type="number"
                      step="0.1"
                      className="topo-input-control"
                      value={datosMotor.radioR ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, radioR: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Deflexión Δ</label>
                    <input
                      type="number"
                      step="0.000001"
                      className="topo-input-control"
                      value={datosMotor.deflexionDelta_deg ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, deflexionDelta_deg: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">°</span>
                  </div>

                  <div className="topo-input-wrapper has-unit span-full">
                    <label className="topo-label-float">Intervalo de replanteo</label>
                    <input
                      type="number"
                      step="1"
                      className="topo-input-control"
                      value={datosMotor.intervaloReplanteo ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, intervaloReplanteo: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>
                </div>
              </>
            )}

            {proyecto.motorId === "COO" && (
              <div className="topo-form-grid">
                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Este P1</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.este1 ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, este1: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Norte P1</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.norte1 ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, norte1: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Azimut P1 → P2</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="topo-input-control"
                    value={datosMotor.azimut_deg ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, azimut_deg: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">°</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Distancia P1 → P2</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.distanciaHorizontal ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, distanciaHorizontal: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Este P2 para inverso</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.este2 ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, este2: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Norte P2 para inverso</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.norte2 ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, norte2: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>
              </div>
            )}

            {proyecto.motorId === "POL" && (
              <>
                <div className="topo-form-grid">
                  <div className="topo-input-wrapper span-full">
                    <label className="topo-label-float">Sentido del recorrido</label>
                    <div className="topo-segmented-control">
                      <button
                        type="button"
                        className={`topo-seg-btn ${(datosMotor.sentido || "Horario") === "Horario" ? "active" : ""}`}
                        onClick={() => setDatosMotor({ ...datosMotor, sentido: "Horario" })}
                      >
                        Horario
                      </button>
                      <button
                        type="button"
                        className={`topo-seg-btn ${datosMotor.sentido === "Antihorario" ? "active" : ""}`}
                        onClick={() => setDatosMotor({ ...datosMotor, sentido: "Antihorario" })}
                      >
                        Antihorario
                      </button>
                    </div>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Este inicial</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.puntoInicial?.este ?? ""}
                      onChange={(e) =>
                        setDatosMotor({
                          ...datosMotor,
                          puntoInicial: { ...datosMotor.puntoInicial, este: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Norte inicial</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.puntoInicial?.norte ?? ""}
                      onChange={(e) =>
                        setDatosMotor({
                          ...datosMotor,
                          puntoInicial: { ...datosMotor.puntoInicial, norte: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Cota inicial</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.puntoInicial?.cota ?? ""}
                      onChange={(e) =>
                        setDatosMotor({
                          ...datosMotor,
                          puntoInicial: { ...datosMotor.puntoInicial, cota: parseFloat(e.target.value) || 0 },
                        })
                      }
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Azimut del primer lado</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="topo-input-control"
                      value={datosMotor.azimutInicial_deg ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, azimutInicial_deg: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">°</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Factor angular (C)</label>
                    <input
                      type="number"
                      step="1"
                      className="topo-input-control"
                      value={datosMotor.factorAngularC ?? 20}
                      onChange={(e) => setDatosMotor({ ...datosMotor, factorAngularC: parseFloat(e.target.value) || 20 })}
                    />
                    <span className="topo-unit cyan">″√n</span>
                    <span className="topo-input-subhint">Parámetro del proyecto; no es una norma universal</span>
                  </div>
                </div>

                <SeccionLibretaDigital
                  titulo="LIBRETA DIGITAL"
                  filas={datosMotor.vertices || []}
                  campos={[
                    { key: "estacion", label: "Estación", tipo: "text" },
                    { key: "anguloObservado_deg", label: "Ángulo interior", tipo: "number", unidad: "°", step: "0.0001" },
                    { key: "distancia_m", label: "Distancia siguiente", tipo: "number", unidad: "m", step: "0.001", spanFull: true },
                  ]}
                  onAgregar={() =>
                    agregarFilaMotor("vertices", {
                      estacion: `E-${(datosMotor.vertices?.length || 0) + 1}`,
                      anguloObservado_deg: 90,
                      distancia_m: 0,
                    })
                  }
                  onQuitar={(idx) => quitarFilaMotor("vertices", idx)}
                  onCambiar={(idx, key, val) => actualizarFilaMotor("vertices", idx, key, val)}
                />
              </>
            )}

            {proyecto.motorId === "NIV" && (
              <>
                <div className="topo-form-grid">
                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Cota inicial</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.cotaInicial ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, cotaInicial: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Cota final conocida</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.cotaFinalConocida ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, cotaFinalConocida: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit span-full">
                    <label className="topo-label-float">Factor de cierre</label>
                    <input
                      type="number"
                      step="1"
                      className="topo-input-control"
                      value={datosMotor.factorCierre ?? 12}
                      onChange={(e) => setDatosMotor({ ...datosMotor, factorCierre: parseFloat(e.target.value) || 12 })}
                    />
                    <span className="topo-unit cyan">mm√km</span>
                    <span className="topo-input-subhint">Configurable según especificación del proyecto</span>
                  </div>
                </div>

                <div className="topo-libreta-header-row">
                  <div>
                    <span className="topo-card-tag cyan">LIBRETA DIGITAL</span>
                    <p className="topo-libreta-count">{(datosMotor.filas || []).length} fila(s)</p>
                  </div>
                  <button
                    type="button"
                    className="topo-btn-add-row-green"
                    onClick={() => {
                      const filas = datosMotor.filas || [];
                      const nextNum = filas.length + 1;
                      const nueva = {
                        id: `r-${Date.now()}`,
                        punto: `PC-${nextNum.toString().padStart(2, "0")}`,
                        vistaAtras: 1.0,
                        vistaAdelante: 1.0,
                        distanciaTramo: 100.0,
                      };
                      setDatosMotor({ ...datosMotor, filas: [...filas, nueva] });
                    }}
                  >
                    + AGREGAR FILA
                  </button>
                </div>

                <div className="topo-registros-list">
                  {(datosMotor.filas || []).map((f: any, idx: number) => (
                    <div key={f.id || idx} className="topo-registro-card-item">
                      <div className="topo-registro-header">
                        <span className="topo-registro-title-pink">REGISTRO {(idx + 1).toString().padStart(2, "0")}</span>
                        {(datosMotor.filas || []).length > 1 && (
                          <button
                            type="button"
                            className="topo-btn-quitar-row"
                            onClick={() => {
                              const filtradas = (datosMotor.filas || []).filter((_: any, i: number) => i !== idx);
                              setDatosMotor({ ...datosMotor, filas: filtradas });
                            }}
                          >
                            QUITAR
                          </button>
                        )}
                      </div>

                      <div className="topo-form-grid">
                        <div className="topo-input-wrapper">
                          <label className="topo-label-float">Punto</label>
                          <input
                            type="text"
                            className="topo-input-control"
                            value={f.punto || ""}
                            onChange={(e) => {
                              const nuevas = [...(datosMotor.filas || [])];
                              nuevas[idx] = { ...nuevas[idx], punto: e.target.value };
                              setDatosMotor({ ...datosMotor, filas: nuevas });
                            }}
                          />
                        </div>

                        <div className="topo-input-wrapper has-unit">
                          <label className="topo-label-float">Vista atrás</label>
                          <input
                            type="number"
                            step="0.001"
                            className="topo-input-control"
                            value={f.vistaAtras ?? ""}
                            onChange={(e) => {
                              const nuevas = [...(datosMotor.filas || [])];
                              nuevas[idx] = { ...nuevas[idx], vistaAtras: parseFloat(e.target.value) || 0 };
                              setDatosMotor({ ...datosMotor, filas: nuevas });
                            }}
                          />
                          <span className="topo-unit cyan">m</span>
                        </div>

                        <div className="topo-input-wrapper has-unit">
                          <label className="topo-label-float">Vista adelante</label>
                          <input
                            type="number"
                            step="0.001"
                            className="topo-input-control"
                            value={f.vistaAdelante ?? ""}
                            onChange={(e) => {
                              const nuevas = [...(datosMotor.filas || [])];
                              nuevas[idx] = { ...nuevas[idx], vistaAdelante: parseFloat(e.target.value) || 0 };
                              setDatosMotor({ ...datosMotor, filas: nuevas });
                            }}
                          />
                          <span className="topo-unit cyan">m</span>
                        </div>

                        <div className="topo-input-wrapper has-unit">
                          <label className="topo-label-float">Distancia tramo</label>
                          <input
                            type="number"
                            step="0.001"
                            className="topo-input-control"
                            value={f.distanciaTramo ?? ""}
                            onChange={(e) => {
                              const nuevas = [...(datosMotor.filas || [])];
                              nuevas[idx] = { ...nuevas[idx], distanciaTramo: parseFloat(e.target.value) || 0 };
                              setDatosMotor({ ...datosMotor, filas: nuevas });
                            }}
                          />
                          <span className="topo-unit cyan">m</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {proyecto.motorId === "AREA" && (
              <SeccionLibretaDigital
                titulo="LIBRETA DIGITAL"
                filas={datosMotor.puntos || []}
                campos={[
                  { key: "id", label: "Punto", tipo: "text" },
                  { key: "este", label: "Este", tipo: "number", unidad: "m", step: "0.001" },
                  { key: "norte", label: "Norte", tipo: "number", unidad: "m", step: "0.001" },
                ]}
                onAgregar={() =>
                  agregarFilaMotor("puntos", {
                    id: `P${(datosMotor.puntos?.length || 0) + 1}`,
                    este: 0,
                    norte: 0,
                  })
                }
                onQuitar={(idx) => quitarFilaMotor("puntos", idx)}
                onCambiar={(idx, key, val) => actualizarFilaMotor("puntos", idx, key, val)}
              />
            )}

            {/* Otros motores como PEN, BUZ */}
            {proyecto.motorId === "PEN" && (
              <div className="topo-form-grid">
                <div className="topo-input-wrapper">
                  <label className="topo-label-float">Progresiva inicial</label>
                  <input
                    type="text"
                    className="topo-input-control"
                    value={datosMotor.progresivaInicial || ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, progresivaInicial: e.target.value })}
                  />
                  <span className="topo-input-subhint">Formato: 0+000.000</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Cota inicial</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.cotaInicial ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, cotaInicial: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Pendiente</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.pendientePct ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, pendientePct: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">%</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Longitud horizontal</label>
                  <input
                    type="number"
                    step="0.001"
                    className="topo-input-control"
                    value={datosMotor.longitudHorizontal ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, longitudHorizontal: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>

                <div className="topo-input-wrapper has-unit">
                  <label className="topo-label-float">Intervalo</label>
                  <input
                    type="number"
                    step="1"
                    className="topo-input-control"
                    value={datosMotor.intervalo ?? ""}
                    onChange={(e) => setDatosMotor({ ...datosMotor, intervalo: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="topo-unit cyan">m</span>
                </div>
              </div>
            )}

            {proyecto.motorId === "BUZ" && (
              <>
                <div className="topo-form-grid">
                  <div className="topo-input-wrapper">
                    <label className="topo-label-float">Progresiva inicial</label>
                    <input
                      type="text"
                      className="topo-input-control"
                      value={datosMotor.progresivaInicial || ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, progresivaInicial: e.target.value })}
                    />
                    <span className="topo-input-subhint">Formato: 0+000.000</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Cota terreno inicial</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.cotaTerrenoInicial ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, cotaTerrenoInicial: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>

                  <div className="topo-input-wrapper has-unit">
                    <label className="topo-label-float">Cota fondo inicial</label>
                    <input
                      type="number"
                      step="0.001"
                      className="topo-input-control"
                      value={datosMotor.cotaFondoInicial ?? ""}
                      onChange={(e) => setDatosMotor({ ...datosMotor, cotaFondoInicial: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="topo-unit cyan">m</span>
                  </div>
                </div>

                <SeccionLibretaDigital
                  titulo="LIBRETA DIGITAL"
                  filas={datosMotor.buzones || []}
                  campos={[
                    { key: "id", label: "Buzón", tipo: "text" },
                    { key: "longitudDesdeAnterior", label: "Longitud desde anterior", tipo: "number", unidad: "m", step: "0.001" },
                    { key: "pendienteDescendente", label: "Pendiente descendente", tipo: "number", unidad: "%", step: "0.001" },
                    { key: "cotaTerreno", label: "Cota terreno", tipo: "number", unidad: "m", step: "0.001" },
                    { key: "caidaAdicional", label: "Caída adicional", tipo: "number", unidad: "m", step: "0.001" },
                  ]}
                  onAgregar={() => {
                    const n = (datosMotor.buzones?.length || 0) + 1;
                    agregarFilaMotor("buzones", {
                      id: `BZ-${String(n).padStart(2, "0")}`,
                      longitudDesdeAnterior: 30,
                      pendienteDescendente: 1.0,
                      cotaTerreno: (datosMotor.cotaTerrenoInicial || 100) - n * 0.3,
                      caidaAdicional: 0,
                    });
                  }}
                  onQuitar={(idx) => quitarFilaMotor("buzones", idx)}
                  onCambiar={(idx, key, val) => actualizarFilaMotor("buzones", idx, key, val)}
                />
              </>
            )}
          </section>

          {/* Cuadrícula de KPIs y Resultados (Screenshot 5) */}
          {renderKPIs(proyecto.motorId, resultados)}
        </div>

        <div className="topo-taller-col-right">
          {/* HUD de Replanteo de Precisión GPS (si está activo) */}
          {modoReplanteo && (
            <section className="topo-card topo-card-replanteo-hud">
              <div className="topo-card-header-row">
                <div>
                  <div className="topo-card-tag pink">REPLANTEO EN TIEMPO REAL</div>
                  <h3 className="topo-card-title">Navegación al punto de diseño</h3>
                </div>
                <button
                  type="button"
                  className="topo-btn-cerrar-hud"
                  onClick={() => setModoReplanteo(false)}
                >
                  ✕ CERRAR
                </button>
              </div>

              <div className="topo-replanteo-grid">
                <div className="topo-replanteo-selector-col">
                  <label className="topo-label-float">Punto Objetivo a Replantear</label>
                  <select
                    className="topo-input-control"
                    value={puntoReplanteoIdx}
                    onChange={(e) => setPuntoReplanteoIdx(parseInt(e.target.value) || 0)}
                  >
                    {listaPuntosReplanteo.map((pt: any, i: number) => (
                      <option key={i} value={i}>
                        {pt.nombre} · (E: {pt.este.toFixed(1)}, N: {pt.norte.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="topo-replanteo-status-box">
                  {guiaReplanteo ? (
                    <div className={`topo-replanteo-gauge ${guiaReplanteo.enTolerancia ? "en-tolerancia" : ""}`}>
                      <div className="topo-replanteo-dist-val">
                        {guiaReplanteo.distanciaHorizontalM.toFixed(3)} m
                      </div>
                      <div className="topo-replanteo-dist-label">
                        {guiaReplanteo.enTolerancia ? "EN TOLERANCIA TOPOGRÁFICA" : `Rumbo ${guiaReplanteo.rumboStr}`}
                      </div>
                      <div className="topo-replanteo-deltas">
                        <span>ΔE: {guiaReplanteo.deltaEsteM >= 0 ? `+${guiaReplanteo.deltaEsteM.toFixed(3)}` : guiaReplanteo.deltaEsteM.toFixed(3)}m</span>
                        <span>ΔN: {guiaReplanteo.deltaNorteM >= 0 ? `+${guiaReplanteo.deltaNorteM.toFixed(3)}` : guiaReplanteo.deltaNorteM.toFixed(3)}m</span>
                      </div>
                    </div>
                  ) : (
                    <div className="topo-empty-hint">
                      {gpsLectura ? "Calculando navegación geodésica..." : "Activa 'GPS CAMPO' para iniciar guía de replanteo."}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Card 3: VISUALIZACIÓN TÉCNICA (Gráfico interactivo 2D / Modelo 3D Universal) */}
          <section className="topo-card topo-card-grafico">
            <div className="topo-card-header-row" style={{ marginBottom: 12 }}>
              <div>
                <div className="topo-card-tag cyan">VISUALIZACIÓN TÉCNICA</div>
                <h2 className="topo-card-title">Vista dinámica</h2>
                <p className="topo-card-desc">El gráfico se reconstruye con cada cambio y se ajusta automáticamente a la geometría.</p>
              </div>

              {/* Selector Universal 2D Vectorial vs 3D Modelo Pro */}
              <div className="topo-segmented-control mini">
                <button
                  type="button"
                  className={!vista3D ? "active" : ""}
                  onClick={() => setVista3D(false)}
                >
                  <Icono2D size={12} /> 2D Vectorial
                </button>
                <button
                  type="button"
                  className={vista3D ? "active" : ""}
                  onClick={() => setVista3D(true)}
                >
                  <Icono3D size={12} /> 3D Modelo Pro
                </button>
              </div>
            </div>

            <div className="topo-svg-canvas-wrapper">
              {vista3D ? (
                <Visor3DTopograficoUniversal motorId={proyecto.motorId} datos={datosMotor} resultados={resultados} />
              ) : (
                <VisorDinamicoSVG motorId={proyecto.motorId} datos={datosMotor} resultados={resultados} />
              )}
            </div>
          </section>

          {/* Card 4: TABLA TÉCNICA */}
          <section className="topo-card topo-card-tabla">
            <div className="topo-card-tag purple">TABLA TÉCNICA</div>
            <div className="topo-table-responsive-container">
              {renderTablaTecnica(proyecto.motorId, resultados)}
            </div>
          </section>

          {/* Disclaimer / Aviso legal técnico inferior */}
          <div className="topo-disclaimer-card">
            <div className="topo-disclaimer-icon">i</div>
            <p className="topo-disclaimer-text">
              NAMICAD realiza cálculo y control preliminar. Antes del replanteo, confirme unidades, orientación, datum, calibración del equipo y tolerancias contractuales con el responsable topográfico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// COMPONENTES AUXILIARES: KPI CARDS
// -------------------------------------------------------------------------------------------------
function renderKPIs(motorId: TipoMotorTopo, res: any) {
  if (!res) return null;

  if (motorId === "CV") {
    return (
      <section className="topo-card topo-card-resultados-curva-vertical">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag cyan">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Curva vertical parabólica</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="4.5"
                strokeDasharray="163 163"
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                100
              </text>
              <text x="32" y="44" fill="#38bdf8" fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-aviso-banner-yellow">
          <span className="topo-aviso-icon">!</span>
          <span className="topo-aviso-text">
            La longitud debe validarse con los criterios de visibilidad, comodidad y drenaje aplicables al proyecto.
          </span>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">PVC</span>
            <span className="topo-kpi-val">{res.pvcProgStr} · {res.pvcCota.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">PVI</span>
            <span className="topo-kpi-val">{res.pviProgStr} · {res.pviCota.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">PVT</span>
            <span className="topo-kpi-val">{res.pvtProgStr} · {res.pvtCota.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">DIFERENCIA ALGEBRAICA A</span>
            <span className="topo-kpi-val">{res.diferenciaA >= 0 ? `+${res.diferenciaA.toFixed(3)}` : res.diferenciaA.toFixed(3)} %</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">PARÁMETRO K</span>
            <span className="topo-kpi-val">{res.parametroK.toFixed(3)} m/%</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">TIPO</span>
            <span className="topo-kpi-val">{res.tipo}</span>
          </div>

          <div className="topo-kpi-card cyan span-full">
            <span className="topo-kpi-label">PUNTO CRÍTICO</span>
            <span className="topo-kpi-val">{res.puntoCriticoProgStr} · {res.puntoCriticoCota.toFixed(3)} m</span>
          </div>
        </div>
      </section>
    );
  }

  if (motorId === "CH") {
    return (
      <section className="topo-card topo-card-resultados-curva-horizontal">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag green">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Curva circular simple</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#34d399"
                strokeWidth="4.5"
                strokeDasharray="163 163"
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                100
              </text>
              <text x="32" y="44" fill="#34d399" fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-aviso-banner-yellow">
          <span className="topo-aviso-icon">!</span>
          <span className="topo-aviso-text">
            La tabla geométrica no reemplaza la verificación del radio, peralte y visibilidad exigidos por el proyecto vial o minero.
          </span>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">PC</span>
            <span className="topo-kpi-val">{res.pcProgStr}</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">PI</span>
            <span className="topo-kpi-val">{res.piProgStr}</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">PT</span>
            <span className="topo-kpi-val">{res.ptProgStr}</span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">TANGENTE T</span>
            <span className="topo-kpi-val">{res.T.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">LONGITUD L</span>
            <span className="topo-kpi-val">{res.L.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">CUERDA LARGA</span>
            <span className="topo-kpi-val">{res.CL.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">EXTERNA</span>
            <span className="topo-kpi-val">{res.E.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">ORDENADA MEDIA</span>
            <span className="topo-kpi-val">{res.M.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card purple span-full">
            <span className="topo-kpi-label">CONTROL GEOMÉTRICO PT</span>
            <span className="topo-kpi-val">{(res.controlGeometricoPT || 0).toFixed(6)} m</span>
          </div>
        </div>
      </section>
    );
  }

  if (motorId === "COO") {
    return (
      <section className="topo-card topo-card-resultados-coordenadas">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag cyan">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Problema directo e inverso</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={res.porcentajeControl >= 90 ? "#34d399" : "#fbbf24"}
                strokeWidth="4.5"
                strokeDasharray={`${(res.porcentajeControl / 100) * 163} 163`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                {res.porcentajeControl}
              </text>
              <text x="32" y="44" fill={res.porcentajeControl >= 90 ? "#34d399" : "#fbbf24"} fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">ESTE CALCULADO P2</span>
            <span className="topo-kpi-val">{res.esteCalculadoP2.toFixed(3)}</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">NORTE CALCULADO P2</span>
            <span className="topo-kpi-val">{res.norteCalculadoP2.toFixed(3)}</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">Δ ESTE</span>
            <span className="topo-kpi-val">{res.deltaEste >= 0 ? `+${res.deltaEste.toFixed(3)}` : res.deltaEste.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">Δ NORTE</span>
            <span className="topo-kpi-val">{res.deltaNorte >= 0 ? `+${res.deltaNorte.toFixed(3)}` : res.deltaNorte.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">DISTANCIA INVERSA</span>
            <span className="topo-kpi-val">{res.distanciaInversa.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">AZIMUT INVERSO</span>
            <span className="topo-kpi-val">{res.azimutInversoDeg.toFixed(6)}°</span>
          </div>

          <div className="topo-kpi-card cyan span-full">
            <span className="topo-kpi-label">RUMBO INVERSO</span>
            <span className="topo-kpi-val">{res.rumboInverso}</span>
          </div>
        </div>
      </section>
    );
  }

  if (motorId === "POL") {
    return (
      <div className="topo-kpi-grid">
        <div className="topo-kpi-card green">
          <span className="topo-kpi-label">PRECISIÓN DE CIERRE</span>
          <span className="topo-kpi-val">{res.precision}</span>
        </div>
        <div className="topo-kpi-card purple">
          <span className="topo-kpi-label">ERROR LINEAL</span>
          <span className="topo-kpi-val">{res.errorCierreLineal.toFixed(4)} m</span>
        </div>
        <div className="topo-kpi-card yellow">
          <span className="topo-kpi-label">PERÍMETRO</span>
          <span className="topo-kpi-val">{res.perimetro.toFixed(2)} m</span>
        </div>
        <div className="topo-kpi-card pink">
          <span className="topo-kpi-label">ÁREA CALCULADA</span>
          <span className="topo-kpi-val">{res.areaM2.toFixed(2)} m²</span>
        </div>
        <div className="topo-kpi-card green">
          <span className="topo-kpi-label">ERROR ANGULAR</span>
          <span className="topo-kpi-val">
            {res.errorAngularSeg >= 0 ? `+${res.errorAngularSeg.toFixed(1)}` : res.errorAngularSeg.toFixed(1)}″
          </span>
        </div>
        <div className="topo-kpi-card cyan">
          <span className="topo-kpi-label">TOLERANCIA (C√n)</span>
          <span className="topo-kpi-val">±{res.toleranciaAngularSeg.toFixed(1)}″ · {res.cumpleToleranciaAngular ? "CUMPLE" : "EXCEDE"}</span>
        </div>
      </div>
    );
  }

  if (motorId === "NIV") {
    return (
      <section className="topo-card topo-card-resultados-nivelacion">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag green">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Nivelación compensada por distancia</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={res.cumpleTolerancia ? "#34d399" : "#f43f5e"}
                strokeWidth="4.5"
                strokeDasharray={`${(res.porcentajeControl / 100) * 163} 163`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                {res.porcentajeControl}
              </text>
              <text x="32" y="44" fill={res.cumpleTolerancia ? "#34d399" : "#f43f5e"} fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">Σ VISTA ATRÁS</span>
            <span className="topo-kpi-val">{res.sumVistaAtras.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">Σ VISTA ADELANTE</span>
            <span className="topo-kpi-val">{res.sumVistaAdelante.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">COTA CALCULADA</span>
            <span className="topo-kpi-val">{res.cotaCalculada.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">COTA CONOCIDA</span>
            <span className="topo-kpi-val">{res.cotaConocida.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">ERROR DE CIERRE</span>
            <span className="topo-kpi-val">{res.errorCierreMmStr}</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">TOLERANCIA CONFIGURADA</span>
            <span className="topo-kpi-val">{res.toleranciaMmStr}</span>
          </div>

          <div className="topo-kpi-card cyan span-full">
            <span className="topo-kpi-label">DISTANCIA NIVELADA</span>
            <span className="topo-kpi-val">{res.distanciaTotalM.toFixed(3)} m</span>
          </div>
        </div>
      </section>
    );
  }

  if (motorId === "BUZ") {
    return (
      <section className="topo-card topo-card-resultados-buzones">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag purple">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Cotas de fondo de buzones</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#c084fc"
                strokeWidth="4.5"
                strokeDasharray="163 163"
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                100
              </text>
              <text x="32" y="44" fill="#c084fc" fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">BUZONES CALCULADOS</span>
            <span className="topo-kpi-val">{res.buzonesCalculados}</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">LONGITUD TOTAL</span>
            <span className="topo-kpi-val">{res.longitudTotal.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">COTA DE FONDO INICIAL</span>
            <span className="topo-kpi-val">{res.cotaFondoInicial.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">COTA DE FONDO FINAL</span>
            <span className="topo-kpi-val">{res.cotaFondoFinal.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">DESNIVEL ACUMULADO</span>
            <span className="topo-kpi-val">{res.desnivelAcumulado.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">PROFUNDIDAD FINAL</span>
            <span className="topo-kpi-val">{res.profundidadFinal.toFixed(3)} m</span>
          </div>
        </div>
      </section>
    );
  }

  if (motorId === "PEN") {
    return (
      <section className="topo-card topo-card-resultados-pendiente">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag yellow">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Rasante de pendiente constante</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="4.5"
                strokeDasharray="163 163"
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                100
              </text>
              <text x="32" y="44" fill="#fbbf24" fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">PENDIENTE</span>
            <span className="topo-kpi-val">
              {res.pendientePct >= 0 ? `+${res.pendientePct.toFixed(3)}` : res.pendientePct.toFixed(3)} %
            </span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">ÁNGULO</span>
            <span className="topo-kpi-val">
              {res.anguloDeg >= 0 ? `+${res.anguloDeg.toFixed(6)}` : res.anguloDeg.toFixed(6)}°
            </span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">DESNIVEL</span>
            <span className="topo-kpi-val">
              {res.desnivelTotal >= 0 ? `+${res.desnivelTotal.toFixed(3)}` : res.desnivelTotal.toFixed(3)} m
            </span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">DISTANCIA HORIZONTAL</span>
            <span className="topo-kpi-val">{res.distanciaHorizontal.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">DISTANCIA INCLINADA</span>
            <span className="topo-kpi-val">{res.distanciaInclinada.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">COTA FINAL</span>
            <span className="topo-kpi-val">{res.cotaFinal.toFixed(3)} m</span>
          </div>
        </div>
      </section>
    );
  }

  if (motorId === "AREA") {
    return (
      <section className="topo-card topo-card-resultados-area">
        <div className="topo-card-header-row">
          <div>
            <div className="topo-card-tag green">RESULTADOS EN TIEMPO REAL</div>
            <h3 className="topo-card-title">Polígono por coordenadas</h3>
            <p className="topo-card-desc">Actualizados al modificar cualquier entrada.</p>
          </div>
          <div className="topo-gauge-circle-wrap">
            <svg viewBox="0 0 64 64" width="56" height="56" className="topo-gauge-svg">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#34d399"
                strokeWidth="4.5"
                strokeDasharray="163 163"
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="30" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                100
              </text>
              <text x="32" y="44" fill="#34d399" fontSize="7.5" fontWeight="800" textAnchor="middle" letterSpacing="0.06em">
                CONTROL
              </text>
            </svg>
          </div>
        </div>

        <div className="topo-kpi-grid">
          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">ÁREA</span>
            <span className="topo-kpi-val">{res.areaM2.toFixed(3)} m²</span>
          </div>

          <div className="topo-kpi-card cyan">
            <span className="topo-kpi-label">HECTÁREAS</span>
            <span className="topo-kpi-val">{res.areaHa.toFixed(6)} ha</span>
          </div>

          <div className="topo-kpi-card green">
            <span className="topo-kpi-label">PERÍMETRO</span>
            <span className="topo-kpi-val">{res.perimetro.toFixed(3)} m</span>
          </div>

          <div className="topo-kpi-card purple">
            <span className="topo-kpi-label">CENTROIDE ESTE</span>
            <span className="topo-kpi-val">{res.centroideEste.toFixed(3)}</span>
          </div>

          <div className="topo-kpi-card yellow">
            <span className="topo-kpi-label">CENTROIDE NORTE</span>
            <span className="topo-kpi-val">{res.centroideNorte.toFixed(3)}</span>
          </div>

          <div className="topo-kpi-card pink">
            <span className="topo-kpi-label">RECORRIDO</span>
            <span className="topo-kpi-val">{res.recorrido}</span>
          </div>
        </div>
      </section>
    );
  }

  return null;
}

// -------------------------------------------------------------------------------------------------
// COMPONENTES AUXILIARES: TABLA TÉCNICA
// -------------------------------------------------------------------------------------------------
function renderTablaTecnica(motorId: TipoMotorTopo, res: any) {
  if (!res) return <p className="topo-empty-hint">Sin datos calculados.</p>;

  if (motorId === "CV") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Progresiva</th>
            <th>x</th>
            <th>Tangente</th>
            <th>Corrección</th>
            <th>Cota curva</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((row: any, i: number) => {
            const isHighlight = row.etiqueta !== undefined;
            return (
              <tr key={i} className={isHighlight ? "highlight-row" : ""}>
                <td>
                  {row.progresivaStr}
                  {row.etiqueta && <span className="topo-tag-badge">{row.etiqueta}</span>}
                </td>
                <td>{row.x.toFixed(3)}</td>
                <td>{row.cotaTangente.toFixed(3)}</td>
                <td>{row.correccion >= 0 ? `+${row.correccion.toFixed(4)}` : row.correccion.toFixed(4)}</td>
                <td className="font-bold">{row.cotaCurva.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (motorId === "CH") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Progresiva</th>
            <th>Arco</th>
            <th>Deflexión</th>
            <th>Cuerda</th>
            <th>Este</th>
            <th>Norte</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((row: any, i: number) => {
            const isHighlight = row.etiqueta === "PC" || row.etiqueta === "PT";
            return (
              <tr key={i} className={isHighlight ? "highlight-row" : ""}>
                <td>
                  {row.progresivaStr}
                  {row.etiqueta && <span className="topo-tag-badge">{row.etiqueta}</span>}
                </td>
                <td>{row.arco.toFixed(3)}</td>
                <td className="text-cyan">{row.deflexionStr}</td>
                <td>{row.cuerda.toFixed(3)}</td>
                <td>{row.este.toFixed(3)}</td>
                <td>{row.norte.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (motorId === "NIV") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th>VA</th>
            <th>VD</th>
            <th>Δh</th>
            <th>Dist.</th>
            <th>Prog.</th>
            <th>Cota</th>
            <th>Corr.</th>
            <th>Cota corr.</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((row: any, i: number) => (
            <tr key={i}>
              <td className="font-bold">{row.punto}</td>
              <td>{row.va.toFixed(3)}</td>
              <td>{row.vd.toFixed(3)}</td>
              <td className={row.deltaH >= 0 ? "text-cyan" : "text-pink"}>
                {row.deltaH >= 0 ? `+${row.deltaH.toFixed(3)}` : row.deltaH.toFixed(3)}
              </td>
              <td>{row.dist.toFixed(3)}</td>
              <td>{row.progresivaStr}</td>
              <td className="font-bold">{row.cota.toFixed(3)}</td>
              <td>{row.corr >= 0 ? `+${row.corr.toFixed(4)}` : row.corr.toFixed(4)}</td>
              <td className="font-bold text-green">{row.cotaCorr.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (motorId === "BUZ") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Progresiva</th>
            <th>Long.</th>
            <th>Pend.</th>
            <th>Terreno</th>
            <th>Fondo</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((row: any, i: number) => (
            <tr key={i}>
              <td>{row.progresivaStr}</td>
              <td>{row.longitud.toFixed(3)}</td>
              <td className="text-cyan">
                {row.pendienteDescendente >= 0
                  ? `+${row.pendienteDescendente.toFixed(3)}`
                  : row.pendienteDescendente.toFixed(3)}
              </td>
              <td>{row.cotaTerreno.toFixed(3)}</td>
              <td className="font-bold">{row.cotaFondo.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (motorId === "PEN") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Progresiva</th>
            <th>Distancia</th>
            <th>Desnivel</th>
            <th>Cota rasante</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((row: any, i: number) => (
            <tr key={i}>
              <td>{row.progresivaStr}</td>
              <td>{row.distancia.toFixed(3)}</td>
              <td className={row.desnivel >= 0 ? "text-cyan" : "text-pink"}>
                {row.desnivel >= 0 ? `+${row.desnivel.toFixed(3)}` : row.desnivel.toFixed(3)}
              </td>
              <td className="font-bold">{row.cotaRasante.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (motorId === "COO") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Operación</th>
            <th>Este</th>
            <th>Norte</th>
            <th>Distancia</th>
            <th>Azimut</th>
            <th>Rumbo</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((t: any, i: number) => (
            <tr key={i}>
              <td className="font-bold">{t.operacion}</td>
              <td>{t.este.toFixed(3)}</td>
              <td>{t.norte.toFixed(3)}</td>
              <td>{t.distancia.toFixed(3)}</td>
              <td>{t.azimutStr || `${t.azimut.toFixed(6)}°`}</td>
              <td className="font-bold text-cyan">{t.rumbo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (motorId === "POL") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Vértice</th>
            <th>Distancia</th>
            <th>Azimut</th>
            <th>Este (X)</th>
            <th>Norte (Y)</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((t: any, i: number) => (
            <tr key={i}>
              <td className="font-bold">{t.estacion}</td>
              <td>{t.distancia.toFixed(2)} m</td>
              <td>{t.azimut.toFixed(2)}°</td>
              <td>{t.este.toFixed(3)}</td>
              <td>{t.norte.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (motorId === "AREA") {
    const tabla = res.tabla || [];
    return (
      <table className="topo-data-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th>Este</th>
            <th>Norte</th>
            <th>Lado siguiente</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((row: any, i: number) => (
            <tr key={i}>
              <td className="font-bold">{row.punto}</td>
              <td>{row.este.toFixed(3)}</td>
              <td>{row.norte.toFixed(3)}</td>
              <td>{row.ladoSiguiente.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <p className="topo-empty-hint">Resultados calculados disponibles en panel principal.</p>;
}

// -------------------------------------------------------------------------------------------------
// GRÁFICO DINÁMICO SVG (VISUALIZADOR TÉCNICO)
// -------------------------------------------------------------------------------------------------
function VisorDinamicoSVG({
  motorId,
  datos,
  resultados,
}: {
  motorId: TipoMotorTopo;
  datos: any;
  resultados: any;
}) {
  if (motorId === "CV" && resultados && resultados.tabla) {
    const tabla = resultados.tabla;
    if (tabla.length < 2) return null;

    const minX = tabla[0].progresivaNum;
    const maxX = tabla[tabla.length - 1].progresivaNum;
    const cotas = tabla.map((t: any) => t.cotaCurva).concat([resultados.pvcCota, resultados.pvtCota]);
    const minCota = Math.min(...cotas);
    const maxCota = Math.max(...cotas);

    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(0.5, maxCota - minCota);

    const W = 600;
    const H = 240;
    const padX = 60;
    const padY = 40;

    const mapX = (prog: number) => padX + ((prog - minX) / rangeX) * (W - 2 * padX);
    const mapY = (cota: number) => H - padY - ((cota - minCota) / rangeY) * (H - 2 * padY);

    // Tangentes PVC -> PVI y PVI -> PVT
    const pviProg = (minX + maxX) / 2;
    const pviCota = datos.cotaPVI || minCota;

    const xPVC = mapX(resultados.pvcProgNum);
    const yPVC = mapY(resultados.pvcCota);
    const xPVI = mapX(pviProg);
    const yPVI = mapY(pviCota);
    const xPVT = mapX(resultados.pvtProgNum);
    const yPVT = mapY(resultados.pvtCota);

    // Polilínea de la curva
    const pathCurva = tabla
      .map((t: any, idx: number) => {
        const px = mapX(t.progresivaNum);
        const py = mapY(t.cotaCurva);
        return `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(" ");

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          {/* Grilla de fondo */}
          <defs>
            <pattern id="topoGridCV" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridCV)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            COTA
          </text>
          <text x="20" y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            PROGRESIVA
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Líneas tangentes en trazo discontinuo slate */}
          <line x1={xPVC} y1={yPVC} x2={xPVI} y2={yPVI} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1={xPVI} y1={yPVI} x2={xPVT} y2={yPVT} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Curva Parabólica en blanco de alto contraste */}
          <path d={pathCurva} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />

          {/* Puntos de muestreo sobre la curva */}
          {tabla.map((t: any, i: number) => {
            const px = mapX(t.progresivaNum);
            const py = mapY(t.cotaCurva);
            const isEndpoint = t.etiqueta === "PVC" || t.etiqueta === "PVT";
            const isCrit = t.etiqueta === "CRIT";
            return (
              <g key={i}>
                <circle
                  cx={px}
                  cy={py}
                  r={isCrit ? 5 : (isEndpoint ? 4.5 : 3.5)}
                  fill={isCrit ? "#ffffff" : (isEndpoint ? "#ffffff" : "#94a3b8")}
                  stroke="#0f141d"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          {/* Labels PVC, PVI, PVT */}
          <text x={xPVC} y={yPVC - 8} fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">
            PVC
          </text>
          <text x={xPVI} y={yPVI - 10} fill="#cbd5e1" fontSize="10" textAnchor="middle" fontWeight="bold">
            PVI
          </text>
          <text x={xPVT} y={yPVT - 8} fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">
            PVT
          </text>
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Curva parabólica</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot dashed" />
            <span>Tangentes de entrada/salida</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Estaciones y cotas</span>
          </div>
        </div>
      </div>
    );
  }

  if (motorId === "CH" && resultados && resultados.tabla && resultados.tabla.length > 0) {
    const tabla = resultados.tabla;
    const { estePC, nortePC, estePI, nortePI, estePT, nortePT, esteCentro, norteCentro } = resultados;
    const allPts = [
      { este: estePC, norte: nortePC },
      { este: estePI, norte: nortePI },
      { este: estePT, norte: nortePT },
      { este: esteCentro, norte: norteCentro },
      ...tabla.map((t: any) => ({ este: t.este, norte: t.norte })),
    ];

    const es = allPts.map((p) => p.este);
    const ns = allPts.map((p) => p.norte);
    const minE = Math.min(...es);
    const maxE = Math.max(...es);
    const minN = Math.min(...ns);
    const maxN = Math.max(...ns);
    const rangeE = Math.max(10, maxE - minE);
    const rangeN = Math.max(10, maxN - minN);

    const W = 600;
    const H = 260;
    const pad = 50;
    const scale = Math.min((W - 2 * pad) / rangeE, (H - 2 * pad) / rangeN);
    const offX = (W - rangeE * scale) / 2;
    const offY = (H - rangeN * scale) / 2;

    const mapX = (e: number) => offX + (e - minE) * scale;
    const mapY = (n: number) => H - offY - (n - minN) * scale;

    const ptPC = { x: mapX(estePC), y: mapY(nortePC) };
    const ptPI = { x: mapX(estePI), y: mapY(nortePI) };
    const ptPT = { x: mapX(estePT), y: mapY(nortePT) };
    const ptCentro = { x: mapX(esteCentro), y: mapY(norteCentro) };

    const pathArco = tabla
      .map((t: any, idx: number) => `${idx === 0 ? "M" : "L"} ${mapX(t.este).toFixed(1)} ${mapY(t.norte).toFixed(1)}`)
      .join(" ");

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          <defs>
            <pattern id="topoGridCH" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridCH)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            NORTE
          </text>
          <text x={W - 48} y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            ESTE
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Radios desde el Centro hacia PC y PT */}
          <line x1={ptCentro.x} y1={ptCentro.y} x2={ptPC.x} y2={ptPC.y} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1={ptCentro.x} y1={ptCentro.y} x2={ptPT.x} y2={ptPT.y} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Tangentes PC -> PI y PI -> PT en trazo discontinuo slate */}
          <line x1={ptPC.x} y1={ptPC.y} x2={ptPI.x} y2={ptPI.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1={ptPI.x} y1={ptPI.y} x2={ptPT.x} y2={ptPT.y} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Curva circular en blanco de alto contraste */}
          <path d={pathArco} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />

          {/* Vértice Centro */}
          <circle cx={ptCentro.x} cy={ptCentro.y} r="4" fill="#94a3b8" stroke="#0f141d" strokeWidth="1.5" />
          <text x={ptCentro.x + 8} y={ptCentro.y + 4} fill="#cbd5e1" fontSize="9.5" fontWeight="bold">
            CENTRO
          </text>

          {/* Vértice PI */}
          <circle cx={ptPI.x} cy={ptPI.y} r="4.5" fill="#ffffff" stroke="#0f141d" strokeWidth="1.5" />
          <text x={ptPI.x} y={ptPI.y - 8} fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">
            PI
          </text>

          {/* Estaciones y cuerda en el arco */}
          {tabla.map((t: any, idx: number) => {
            const px = mapX(t.este);
            const py = mapY(t.norte);
            const isEndpoint = idx === 0 || idx === tabla.length - 1;
            return (
              <g key={idx}>
                <circle
                  cx={px}
                  cy={py}
                  r={isEndpoint ? 4.5 : 3}
                  fill={isEndpoint ? "#ffffff" : "#94a3b8"}
                  stroke="#0f141d"
                  strokeWidth="1.5"
                />
                <text
                  x={px}
                  y={py - 7}
                  fill={isEndpoint ? "#ffffff" : "#cbd5e1"}
                  fontSize={isEndpoint ? "9.5" : "8"}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {t.etiqueta || ""}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Arco circular</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot dashed" />
            <span>Tangentes y radios</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Estaciones PC / PT</span>
          </div>
        </div>
      </div>
    );
  }

  if (motorId === "POL" && resultados && resultados.valido && resultados.coordenadasVector) {
    const coords: Array<{ x: number; y: number }> = resultados.coordenadasVector;
    const n = coords.length - 1; // último punto es la duplicación de cierre
    if (n < 3) return null;

    const xs = coords.map((p) => p.x);
    const ys = coords.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);

    const W = 600;
    const H = 240;
    const pad = 44;
    const scale = Math.min((W - 2 * pad) / rangeX, (H - 2 * pad) / rangeY);
    const offsetX = (W - rangeX * scale) / 2;
    const offsetY = (H - rangeY * scale) / 2;

    // Norte (Y) hacia arriba en pantalla
    const mapPt = (p: { x: number; y: number }) => ({
      px: offsetX + (p.x - minX) * scale,
      py: H - offsetY - (p.y - minY) * scale,
    });

    const screenPts = coords.map(mapPt);
    const pathPoligono = screenPts
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`)
      .join(" ");

    const tabla = resultados.tabla || [];

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
        <defs>
          <pattern id="topoGridPol" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#topoGridPol)" rx="8" />

        <text x="20" y="25" fill="#cbd5e1" fontSize="11" fontWeight="700">
          PLANTA (E, N)
        </text>
        <text x={W - 35} y="30" fill="#94a3b8" fontSize="13" fontWeight="bold">
          ↑ N
        </text>

        {/* Área encerrada */}
        <path d={pathPoligono} fill="rgba(255, 255, 255, 0.05)" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />

        {/* Etiquetas de distancia por lado */}
        {Array.from({ length: n }).map((_, idx) => {
          const p1 = screenPts[idx];
          const p2 = screenPts[idx + 1];
          const mid = { x: (p1.px + p2.px) / 2, y: (p1.py + p2.py) / 2 };
          const dist = tabla[idx]?.distancia;
          return (
            <text key={`d-${idx}`} x={mid.x} y={mid.y - 4} fill="#94a3b8" fontSize="9.5" textAnchor="middle" fontWeight="600">
              {dist !== undefined ? `${dist.toFixed(2)} m` : ""}
            </text>
          );
        })}

        {/* Vértices */}
        {Array.from({ length: n }).map((_, idx) => {
          const p = screenPts[idx];
          return (
            <g key={`v-${idx}`}>
              <circle cx={p.px} cy={p.py} r="4.5" fill="#ffffff" stroke="#0f141d" strokeWidth="1.5" />
              <text x={p.px} y={p.py - 10} fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">
                E-{idx + 1}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (motorId === "NIV" && resultados && resultados.tabla && resultados.tabla.length > 0) {
    const tabla = resultados.tabla;
    const cotaIni = resultados.cotaInicial ?? 100;

    // Todos los puntos del perfil incluyendo el origen (0m, cotaIni)
    const puntosPerfil = [
      { punto: "P0", dist: 0, cota: cotaIni, cotaCorr: cotaIni },
      ...tabla.map((t: any) => ({
        punto: t.punto,
        dist: t.progresivaNum,
        cota: t.cota,
        cotaCorr: t.cotaCorr,
      })),
    ];

    const todasCotas = puntosPerfil.flatMap((p) => [p.cota, p.cotaCorr]);
    const minCota = Math.min(...todasCotas);
    const maxCota = Math.max(...todasCotas);
    const rangeCota = Math.max(0.1, maxCota - minCota);
    const distTotal = Math.max(1, resultados.distanciaTotalM || puntosPerfil[puntosPerfil.length - 1].dist || 1);

    const W = 600;
    const H = 260;
    const padX = 60;
    const padY = 45;

    const mapX = (d: number) => padX + (d / distTotal) * (W - 2 * padX);
    const mapY = (c: number) => H - padY - ((c - minCota) / rangeCota) * (H - 2 * padY);

    const pathGeometria = puntosPerfil
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${mapX(p.dist).toFixed(1)} ${mapY(p.cota).toFixed(1)}`)
      .join(" ");

    const pathControl = puntosPerfil
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${mapX(p.dist).toFixed(1)} ${mapY(p.cotaCorr).toFixed(1)}`)
      .join(" ");

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          <defs>
            <pattern id="topoGridNiv" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridNiv)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            COTA
          </text>
          <text x="20" y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            PROGRESIVA
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Línea Geometría (Blanco alto contraste) */}
          <path d={pathGeometria} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Línea Control (Discontinua slate) */}
          <path d={pathControl} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos (Blanco con borde oscuro) */}
          {puntosPerfil.map((p, idx) => {
            const px = mapX(p.dist);
            const py = mapY(p.cota);
            return (
              <g key={idx}>
                <circle cx={px} cy={py} r="4.5" fill="#ffffff" stroke="#0f141d" strokeWidth="1.5" />
                <text x={px} y={py - 10} fill="#f8fafc" fontSize="9.5" textAnchor="middle" fontWeight="bold">
                  {p.punto}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Perfil geométrico</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot dashed" />
            <span>Cota compensada</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Puntos de cambio / BM</span>
          </div>
        </div>
      </div>
    );
  }

  if (motorId === "COO" && resultados && resultados.puntosVisor) {
    const { p1, p2Directo, p2Inverso } = resultados.puntosVisor;
    const allPts = [p1, p2Directo, p2Inverso];
    const es = allPts.map((p) => p.este);
    const ns = allPts.map((p) => p.norte);
    const minE = Math.min(...es);
    const maxE = Math.max(...es);
    const minN = Math.min(...ns);
    const maxN = Math.max(...ns);
    const rangeE = Math.max(10, maxE - minE);
    const rangeN = Math.max(10, maxN - minN);

    const W = 600;
    const H = 260;
    const pad = 50;
    const scale = Math.min((W - 2 * pad) / rangeE, (H - 2 * pad) / rangeN);
    const offX = (W - rangeE * scale) / 2;
    const offY = (H - rangeN * scale) / 2;

    const mapX = (e: number) => offX + (e - minE) * scale;
    const mapY = (n: number) => H - offY - (n - minN) * scale;

    const pt1 = { x: mapX(p1.este), y: mapY(p1.norte) };
    const pt2Dir = { x: mapX(p2Directo.este), y: mapY(p2Directo.norte) };
    const pt2Inv = { x: mapX(p2Inverso.este), y: mapY(p2Inverso.norte) };

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          <defs>
            <pattern id="topoGridCoo" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridCoo)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            NORTE
          </text>
          <text x={W - 48} y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            ESTE
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Línea Vector P1 -> P2 */}
          <line x1={pt1.x} y1={pt1.y} x2={pt2Dir.x} y2={pt2Dir.y} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />

          {/* P1 (Vértice base blanco) */}
          <circle cx={pt1.x} cy={pt1.y} r="4.5" fill="#ffffff" stroke="#0f141d" strokeWidth="1.5" />
          <text x={pt1.x + 8} y={pt1.y - 8} fill="#f8fafc" fontSize="10" fontWeight="bold">
            P1
          </text>

          {/* P2 Directo (Titanio plata) */}
          <circle cx={pt2Dir.x} cy={pt2Dir.y} r="4.5" fill="#cbd5e1" stroke="#0f141d" strokeWidth="1.5" />
          <text x={pt2Dir.x + 8} y={pt2Dir.y - 8} fill="#cbd5e1" fontSize="9.5" fontWeight="bold">
            P2 directo
          </text>

          {/* P2 Inverso si difiere */}
          {Math.abs(pt2Dir.x - pt2Inv.x) > 1 || Math.abs(pt2Dir.y - pt2Inv.y) > 1 ? (
            <g>
              <circle cx={pt2Inv.x} cy={pt2Inv.y} r="4" fill="#64748b" stroke="#0f141d" strokeWidth="1.5" />
              <text x={pt2Inv.x + 8} y={pt2Inv.y + 12} fill="#94a3b8" fontSize="9.5" fontWeight="bold">
                P2 ingresado
              </text>
            </g>
          ) : null}
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Vector de radiación</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Vértice base P1</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot slate" />
            <span>Punto radiado P2</span>
          </div>
        </div>
      </div>
    );
  }

  if (motorId === "PEN" && resultados && resultados.tabla && resultados.tabla.length > 0) {
    const tabla = resultados.tabla;
    const distTotal = Math.max(1, resultados.distanciaHorizontal || 100);
    const cotas = tabla.map((t: any) => t.cotaRasante).concat([resultados.cotaInicial, resultados.cotaFinal]);
    const minCota = Math.min(...cotas);
    const maxCota = Math.max(...cotas);
    const rangeCota = Math.max(0.1, maxCota - minCota);

    const W = 600;
    const H = 260;
    const padX = 60;
    const padY = 45;

    const mapX = (d: number) => padX + (d / distTotal) * (W - 2 * padX);
    const mapY = (c: number) => H - padY - ((c - minCota) / rangeCota) * (H - 2 * padY);

    const xIni = mapX(0);
    const yIni = mapY(resultados.cotaInicial);
    const xFin = mapX(distTotal);
    const yFin = mapY(resultados.cotaFinal);

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          <defs>
            <pattern id="topoGridPEN" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridPEN)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            COTA
          </text>
          <text x="20" y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            PROGRESIVA
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Línea Geometría (Blanco alto contraste) */}
          <line x1={xIni} y1={yIni} x2={xFin} y2={yFin} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />

          {/* Puntos de muestreo sobre la rasante */}
          {tabla.map((t: any, idx: number) => {
            const px = mapX(t.distancia);
            const py = mapY(t.cotaRasante);
            const isEndpoint = idx === 0 || idx === tabla.length - 1;
            return (
              <g key={idx}>
                <circle
                  cx={px}
                  cy={py}
                  r={isEndpoint ? 4.5 : 3.5}
                  fill={isEndpoint ? "#ffffff" : "#94a3b8"}
                  stroke="#0f141d"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Rasante calculada</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Estacas extremas</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot slate" />
            <span>Progresivas intermedias</span>
          </div>
        </div>
      </div>
    );
  }

  if (motorId === "AREA" && resultados && resultados.puntos && resultados.puntos.length >= 3) {
    const pts = resultados.puntos;
    const es = pts.map((p: any) => Number(p.este) || 0);
    const ns = pts.map((p: any) => Number(p.norte) || 0);
    const minE = Math.min(...es);
    const maxE = Math.max(...es);
    const minN = Math.min(...ns);
    const maxN = Math.max(...ns);
    const rangeE = Math.max(1, maxE - minE);
    const rangeN = Math.max(1, maxN - minN);

    const W = 600;
    const H = 260;
    const padX = 60;
    const padY = 45;

    const scale = Math.min((W - 2 * padX) / rangeE, (H - 2 * padY) / rangeN);
    const offsetX = (W - rangeE * scale) / 2;
    const offsetY = (H - rangeN * scale) / 2;

    const mapX = (e: number) => offsetX + (e - minE) * scale;
    const mapY = (n: number) => H - offsetY - (n - minN) * scale;

    const pathPoligono =
      pts
        .map((p: any, idx: number) => `${idx === 0 ? "M" : "L"} ${mapX(p.este).toFixed(1)} ${mapY(p.norte).toFixed(1)}`)
        .join(" ") + " Z";

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          <defs>
            <pattern id="topoGridArea" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridArea)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            NORTE
          </text>
          <text x={W - 48} y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            ESTE
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Polígono cerrado en blanco monocromo */}
          <path
            d={pathPoligono}
            fill="rgba(255, 255, 255, 0.05)"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Nodos y etiquetas de vértices */}
          {pts.map((p: any, idx: number) => {
            const px = mapX(p.este);
            const py = mapY(p.norte);
            const labelX = px > W - 70 ? px - 10 : px + 6;
            const labelY = py < 35 ? py + 14 : py - 8;
            const textAnchor = px > W - 70 ? "end" : "start";

            return (
              <g key={idx}>
                <circle cx={px} cy={py} r="4.5" fill="#ffffff" stroke="#0f141d" strokeWidth="1.5" />
                <text
                  x={labelX}
                  y={labelY}
                  fill="#f8fafc"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor={textAnchor}
                >
                  {p.id || `P${idx + 1}`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Lindero perimetral</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Vértices catastrales</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot slate" />
            <span>Superficie m²</span>
          </div>
        </div>
      </div>
    );
  }

  if (motorId === "BUZ" && resultados && resultados.perfil && resultados.perfil.length > 0) {
    const perfil = resultados.perfil;
    const minProg = perfil[0].progresivaNum;
    const maxProg = perfil[perfil.length - 1].progresivaNum;
    const cotas = perfil.map((p: any) => p.cotaFondo);
    const minCota = Math.min(...cotas);
    const maxCota = Math.max(...cotas);

    const rangeX = Math.max(1, maxProg - minProg);
    const rangeY = Math.max(0.1, maxCota - minCota);

    const W = 600;
    const H = 260;
    const padX = 60;
    const padY = 45;

    const mapX = (prog: number) => padX + ((prog - minProg) / rangeX) * (W - 2 * padX);
    const mapY = (cota: number) => H - padY - ((cota - minCota) / rangeY) * (H - 2 * padY);

    const pathPerfil = perfil
      .map((p: any, idx: number) => `${idx === 0 ? "M" : "L"} ${mapX(p.progresivaNum).toFixed(1)} ${mapY(p.cotaFondo).toFixed(1)}`)
      .join(" ");

    return (
      <div className="topo-visor-svg-container">
        <svg viewBox={`0 0 ${W} ${H}`} className="topo-svg-canvas">
          <defs>
            <pattern id="topoGridBUZ" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#topoGridBUZ)" rx="8" />

          {/* Ejes y Etiquetas */}
          <text x="20" y="28" fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            COTA
          </text>
          <text x="20" y={H - 14} fill="#94a3b8" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
            PROGRESIVA
          </text>
          <text x={W - 35} y="28" fill="#94a3b8" fontSize="13" fontWeight="bold">
            ↑ N
          </text>

          {/* Línea rasante de fondo de buzones (Blanco) */}
          <path d={pathPerfil} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />

          {/* Puntos / Buzones sobre el perfil */}
          {perfil.map((p: any, idx: number) => {
            const px = mapX(p.progresivaNum);
            const py = mapY(p.cotaFondo);
            const isEndpoint = idx === 0 || idx === perfil.length - 1;
            return (
              <g key={idx}>
                <circle
                  cx={px}
                  cy={py}
                  r={isEndpoint ? 4.5 : 3.5}
                  fill={isEndpoint ? "#ffffff" : "#94a3b8"}
                  stroke="#0c0712"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>

        {/* Leyenda interactiva inferior */}
        <div className="topo-chart-legend">
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot white" />
            <span>Colector / Rasante de fondo</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot silver" />
            <span>Buzón inicial/final</span>
          </div>
          <div className="topo-chart-legend-item">
            <span className="topo-legend-dot slate" />
            <span>Buzones de inspección</span>
          </div>
        </div>
      </div>
    );
  }

  // Gráfico general para otros motores (Planta de curva, polígono, perfil)
  return (
    <div className="topo-svg-generic-view">
      <svg viewBox="0 0 600 240" className="topo-svg-canvas">
        <defs>
          <pattern id="topoGridGen" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="600" height="240" fill="url(#topoGridGen)" rx="8" />
        <circle cx="300" cy="120" r="70" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 230 120 A 70 70 0 0 1 370 120" fill="none" stroke="#ffffff" strokeWidth="2.2" />
        <circle cx="230" cy="120" r="4" fill="#ffffff" />
        <circle cx="370" cy="120" r="4" fill="#ffffff" />
        <text x="300" y="160" fill="#94a3b8" fontSize="11" textAnchor="middle">
          Geometría Vectorial Dinámica Activa
        </text>
      </svg>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// LIBRETA DIGITAL: filas dinámicas agregables/eliminables por motor (POL, NIV, AREA, BUZ)
// -------------------------------------------------------------------------------------------------
interface CampoLibreta {
  key: string;
  label: string;
  tipo: "text" | "number";
  unidad?: string;
  step?: string;
  spanFull?: boolean;
}

function SeccionLibretaDigital({
  titulo,
  filas,
  campos,
  onAgregar,
  onQuitar,
  onCambiar,
}: {
  titulo: string;
  filas: Record<string, any>[];
  campos: CampoLibreta[];
  onAgregar: () => void;
  onQuitar: (idx: number) => void;
  onCambiar: (idx: number, key: string, value: any) => void;
}) {
  return (
    <>
      <div className="topo-libreta-header">
        <div>
          <span className="topo-card-tag cyan">{titulo}</span>
          <p className="topo-libreta-count">{filas.length} fila(s)</p>
        </div>
        <button type="button" className="topo-btn-agregar-fila" onClick={onAgregar}>
          + AGREGAR FILA
        </button>
      </div>

      <div className="topo-registros-list">
        {filas.map((fila, idx) => (
          <div className="topo-registro-card" key={idx}>
            <div className="topo-registro-header">
              <span className="topo-registro-tag">REGISTRO {String(idx + 1).padStart(2, "0")}</span>
              <button type="button" className="topo-btn-quitar" onClick={() => onQuitar(idx)}>
                QUITAR
              </button>
            </div>
            <div className="topo-form-grid">
              {campos.map((c) => (
                <div
                  key={c.key}
                  className={`topo-input-wrapper ${c.unidad ? "has-unit" : ""} ${c.spanFull ? "span-full" : ""}`}
                >
                  <label className="topo-label-float">{c.label}</label>
                  <input
                    type={c.tipo}
                    step={c.step}
                    className="topo-input-control"
                    value={fila[c.key] ?? (c.tipo === "number" ? 0 : "")}
                    onChange={(e) =>
                      onCambiar(idx, c.key, c.tipo === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
                    }
                  />
                  {c.unidad && <span className="topo-unit cyan">{c.unidad}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}

        {filas.length === 0 && <p className="topo-empty-hint">Sin filas. Agrega la primera para comenzar.</p>}
      </div>
    </>
  );
}

// -------------------------------------------------------------------------------------------------
// VISOR 3D DE LA POLIGONAL (dimensiones reales, orbitable)
// -------------------------------------------------------------------------------------------------
function crearEtiquetaSprite(texto: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(6, 14, 20, 0.88)";
    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(0, 0, 256, 96, 18);
    } else {
      ctx.rect(0, 0, 256, 96);
    }
    ctx.fill();
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#e2f8fb";
    ctx.font = "bold 42px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, 128, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}

function Visor3DPoligonal({ resultados }: { resultados: any }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor || !resultados || !resultados.valido) return;

    const coords: Array<{ x: number; y: number }> = resultados.coordenadasVector || [];
    if (coords.length < 3) return;

    const cx = coords.reduce((a, c) => a + c.x, 0) / coords.length;
    const cy = coords.reduce((a, c) => a + c.y, 0) / coords.length;
    // x = Este relativo, z = -Norte relativo (para que "Norte" quede hacia -Z en three.js)
    const puntos = coords.slice(0, -1).map((c) => ({ x: c.x - cx, z: -(c.y - cy) }));

    const width = contenedor.clientWidth || 600;
    const height = 360;
    const maxDim = Math.max(...puntos.map((p) => Math.hypot(p.x, p.z)), 5);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090410);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, maxDim * 50);
    camera.position.set(maxDim * 1.1, maxDim * 1.3, maxDim * 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    contenedor.innerHTML = "";
    contenedor.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(maxDim, maxDim * 2, maxDim);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(maxDim * 3, 20, 0x0891b2, 0x1e293b);
    scene.add(grid);

    // Contorno cerrado de la poligonal
    const pts3D = puntos.map((p) => new THREE.Vector3(p.x, 0, p.z));
    pts3D.push(pts3D[0].clone());
    const geomLinea = new THREE.BufferGeometry().setFromPoints(pts3D);
    const linea = new THREE.Line(geomLinea, new THREE.LineBasicMaterial({ color: 0x06b6d4 }));
    scene.add(linea);

    // Superficie semitransparente del área encerrada
    const shape = new THREE.Shape(puntos.map((p) => new THREE.Vector2(p.x, p.z)));
    const geomSup = new THREE.ShapeGeometry(shape);
    const mallaSup = new THREE.Mesh(
      geomSup,
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    );
    mallaSup.rotation.x = -Math.PI / 2;
    scene.add(mallaSup);

    // Estacas en cada vértice + etiqueta de distancia por tramo
    const alturaPoste = maxDim * 0.12;
    puntos.forEach((p, idx) => {
      const poste = new THREE.Mesh(
        new THREE.CylinderGeometry(maxDim * 0.006, maxDim * 0.006, alturaPoste, 8),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc })
      );
      poste.position.set(p.x, alturaPoste / 2, p.z);
      scene.add(poste);

      const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(maxDim * 0.02, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x06b6d4 })
      );
      esfera.position.set(p.x, alturaPoste, p.z);
      scene.add(esfera);

      const etiquetaVertice = crearEtiquetaSprite(`E${idx + 1}`);
      etiquetaVertice.position.set(p.x, alturaPoste * 1.9, p.z);
      const escalaVertice = maxDim * 0.1;
      etiquetaVertice.scale.set(escalaVertice, escalaVertice * 0.4, 1);
      scene.add(etiquetaVertice);

      const siguiente = puntos[(idx + 1) % puntos.length];
      const distTramo = Math.hypot(siguiente.x - p.x, siguiente.z - p.z);
      const mid = { x: (p.x + siguiente.x) / 2, z: (p.z + siguiente.z) / 2 };
      const etiquetaDist = crearEtiquetaSprite(`${distTramo.toFixed(2)} m`);
      etiquetaDist.position.set(mid.x, alturaPoste * 0.5, mid.z);
      const escalaDist = maxDim * 0.12;
      etiquetaDist.scale.set(escalaDist, escalaDist * 0.4, 1);
      scene.add(etiquetaDist);
    });

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      const w = contenedor!.clientWidth || width;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      });
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [resultados]);

  if (!resultados || !resultados.valido) {
    return <p className="topo-empty-hint" style={{ padding: 16 }}>Completa al menos 3 registros en la libreta digital para generar la vista 3D.</p>;
  }

  return <div ref={mountRef} className="topo-3d-canvas-wrapper" />;
}
