import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { EntradaMallaPerforacion, ResultadoMallaPerforacion, ResultadoVoladura } from "@suite/core";

const MARGEN_X = 14;
const ANCHO_PAGINA = 210; // A4 mm
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN_X * 2;

function encabezado(doc: jsPDF, titulo: string, subtitulo: string): number {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Suite Minera", MARGEN_X, 16);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(titulo, MARGEN_X, 24);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(subtitulo, MARGEN_X, 30);
  doc.text(new Date().toLocaleString(), ANCHO_PAGINA - MARGEN_X, 16, { align: "right" });
  doc.setTextColor(0);
  doc.setDrawColor(200);
  doc.line(MARGEN_X, 34, ANCHO_PAGINA - MARGEN_X, 34);
  return 42;
}

function tituloSeccion(doc: jsPDF, texto: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(texto, MARGEN_X, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  return y + 6;
}

function piePaginas(doc: jsPDF): void {
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${paginas} — generado por Suite Minera, ${new Date().toLocaleDateString()}`, ANCHO_PAGINA / 2, 290, {
      align: "center",
    });
    doc.setTextColor(0);
  }
}

/** finalY de la ultima tabla dibujada (jspdf-autotable lo deja en doc.lastAutoTable). */
function finalYDeUltimaTabla(doc: jsPDF, porDefecto: number): number {
  const conAutoTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  return conAutoTable.lastAutoTable?.finalY ?? porDefecto;
}

/** Dibuja un plano en planta simple de los collares de taladro (puntos + etiqueta), escalado para caber en una caja fija. */
function dibujarPlanoTaladros(
  doc: jsPDF,
  taladros: ResultadoMallaPerforacion["taladros"],
  y: number,
  alto_mm = 70
): number {
  if (taladros.length === 0) return y;
  const xs = taladros.map((t) => t.collar.x);
  const ys = taladros.map((t) => t.collar.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const anchoMundo = Math.max(xMax - xMin, 1);
  const altoMundo = Math.max(yMax - yMin, 1);
  const margenCaja = 8;
  const escala = Math.min((ANCHO_UTIL - margenCaja * 2) / anchoMundo, (alto_mm - margenCaja * 2) / altoMundo);

  const centroCajaX = MARGEN_X + ANCHO_UTIL / 2;
  const centroCajaY = y + alto_mm / 2;
  const centroMundoX = (xMin + xMax) / 2;
  const centroMundoY = (yMin + yMax) / 2;

  doc.setDrawColor(210);
  doc.rect(MARGEN_X, y, ANCHO_UTIL, alto_mm, "S");

  doc.setFillColor(234, 88, 12);
  doc.setFontSize(5);
  for (const t of taladros) {
    const px = centroCajaX + (t.collar.x - centroMundoX) * escala;
    // Y de pantalla crece hacia abajo; Y de mundo (Norte) crece hacia arriba -> se invierte
    const py = centroCajaY - (t.collar.y - centroMundoY) * escala;
    doc.circle(px, py, 0.8, "F");
  }
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Plano en planta — ${taladros.length} taladros (no a escala real de impresión)`, MARGEN_X, y + alto_mm + 5);
  doc.setTextColor(0);

  return y + alto_mm + 10;
}

/** Genera el reporte PDF de Diseño de Malla (parámetros, resultados de diseño, plano, secuencia, tabla de taladros). Devuelve el documento listo para doc.save(...) o doc.output(...). */
export function generarReporteMalla(
  entrada: EntradaMallaPerforacion,
  resultado: ResultadoMallaPerforacion,
  resultadoVoladura: ResultadoVoladura
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = encabezado(doc, "Diseño de Malla de Perforación y Voladura", "mining.blast-pattern · mining.blasting");

  y = tituloSeccion(doc, "Parámetros de entrada", y);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8 },
    head: [["Geometría del banco", "Valor", "Taladro y roca", "Valor"]],
    body: [
      ["Cota de cresta", `${entrada.cotaCresta} m`, "Diámetro", `${entrada.diametroMm} mm`],
      ["Altura de banco", `${entrada.alturaBanco_m} m`, "Densidad roca", `${entrada.densidadRocaGcm3} g/cm³`],
      ["Vértices de cresta", `${entrada.poligonoCresta.length}`, "Tipo de roca", entrada.tipoRoca],
      ["", "", "Explosivo", entrada.explosivo.nombre],
    ],
  });
  y = finalYDeUltimaTabla(doc, y) + 10;

  y = tituloSeccion(doc, "Resultados de diseño", y);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8 },
    head: [["Parámetro", "Valor"]],
    body: [
      ["Burden Ash", `${resultado.burdenAsh_m.toFixed(2)} m`],
      ["Burden máx. Langefors", `${resultado.burdenLangeforsMax_m.toFixed(2)} m`],
      ["Burden práctico Langefors", `${resultado.burdenLangeforsPractico_m.toFixed(2)} m`],
      ["Burden de diseño (adoptado)", `${resultado.burdenDiseno_m.toFixed(2)} m`],
      ["Espaciamiento (Konya)", `${resultado.espaciamiento_m.toFixed(2)} m`],
      ["Razón de rigidez H/B", resultado.razonRigidezHB.toFixed(2)],
      ["Sobreperforación", `${resultado.sobreperforacion_m.toFixed(2)} m`],
      ["Profundidad de taladro", `${resultado.profundidadTaladro_m.toFixed(2)} m`],
      ["Taco", `${resultado.taco_m.toFixed(2)} m`],
      ["Longitud de carga", `${resultado.longitudCarga_m.toFixed(2)} m`],
      ["Número de taladros", `${resultado.taladros.length}`],
    ],
  });
  y = finalYDeUltimaTabla(doc, y) + 10;

  if (resultado.advertencias.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y = tituloSeccion(doc, "Advertencias", y);
    doc.setFontSize(8);
    doc.setTextColor(180, 60, 0);
    for (const advertencia of resultado.advertencias) {
      const lineas = doc.splitTextToSize(`⚠ ${advertencia}`, ANCHO_UTIL);
      doc.text(lineas, MARGEN_X, y);
      y += lineas.length * 4 + 2;
    }
    doc.setTextColor(0);
    y += 6;
  }

  if (y > 200) {
    doc.addPage();
    y = 20;
  }
  y = tituloSeccion(doc, "Plano de taladros (en planta)", y);
  y = dibujarPlanoTaladros(doc, resultado.taladros, y);

  doc.addPage();
  y = 20;
  y = tituloSeccion(doc, "Voladura: carga y secuencia de iniciación", y);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8 },
    head: [["Parámetro", "Valor"]],
    body: [
      ["Peso total de explosivo", `${resultadoVoladura.pesoExplosivoTotal_kg.toFixed(0)} kg`],
      ["Volumen de roca total", `${resultadoVoladura.volumenRocaTotal_m3.toFixed(0)} m³`],
      ["Factor de carga (powder factor)", `${resultadoVoladura.factorCarga_kgm3.toFixed(3)} kg/m³`],
      ["Carga lineal", `${resultadoVoladura.cargaLineal_kgm.toFixed(2)} kg/m`],
      ["Retardo entre filas", `${resultadoVoladura.retardoEntreFilas_ms.toFixed(1)} ms`],
      ["Retardo entre taladros", `${resultadoVoladura.retardoEntreTaladros_ms.toFixed(1)} ms`],
      ["Duración total de secuencia", `${resultadoVoladura.duracionTotalSecuencia_ms.toFixed(0)} ms`],
    ],
  });
  y = finalYDeUltimaTabla(doc, y) + 10;

  y = tituloSeccion(doc, "Tabla de taladros", y);
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
    head: [["ID", "X collar (m)", "Y collar (m)", "Z collar (m)", "Profundidad (m)", "Diámetro (mm)"]],
    body: resultado.taladros.map((t) => [
      t.id,
      t.collar.x.toFixed(2),
      t.collar.y.toFixed(2),
      t.collar.z.toFixed(2),
      t.profundidad_m.toFixed(2),
      `${t.diametroMm}`,
    ]),
  });

  piePaginas(doc);
  return doc;
}
