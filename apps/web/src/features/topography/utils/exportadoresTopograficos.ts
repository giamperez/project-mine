/**
 * exportadoresTopograficos.ts
 * Generador de formatos de exportación e interoperabilidad para topografía e ingeniería civil:
 * - DXF 3D (AutoCAD / Civil 3D) con capas técnicas y geometrías 3D
 * - CSV Topográfico estándar para Estación Total / Colectores GNSS
 * - GeoJSON estándar para SIG (QGIS, ArcGIS, Google Earth)
 * - Interoperabilidad con el Editor CAD 3D de NAMICAD
 */

import { TipoMotorTopo } from "../motoresTopograficos";
import { utmToWgs84 } from "./gpsTopografico";

/**
 * Descarga un archivo en el navegador del cliente.
 */
export function descargarArchivo(contenido: string, nombreArchivo: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------------------------------------------
// GENERADOR DXF 3D (AutoCAD Release 12 / 2000 ASCII)
// -------------------------------------------------------------------------------------------------
export function generarDxfTopografico(
  motorId: TipoMotorTopo,
  datos: any,
  resultados: any,
  nombreProyecto = "Topografia_Namicad"
): string {
  const lines: string[] = [];

  function add(code: number | string, val: number | string) {
    lines.push(String(code));
    lines.push(String(val));
  }

  // Encabezado DXF
  add(0, "SECTION");
  add(2, "HEADER");
  add(9, "$ACADVER");
  add(1, "AC1009"); // AutoCAD R12 ASCII (máxima compatibilidad)
  add(9, "$INSUNITS");
  add(70, 6); // Metros
  add(0, "ENDSEC");

  // Tablas de Capas
  add(0, "SECTION");
  add(2, "TABLES");
  add(0, "TABLE");
  add(2, "LAYER");
  add(70, 6);

  const capas = [
    { nombre: "TOPO_EJE_3D", color: 4 }, // Cian
    { nombre: "TOPO_PUNTOS", color: 6 }, // Magenta
    { nombre: "TOPO_TEXTO", color: 2 }, // Amarillo
    { nombre: "TOPO_BUZONES_3D", color: 3 }, // Verde
    { nombre: "TOPO_TUBERIAS", color: 5 }, // Azul
    { nombre: "TOPO_SUPERFICIE", color: 1 }, // Rojo
  ];

  capas.forEach((c) => {
    add(0, "LAYER");
    add(2, c.nombre);
    add(70, 0);
    add(62, c.color);
    add(6, "CONTINUOUS");
  });

  add(0, "ENDTAB");
  add(0, "ENDSEC");

  // Sección de Bloques (vacía)
  add(0, "SECTION");
  add(2, "BLOCKS");
  add(0, "ENDSEC");

  // Sección de Entidades 3D
  add(0, "SECTION");
  add(2, "ENTITIES");

  function addPoint3D(layer: string, x: number, y: number, z: number) {
    add(0, "POINT");
    add(8, layer);
    add(10, x.toFixed(4));
    add(20, y.toFixed(4));
    add(30, z.toFixed(4));
  }

  function addLine3D(layer: string, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    add(0, "LINE");
    add(8, layer);
    add(10, x1.toFixed(4));
    add(20, y1.toFixed(4));
    add(30, z1.toFixed(4));
    add(11, x2.toFixed(4));
    add(21, y2.toFixed(4));
    add(31, z2.toFixed(4));
  }

  function addText3D(layer: string, text: string, x: number, y: number, z: number, height = 1.0) {
    add(0, "TEXT");
    add(8, layer);
    add(10, x.toFixed(4));
    add(20, y.toFixed(4));
    add(30, z.toFixed(4));
    add(40, height.toFixed(2));
    add(1, text);
  }

  // Generación específica según el motor activo
  if (motorId === "CV" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length - 1; i++) {
      const p1 = tabla[i];
      const p2 = tabla[i + 1];
      addLine3D("TOPO_EJE_3D", p1.progresivaNum, 0, p1.cotaCurva, p2.progresivaNum, 0, p2.cotaCurva);
    }
    tabla.forEach((t: any) => {
      addPoint3D("TOPO_PUNTOS", t.progresivaNum, 0, t.cotaCurva);
      addText3D("TOPO_TEXTO", `${t.progresivaStr}: ${t.cotaCurva.toFixed(3)}m`, t.progresivaNum, 0, t.cotaCurva + 0.5, 0.8);
    });
  } else if (motorId === "CH" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length - 1; i++) {
      const p1 = tabla[i];
      const p2 = tabla[i + 1];
      addLine3D("TOPO_EJE_3D", p1.este, p1.norte, 0, p2.este, p2.norte, 0);
    }
    tabla.forEach((t: any) => {
      addPoint3D("TOPO_PUNTOS", t.este, t.norte, 0);
      addText3D("TOPO_TEXTO", `${t.etiqueta || ""} ${t.progresivaStr}`, t.este + 0.5, t.norte + 0.5, 0, 0.8);
    });
  } else if (motorId === "POL" && resultados?.tabla) {
    const tabla = resultados.tabla;
    const cota = resultados.cotaInicial || 100;
    for (let i = 0; i < tabla.length; i++) {
      const p1 = tabla[i];
      const p2 = tabla[(i + 1) % tabla.length];
      addLine3D("TOPO_EJE_3D", p1.este, p1.norte, cota, p2.este, p2.norte, cota);
      addPoint3D("TOPO_PUNTOS", p1.este, p1.norte, cota);
      addText3D("TOPO_TEXTO", `${p1.estacion}`, p1.este + 0.6, p1.norte + 0.6, cota, 0.8);
    }
  } else if (motorId === "AREA" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length; i++) {
      const p1 = tabla[i];
      const p2 = tabla[(i + 1) % tabla.length];
      addLine3D("TOPO_EJE_3D", p1.este, p1.norte, 0, p2.este, p2.norte, 0);
      addPoint3D("TOPO_PUNTOS", p1.este, p1.norte, 0);
      addText3D("TOPO_TEXTO", `${p1.punto} (${p1.ladoSiguiente.toFixed(2)}m)`, p1.este + 0.8, p1.norte + 0.8, 0, 0.9);
    }
    if (resultados.centroideEste) {
      addPoint3D("TOPO_TEXTO", resultados.centroideEste, resultados.centroideNorte, 0);
      addText3D("TOPO_TEXTO", `CENTROIDE Area: ${resultados.areaM2.toFixed(2)}m2`, resultados.centroideEste, resultados.centroideNorte, 0, 1.2);
    }
  } else if (motorId === "BUZ" && resultados?.tabla) {
    const pIni = resultados.perfil?.[0]?.progresivaNum || 0;
    const cotaIniFondo = resultados.cotaFondoInicial || 98.5;
    const cotaIniTerreno = resultados.perfil?.[0]?.cotaTerreno || 100.0;

    // Buzón de arranque 3D
    addLine3D("TOPO_BUZONES_3D", pIni, 0, cotaIniFondo, pIni, 0, cotaIniTerreno);
    addText3D("TOPO_TEXTO", `BZ-00 Fondo:${cotaIniFondo.toFixed(3)}m`, pIni, 0, cotaIniTerreno + 0.5, 0.8);

    let prevProg = pIni;
    let prevFondo = cotaIniFondo;

    resultados.tabla.forEach((b: any) => {
      // Línea de tubería subterránea entre fondos
      addLine3D("TOPO_TUBERIAS", prevProg, 0, prevFondo, b.progresivaNum, 0, b.cotaFondo);

      // Columna de buzón 3D (Cota Fondo a Cota Terreno)
      addLine3D("TOPO_BUZONES_3D", b.progresivaNum, 0, b.cotaFondo, b.progresivaNum, 0, b.cotaTerreno);
      addPoint3D("TOPO_PUNTOS", b.progresivaNum, 0, b.cotaFondo);
      addText3D("TOPO_TEXTO", `${b.id} Fondo:${b.cotaFondo.toFixed(3)}m Prof:${b.profundidad.toFixed(2)}m`, b.progresivaNum, 0, b.cotaTerreno + 0.6, 0.8);

      prevProg = b.progresivaNum;
      prevFondo = b.cotaFondo;
    });
  } else if (motorId === "PEN" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length - 1; i++) {
      const p1 = tabla[i];
      const p2 = tabla[i + 1];
      addLine3D("TOPO_EJE_3D", p1.distancia, 0, p1.cotaRasante, p2.distancia, 0, p2.cotaRasante);
    }
    tabla.forEach((t: any) => {
      addPoint3D("TOPO_PUNTOS", t.distancia, 0, t.cotaRasante);
      addText3D("TOPO_TEXTO", `${t.progresivaStr}: ${t.cotaRasante.toFixed(3)}m`, t.distancia, 0, t.cotaRasante + 0.4, 0.7);
    });
  } else if (motorId === "NIV" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length - 1; i++) {
      const p1 = tabla[i];
      const p2 = tabla[i + 1];
      addLine3D("TOPO_EJE_3D", p1.dist, 0, p1.cotaCorr, p2.dist, 0, p2.cotaCorr);
    }
    tabla.forEach((t: any) => {
      addPoint3D("TOPO_PUNTOS", t.dist, 0, t.cotaCorr);
      addText3D("TOPO_TEXTO", `${t.punto}: ${t.cotaCorr.toFixed(3)}m`, t.dist, 0, t.cotaCorr + 0.5, 0.8);
    });
  } else if (motorId === "COO" && resultados?.puntosVisor) {
    const { p1, p2Directo } = resultados.puntosVisor;
    addLine3D("TOPO_EJE_3D", p1.este, p1.norte, 0, p2Directo.este, p2Directo.norte, 0);
    addPoint3D("TOPO_PUNTOS", p1.este, p1.norte, 0);
    addPoint3D("TOPO_PUNTOS", p2Directo.este, p2Directo.norte, 0);
    addText3D("TOPO_TEXTO", `P1 (${p1.este.toFixed(3)}, ${p1.norte.toFixed(3)})`, p1.este + 1, p1.norte + 1, 0, 1.0);
    addText3D("TOPO_TEXTO", `P2 (${p2Directo.este.toFixed(3)}, ${p2Directo.norte.toFixed(3)})`, p2Directo.este + 1, p2Directo.norte + 1, 0, 1.0);
  }

  add(0, "ENDSEC");
  add(0, "EOF");

  return lines.join("\n");
}

// -------------------------------------------------------------------------------------------------
// GENERADOR CSV TOPOGRÁFICO (Estación Total / Colector GNSS)
// -------------------------------------------------------------------------------------------------
export function generarCsvTopografico(motorId: TipoMotorTopo, datos: any, resultados: any): string {
  const header = "Punto,Este,Norte,Cota,Codigo,Progresiva\n";
  const rows: string[] = [];

  if (motorId === "AREA" && resultados?.tabla) {
    resultados.tabla.forEach((r: any) => {
      rows.push(`${r.punto},${r.este.toFixed(4)},${r.norte.toFixed(4)},0.000,VERTICE,${r.ladoSiguiente.toFixed(3)}`);
    });
  } else if (motorId === "POL" && resultados?.tabla) {
    const cota = resultados.cotaInicial || 100;
    resultados.tabla.forEach((r: any) => {
      rows.push(`${r.estacion},${r.este.toFixed(4)},${r.norte.toFixed(4)},${cota.toFixed(3)},POLIGONAL,${r.distancia.toFixed(3)}`);
    });
  } else if (motorId === "BUZ" && resultados?.tabla) {
    resultados.tabla.forEach((r: any) => {
      rows.push(`${r.id},0.000,0.000,${r.cotaFondo.toFixed(3)},FONDO_BUZON,${r.progresivaStr}`);
      rows.push(`${r.id}_TERRENO,0.000,0.000,${r.cotaTerreno.toFixed(3)},TAPA_BUZON,${r.progresivaStr}`);
    });
  } else if ((motorId === "CV" || motorId === "PEN") && resultados?.tabla) {
    resultados.tabla.forEach((r: any, idx: number) => {
      const cota = r.cotaCurva ?? r.cotaRasante ?? 0;
      rows.push(`P_${idx + 1},${r.progresivaNum || r.distancia || 0},0.000,${cota.toFixed(3)},RASANTE,${r.progresivaStr}`);
    });
  } else if (motorId === "CH" && resultados?.tabla) {
    resultados.tabla.forEach((r: any) => {
      rows.push(`${r.etiqueta || "CURVA"},${r.este.toFixed(4)},${r.norte.toFixed(4)},0.000,EJE_VIAL,${r.progresivaStr}`);
    });
  } else if (motorId === "NIV" && resultados?.tabla) {
    resultados.tabla.forEach((r: any) => {
      rows.push(`${r.punto},${r.dist.toFixed(4)},0.000,${r.cotaCorr.toFixed(3)},BM_NIVELADO,${r.progresivaStr}`);
    });
  } else if (motorId === "COO" && resultados?.puntosVisor) {
    const { p1, p2Directo } = resultados.puntosVisor;
    rows.push(`P1,${p1.este.toFixed(4)},${p1.norte.toFixed(4)},0.000,BASE_P1,0+000.000`);
    rows.push(`P2,${p2Directo.este.toFixed(4)},${p2Directo.norte.toFixed(4)},0.000,RADIADO_P2,0+100.000`);
  }

  return header + rows.join("\n");
}

// -------------------------------------------------------------------------------------------------
// GENERADOR GEOJSON (SIG / Google Earth / QGIS)
// -------------------------------------------------------------------------------------------------
export function generarGeoJsonTopografico(
  motorId: TipoMotorTopo,
  datos: any,
  resultados: any,
  zonaUtmStr = "18S"
): string {
  const zonaNum = parseInt(zonaUtmStr) || 18;
  const hemisferio = zonaUtmStr.toUpperCase().includes("N") ? "N" : "S";

  const features: any[] = [];

  function toWgs(este: number, norte: number) {
    return utmToWgs84(este, norte, zonaNum, hemisferio);
  }

  if ((motorId === "AREA" || motorId === "POL") && resultados?.tabla) {
    const coordsWgs: number[][] = [];
    resultados.tabla.forEach((r: any) => {
      const wgs = toWgs(r.este, r.norte);
      coordsWgs.push([wgs.lon, wgs.lat]);

      features.push({
        type: "Feature",
        properties: {
          nombre: r.punto || r.estacion,
          este: r.este,
          norte: r.norte,
        },
        geometry: {
          type: "Point",
          coordinates: [wgs.lon, wgs.lat],
        },
      });
    });

    if (coordsWgs.length > 2) {
      coordsWgs.push(coordsWgs[0]); // Cerrar polígono
      features.push({
        type: "Feature",
        properties: {
          tipo: "Polígono Topográfico",
          areaM2: resultados.areaM2,
          perimetroM: resultados.perimetro,
        },
        geometry: {
          type: "Polygon",
          coordinates: [coordsWgs],
        },
      });
    }
  } else if (motorId === "CH" && resultados?.tabla) {
    const lineCoords: number[][] = [];
    resultados.tabla.forEach((r: any) => {
      const wgs = toWgs(r.este, r.norte);
      lineCoords.push([wgs.lon, wgs.lat]);
    });
    features.push({
      type: "Feature",
      properties: { tipo: "Curva Horizontal Vial" },
      geometry: { type: "LineString", coordinates: lineCoords },
    });
  } else if (motorId === "COO" && resultados?.puntosVisor) {
    const { p1, p2Directo } = resultados.puntosVisor;
    const w1 = toWgs(p1.este, p1.norte);
    const w2 = toWgs(p2Directo.este, p2Directo.norte);
    features.push({
      type: "Feature",
      properties: { nombre: "Vector P1 -> P2" },
      geometry: {
        type: "LineString",
        coordinates: [
          [w1.lon, w1.lat],
          [w2.lon, w2.lat],
        ],
      },
    });
  }

  const geoJson = {
    type: "FeatureCollection",
    metadata: {
      datum: "WGS84",
      zonaUtm: zonaUtmStr,
      generadoPor: "NAMICAD Topografía",
      fecha: new Date().toISOString(),
    },
    features,
  };

  return JSON.stringify(geoJson, null, 2);
}

// -------------------------------------------------------------------------------------------------
// INTEROPERABILIDAD CON EDITOR CAD 3D (NAMICAD)
// -------------------------------------------------------------------------------------------------
export function enviarACad3D(
  motorId: TipoMotorTopo,
  datos: any,
  resultados: any,
  nombreProyecto = "Topografía"
): number {
  if (typeof window === "undefined") return 0;

  const entidades: any[] = [];
  let idContador = 1;

  if (motorId === "AREA" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length; i++) {
      const p1 = tabla[i];
      const p2 = tabla[(i + 1) % tabla.length];
      entidades.push({
        id: `cad-line-${idContador++}`,
        tipo: "linea",
        x1: p1.este,
        y1: p1.norte,
        z1: 0,
        x2: p2.este,
        y2: p2.norte,
        z2: 0,
        color: "#06b6d4",
        capa: "TOPOGRAFIA_AREA",
      });
      entidades.push({
        id: `cad-pt-${idContador++}`,
        tipo: "punto",
        x: p1.este,
        y: p1.norte,
        z: 0,
        texto: p1.punto,
        color: "#f43f5e",
        capa: "VERTICES",
      });
    }
  } else if (motorId === "BUZ" && resultados?.tabla) {
    const pIni = resultados.perfil?.[0]?.progresivaNum || 0;
    const cotaIniFondo = resultados.cotaFondoInicial || 98.5;
    const cotaIniTerreno = resultados.perfil?.[0]?.cotaTerreno || 100.0;

    let prevX = pIni;
    let prevZ = cotaIniFondo;

    // Buzón de inicio
    entidades.push({
      id: `cad-buz-${idContador++}`,
      tipo: "linea",
      x1: pIni,
      y1: 0,
      z1: cotaIniFondo,
      x2: pIni,
      y2: 0,
      z2: cotaIniTerreno,
      color: "#34d399",
      capa: "BUZONES_3D",
    });

    resultados.tabla.forEach((b: any) => {
      // Tubería
      entidades.push({
        id: `cad-pipe-${idContador++}`,
        tipo: "linea",
        x1: prevX,
        y1: 0,
        z1: prevZ,
        x2: b.progresivaNum,
        y2: 0,
        z2: b.cotaFondo,
        color: "#38bdf8",
        capa: "TUBERIAS_3D",
      });
      // Buzón
      entidades.push({
        id: `cad-buz-${idContador++}`,
        tipo: "linea",
        x1: b.progresivaNum,
        y1: 0,
        z1: b.cotaFondo,
        x2: b.progresivaNum,
        y2: 0,
        z2: b.cotaTerreno,
        color: "#34d399",
        capa: "BUZONES_3D",
      });

      prevX = b.progresivaNum;
      prevZ = b.cotaFondo;
    });
  } else if (motorId === "CH" && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length - 1; i++) {
      const p1 = tabla[i];
      const p2 = tabla[i + 1];
      entidades.push({
        id: `cad-ch-${idContador++}`,
        tipo: "linea",
        x1: p1.este,
        y1: p1.norte,
        z1: 0,
        x2: p2.este,
        y2: p2.norte,
        z2: 0,
        color: "#06b6d4",
        capa: "CURVA_HORIZONTAL",
      });
    }
  } else if ((motorId === "CV" || motorId === "PEN") && resultados?.tabla) {
    const tabla = resultados.tabla;
    for (let i = 0; i < tabla.length - 1; i++) {
      const p1 = tabla[i];
      const p2 = tabla[i + 1];
      const c1 = p1.cotaCurva ?? p1.cotaRasante ?? 0;
      const c2 = p2.cotaCurva ?? p2.cotaRasante ?? 0;
      const x1 = p1.progresivaNum ?? p1.distancia ?? 0;
      const x2 = p2.progresivaNum ?? p2.distancia ?? 0;
      entidades.push({
        id: `cad-prof-${idContador++}`,
        tipo: "linea",
        x1,
        y1: 0,
        z1: c1,
        x2,
        y2: 0,
        z2: c2,
        color: "#06b6d4",
        capa: "PERFIL_RASANTE",
      });
    }
  }

  // Guardar en sessionStorage para que el Editor CAD 3D pueda detectarlo e importarlo
  sessionStorage.setItem(
    "namicad_external_import",
    JSON.stringify({
      titulo: `${nombreProyecto} (${motorId})`,
      fecha: new Date().toISOString(),
      motorId,
      entidades,
    })
  );

  return entidades.length;
}
