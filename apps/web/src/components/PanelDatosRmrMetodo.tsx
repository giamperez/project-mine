import React, { useState, useMemo, useEffect } from "react";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { calcularArranqueHolmberg } from "@suite/core";
import type { Punto2D, Taladro } from "@suite/core";
import type { LineaCad3D, PolilineaCad3D } from "./EditorCadMalla.js";

export type TabPanel = "datos" | "rmr" | "metodo" | "resultado";
export type TipoSeccionPlantilla = "rectangular" | "herradura" | "tipo_d" | "arco_personalizado";
export type TipoPatronContorno = "uniforme" | "corona_recorte" | "recorte_continuo";
export type MetodoDisenoArranque = "corte_paralelo" | "practico_empirico" | "expansion_sucesiva";
export type TipoCorteArranque = "paralelo_quemado" | "cuna" | "piramidal" | "abanico" | "diamante";

interface Props {
  visible: boolean;
  onOcultar: () => void;
  poligonoCresta?: Punto2D[];
  onCambiarPoligono?: (pts: Punto2D[]) => void;
  lineasCad?: LineaCad3D[];
  polilineasCad?: PolilineaCad3D[];
  taladros?: Taladro[];
  onCambiarTaladros?: (nuevos: Taladro[]) => void;
  onGenerarTaladros?: (nuevos: Taladro[]) => void;
  onAplicarParametros?: (params: {
    ancho: number;
    alto: number;
    area: number;
    perimetro: number;
    tipoSeccion?: TipoSeccionPlantilla;
    rmr: number;
    alivios?: number;
    numAlivios?: number;
    diametroAlivioMm?: number;
    diametroProdMm?: number;
    metodo?: MetodoDisenoArranque;
    tipoCorte?: TipoCorteArranque;
  }) => void;
  mostrarAviso?: (msg: string) => void;
}

export interface PlantillaMalla {
  id: string;
  nombre: string;
  tipoSeccion: TipoSeccionPlantilla;
  ancho: number;
  alto: number;
  corona: number;
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  avanceM: number;
  rmr: number;
  descripcion: string;
  badge: string;
  color: string;
  icono: string;
}

export const PLANTILLAS_MALLA_PRESET: PlantillaMalla[] = [
  {
    id: "herradura-2.5x2.5",
    nombre: "Herradura Estándar",
    tipoSeccion: "herradura",
    ancho: 2.5,
    alto: 2.5,
    corona: 1.25,
    numAlivios: 4,
    diametroAlivioMm: 102,
    diametroProdMm: 45,
    avanceM: 3.6,
    rmr: 45,
    descripcion: "Cuele Holmberg con 4 alivios centrales Ø102mm, arrastres, corona y hastiales (cantidad de taladros calculada según RMR).",
    badge: "2.5 × 2.5m",
    color: "#f97316",
    icono: "🚇",
  },
  {
    id: "herradura-3.0x3.0",
    nombre: "Túnel Principal",
    tipoSeccion: "herradura",
    ancho: 3.0,
    alto: 3.0,
    corona: 1.5,
    numAlivios: 4,
    diametroAlivioMm: 102,
    diametroProdMm: 45,
    avanceM: 3.8,
    rmr: 55,
    descripcion: "Galería de transporte y acarreo principal con 4 cuadrantes y corona reforzada.",
    badge: "3.0 × 3.0m",
    color: "#38bdf8",
    icono: "⛏️",
  },
  {
    id: "tipo-d-3.5x3.0",
    nombre: "Rampa Tipo D",
    tipoSeccion: "tipo_d",
    ancho: 3.5,
    alto: 3.0,
    corona: 1.05,
    numAlivios: 4,
    diametroAlivioMm: 102,
    diametroProdMm: 45,
    avanceM: 3.6,
    rmr: 50,
    descripcion: "Sección abovedada rebajada para optimización de gálibo de equipos LHD y volquetes.",
    badge: "3.5 × 3.0m",
    color: "#a855f7",
    icono: "🔷",
  },
  {
    id: "rectangular-2.5x2.5",
    nombre: "Labor en Veta",
    tipoSeccion: "rectangular",
    ancho: 2.5,
    alto: 2.5,
    corona: 0,
    numAlivios: 4,
    diametroAlivioMm: 89,
    diametroProdMm: 41,
    avanceM: 3.2,
    rmr: 40,
    descripcion: "Corte rectangular para labores de avance en vetas angostas y subniveles de explotación.",
    badge: "2.5 × 2.5m",
    color: "#10b981",
    icono: "🟧",
  },
];

/**
 * Diametro equivalente de alivio y secuencia de burden/espaciamiento del arranque (cuele Holmberg,
 * metodo simplificado de Jimeno Tabla 22.2), delegando en el motor ya validado de
 * packages/core/src/formulas/mining/tunnelRound.ts::calcularArranqueHolmberg — en vez de mantener
 * una segunda copia de la misma formula que podía (y de hecho llegó a) divergir con constantes
 * incorrectas. `maximoSecciones` limita a 5 etapas y reutiliza la regla de parada real (deja de
 * agregar secciones cuando el lado resultante alcanza sqrt(avance)), asi que en galerías pequeñas o
 * con avances cortos no se generan anillos de arranque más grandes que la propia sección.
 */
function calcularHolmberg(numAlivios: number, diametroAlivioMm: number, avanceM: number) {
  const resultado = calcularArranqueHolmberg({
    diametroIndividualAlivio_mm: diametroAlivioMm,
    numeroTaladrosAlivio: numAlivios,
    avance_m: avanceM,
    maximoSecciones: 5,
  });
  return {
    deMm: resultado.diametroEquivalente_mm,
    deM: resultado.diametroEquivalente_mm / 1000,
    etapas: resultado.secciones.map((s) => ({ etapa: s.numero, b: s.burden_m, e: s.espaciamiento_m, f: s.factor })),
  };
}

/**
 * Espaciamiento de taladros de contorno segun clase de roca (RMR) — mismos valores que usa
 * `recomendacionRmr` más abajo, alineados con la tabla "Distancias entre taladros" de la
 * referencia (tenaz 0.50-0.55m, intermedio 0.60-0.65m, friable 0.70-0.75m; se toma el punto medio).
 */
function calcularEspaciamientoContornoPorRmr(rmr: number): number {
  if (rmr > 60) return 0.73; // roca suave / friable
  if (rmr >= 41) return 0.55; // roca semidura / intermedio
  return 0.48; // roca dura / tenaz
}

/**
 * Espaciamiento "normal" (SIN voladura controlada) — regla práctica de Mamani López, R.J. (op.
 * cit., p.19): "se estima una distancia de 2 ft por cada pulgada de diámetro de broca". Es el
 * espaciamiento que usan los taladros de contorno cuando NO se busca una pared lisa (patrón
 * "Corona uniforme"), bastante más abierto que el de recorte/smooth blasting.
 */
function calcularEspaciamientoProduccionReglaPractica(diametroMm: number): number {
  const diametroPulgadas = diametroMm / 25.4;
  const espaciamientoPies = 2 * diametroPulgadas;
  return espaciamientoPies * 0.3048;
}

/**
 * Secuencia del arranque por el "método práctico/empírico": en vez de la progresión geométrica de
 * Holmberg (B1=1.5·De, Bn=E(n-1)...), usa 3 bandas de distancia fijas y ya tabuladas por zona —
 * arranque 0.15-0.30 m, ayudas 0.60-0.90 m, cuadradores 0.50-0.70 m — tal como se enseña para un
 * diseño rápido de campo sin calcular el diámetro equivalente (Mamani López, R.J., "Diseño de
 * mallas de perforación en minería subterránea", material de curso, Bolivia, p.19, "Distancia
 * entre taladros"). Se usa el punto medio de cada banda; a diferencia de Holmberg, estas bandas NO
 * crecen monótonamente (no son secciones concéntricas de un mismo cuele, son zonas con nombre
 * propio), así que el espaciamiento se toma como B·√2 solo como convención geométrica para poder
 * dibujar los mismos anillos que usa el método de corte paralelo.
 */
function calcularEtapasPracticoEmpirico(): Array<{ etapa: number; b: number; e: number; f: number }> {
  const bandas = [
    { b: (0.15 + 0.3) / 2 }, // Arranque
    { b: (0.6 + 0.9) / 2 }, // Ayudas
    { b: (0.5 + 0.7) / 2 }, // Cuadradores
  ];
  return bandas.map((banda, idx) => ({
    etapa: idx + 1,
    b: banda.b,
    e: banda.b * Math.SQRT2,
    f: NaN,
  }));
}

/**
 * Factor de carga (kg de explosivo por m³ de roca a volar) según el área de la sección del túnel
 * y la categoría de roca — tabla "Kilos de explosivos estimados por m³ de roca" (Mamani López,
 * R.J., "Diseño de mallas de perforación en minería subterránea", material de curso, Bolivia).
 * A menor área de sección, mayor factor de carga (más perímetro relativo al volumen); a mayor
 * dureza/tenacidad de la roca, también mayor factor de carga. Devuelve el rango [min, max] kg/m³
 * de la fila correspondiente — no se interpola entre filas porque la fuente las presenta como
 * bandas discretas, no como una función continua.
 */
function factorCargaPorAreaYRoca(areaM2: number, categoria: "dura" | "intermedia" | "suave"): [number, number] {
  const filas: Array<{ hasta: number; dura: [number, number]; intermedia: [number, number]; suave: [number, number] }> = [
    { hasta: 5, dura: [2.6, 3.2], intermedia: [1.8, 2.3], suave: [1.2, 1.6] },
    { hasta: 10, dura: [2.0, 2.6], intermedia: [1.4, 1.8], suave: [0.9, 1.2] },
    { hasta: 20, dura: [1.65, 2.0], intermedia: [1.1, 1.4], suave: [0.6, 0.9] },
    { hasta: 40, dura: [1.2, 1.65], intermedia: [0.75, 1.1], suave: [0.4, 0.6] },
    { hasta: 60, dura: [0.8, 1.2], intermedia: [0.5, 0.75], suave: [0.3, 0.4] },
  ];
  const fila = filas.find((f) => areaM2 <= f.hasta) ?? filas[filas.length - 1];
  return fila[categoria];
}

/**
 * Número de taladros a partir del RMR y el área de la sección — Ecuación 2 de Beltrán Velásquez,
 * S. (2022) "Diseño de malla de perforación y voladura para optimizar la productividad en una
 * mina subterránea en Pataz, La Libertad 2020" (tesis de titulación, Universidad Privada del
 * Norte): N = RMR·√(Sección)/2.5, con Sección = ancho·alto·factor de corrección geométrica
 * (0.88 para secciones en arco, verificado contra el ejemplo de la tesis: RMR=55,
 * 1.70×1.80×0.88 → N=36; 1.0 para secciones rectangulares sin corrección).
 */
function numeroTaladrosPorRmr(rmr: number, anchoM: number, altoM: number, factorGeometrico: number): number {
  const seccion = Math.max(0.1, anchoM * altoM * factorGeometrico);
  return Math.round((rmr * Math.sqrt(seccion)) / 2.5);
}

/**
 * Genera la malla completa (alivio + anillos del arranque + contorno) para una seccion dada.
 * Fuente unica compartida por la vista en vivo y por la carga de plantillas, para que ambas
 * generen exactamente los mismos puntos a partir de los mismos parametros.
 */
function construirTaladrosMalla(opciones: {
  ancho: number;
  alto: number;
  tipoSeccion: TipoSeccionPlantilla;
  corona: number;
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  avanceM: number;
  rmr: number;
  metodoDiseno: MetodoDisenoArranque;
  patronContorno: TipoPatronContorno;
}): Taladro[] {
  const { tipoSeccion, numAlivios, diametroAlivioMm, diametroProdMm, avanceM, rmr, metodoDiseno, patronContorno } = opciones;
  const W = Math.max(0.5, opciones.ancho);
  const H = Math.max(0.5, opciones.alto);
  const cx = W / 2;
  const scaleY = H / 2.5;

  // Geometría de corona/hastial — MISMA fórmula que `calcularContornoEnVivo` (arriba), para que el
  // techo de taladros coincida siempre con el contorno dibujado. Antes esta función asumía un techo
  // en arco (hHastial≈H*0.55, cy=H*0.42) para cualquier tipo de sección, incluida "rectangular" —
  // que no tiene corona: eso hacía que el arranque y la corona quedaran flotando a mitad de altura
  // en vez de pegados al techo plano, dejando además los hastiales sin taladros en el tercio
  // superior de la galería.
  let hHastial: number;
  let hCorona: number;
  if (tipoSeccion === "rectangular") {
    hHastial = H;
    hCorona = 0;
  } else if (tipoSeccion === "herradura") {
    hCorona = W / 2;
    hHastial = Math.max(0, H - hCorona);
  } else {
    hCorona = tipoSeccion === "tipo_d" ? Math.min(W * 0.35, H * 0.5) : Math.min(opciones.corona, H * 0.8);
    hHastial = Math.max(0, H - hCorona);
  }
  // Centro del arranque: en secciones con corona se ubica cerca del centroide real de toda la cara
  // (un poco por debajo de la mitad, aprox. lo que pesa la caja recta frente al arco); en rectangular
  // no hay arco que compense, así que el centro geométrico real es H/2.
  const cy = tipoSeccion === "rectangular" ? H / 2 : H * 0.42;

  // "Corte paralelo" y "Expansión sucesiva" son el mismo método real (el cuele cilíndrico/paralelo
  // ES, por definición, una expansión sucesiva hacia el hueco vacío — no son dos fórmulas
  // distintas): ambos usan la progresión geométrica de Holmberg. "Práctico empírico" sí es un
  // método distinto: bandas de distancia fijas tabuladas por zona, sin diámetro equivalente.
  const etapas =
    metodoDiseno === "practico_empirico"
      ? calcularEtapasPracticoEmpirico()
      : calcularHolmberg(numAlivios, diametroAlivioMm, avanceM).etapas;

  // Espaciamiento de contorno: espContornoDuro (recorte/smooth blasting, tabla por RMR) se aplica
  // solo donde el patrón elegido lo pide; el resto usa la regla práctica SIN control (más abierta).
  // - uniforme: ningún tramo se dispara como recorte (todo el contorno a espaciamiento normal).
  // - corona_recorte: solo alzas/techo en recorte — convención minera (Mamani López, p.5: "en obras
  //   mineras [el precorte va] en las alzas o techo").
  // - recorte_continuo: alzas Y cuadradores en recorte, disparados juntos como "taladros
  //   periféricos" — convención de obra civil (misma referencia: "obras civiles en los cuadradores
  //   y el techo") y práctica general de smooth blasting (Diéguez, "Diseño de voladuras de contorno
  //   para el laboreo de túneles", Minería y Geología, ISMM: alzas y cuadradores se disparan juntos
  //   al final de la ronda).
  const espContornoDuro = calcularEspaciamientoContornoPorRmr(rmr);
  const espContornoNormal = calcularEspaciamientoProduccionReglaPractica(diametroProdMm);
  const espContornoCorona = patronContorno === "uniforme" ? espContornoNormal : espContornoDuro;
  const espContornoHastial = patronContorno === "recorte_continuo" ? espContornoDuro : espContornoNormal;
  const espContorno = espContornoHastial; // usado por arrastres (piso) — sin cambios, no forma parte del patrón de contorno

  const lista: Taladro[] = [];
  let idSeq = 1;
  const crearTal = (
    x: number,
    y: number,
    zona: string,
    cargado: boolean,
    color: string,
    diamMm: number,
    lookout = 0
  ) => {
    // fondo.z = collar.z (plano) a propósito: esta malla es un esquema 2D (vista de frente, igual
    // que los diagramas de la referencia), no la ronda 3D real. Si fondo.z = avanceM (~3.2-3.6 m),
    // el editor CAD dibuja un cilindro 3D de esa longitud parado sobre el plano del dibujo —mucho
    // más largo que la propia malla (~2.5 m)— y en cualquier ángulo de cámara que no sea la vista
    // frontal exacta se ve como una "vara" larga en vez de un punto. La profundidad real de
    // perforación se conserva en `profundidad_m` (se usa para metros perforados, carga, etc.).
    const tal: Taladro = {
      id: `tal-live-${idSeq++}`,
      fila: idSeq,
      columna: 1,
      collar: { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, z: 0 },
      fondo: { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, z: 0 },
      diametroMm: diamMm,
      profundidad_m: avanceM,
      taco_m: cargado ? 1.0 : 0,
      longitudCarga_m: cargado ? Math.max(0, avanceM - 1.0) : 0,
    };
    (tal as any).zona = zona;
    (tal as any).cargado = cargado;
    (tal as any).tipo = cargado ? "produccion" : "alivio";
    (tal as any).color = color;
    (tal as any).lookout = lookout;
    lista.push(tal);
  };

  // 1. ALIVIOS: agrupados muy cerca del centro (radio pequeño y fijo, actuan como un unico taladro equivalente).
  const nAlivio = Math.max(1, Math.round(numAlivios));
  const radioClusterAlivio = Math.max(0.03, (diametroAlivioMm / 1000) * 0.65);
  if (nAlivio === 1) {
    crearTal(cx, cy, "alivio", false, "#38bdf8", diametroAlivioMm);
  } else {
    for (let i = 0; i < nAlivio; i++) {
      const ang = (i / nAlivio) * Math.PI * 2;
      crearTal(
        cx + radioClusterAlivio * Math.cos(ang),
        cy + radioClusterAlivio * Math.sin(ang),
        "alivio",
        false,
        "#38bdf8",
        diametroAlivioMm
      );
    }
  }

  // 2. ANILLOS DEL ARRANQUE (cuadrante 1-4): radio = E_k / sqrt(2) de la secuencia Holmberg real
  //    (mismo modelo geometrico que generarTaladrosFrenteTunel en packages/core), alternando 45°
  //    entre anillos consecutivos (pinwheel). Antes estos anillos usaban fracciones fijas
  //    (0.16/0.28/0.44/0.62 * escala) que no tenian relacion con el burden/espaciamiento calculado.
  // Si una seccion no cabe dentro de la galeria (galeria chica / avance grande) se deja de agregar
  // anillos en vez de aplastarlos unos sobre otros — calcularHolmberg ya detiene la secuencia por
  // su propia regla (lado >= sqrt(avance)); este limite es solo una salvaguarda geometrica extra.
  const radioMaxArranque = Math.min(W, H) * 0.42;
  for (let idx = 0; idx < Math.min(4, etapas.length); idx++) {
    const et = etapas[idx];
    const r = et.e / Math.SQRT2;
    if (r > radioMaxArranque) break;
    const k = idx + 1;
    const anguloBase = k % 2 === 1 ? Math.PI / 4 : 0;
    for (let j = 0; j < 4; j++) {
      const ang = anguloBase + j * (Math.PI / 2);
      crearTal(cx + r * Math.cos(ang), cy + r * Math.sin(ang), `cuadrante${k}`, true, "#f97316", diametroProdMm);
    }
  }

  // 3. CONTORNO: cuadradores (hastiales), arrastres (piso) y corona/alzas, con la CANTIDAD de
  //    taladros escalada por el espaciamiento segun clase de roca (antes eran conteos fijos: 4
  //    cuadradores + 5 arrastres + 10 corona para cualquier tamaño de seccion o tipo de roca).
  //    hHastial/hCorona ya se calcularon arriba con la misma fórmula que calcularContornoEnVivo.

  // 3a. Arrastres (piso)
  const yArrastre = 0.22;
  const xMinArr = 0.25;
  const xMaxArr = Math.max(xMinArr + 0.1, W - 0.25);
  const numArrastre = Math.max(3, Math.round((xMaxArr - xMinArr) / espContorno) + 1);
  for (let i = 0; i < numArrastre; i++) {
    const xi = numArrastre === 1 ? (xMinArr + xMaxArr) / 2 : xMinArr + (i / (numArrastre - 1)) * (xMaxArr - xMinArr);
    crearTal(xi, yArrastre, "arrastre", true, "#ef4444", diametroProdMm, 3);
  }

  // 3b. Cuadradores (hastiales, pares izquierda/derecha)
  const offHastial = 0.30;
  const yHastialMin = 0.35;
  const yHastialMax = Math.max(yHastialMin + 0.1, hHastial - 0.15);
  const numCuadradorLado = Math.max(1, Math.round((yHastialMax - yHastialMin) / espContornoHastial));
  for (let i = 0; i < numCuadradorLado; i++) {
    const t = numCuadradorLado === 1 ? 0.5 : i / (numCuadradorLado - 1);
    const y = yHastialMin + t * (yHastialMax - yHastialMin);
    crearTal(offHastial, y, "cuadradores", true, "#f97316", diametroProdMm);
    crearTal(W - offHastial, y, "cuadradores", true, "#f97316", diametroProdMm);
  }

  // 3c. Corona / alzas — "rectangular" no tiene corona (techo plano, en línea con
  //     calcularContornoEnVivo): se coloca una fila de taladros de techo recta, con el mismo estilo
  //     que el arrastre pero en y=H. Las secciones con arco replican la MISMA parametrización que
  //     su contorno respectivo (herradura: semicírculo real de radio W/2; tipo_d/arco_personalizado:
  //     arco elíptico x-lineal / y=hCorona·sin — antes esta función siempre usaba un semicírculo de
  //     radio fijo W/2-0.22 sin importar el tipo, así que en tipo_d/arco_personalizado la corona de
  //     taladros podía sobresalir del contorno real, más angosto).
  if (tipoSeccion === "rectangular") {
    const xMinTecho = 0.25;
    const xMaxTecho = Math.max(xMinTecho + 0.1, W - 0.25);
    const numTecho = Math.max(3, Math.round((xMaxTecho - xMinTecho) / espContornoCorona) + 1);
    for (let i = 0; i < numTecho; i++) {
      const xi = numTecho === 1 ? (xMinTecho + xMaxTecho) / 2 : xMinTecho + (i / (numTecho - 1)) * (xMaxTecho - xMinTecho);
      crearTal(xi, H - yArrastre, "corona", true, "#10b981", diametroProdMm, -3);
    }
  } else if (tipoSeccion === "herradura") {
    const radioCorona = Math.max(0.1, hCorona - 0.22);
    const anguloCoronaIni = 0.15 * Math.PI;
    const anguloCoronaFin = 0.85 * Math.PI;
    const longitudArcoCorona = radioCorona * (anguloCoronaFin - anguloCoronaIni);
    const numCorona = Math.max(3, Math.round(longitudArcoCorona / espContornoCorona) + 1);
    for (let i = 0; i < numCorona; i++) {
      const t = numCorona === 1 ? 0.5 : i / (numCorona - 1);
      const ang = anguloCoronaIni + t * (anguloCoronaFin - anguloCoronaIni);
      const x = W / 2 + radioCorona * Math.cos(ang);
      const y = hHastial + radioCorona * Math.sin(ang);
      crearTal(x, y, "corona", true, "#10b981", diametroProdMm);
    }
  } else {
    // tipo_d / arco_personalizado: arco aplanado (x lineal, y = hCorona·sin), igual que su contorno.
    const inset = Math.min(0.22, W * 0.08);
    const hCoronaTal = Math.max(0.05, hCorona - 0.15);
    const numCorona = Math.max(4, Math.round((Math.PI * hCoronaTal) / espContornoCorona) + 1);
    for (let i = 0; i <= numCorona; i++) {
      const t = i / numCorona;
      const ang = t * Math.PI;
      const x = inset + (1 - t) * (W - 2 * inset);
      const y = hHastial + hCoronaTal * Math.sin(ang);
      crearTal(x, y, "corona", true, "#10b981", diametroProdMm);
    }
  }

  // 3d. Recorte / control: anillo interno de voladura controlada. No corresponde a un tipo con
  //     nombre propio en la referencia de diseño (que solo nombra alzas/ayudas/cuadradores/
  //     arranque/arrastre), asi que se mantiene como refuerzo visual fijo. En rectangular no hay
  //     corona que reforzar (los 4 puntos superiores quedaban fuera del techo plano), asi que ahi
  //     solo se colocan los 4 puntos de hastial.
  const yRec1 = hHastial * 0.5;
  const yRec2 = hHastial * 0.85;
  crearTal(0.22, yRec1, "recorte", true, "#ffffff", diametroProdMm);
  crearTal(0.22, yRec2, "recorte", true, "#ffffff", diametroProdMm);
  crearTal(W - 0.22, yRec1, "recorte", true, "#ffffff", diametroProdMm);
  crearTal(W - 0.22, yRec2, "recorte", true, "#ffffff", diametroProdMm);
  if (tipoSeccion !== "rectangular") {
    crearTal(0.40, hHastial + 0.15 * scaleY, "recorte", true, "#ffffff", diametroProdMm);
    crearTal(W - 0.40, hHastial + 0.15 * scaleY, "recorte", true, "#ffffff", diametroProdMm);
    crearTal(0.55, hHastial + 0.45 * scaleY, "recorte", true, "#ffffff", diametroProdMm);
    crearTal(W - 0.55, hHastial + 0.45 * scaleY, "recorte", true, "#ffffff", diametroProdMm);
  }

  return lista;
}

export default function PanelDatosRmrMetodo({
  visible,
  onOcultar,
  poligonoCresta = [],
  onCambiarPoligono,
  lineasCad = [],
  polilineasCad = [],
  taladros = [],
  onCambiarTaladros,
  onGenerarTaladros,
  onAplicarParametros,
  mostrarAviso,
}: Props) {
  // Detección reactiva de dispositivo móvil
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Posición del menú: "abajo" (Bottom Sheet desplegable) por defecto a solicitud del usuario, o "lateral"
  const [posicion, setPosicion] = usePersistedState<"abajo" | "lateral">("panelRmr:posicion", "abajo");
  const [minimizado, setMinimizado] = usePersistedState<boolean>("panelRmr:minimizado", false);

  // Navegación entre pestañas
  const [tab, setTab] = useState<TabPanel>("datos");
  const tabs: { id: TabPanel; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "rmr", label: "RMR" },
    { id: "metodo", label: "Método" },
    { id: "resultado", label: "Resultado" },
  ];

  // TAB 1: DATOS GEOMÉTRICOS & PLANTILLA
  const [tipoSeccion, setTipoSeccion] = useState<TipoSeccionPlantilla>("herradura");
  const [anchoGaleria, setAnchoGaleria] = useState<number>(2.5);
  const [altoGaleria, setAltoGaleria] = useState<number>(2.5);
  const [alturaCorona, setAlturaCorona] = useState<number>(1.25);
  const [patronContorno, setPatronContorno] = useState<TipoPatronContorno>("corona_recorte");

  // Parámetros de Alivio y Perforación
  const [numAlivios, setNumAlivios] = useState<number>(4);
  const [diametroAlivioMm, setDiametroAlivioMm] = useState<number>(102);
  const [diametroProdMm, setDiametroProdMm] = useState<number>(45);
  const [avanceM, setAvanceM] = useState<number>(3.6);

  // TAB 2: GEOMECÁNICA RMR
  const [rmrScore, setRmrScore] = useState<number>(45);

  // TAB 3: MÉTODO Y SECUENCIA DE CORTE
  const [metodoDiseno, setMetodoDiseno] = useState<MetodoDisenoArranque>("corte_paralelo");
  const [tipoCorte, setTipoCorte] = useState<TipoCorteArranque>("paralelo_quemado");

  // Control de activación de la malla (en blanco hasta que el usuario jale/cargue una plantilla o diseñe)
  const [mallaGenerada, setMallaGenerada] = useState<boolean>(() => {
    return Boolean((taladros && taladros.length > 0) || (poligonoCresta && poligonoCresta.length > 0));
  });

  // Si externamente entran taladros o polígonos, marcar como malla generada
  useEffect(() => {
    if ((taladros && taladros.length > 0) || (poligonoCresta && poligonoCresta.length > 0)) {
      setMallaGenerada(true);
    }
  }, [taladros?.length, poligonoCresta?.length]);

  // Estado del Concepto Expandible (para ayudar didácticamente al usuario)
  const [conceptoAbierto, setConceptoAbierto] = useState<string | null>(null);

  // TAB 4: RESULTADOS DETECTADOS CAD
  const [galeriaDetectada, setGaleriaDetectada] = useState<{
    ancho: number;
    alto: number;
    area: number;
    perimetro: number;
    centroX: number;
    centroY: number;
    corona: number;
  }>({
    ancho: 2.5,
    alto: 2.5,
    area: 3.719,
    perimetro: 8.122,
    centroX: 3.499,
    centroY: 10.139,
    corona: 2.0,
  });

  const [taladrosDetectados, setTaladrosDetectados] = useState<{
    total: number;
    cargados: number;
    alivio: number;
    metros: number;
  }>({
    total: 0,
    cargados: 0,
    alivio: 0,
    metros: 0,
  });

  // =========================================================================
  // CÁLCULOS GEOMÉTRICOS RIGUROSOS
  // =========================================================================
  const metricasSeccion = useMemo(() => {
    const W = Math.max(0.5, anchoGaleria);
    const H = Math.max(0.5, altoGaleria);

    if (tipoSeccion === "rectangular") {
      const area = W * H;
      const perimetro = 2 * (W + H);
      return { area, perimetro, corona: 0, hastial: H };
    }

    if (tipoSeccion === "herradura") {
      const radio = W / 2;
      const hCorona = Math.min(radio, H);
      const hHastial = Math.max(0, H - hCorona);
      const area = W * hHastial + (Math.PI * radio * radio) / 2;
      const perimetro = W + 2 * hHastial + Math.PI * radio;
      return { area, perimetro, corona: hCorona, hastial: hHastial };
    }

    if (tipoSeccion === "tipo_d") {
      const hCorona = Math.min(W * 0.35, H);
      const hHastial = Math.max(0, H - hCorona);
      // Arco rebajado de corona + caja inferior
      const area = W * hHastial + (2 / 3) * W * hCorona;
      const perimetro = W + 2 * hHastial + Math.sqrt(W * W + (16 / 3) * hCorona * hCorona);
      return { area, perimetro, corona: hCorona, hastial: hHastial };
    }

    // Arco personalizado
    const hCorona = Math.min(alturaCorona, H);
    const hHastial = Math.max(0, H - hCorona);
    const area = W * hHastial + (Math.PI * (W / 2) * hCorona) / 2;
    const perimetro = W + 2 * hHastial + Math.PI * Math.sqrt((W * W + hCorona * hCorona) / 2);
    return { area, perimetro, corona: hCorona, hastial: hHastial };
  }, [tipoSeccion, anchoGaleria, altoGaleria, alturaCorona]);

  // =========================================================================
  // DIÁMETRO EQUIVALENTE DE ALIVIO Y SECUENCIA DE ARRANQUE (CUELE HOLMBERG)
  // De = D_individual * sqrt(N); B1=1.5*De, E1=B1*sqrt(2); Bn=E(n-1), En=1.5*Bn*sqrt(2)
  // (metodo simplificado de Jimeno Tabla 22.2, delegado en
  // packages/core/src/formulas/mining/tunnelRound.ts::calcularArranqueHolmberg).
  // =========================================================================
  const resultadoHolmberg = useMemo(
    () => calcularHolmberg(numAlivios, diametroAlivioMm, avanceM),
    [numAlivios, diametroAlivioMm, avanceM]
  );
  const diametroEquivalente = useMemo(
    () => ({ deMm: resultadoHolmberg.deMm, deM: resultadoHolmberg.deM }),
    [resultadoHolmberg]
  );
  // La lista mostrada debe coincidir con la que realmente usa construirTaladrosMalla: si el método
  // es "práctico/empírico" no se muestran las etapas de Holmberg (que ese método ni siquiera usa),
  // sino las 3 bandas fijas por zona.
  const etapasArranque = metodoDiseno === "practico_empirico" ? calcularEtapasPracticoEmpirico() : resultadoHolmberg.etapas;

  // =========================================================================
  // RECOMENDACIÓN GEOMECÁNICA RMR (BIENIAWSKI / SUECO)
  // =========================================================================
  const recomendacionRmr = useMemo(() => {
    const areaM2 = metricasSeccion.area;
    if (rmrScore > 60) {
      const [fcMin, fcMax] = factorCargaPorAreaYRoca(areaM2, "suave");
      return {
        tipo: "Roca Suave",
        clase: "Clase I - II (Buena / Muy Buena)",
        espaciamiento: calcularEspaciamientoContornoPorRmr(rmrScore),
        aliviosSugeridos: 4,
        factorCarga: `${fcMin.toFixed(2)} - ${fcMax.toFixed(2)} kg/m³`,
        colorBadge: "#10b981",
        descripcion:
          "Roca de alta calidad geomecánica y baja resistencia al corte. Permite mayor espaciamiento y menor factor de carga sin generar sobre-rotura.",
      };
    }
    if (rmrScore >= 41) {
      const [fcMin, fcMax] = factorCargaPorAreaYRoca(areaM2, "intermedia");
      return {
        tipo: "Roca Semidura",
        clase: "Clase III (Regular)",
        espaciamiento: calcularEspaciamientoContornoPorRmr(rmrScore),
        aliviosSugeridos: 4,
        factorCarga: `${fcMin.toFixed(2)} - ${fcMax.toFixed(2)} kg/m³`,
        colorBadge: "var(--acento, #f97316)",
        descripcion:
          "Calidad geomecánica media. Requiere espaciamiento controlado en contorno (corona y hastiales) para preservar las discontinuidades estructurales.",
      };
    }
    const [fcMin, fcMax] = factorCargaPorAreaYRoca(areaM2, "dura");
    return {
      tipo: "Roca Dura",
      clase: "Clase IV - V (Mala / Muy Mala o Gran Dureza)",
      espaciamiento: calcularEspaciamientoContornoPorRmr(rmrScore),
      aliviosSugeridos: 5,
      factorCarga: `${fcMin.toFixed(2)} - ${fcMax.toFixed(2)} kg/m³`,
      colorBadge: "#ef4444",
      descripcion:
        "Roca tenaz o de macizo fuertemente alterado/confinado. Requiere 5 taladros de alivio para ampliar la cara libre y menor espaciamiento para evitar el soplado.",
    };
  }, [rmrScore, metricasSeccion.area]);

  // Estimación de número de taladros (Beltrán Velásquez, 2022, Ecuación 2 — ver cita en
  // numeroTaladrosPorRmr): factor de corrección geométrica 0.88 para secciones en arco
  // (herradura/tipo D/arco personalizado, igual que en el ejemplo validado de la tesis) y 1.0
  // para rectangular (ya es el área plena, sin arco que corregir).
  const numeroTaladrosEstimado = useMemo(() => {
    const factorGeometrico = tipoSeccion === "rectangular" ? 1.0 : 0.88;
    return Math.max(1, numeroTaladrosPorRmr(rmrScore, anchoGaleria, altoGaleria, factorGeometrico));
  }, [rmrScore, anchoGaleria, altoGaleria, tipoSeccion]);

  // =========================================================================
  // GENERACIÓN DE MALLA EN VIVO (LIVE REAL-TIME CALCULATION)
  // =========================================================================
  const calcularContornoEnVivo = (
    tipo: TipoSeccionPlantilla,
    ancho: number,
    alto: number,
    corona: number
  ): Punto2D[] => {
    const W = Math.max(0.5, ancho);
    const H = Math.max(0.5, alto);

    if (tipo === "rectangular") {
      return [
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: W, y: H },
        { x: 0, y: H },
      ];
    }

    if (tipo === "herradura") {
      const radio = W / 2;
      const hHastial = Math.max(0, H - radio);
      const pts: Punto2D[] = [];
      pts.push({ x: 0, y: 0 });
      pts.push({ x: W, y: 0 });
      pts.push({ x: W, y: hHastial });
      const numPtsArco = 16;
      for (let i = 0; i <= numPtsArco; i++) {
        const ang = (i / numPtsArco) * Math.PI;
        const x = W / 2 + radio * Math.cos(ang);
        const y = hHastial + radio * Math.sin(ang);
        pts.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      }
      pts.push({ x: 0, y: 0 });
      return pts;
    }

    // tipo_d o arco_personalizado
    const hCorona = tipo === "tipo_d" ? Math.min(W * 0.35, H * 0.5) : Math.min(corona, H * 0.8);
    const hHastial = Math.max(0, H - hCorona);
    const pts: Punto2D[] = [];
    pts.push({ x: 0, y: 0 });
    pts.push({ x: W, y: 0 });
    pts.push({ x: W, y: hHastial });
    const numPts = 16;
    for (let i = 0; i <= numPts; i++) {
      const t = i / numPts;
      const ang = t * Math.PI;
      const x = W - t * W;
      const y = hHastial + hCorona * Math.sin(ang);
      pts.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    }
    pts.push({ x: 0, y: 0 });
    return pts;
  };

  const calcularTaladrosEnVivo = (): Taladro[] =>
    construirTaladrosMalla({
      ancho: anchoGaleria,
      alto: altoGaleria,
      tipoSeccion,
      corona: alturaCorona,
      numAlivios,
      diametroAlivioMm,
      diametroProdMm,
      avanceM,
      rmr: rmrScore,
      metodoDiseno,
      patronContorno,
    });

  const handleCargarPlantilla = (p: PlantillaMalla) => {
    setTipoSeccion(p.tipoSeccion);
    setAnchoGaleria(p.ancho);
    setAltoGaleria(p.alto);
    setAlturaCorona(p.corona);
    setNumAlivios(p.numAlivios);
    setDiametroAlivioMm(p.diametroAlivioMm);
    setDiametroProdMm(p.diametroProdMm);
    setAvanceM(p.avanceM);
    setRmrScore(p.rmr);
    setMallaGenerada(true);

    const contorno = calcularContornoEnVivo(p.tipoSeccion, p.ancho, p.alto, p.corona);
    const lista = construirTaladrosMalla({
      ancho: p.ancho,
      alto: p.alto,
      tipoSeccion: p.tipoSeccion,
      corona: p.corona,
      numAlivios: p.numAlivios,
      diametroAlivioMm: p.diametroAlivioMm,
      diametroProdMm: p.diametroProdMm,
      avanceM: p.avanceM,
      rmr: p.rmr,
      metodoDiseno,
      patronContorno,
    });

    if (onCambiarPoligono) {
      onCambiarPoligono(contorno);
    }
    if (onGenerarTaladros) {
      onGenerarTaladros(lista);
    } else if (onCambiarTaladros) {
      onCambiarTaladros(lista);
    }

    mostrarAviso?.(`⚡ Plantilla cargada: ${p.nombre} (${p.badge}) - ${lista.length} taladros.`);
  };

  const handleLimpiarLienzo = () => {
    setMallaGenerada(false);
    if (onCambiarPoligono) {
      onCambiarPoligono([]);
    }
    if (onCambiarTaladros) {
      onCambiarTaladros([]);
    }
    mostrarAviso?.("✓ Lienzo en blanco: Malla y contorno limpiados.");
  };

  // Efecto reactivo para actualizar la malla EN VIVO en el Canvas 3D (solo si la malla está activa)
  useEffect(() => {
    if (!visible || !mallaGenerada) return;
    const contorno = calcularContornoEnVivo(tipoSeccion, anchoGaleria, altoGaleria, alturaCorona);
    const nuevosTaladros = calcularTaladrosEnVivo();

    if (onCambiarPoligono) {
      onCambiarPoligono(contorno);
    }
    if (onGenerarTaladros) {
      onGenerarTaladros(nuevosTaladros);
    } else if (onCambiarTaladros) {
      onCambiarTaladros(nuevosTaladros);
    }
  }, [
    visible,
    mallaGenerada,
    tipoSeccion,
    anchoGaleria,
    altoGaleria,
    alturaCorona,
    numAlivios,
    diametroAlivioMm,
    diametroProdMm,
    avanceM,
    rmrScore,
    metodoDiseno,
    tipoCorte,
    patronContorno,
  ]);

  // =========================================================================
  // ANÁLISIS NO DESTRUCTIVO CAD (INSPECCIÓN DE CAPAS ACTIVAS)
  // =========================================================================
  const ejecutarAnalisisCad = (cambiarTabResultado = true) => {
    const puntosTotales: { x: number; y: number }[] = [];

    // Recolectar vértices de polilíneas
    polilineasCad.forEach((pl) => {
      pl.puntos.forEach((p) => puntosTotales.push({ x: p.x, y: p.y }));
    });

    // Recolectar vértices de líneas
    lineasCad.forEach((l) => {
      puntosTotales.push({ x: l.p1.x, y: l.p1.y });
      puntosTotales.push({ x: l.p2.x, y: l.p2.y });
    });

    // Polígono de cresta o galería
    poligonoCresta.forEach((p) => {
      puntosTotales.push({ x: p.x, y: p.y });
    });

    let ancho = metricasSeccion.corona > 0 ? anchoGaleria : 2.5;
    let alto = altoGaleria;
    let area = metricasSeccion.area;
    let perimetro = metricasSeccion.perimetro;
    let cx = 3.499;
    let cy = 10.139;
    let corona = metricasSeccion.corona || 2.0;

    if (puntosTotales.length >= 3) {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      puntosTotales.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      ancho = Math.round((maxX - minX) * 100) / 100;
      alto = Math.round((maxY - minY) * 100) / 100;
      cx = Math.round(((minX + maxX) / 2) * 1000) / 1000;
      cy = Math.round(((minY + maxY) / 2) * 1000) / 1000;
      area = Math.round(ancho * alto * 0.85 * 1000) / 1000;
      perimetro = Math.round((2 * ancho + 2 * alto * 0.9) * 1000) / 1000;
      corona = Math.round((ancho / 2) * 100) / 100;
    }

    setGaleriaDetectada({
      ancho,
      alto,
      area,
      perimetro,
      centroX: cx,
      centroY: cy,
      corona,
    });

    // Detección de taladros
    const totalTal = taladros.length;
    const alivios = taladros.filter((t) => (t as any).tipo === "alivio" || (t as any).cargado === false).length;
    const cargados = totalTal - alivios;
    const metrosPerf = taladros.reduce((acc, t) => acc + (t.profundidad_m || (t as any).longitud_m || 3.6), 0);

    setTaladrosDetectados({
      total: totalTal,
      cargados,
      alivio: alivios,
      metros: Math.round(metrosPerf * 10) / 10,
    });

    if (mostrarAviso) {
      mostrarAviso("✓ Análisis CAD completado: Geometría y taladros sincronizados.");
    }

    if (cambiarTabResultado) {
      setTab("resultado");
    }
  };

  // Cargar referencia P&V Jumbo 3.5 x 3.5
  const cargarReferenciaPyV = () => {
    setAnchoGaleria(3.5);
    setAltoGaleria(3.5);
    setAlturaCorona(1.75);
    setNumAlivios(4);
    setDiametroAlivioMm(102);
    setDiametroProdMm(45);
    setRmrScore(35); // RMR 31-40
    setTipoSeccion("herradura");
    if (mostrarAviso) {
      mostrarAviso("Referencia cargada: Jumbo 3.5 × 3.5 m | RMR 31-40");
    }
  };

  // Restablecer proporciones
  const restablecerProporciones = () => {
    setAnchoGaleria(2.5);
    setAltoGaleria(2.5);
    setAlturaCorona(1.25);
    setNumAlivios(4);
    setDiametroAlivioMm(102);
    setRmrScore(45);
    setTipoSeccion("herradura");
    if (mostrarAviso) {
      mostrarAviso("Proporciones restablecidas a 2.5 × 2.5 m");
    }
  };

  // Aplicar sugerencia geomecánica
  const aplicarSugerenciaRmr = (aliviosSugeridos: number) => {
    setNumAlivios(aliviosSugeridos);
    if (onAplicarParametros) {
      onAplicarParametros({
        ancho: anchoGaleria,
        alto: altoGaleria,
        area: metricasSeccion.area,
        perimetro: metricasSeccion.perimetro,
        numAlivios: aliviosSugeridos,
        diametroAlivioMm,
        rmr: rmrScore,
      });
    }
    if (mostrarAviso) {
      mostrarAviso(`✓ Sugerencia aplicada: ${aliviosSugeridos} taladros de alivio configurados.`);
    }
  };

  // Navegación secuencial de pestañas
  const irPasoSiguiente = () => {
    const idx = tabs.findIndex((t) => t.id === tab);
    if (idx < tabs.length - 1) {
      setTab(tabs[idx + 1].id);
    } else {
      // Si estamos en Resultado, ejecutar análisis y avisar
      ejecutarAnalisisCad(false);
      if (mostrarAviso) {
        mostrarAviso("✓ Parámetros teóricos y CAD confirmados.");
      }
    }
  };

  const irPasoAnterior = () => {
    const idx = tabs.findIndex((t) => t.id === tab);
    if (idx > 0) {
      setTab(tabs[idx - 1].id);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="panel-datos-rmr-container"
      onClick={(e) => e.stopPropagation()}
      style={
        isMobile
          ? {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              width: "100%",
              maxWidth: "100vw",
              transform: "none",
              maxHeight: minimizado ? 44 : "64vh",
              height: minimizado ? 44 : "auto",
              background: "#0c121e",
              border: "1.5px solid rgba(249, 115, 22, 0.45)",
              borderBottom: "none",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.95), 0 0 25px rgba(249, 115, 22, 0.15)",
              display: "flex",
              flexDirection: "column",
              zIndex: 900,
              overflow: "hidden",
              color: "#f8fafc",
              fontFamily: "'Segoe UI', -apple-system, sans-serif",
              boxSizing: "border-box",
              transition: "max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease",
            }
          : posicion === "abajo"
          ? {
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(1180px, calc(100vw - 120px))",
              maxHeight: minimizado ? 46 : "48vh",
              height: minimizado ? 46 : "auto",
              background: "#0c121e",
              border: "1.5px solid rgba(249, 115, 22, 0.45)",
              borderBottom: "none",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.88), 0 0 25px rgba(249, 115, 22, 0.15)",
              display: "flex",
              flexDirection: "column",
              zIndex: 900,
              overflow: "hidden",
              color: "#f8fafc",
              fontFamily: "'Segoe UI', -apple-system, sans-serif",
              transition: "max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease",
            }
          : {
              position: "absolute",
              top: 24,
              right: 80,
              width: 400,
              maxWidth: "calc(100vw - 100px)",
              maxHeight: minimizado ? 46 : "calc(100vh - 80px)",
              height: minimizado ? 46 : "auto",
              background: "#0c121e",
              border: "1px solid rgba(249, 115, 22, 0.4)",
              borderRadius: 20,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.75), 0 0 20px rgba(249, 115, 22, 0.15)",
              display: "flex",
              flexDirection: "column",
              zIndex: 900,
              overflow: "hidden",
              color: "#f8fafc",
              fontFamily: "'Segoe UI', -apple-system, sans-serif",
              transition: "max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease",
            }
      }
    >
      {/* CABECERA PRINCIPAL */}
      <div
        style={{
          padding: isMobile ? "6px 12px 8px" : posicion === "abajo" ? "8px 16px 10px" : "14px 18px 10px",
          borderBottom: minimizado ? "none" : "1px solid #1e293b",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.45) 0%, rgba(12, 18, 30, 0.85) 100%)",
        }}
      >
        {(posicion === "abajo" || isMobile) && (
          <div
            onClick={() => setMinimizado(!minimizado)}
            style={{
              width: isMobile ? 32 : 38,
              height: 4,
              background: "rgba(255, 255, 255, 0.28)",
              borderRadius: 2,
              margin: "0 auto 5px",
              cursor: "pointer",
            }}
            title={minimizado ? "Expandir panel inferior" : "Comprimir panel"}
          />
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 11.5 : 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isMobile ? "DISEÑO DE MALLA" : "DISEÑO DE MALLA · SUBTERRÁNEA"}
            </span>
            {minimizado && (
              <span
                style={{
                  fontSize: isMobile ? 9 : 10,
                  fontWeight: 600,
                  color: "var(--acento, #f97316)",
                  background: "rgba(249, 115, 22, 0.12)",
                  padding: "2px 6px",
                  borderRadius: 12,
                  border: "1px solid rgba(249, 115, 22, 0.3)",
                  flexShrink: 0,
                }}
              >
                {anchoGaleria}×{altoGaleria}m · {tab.toUpperCase()}
              </span>
            )}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Botón para alternar posición entre Abajo y Lateral (solo desktop) */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setPosicion(posicion === "abajo" ? "lateral" : "abajo")}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  color: "#94a3b8",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title={posicion === "abajo" ? "Cambiar a panel lateral derecho" : "Acoplar abajo como panel inferior"}
              >
                {posicion === "abajo" ? "◫ Lateral" : "⬕ Abajo"}
              </button>
            )}

            {/* Botón Minimizar / Expandir */}
            <button
              type="button"
              onClick={() => setMinimizado(!minimizado)}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#cbd5e1",
                fontSize: 11,
                fontWeight: 700,
                padding: isMobile ? "3px 8px" : "3px 8px",
                cursor: "pointer",
              }}
              title={minimizado ? "Expandir menú completo" : "Comprimir menú"}
            >
              {isMobile ? (minimizado ? "▲" : "▼") : (minimizado ? "▲ Expandir" : "▼ Comprimir")}
            </button>

            {/* Botón Ocultar */}
            <button
              type="button"
              onClick={onOcultar}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--acento, #f97316)",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.05em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: isMobile ? "3px 5px" : "3px 6px",
              }}
              title="Ocultar panel"
            >
              <span>{isMobile ? "✕" : "✕ OCULTAR"}</span>
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        {!minimizado && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: isMobile ? 3 : 6,
              marginTop: isMobile ? 6 : 10,
            }}
          >
            {tabs.map((t) => {
              const activa = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: isMobile ? "5px 2px" : "6px 2px",
                    fontSize: isMobile ? 10 : 11,
                    fontWeight: activa ? 700 : 500,
                    borderRadius: 6,
                    border: activa ? "1px solid var(--acento, #f97316)" : "1px solid #334155",
                    background: activa ? "rgba(249, 115, 22, 0.22)" : "rgba(15, 23, 42, 0.6)",
                    color: activa ? "#ffffff" : "#94a3b8",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CUERPO PRINCIPAL CON DESPLAZAMIENTO (solo si no está minimizado) */}
      {!minimizado && (
        <div
          style={{
            padding: isMobile ? "10px 12px" : posicion === "abajo" ? "12px 18px" : "16px 18px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 10 : 12,
            maxHeight: isMobile
              ? "calc(64vh - 90px)"
              : posicion === "abajo"
              ? "calc(48vh - 95px)"
              : "calc(100vh - 180px)",
          }}
        >
        {/* ================================================================= */}
        {/* TAB 1: DATOS */}
        {/* ================================================================= */}
        {tab === "datos" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            {/* SECCIÓN 0: BANNER DE PLANTILLAS RÁPIDAS (JALAR PLANTILLA) */}
            <div
              style={{
                background: mallaGenerada ? "rgba(15, 23, 42, 0.5)" : "linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)",
                borderRadius: 12,
                padding: 14,
                border: mallaGenerada ? "1px solid #1e293b" : "1.5px solid var(--acento, #f97316)",
                boxShadow: mallaGenerada ? "none" : "0 0 20px rgba(249, 115, 22, 0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#ffffff",
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>⚡</span>
                  <span>{mallaGenerada ? "Plantilla Activa (En Vivo)" : "Jalar / Cargar Plantilla de Malla"}</span>
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 10,
                    background: mallaGenerada ? "rgba(16, 185, 129, 0.15)" : "rgba(249, 115, 22, 0.15)",
                    color: mallaGenerada ? "#10b981" : "var(--acento, #f97316)",
                    border: mallaGenerada ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(249, 115, 22, 0.3)",
                  }}
                >
                  {mallaGenerada ? "● EN VIVO" : "○ EN BLANCO"}
                </span>
              </div>

              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, lineHeight: 1.4 }}>
                {mallaGenerada
                  ? "Cualquier cambio se actualiza en tiempo real en el visor 3D. Puedes cambiar de plantilla o limpiar el lienzo:"
                  : "El lienzo está en blanco. Selecciona una plantilla predefinida para generar la malla de perforación:"}
              </div>

              {/* Grid de mini tarjetas de plantilla */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {PLANTILLAS_MALLA_PRESET.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleCargarPlantilla(p)}
                    style={{
                      padding: "8px 8px",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      background: "rgba(15, 23, 42, 0.6)",
                      color: "#f8fafc",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--acento, #f97316)";
                      e.currentTarget.style.background = "rgba(249, 115, 22, 0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#334155";
                      e.currentTarget.style.background = "rgba(15, 23, 42, 0.6)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff" }}>
                        {p.icono} {p.nombre}
                      </span>
                      <span style={{ fontSize: 9, color: p.color, fontWeight: 700 }}>
                        {p.badge}
                      </span>
                    </div>
                    <span style={{ fontSize: 9.5, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.numAlivios} Alivios · RMR {p.rmr}
                    </span>
                  </button>
                ))}
              </div>

              {mallaGenerada && (
                <button
                  type="button"
                  onClick={handleLimpiarLienzo}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    fontSize: 10.5,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: "1px solid #475569",
                    background: "rgba(30, 41, 59, 0.5)",
                    color: "#cbd5e1",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  ✕ Limpiar Malla (Volver a Lienzo en Blanco)
                </button>
              )}
            </div>

            {/* SECCIÓN 1: PLANTILLA GEOMÉTRICA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Plantilla geométrica de sección</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "seccion" ? null : "seccion")
                  }
                  title="Ver concepto geológico y de diseño"
                >
                  {conceptoAbierto === "seccion" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              {conceptoAbierto === "seccion" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--acento, #f97316)",
                  }}
                >
                  <b>Concepto Minero:</b> La forma de la galería distribuye los esfuerzos del macizo
                  rocoso. La sección <i>Herradura</i> distribuye favorablemente el esfuerzo tensional
                  hacia los hastiales, mientras que el <i>Arco rebajado (Tipo D)</i> optimiza el gálibo
                  en vetas angostas y labores de transporte.
                </div>
              )}

              {/* Botones de plantilla */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {(
                  [
                    { id: "rectangular", label: "Rectangular" },
                    { id: "herradura", label: "Herradura" },
                    { id: "tipo_d", label: "Tipo D" },
                    { id: "arco_personalizado", label: "Arco personalizado" },
                  ] as const
                ).map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setTipoSeccion(sec.id);
                      setMallaGenerada(true);
                    }}
                    style={{
                      padding: "8px 4px",
                      fontSize: 11,
                      fontWeight: tipoSeccion === sec.id ? 700 : 500,
                      borderRadius: 6,
                      border:
                        tipoSeccion === sec.id
                          ? "1px solid var(--acento, #f97316)"
                          : "1px solid #334155",
                      background:
                        tipoSeccion === sec.id
                          ? "rgba(249, 115, 22, 0.2)"
                          : "rgba(15, 23, 42, 0.4)",
                      color: tipoSeccion === sec.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>

              {/* Inputs de dimensiones */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Ancho galería (m)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={anchoGaleria}
                    onChange={(e) => {
                      setAnchoGaleria(Math.max(0.5, Number(e.target.value)));
                      setMallaGenerada(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Alto galería (m)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={altoGaleria}
                    onChange={(e) => {
                      setAltoGaleria(Math.max(0.5, Number(e.target.value)));
                      setMallaGenerada(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {tipoSeccion === "arco_personalizado" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Altura de flecha / corona (m)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.05}
                    value={alturaCorona}
                    onChange={(e) => {
                      setAlturaCorona(Math.max(0.1, Number(e.target.value)));
                      setMallaGenerada(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Métricas calculadas en vivo */}
              <div
                style={{
                  background: "rgba(7, 12, 22, 0.7)",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#cbd5e1",
                  marginTop: 6,
                }}
              >
                <div>
                  Área: <b style={{ color: "#ffffff" }}>{metricasSeccion.area.toFixed(3)} m²</b>
                </div>
                <div>
                  Perímetro:{" "}
                  <b style={{ color: "#ffffff" }}>{metricasSeccion.perimetro.toFixed(3)} m</b>
                </div>
              </div>
            </div>

            {/* BOTONES DE REFERENCIA RÁPIDA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                onClick={cargarReferenciaPyV}
                style={{
                  padding: "9px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid rgba(249, 115, 22, 0.4)",
                  background: "rgba(249, 115, 22, 0.12)",
                  color: "var(--acento, #f97316)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                CARGAR REFERENCIA P&amp;V · JUMBO 3.5 × 3.5 RMR 31-40
              </button>
              <button
                type="button"
                onClick={restablecerProporciones}
                style={{
                  padding: "8px 12px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                RESTABLECER PROPORCIONES DE LA PLANTILLA
              </button>
            </div>

            {/* SECCIÓN 2: PATRÓN DE CONTORNO */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
                Patrón de contorno
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {(
                  [
                    { id: "uniforme", label: "Corona uniforme" },
                    { id: "corona_recorte", label: "Corona + recorte" },
                    { id: "recorte_continuo", label: "Recorte continuo" },
                  ] as const
                ).map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setPatronContorno(pat.id)}
                    style={{
                      padding: "6px 4px",
                      fontSize: 10,
                      fontWeight: patronContorno === pat.id ? 700 : 500,
                      borderRadius: 6,
                      border:
                        patronContorno === pat.id
                          ? "1px solid var(--acento, #f97316)"
                          : "1px solid #334155",
                      background:
                        patronContorno === pat.id
                          ? "rgba(249, 115, 22, 0.2)"
                          : "rgba(15, 23, 42, 0.4)",
                      color: patronContorno === pat.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10, lineHeight: 1.4 }}>
                Cambia el espaciamiento de <b>corona</b> (techo) y <b>cuadradores</b> (hastiales):{" "}
                <b>Corona uniforme</b> = todo el contorno a espaciamiento normal, sin control (regla
                práctica de 2 pies por pulgada de diámetro). <b>Corona + recorte</b> = solo el techo
                a espaciamiento de smooth blasting (según RMR) — convención típica en obra minera.{" "}
                <b>Recorte continuo</b> = techo y hastiales juntos a espaciamiento de smooth
                blasting, como "taladros periféricos" — convención de obra civil y de voladura
                controlada en túneles (Diéguez, "Diseño de voladuras de contorno para el laboreo de
                túneles", <i>Minería y Geología</i>, ISMM).
              </div>

              {/* Leyenda Geométrica */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  fontSize: 10,
                  color: "#94a3b8",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#38bdf8",
                      display: "inline-block",
                    }}
                  />
                  <span>Azul claro: Alivio / Escariado</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#ffffff",
                      display: "inline-block",
                    }}
                  />
                  <span>Blanco: Recorte / Control</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                      display: "inline-block",
                    }}
                  />
                  <span>Verde: Corona</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: PARÁMETROS DEL ALIVIO / ARRANQUE */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Corte y Alivio (Cálculo De)</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "alivio" ? null : "alivio")
                  }
                >
                  {conceptoAbierto === "alivio" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              {conceptoAbierto === "alivio" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    lineHeight: 1.45,
                    borderLeft: "3px solid #38bdf8",
                  }}
                >
                  <b>¿Por qué Diámetro Equivalente?</b> En voladura subterránea no hay cara libre. Los
                  taladros vacíos sin cargar proporcionan el volumen de expansión inicial. Según la
                  fórmula sueca: <code>De = D · √N</code>. Múltiples alivios pequeños actúan
                  dinámicamente como un gran cilindro central de alivio.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    N° taladros alivio (N)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={numAlivios}
                    onChange={(e) => setNumAlivios(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Ø individual alivio (mm)
                  </label>
                  <input
                    type="number"
                    min={50}
                    step={1}
                    value={diametroAlivioMm}
                    onChange={(e) => setDiametroAlivioMm(Math.max(25, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Ø taladros producción (mm)
                  </label>
                  <input
                    type="number"
                    min={25}
                    step={1}
                    value={diametroProdMm}
                    onChange={(e) => setDiametroProdMm(Math.max(25, Number(e.target.value)))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      background: "#070c16",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: 9, color: "#64748b", display: "block", marginTop: 3 }}>
                    Referencia: dura 34mm · semidura 36mm · blanda 38mm (Mamani López)
                  </span>
                </div>
              </div>

              {/* Resultado del Diámetro Equivalente */}
              <div
                style={{
                  background: "rgba(56, 189, 248, 0.08)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "#e0f2fe",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Diámetro equivalente:</span>
                <b style={{ color: "#38bdf8", fontSize: 12 }}>
                  De = {diametroEquivalente.deMm.toFixed(1)} mm ({diametroEquivalente.deM.toFixed(3)} m)
                </b>
              </div>
            </div>

            {/* SECCIÓN 4: ACCIONES CAD NO DESTRUCTIVAS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={() => ejecutarAnalisisCad(false)}
                style={{
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                DETECTAR GALERÍA
              </button>
              <button
                type="button"
                onClick={() => ejecutarAnalisisCad(false)}
                style={{
                  padding: "8px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                DETECTAR TALADROS
              </button>
            </div>

            <button
              type="button"
              onClick={() => ejecutarAnalisisCad(true)}
              style={{
                padding: "10px 14px",
                fontSize: 11,
                fontWeight: 800,
                borderRadius: 8,
                border: "1px solid #10b981",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#34d399",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              ANALIZAR CAD · NO MODIFICAR
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: RMR */}
        {/* ================================================================= */}
        {tab === "rmr" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Clasificación Geomecánica (RMR)
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "rmr" ? null : "rmr")
                  }
                >
                  {conceptoAbierto === "rmr" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              {conceptoAbierto === "rmr" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--acento, #f97316)",
                  }}
                >
                  <b>Concepto Geomecánico:</b> El sistema RMR (Bieniawski) integra la resistencia de la
                  roca intacta, RQD, espaciamiento de discontinuidades y presencia de agua. En
                  voladura, un RMR bajo (roca fracturada o dura y confinada) exige menor espaciamiento
                  entre barrenos y un mayor factor de roca <i>K</i> para garantizar fragmentación
                  homogénea sin soplado.
                </div>
              )}

              {/* Slider interactivo y valor numérico */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#94a3b8",
                    marginBottom: 6,
                  }}
                >
                  <span>Índice RMR (0 a 100)</span>
                  <b style={{ color: recomendacionRmr.colorBadge, fontSize: 13 }}>
                    {rmrScore} pts
                  </b>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={rmrScore}
                  onChange={(e) => setRmrScore(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                />
              </div>

              {/* Tarjeta de Recomendación Activa */}
              <div
                style={{
                  background: "rgba(7, 12, 22, 0.8)",
                  borderRadius: 10,
                  border: `1px solid ${recomendacionRmr.colorBadge}`,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: recomendacionRmr.colorBadge,
                    }}
                  >
                    {recomendacionRmr.tipo}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      background: "rgba(30, 41, 59, 0.5)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {recomendacionRmr.clase}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    lineHeight: 1.4,
                    marginBottom: 10,
                  }}
                >
                  {recomendacionRmr.descripcion}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    fontSize: 11,
                    background: "rgba(15, 23, 42, 0.6)",
                    padding: 8,
                    borderRadius: 6,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    Espaciamiento:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.espaciamiento} m</b>
                  </div>
                  <div>
                    N° taladros estimado:{" "}
                    <b style={{ color: "#ffffff" }}>{numeroTaladrosEstimado}</b>
                  </div>
                  <div>
                    Alivios recomendados:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.aliviosSugeridos} taladros</b>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    Factor carga (por área de sección):{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.factorCarga}</b>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => aplicarSugerenciaRmr(recomendacionRmr.aliviosSugeridos)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--acento, #f97316)",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  APLICAR SUGERENCIA
                </button>
              </div>
            </div>

            {/* TABLA COMPARATIVA DE CLASES RMR */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
                Matriz de Recomendaciones por Calidad
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(() => {
                  const areaM2 = metricasSeccion.area;
                  const fmt = (r: [number, number]) => `${r[0].toFixed(2)}-${r[1].toFixed(2)}`;
                  return [
                    {
                      nombre: "Roca Suave (RMR > 60)",
                      esp: `${calcularEspaciamientoContornoPorRmr(61).toFixed(2)} m`,
                      fc: fmt(factorCargaPorAreaYRoca(areaM2, "suave")),
                      alivios: 4,
                      activo: rmrScore > 60,
                    },
                    {
                      nombre: "Roca Semidura (41-60)",
                      esp: `${calcularEspaciamientoContornoPorRmr(50).toFixed(2)} m`,
                      fc: fmt(factorCargaPorAreaYRoca(areaM2, "intermedia")),
                      alivios: 4,
                      activo: rmrScore >= 41 && rmrScore <= 60,
                    },
                    {
                      nombre: "Roca Dura (RMR ≤ 40)",
                      esp: `${calcularEspaciamientoContornoPorRmr(30).toFixed(2)} m`,
                      fc: fmt(factorCargaPorAreaYRoca(areaM2, "dura")),
                      alivios: 5,
                      activo: rmrScore <= 40,
                    },
                  ];
                })().map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 10,
                      background: item.activo
                        ? "rgba(249, 115, 22, 0.15)"
                        : "rgba(7, 12, 22, 0.4)",
                      border: item.activo
                        ? "1px solid var(--acento, #f97316)"
                        : "1px solid transparent",
                      color: item.activo ? "#ffffff" : "#94a3b8",
                    }}
                  >
                    <span>{item.nombre}</span>
                    <span>
                      E = {item.esp} · FC = {item.fc} kg/m³ · {item.alivios} Alivios
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>
                Espaciamiento: tabla "distancia entre taladros de contorno" (tenaz 0.50-0.55 m,
                intermedio 0.60-0.65 m, friable 0.70-0.75 m). Factor de carga (FC): tabla "kilos de
                explosivo estimados por m³ de roca" según área de la sección — ambas de Mamani
                López, R.J., <i>Diseño de mallas de perforación en minería subterránea</i>{" "}
                (material de curso, Bolivia). N° de taladros: Beltrán Velásquez, S. (2022){" "}
                <i>
                  Diseño de malla de perforación y voladura para optimizar la productividad en una
                  mina subterránea en Pataz, La Libertad 2020
                </i>
                , tesis de titulación, Universidad Privada del Norte, Ecuación 2 (N = RMR·√Sección/2.5).
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: MÉTODO (SECUENCIA GEOMÉTRICA DEL ARRANQUE) */}
        {/* ================================================================= */}
        {tab === "metodo" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            {/* SELECTOR DE MÉTODO */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 12,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                Método de cálculo
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {(
                  [
                    { id: "corte_paralelo", label: "Corte paralelo" },
                    { id: "practico_empirico", label: "Práctico empírico" },
                    { id: "expansion_sucesiva", label: "Expansión sucesiva" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoDiseno(m.id)}
                    style={{
                      padding: "6px 2px",
                      fontSize: 10,
                      fontWeight: metodoDiseno === m.id ? 700 : 500,
                      borderRadius: 6,
                      border:
                        metodoDiseno === m.id
                          ? "1px solid var(--acento, #f97316)"
                          : "1px solid #334155",
                      background:
                        metodoDiseno === m.id
                          ? "rgba(249, 115, 22, 0.2)"
                          : "rgba(15, 23, 42, 0.4)",
                      color: metodoDiseno === m.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, lineHeight: 1.4 }}>
                <b>Corte paralelo</b> y <b>Expansión sucesiva</b> son, en la práctica, el mismo
                método: el cuele cilíndrico/paralelo funciona precisamente por expansión sucesiva
                hacia el hueco vacío — por eso ambos usan la misma progresión de Holmberg (no son
                dos fórmulas distintas, son dos nombres del mismo mecanismo). <b>Práctico empírico</b>{" "}
                sí calcula distinto: usa bandas de distancia fijas por zona (arranque, ayudas,
                cuadradores) en vez del diámetro equivalente y la progresión geométrica.
              </div>
            </div>

            {/* CABECERA SECUENCIA GEOMÉTRICA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                  Secuencia geométrica del arranque
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--acento, #f97316)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setConceptoAbierto(conceptoAbierto === "holmberg" ? null : "holmberg")
                  }
                >
                  {conceptoAbierto === "holmberg" ? "▲ Ocultar info" : "ⓘ Concepto"}
                </span>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  lineHeight: 1.4,
                  marginBottom: conceptoAbierto === "holmberg" ? 10 : 12,
                }}
              >
                Se calculan {etapasArranque.length} etapa{etapasArranque.length === 1 ? "" : "s"} para
                un avance de {avanceM.toFixed(2)} m (se detiene cuando el espaciamiento supera
                √avance = {Math.sqrt(Math.max(0.1, avanceM)).toFixed(2)} m). El "Método de cálculo" y
                el "Tipo de corte" de arriba todavía no cambian este resultado — ver nota abajo.
              </div>

              {conceptoAbierto === "holmberg" && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    background: "rgba(30, 41, 59, 0.7)",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--acento, #f97316)",
                  }}
                >
                  <b>Fundamento Físico:</b> Cada cuadrante de taladros abre una cavidad cuadrada
                  hacia la cual rompe el siguiente. El <i>Burden (Bn)</i> es la distancia crítica a la
                  cara libre para evitar soplado. El <i>Espaciamiento (En)</i> define el lado del
                  prisma desalojado. Metodo simplificado de Jimeno (Tabla 22.2): en la Etapa 1,{" "}
                  <code>B1 = 1.5 × De</code> y <code>E1 = B1 × √2</code>; en las etapas siguientes,{" "}
                  <code>Bn = E(n-1)</code> y <code>En = 1.5 × Bn × √2</code> (factor <code>f = En/Bn</code>{" "}
                  mostrado en cada fila).
                </div>
              )}

              {/* LISTA DE 5 ETAPAS (EXACTAS AL DISEÑO) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {etapasArranque.map((et) => (
                  <div
                    key={et.etapa}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(7, 12, 22, 0.75)",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                    }}
                  >
                    {/* Número de etapa con círculo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: "1px solid var(--acento, #f97316)",
                          background: "rgba(249, 115, 22, 0.15)",
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {et.etapa}
                      </div>

                      {/* Valores de B y E */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--acento, #f97316)" }}>
                          B{et.etapa} = {et.b.toFixed(3)} m
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#38bdf8" }}>
                          E{et.etapa} = {et.e.toFixed(3)} m
                        </div>
                      </div>
                    </div>

                    {/* Factor f */}
                    <div
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      f {et.f.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: RESULTADO */}
        {/* ================================================================= */}
        {tab === "resultado" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : posicion === "abajo" ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2, gridColumn: "1 / -1" }}>
              RESULTADO CAD MANUAL · detectado desde capas visibles
            </div>

            {/* TARJETA 1: GALERÍA DETECTADA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #10b981",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#10b981",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                GALERÍA DETECTADA
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                Ancho {galeriaDetectada.ancho.toFixed(1)} m · Alto{" "}
                {galeriaDetectada.alto.toFixed(1)} m
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                Área {galeriaDetectada.area.toFixed(3)} m² · Perímetro{" "}
                {galeriaDetectada.perimetro.toFixed(3)} m
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                Centro X {galeriaDetectada.centroX.toFixed(3)} · Y{" "}
                {galeriaDetectada.centroY.toFixed(3)} · Corona estimada{" "}
                {galeriaDetectada.corona.toFixed(2)} m
              </div>
            </div>

            {/* TARJETA 2: TALADROS EN ESCENA */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #06b6d4",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#06b6d4",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                TALADROS EN ESCENA
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                Total: {taladrosDetectados.total} taladros ({taladrosDetectados.cargados}{" "}
                cargados + {taladrosDetectados.alivio} alivio)
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                Metraje total perforado: {taladrosDetectados.metros.toFixed(1)} m
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                }}
              >
                Ø Alivio {diametroAlivioMm} mm · Ø Prod {diametroProdMm} mm · Avance{" "}
                {avanceM} m
              </div>
            </div>

            {/* TARJETA 3: BALANCES MINEROS */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #38bdf8",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 11,
                color: "#cbd5e1",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#38bdf8",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                BALANCES MINEROS ESTIMADOS
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Volumen roto teórico:</span>
                <b>{(galeriaDetectada.area * avanceM * 0.92).toFixed(2)} m³</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Toneladas rotas (ρ = 2.7 t/m³):</span>
                <b>{(galeriaDetectada.area * avanceM * 0.92 * 2.7).toFixed(1)} ton</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Densidad de perforación:</span>
                <b>
                  {galeriaDetectada.area > 0
                    ? (taladrosDetectados.total / galeriaDetectada.area).toFixed(2)
                    : "0"}{" "}
                  tal/m²
                </b>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 6, lineHeight: 1.4 }}>
                92% de eficiencia y ρ≈2.7-2.75 t/m³ son valores de referencia consistentes con
                casos documentados (Beltrán Velásquez, 2022, Figura 3: 92% eficiencia, 2.75 t/m³);
                ajústalos si el mapeo geomecánico de tu labor da otros valores.
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* PIE / BOTONES DE NAVEGACIÓN (ANTERIOR / SIGUIENTE) */}
      {!minimizado && (
        <div
          style={{
            padding: isMobile ? "8px 12px" : "10px 18px",
            borderTop: "1px solid #1e293b",
            background: "rgba(7, 12, 22, 0.95)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: isMobile ? 8 : 10,
          }}
        >
          <button
            type="button"
            onClick={irPasoAnterior}
            disabled={tab === "datos"}
            style={{
              padding: isMobile ? "8px" : "9px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "transparent",
              color: tab === "datos" ? "#475569" : "#e2e8f0",
              fontSize: isMobile ? 11 : 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              cursor: tab === "datos" ? "not-allowed" : "pointer",
              textAlign: "center",
            }}
          >
            ANTERIOR
          </button>

          <button
            type="button"
            onClick={irPasoSiguiente}
            style={{
              padding: isMobile ? "8px" : "9px",
              borderRadius: 8,
              border: "none",
              background: "var(--acento, #f97316)",
              color: "#ffffff",
              fontSize: isMobile ? 11 : 12,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              textAlign: "center",
              boxShadow: "0 4px 14px rgba(249, 115, 22, 0.35)",
            }}
          >
            {tab === "resultado" ? "FINALIZAR" : "SIGUIENTE"}
          </button>
        </div>
      )}
    </div>
  );
}
