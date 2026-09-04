import React, { useState, useMemo, useRef, useEffect } from "react";
import type { Punto2D, Taladro, TipoRoca, EntradaArranqueHolmberg } from "@suite/core";
import {
  calcularArranqueHolmberg,
  calcularGeometriaFrente,
  diametroEquivalente_mm,
  generarTaladrosFrenteTunel,
  burdenLangeforsMax_m,
  burdenLangeforsPractico_m,
  espaciamientoKonya_m,
  cargaLineal_kgm,
  pesoExplosivoPorTaladro_kg,
  CONSTANTE_ROCA_POR_TIPO,
} from "@suite/core";
import type { LineaCad3D, PolilineaCad3D } from "./EditorCadMalla.js";
import { EXPLOSIVOS_PRESET, TIPOS_ROCA } from "../data/presets.js";

export type TabPanel = "datos" | "rmr" | "metodo" | "resultado";
export type TipoSeccionPlantilla = "rectangular" | "herradura" | "tipo_d" | "arco_personalizado";
export type TipoPatronContorno = "uniforme" | "corona_recorte" | "recorte_continuo";
export type MetodoDisenoArranque = "corte_paralelo" | "practico_empirico" | "expansion_sucesiva";
export type TipoCorteArranque = "paralelo_quemado" | "cuna" | "piramidal" | "abanico" | "diamante";

interface Props {
  visible: boolean;
  onOcultar: () => void;
  poligonoCresta?: Punto2D[];
  onCambiarPoligono?: (nuevos: Punto2D[]) => void;
  lineasCad?: LineaCad3D[];
  polilineasCad?: PolilineaCad3D[];
  taladros?: Taladro[];
  onAplicarParametros?: (params: {
    ancho: number;
    alto: number;
    area: number;
    perimetro: number;
    numAlivios: number;
    diametroAlivioMm: number;
    rmr: number;
  }) => void;
  /** Reemplaza los taladros del editor CAD por la ronda generada (cuele + contorno + produccion). */
  onGenerarTaladros?: (taladros: Taladro[]) => void;
  mostrarAviso?: (msg: string) => void;
}

export default function PanelDatosRmrMetodo({
  visible,
  onOcultar,
  poligonoCresta = [],
  onCambiarPoligono,
  lineasCad = [],
  polilineasCad = [],
  taladros = [],
  onAplicarParametros,
  onGenerarTaladros,
  mostrarAviso,
}: Props) {
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
  const [diametroCargaMm, setDiametroCargaMm] = useState<number>(45);
  const [avanceM, setAvanceM] = useState<number>(3.6);
  // Eficiencia de corte: avance real logrado / longitud perforada. Un cuele paralelo bien
  // diseñado (Jimeno, 1995, cap. 22) logra 85-95%; el resto se pierde por desvío de perforación
  // y rotura incompleta del fondo del taladro.
  const [eficienciaCorte, setEficienciaCorte] = useState<number>(0.9);

  // TAB 2: GEOMECÁNICA RMR (índice ya calculado en el módulo Geomecánica, o estimado en campo)
  const [rmrScore, setRmrScore] = useState<number>(45);

  // Roca y explosivo — alimentan las fórmulas de burden/espaciamiento de la zona de producción
  // (Ash 1963 / Langefors-Kihlström, ya implementadas y citadas en @suite/core).
  const [tipoRoca, setTipoRoca] = useState<TipoRoca>("media");
  const [densidadRocaGcm3, setDensidadRocaGcm3] = useState<number>(2.7);
  const [explosivoIdx, setExplosivoIdx] = useState<number>(0);
  const explosivo = EXPLOSIVOS_PRESET[explosivoIdx] ?? EXPLOSIVOS_PRESET[0];

  // TAB 3: MÉTODO Y SECUENCIA DE CORTE
  const [metodoDiseno, setMetodoDiseno] = useState<MetodoDisenoArranque>("corte_paralelo");
  const [tipoCorte, setTipoCorte] = useState<TipoCorteArranque>("paralelo_quemado");

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
  // CÁLCULOS GEOMÉTRICOS
  // Rectangular/herradura: `calcularGeometriaFrente` (@suite/core), verificado por tests unitarios
  // contra López Jimeno et al. (1995) cap. 22. Tipo D / arco personalizado: no son formas
  // estandarizadas en una fuente única, así que se aproximan por geometría analítica (segmento
  // parabólico, área = (2/3)·base·altura — cuadratura de la parábola, resultado clásico atribuido
  // a Arquímedes) — se etiquetan como aproximación, no como fórmula de diseño de voladura.
  // =========================================================================
  const metricasSeccion = useMemo(() => {
    const W = Math.max(0.5, anchoGaleria);
    const H = Math.max(0.5, altoGaleria);

    if (tipoSeccion === "rectangular" || tipoSeccion === "herradura") {
      const g = calcularGeometriaFrente({ tipo: tipoSeccion, ancho_m: W, alto_m: H });
      return { area: g.area_m2, perimetro: g.perimetro_m, corona: g.alturaCorona_m, hastial: g.alturaHastial_m };
    }

    if (tipoSeccion === "tipo_d") {
      const hCorona = Math.min(W * 0.35, H);
      const hHastial = Math.max(0, H - hCorona);
      // Arco rebajado de corona (segmento parabólico) + caja inferior rectangular
      const area = W * hHastial + (2 / 3) * W * hCorona;
      const perimetro = W + 2 * hHastial + Math.sqrt(W * W + (16 / 3) * hCorona * hCorona);
      return { area, perimetro, corona: hCorona, hastial: hHastial };
    }

    // Arco personalizado (corona semielíptica de flecha configurable)
    const hCorona = Math.min(alturaCorona, H);
    const hHastial = Math.max(0, H - hCorona);
    const area = W * hHastial + (Math.PI * (W / 2) * hCorona) / 2;
    const perimetro = W + 2 * hHastial + Math.PI * Math.sqrt((W * W + hCorona * hCorona) / 2);
    return { area, perimetro, corona: hCorona, hastial: hHastial };
  }, [tipoSeccion, anchoGaleria, altoGaleria, alturaCorona]);

  // =========================================================================
  // DIÁMETRO EQUIVALENTE DE ALIVIO — De = D_individual · √N
  // López Jimeno, López Jimeno & Ayala Carcedo (1995) "Drilling and Blasting of Rocks",
  // A.A. Balkema, cap. 22 "Blasting for tunnels and drifts", p. 219.
  // =========================================================================
  const deMm = useMemo(
    () => diametroEquivalente_mm(Math.max(25, diametroAlivioMm), Math.max(1, numAlivios)),
    [numAlivios, diametroAlivioMm]
  );
  const diametroEquivalente = { deMm, deM: deMm / 1000 };

  // =========================================================================
  // SECUENCIA DEL ARRANQUE (CUELE HOLMBERG, MÉTODO SIMPLIFICADO)
  // B1 = 1.5·De, E1 = B1·√2; para n≥2: Bn = E(n-1), En = 1.5·Bn·√2.
  // Se agregan secciones mientras En < √avance (el lado de la última sección no debería ser menor
  // que la raíz del avance) — misma fuente que el diámetro equivalente, p. 221.
  // Fórmula original: Holmberg, R. (1982) "Charge calculations for tunnelling", en Underground
  // Mining Methods Handbook, SME; simplificada por Olofsson, S. (1990) "Applied Explosives
  // Technology for Construction and Mining", APEX Consultants.
  // =========================================================================
  const arranqueResultado = useMemo(
    () =>
      calcularArranqueHolmberg({
        diametroIndividualAlivio_mm: Math.max(25, diametroAlivioMm),
        numeroTaladrosAlivio: Math.max(1, numAlivios),
        avance_m: Math.max(0.1, avanceM),
      }),
    [diametroAlivioMm, numAlivios, avanceM]
  );
  const etapasArranque = arranqueResultado.secciones.map((s) => ({ etapa: s.numero, b: s.burden_m, e: s.espaciamiento_m, f: s.factor }));

  // =========================================================================
  // ZONA DE PRODUCCIÓN (DESTROZA): burden/espaciamiento por Ash / Langefors-Kihlström + Konya
  // — las mismas fórmulas ya usadas y citadas para el banco a cielo abierto en @suite/core
  // (formulas/mining/blastPattern.ts). Después de que el cuele abre la primera cavidad, el resto
  // de la ronda se comporta, en burden/espaciamiento, como un banco de altura = avance/eficiencia
  // (criterio explícito en Jimeno, 1995, cap. 22 §22.4.4 "cálculo del resto de la voladura").
  // =========================================================================
  const constanteRoca = CONSTANTE_ROCA_POR_TIPO[tipoRoca];
  const profundidadTaladro_m = Math.max(0.1, avanceM) / Math.min(0.98, Math.max(0.5, eficienciaCorte));
  const produccionResultado = useMemo(() => {
    const bMax = burdenLangeforsMax_m(diametroCargaMm, explosivo.densidadGcm3, explosivo.fuerzaRelativaANFO, constanteRoca, 1.0, 1.25);
    const bPractico = burdenLangeforsPractico_m(bMax, profundidadTaladro_m, 0.05, 0.03);
    const { espaciamiento_m, razonRigidezHB } = espaciamientoKonya_m(bPractico, profundidadTaladro_m);
    return { burdenMax_m: bMax, burden_m: bPractico, espaciamiento_m, razonRigidezHB };
  }, [diametroCargaMm, explosivo, constanteRoca, profundidadTaladro_m]);

  // =========================================================================
  // ESPACIAMIENTO DE CONTORNO (voladura controlada / smooth blasting)
  // espaciamiento ≈ (10 a 16) × diámetro del taladro. OSMRE (2016) "Blast Design — Module 3:
  // Surface Blast Design", Office of Surface Mining Reclamation and Enforcement (EE.UU.): 12×Ø
  // para presplit/control, 15×Ø roca dura y 20×Ø roca blanda en smooth blasting de superficie —
  // el mismo principio (espaciamiento proporcional al diámetro) se usa para el recorte en túneles
  // (Olofsson, S. 1990). Aquí se reduce el multiplicador en roca de peor calidad (RMR bajo) para
  // limitar la sobre-rotura y preservar la estabilidad del contorno — el RMR (Bieniawski, 1989,
  // "Engineering Rock Mass Classifications", Wiley) mide justamente eso: calidad/tiempo de
  // auto-sostenimiento del macizo, no la dureza de la roca intacta (que ya está cubierta por
  // tipoRoca/explosivo arriba).
  // =========================================================================
  const recomendacionRmr = useMemo(() => {
    const diamM = diametroCargaMm / 1000;
    if (rmrScore > 60) {
      return {
        tipo: "Roca de buena calidad geomecánica",
        clase: "Clase I - II (RMR 61-100, Bieniawski 1989)",
        espaciamientoContorno: diamM * 16,
        aliviosSugeridos: 4,
        colorBadge: "#10b981",
        descripcion:
          "Macizo poco fracturado y con discontinuidades favorables (alto tiempo de auto-sostenimiento). Admite mayor espaciamiento de contorno sin riesgo de sobre-rotura.",
      };
    }
    if (rmrScore >= 41) {
      return {
        tipo: "Roca de calidad geomecánica media",
        clase: "Clase III (RMR 41-60, Bieniawski 1989)",
        espaciamientoContorno: diamM * 13,
        aliviosSugeridos: 4,
        colorBadge: "var(--acento, #f97316)",
        descripcion:
          "Calidad media: discontinuidades moderadamente desfavorables. Espaciamiento de contorno intermedio para controlar la sobre-rotura sin perder avance.",
      };
    }
    return {
      tipo: "Roca de baja calidad geomecánica",
      clase: "Clase IV - V (RMR ≤ 40, Bieniawski 1989)",
      espaciamientoContorno: diamM * 10,
      aliviosSugeridos: 5,
      colorBadge: "#ef4444",
      descripcion:
        "Macizo muy fracturado o con bajo tiempo de auto-sostenimiento. Se recomienda un taladro de alivio adicional (5) para una apertura más gradual del cuele y contorno más cerrado para limitar la sobre-rotura.",
    };
  }, [rmrScore, diametroCargaMm]);

  // =========================================================================
  // CARGA EXPLOSIVA Y FACTOR DE CARGA (cálculo ascendente, no una tabla RMR→kg/m³)
  // Carga lineal Mc = (π/4)·d²·ρ_explosivo y factor de carga = peso explosivo / volumen de roca
  // — mismas fórmulas de @suite/core (formulas/mining/blasting.ts), citando Ash, R.L. (1963)
  // "The Mechanics of Rock Breakage", Pit & Quarry.
  // =========================================================================
  const cargaExplosiva = useMemo(() => {
    const mc = cargaLineal_kgm(diametroCargaMm, explosivo.densidadGcm3);
    const tacoTípico = produccionResultado.burden_m * 0.7;
    const longitudCarga_m = Math.max(0, profundidadTaladro_m - tacoTípico);
    const pesoPorTaladro_kg = pesoExplosivoPorTaladro_kg(longitudCarga_m, mc);
    const volumenRonda_m3 = metricasSeccion.area * avanceM;
    return { cargaLineal_kgm: mc, pesoPorTaladro_kg, longitudCarga_m, volumenRonda_m3 };
  }, [diametroCargaMm, explosivo, produccionResultado.burden_m, profundidadTaladro_m, metricasSeccion.area, avanceM]);

  // Estimación previa del número de taladros (antes de generar la ronda real): taladros de
  // contorno por perímetro/espaciamiento + taladros de producción por área/(burden×espaciamiento)
  // + alivio y arranque ya conocidos. Es una cuenta propia de este panel (no una fórmula empírica
  // citada de una fuente única) — una vez generada la ronda real, el conteo exacto reemplaza a
  // esta estimación (ver "Taladros manuales" en Resultado).
  const estimacionTaladros = useMemo(() => {
    const contorno = Math.ceil(metricasSeccion.perimetro / Math.max(0.1, recomendacionRmr.espaciamientoContorno));
    const produccion = Math.ceil(metricasSeccion.area / Math.max(0.01, produccionResultado.burden_m * produccionResultado.espaciamiento_m));
    const arranque = 4 * arranqueResultado.secciones.length;
    return { contorno, produccion, arranque, alivio: Math.max(1, numAlivios), total: contorno + produccion + arranque + Math.max(1, numAlivios) };
  }, [metricasSeccion, recomendacionRmr.espaciamientoContorno, produccionResultado, arranqueResultado.secciones.length, numAlivios]);

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
    const metrosPerf = taladros.reduce((acc, t) => acc + (t.profundidad_m ?? (t as any).longitud_m ?? 3.6), 0);

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

  // Referencia de interacción del usuario para sincronización en vivo
  const hasUserInteractedRef = useRef(false);
  const [sincronizacionEnVivo, setSincronizacionEnVivo] = useState(true);

  // Helper para construir el contorno geométrico de la galería (Herradura, Rectangular, Tipo D, Arco)
  const construirContornoFrente = (
    secTipo: TipoSeccionPlantilla = tipoSeccion,
    w: number = anchoGaleria,
    h: number = altoGaleria,
    hc: number = alturaCorona
  ): Punto2D[] => {
    const W = Math.max(0.5, w);
    const H = Math.max(0.5, h);
    const halfW = W / 2;

    // Si ya existe un polígono en la escena, preservar su centroX y base de piso
    let centroX = 0;
    let pisoY = 0;
    if (poligonoCresta && poligonoCresta.length >= 3) {
      const xs = poligonoCresta.map((p) => p.x);
      const ys = poligonoCresta.map((p) => p.y);
      centroX = (Math.min(...xs) + Math.max(...xs)) / 2;
      pisoY = Math.min(...ys);
    }

    const ptsLocales: Punto2D[] = [];

    if (secTipo === "rectangular") {
      ptsLocales.push({ x: -halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: H });
      ptsLocales.push({ x: -halfW, y: H });
    } else if (secTipo === "herradura") {
      const R = halfW;
      const hHastial = Math.max(0, H - R);
      // Piso
      ptsLocales.push({ x: -halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: 0 });
      // Hastial derecho
      ptsLocales.push({ x: halfW, y: hHastial });
      // Bóveda semicircular (0 -> PI)
      const nPasos = 16;
      for (let i = 1; i < nPasos; i++) {
        const ang = (i / nPasos) * Math.PI;
        ptsLocales.push({
          x: R * Math.cos(ang),
          y: hHastial + R * Math.sin(ang),
        });
      }
      // Hastial izquierdo
      ptsLocales.push({ x: -halfW, y: hHastial });
    } else if (secTipo === "tipo_d") {
      const hCorona = Math.min(W * 0.35, H);
      const hHastial = Math.max(0, H - hCorona);
      ptsLocales.push({ x: -halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: hHastial });
      const nPasos = 16;
      for (let i = 1; i < nPasos; i++) {
        const ang = (i / nPasos) * Math.PI;
        ptsLocales.push({
          x: halfW * Math.cos(ang),
          y: hHastial + hCorona * Math.sin(ang),
        });
      }
      ptsLocales.push({ x: -halfW, y: hHastial });
    } else {
      // arco_personalizado
      const hCorona = Math.min(hc, H);
      const hHastial = Math.max(0, H - hCorona);
      ptsLocales.push({ x: -halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: 0 });
      ptsLocales.push({ x: halfW, y: hHastial });
      const nPasos = 16;
      for (let i = 1; i < nPasos; i++) {
        const ang = (i / nPasos) * Math.PI;
        ptsLocales.push({
          x: halfW * Math.cos(ang),
          y: hHastial + hCorona * Math.sin(ang),
        });
      }
      ptsLocales.push({ x: -halfW, y: hHastial });
    }

    return ptsLocales.map((p) => ({
      x: Math.round((centroX + p.x) * 1000) / 1000,
      y: Math.round((pisoY + p.y) * 1000) / 1000,
    }));
  };

  // Sincronización completa de Geometría y Taladros en 3D
  const sincronizarMallaYTaladros = (
    overrideParams?: {
      tipo?: TipoSeccionPlantilla;
      ancho?: number;
      alto?: number;
      corona?: number;
      alivios?: number;
      diamAlivio?: number;
      diamCarga?: number;
      avance?: number;
      rmr?: number;
      notificar?: boolean;
    }
  ) => {
    const secTipo = overrideParams?.tipo ?? tipoSeccion;
    const w = overrideParams?.ancho ?? anchoGaleria;
    const h = overrideParams?.alto ?? altoGaleria;
    const hc = overrideParams?.corona ?? alturaCorona;
    const nAliv = overrideParams?.alivios ?? numAlivios;
    const dAliv = overrideParams?.diamAlivio ?? diametroAlivioMm;
    const dCarga = overrideParams?.diamCarga ?? diametroCargaMm;
    const av = overrideParams?.avance ?? avanceM;
    const rmr = overrideParams?.rmr ?? rmrScore;

    // 1. Generar contorno de frente y actualizar poligonoCresta
    const nuevoPoligono = construirContornoFrente(secTipo, w, h, hc);
    if (onCambiarPoligono) {
      onCambiarPoligono(nuevoPoligono);
    }

    // 2. Calcular secuencia de arranque Holmberg
    const entradaArranque: EntradaArranqueHolmberg = {
      diametroIndividualAlivio_mm: Math.max(25, dAliv),
      numeroTaladrosAlivio: Math.max(1, nAliv),
      avance_m: av,
      maximoSecciones: 8,
    };
    const resArranque = calcularArranqueHolmberg(entradaArranque);

    // 3. Recomendaciones RMR para contorno
    const espContorno =
      rmr >= 60
        ? (dCarga / 1000) * 16
        : rmr >= 41
        ? (dCarga / 1000) * 13
        : rmr >= 21
        ? (dCarga / 1000) * 11
        : (dCarga / 1000) * 9;

    // Burden y espaciamiento de producción
    const B_prod = Math.max(0.4, Math.min(1.2, w * 0.22));
    const E_prod = Math.max(0.4, Math.min(1.2, B_prod * 1.15));

    // 4. Generar taladros del frente
    const resultado = generarTaladrosFrenteTunel({
      poligonoCresta: nuevoPoligono,
      secciones: resArranque.secciones,
      diametroIndividualAlivio_mm: Math.max(25, dAliv),
      numeroTaladrosAlivio: Math.max(1, nAliv),
      diametroCargaMm: dCarga,
      burdenProduccion_m: B_prod,
      espaciamientoProduccion_m: E_prod,
      espaciamientoContorno_m: espContorno,
    });

    if (resultado.puntos.length > 0 && onGenerarTaladros) {
      const prof = av > 0 ? av : 3.6;
      const taco_m = B_prod * 0.7;
      const timestamp = Date.now();
      const taladrosGenerados: Taladro[] = resultado.puntos.map((p, idx) => {
        const t = {
          id: `holmberg-${timestamp}-${idx}`,
          fila: p.etapa ?? 0,
          columna: idx,
          collar: { x: p.x, y: p.y, z: p.z },
          fondo: { x: p.x, y: p.y, z: p.z - prof },
          profundidad_m: prof,
          diametroMm: p.diametroMm,
          taco_m: p.cargado ? taco_m : 0,
          longitudCarga_m: p.cargado ? Math.max(0, prof - taco_m) : 0,
        } as Taladro;
        (t as any).zona = p.zona;
        (t as any).codigo = `${p.zona.toUpperCase().slice(0, 3)}-${idx + 1}`;
        return t;
      });

      onGenerarTaladros(taladrosGenerados);

      if (overrideParams?.notificar && mostrarAviso) {
        mostrarAviso(
          `✓ Malla 3D generada: ${taladrosGenerados.length} taladros y galería ${secTipo} (${w}×${h}m)`
        );
      }
    }

    if (onAplicarParametros) {
      onAplicarParametros({
        ancho: w,
        alto: h,
        area: metricasSeccion.area,
        perimetro: metricasSeccion.perimetro,
        numAlivios: nAliv,
        diametroAlivioMm: dAliv,
        rmr,
      });
    }
  };

  // Reaccionar automáticamente a los cambios de medidas/geometría con debounce suave
  useEffect(() => {
    if (!sincronizacionEnVivo || !hasUserInteractedRef.current) return;
    const timer = setTimeout(() => {
      sincronizarMallaYTaladros();
    }, 120);
    return () => clearTimeout(timer);
  }, [
    sincronizacionEnVivo,
    tipoSeccion,
    anchoGaleria,
    altoGaleria,
    alturaCorona,
    numAlivios,
    diametroAlivioMm,
    diametroCargaMm,
    avanceM,
    rmrScore,
  ]);

  // Cargar referencia P&V Jumbo 3.5 x 3.5
  const cargarReferenciaPyV = () => {
    hasUserInteractedRef.current = true;
    setAnchoGaleria(3.5);
    setAltoGaleria(3.5);
    setAlturaCorona(1.75);
    setNumAlivios(4);
    setDiametroAlivioMm(102);
    setDiametroCargaMm(45);
    setAvanceM(3.6);
    setEficienciaCorte(0.9);
    setTipoRoca("media");
    setDensidadRocaGcm3(2.7);
    setExplosivoIdx(0);
    setRmrScore(35); // RMR 31-40
    setTipoSeccion("herradura");

    sincronizarMallaYTaladros({
      tipo: "herradura",
      ancho: 3.5,
      alto: 3.5,
      corona: 1.75,
      alivios: 4,
      diamAlivio: 102,
      diamCarga: 45,
      avance: 3.6,
      rmr: 35,
      notificar: true,
    });
  };

  // Restablecer proporciones
  const restablecerProporciones = () => {
    hasUserInteractedRef.current = true;
    setAnchoGaleria(2.5);
    setAltoGaleria(2.5);
    setAlturaCorona(1.25);
    setNumAlivios(4);
    setDiametroAlivioMm(102);
    setDiametroCargaMm(45);
    setRmrScore(45);
    setTipoSeccion("herradura");

    sincronizarMallaYTaladros({
      tipo: "herradura",
      ancho: 2.5,
      alto: 2.5,
      corona: 1.25,
      alivios: 4,
      diamAlivio: 102,
      diamCarga: 45,
      avance: 3.6,
      rmr: 45,
      notificar: true,
    });
    if (mostrarAviso) {
      mostrarAviso("Proporciones restablecidas a 2.5 × 2.5 m y sincronizadas con 3D");
    }
  };

  // Aplicar sugerencia geomecánica
  const aplicarSugerenciaRmr = (aliviosSugeridos: number) => {
    hasUserInteractedRef.current = true;
    setNumAlivios(aliviosSugeridos);
    sincronizarMallaYTaladros({ alivios: aliviosSugeridos });
    if (mostrarAviso) {
      mostrarAviso(`✓ Sugerencia aplicada: ${aliviosSugeridos} taladros de alivio configurados y sincronizados.`);
    }
  };

  // =========================================================================
  // GENERAR TALADROS DE RONDA (simulación)
  // =========================================================================
  const generarTaladrosRonda = () => {
    hasUserInteractedRef.current = true;
    sincronizarMallaYTaladros({ notificar: true });
    setTab("resultado");
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
      style={{
        position: "absolute",
        top: 24,
        right: 80,
        width: 390,
        maxWidth: "calc(100vw - 100px)",
        maxHeight: "calc(100vh - 80px)",
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
      }}
    >
      {/* CABECERA PRINCIPAL */}
      <div
        style={{
          padding: "16px 18px 12px",
          borderBottom: "1px solid #1e293b",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(12, 18, 30, 0.8) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>DATOS / RMR / MÉTODO</span>
          </h2>
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
              gap: 4,
              padding: "4px 6px",
            }}
            title="Ocultar panel"
          >
            <span>&gt;</span>
            <span>OCULTAR</span>
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          Generador teórico + análisis CAD no destructivo.
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
            marginTop: 14,
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
                  padding: "7px 2px",
                  fontSize: 11,
                  fontWeight: activa ? 700 : 500,
                  borderRadius: 8,
                  border: activa ? "1px solid var(--acento, #f97316)" : "1px solid #334155",
                  background: activa ? "rgba(249, 115, 22, 0.18)" : "rgba(15, 23, 42, 0.6)",
                  color: activa ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "center",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CUERPO PRINCIPAL CON DESPLAZAMIENTO */}
      <div
        style={{
          padding: "16px 18px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* ================================================================= */}
        {/* TAB 1: DATOS */}
        {/* ================================================================= */}
        {tab === "datos" && (
          <>
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
                  <b>Concepto minero:</b> la forma de la galería distribuye los esfuerzos del macizo
                  rocoso. La sección <i>Herradura</i> (hastiales rectos + corona semicircular de
                  radio = ancho/2) distribuye favorablemente el esfuerzo tensional hacia los
                  hastiales, mientras que el <i>Arco rebajado (Tipo D)</i> optimiza el gálibo en
                  vetas angostas y labores de transporte. Área/perímetro de Rectangular y Herradura
                  se calculan con la geometría de López Jimeno, C., López Jimeno, E. &amp; Ayala
                  Carcedo, F.J. (1995) <i>Drilling and Blasting of Rocks</i>, A.A. Balkema, cap. 22;
                  Tipo D y Arco personalizado son aproximaciones geométricas propias (segmento
                  parabólico) sin una fuente única de referencia.
                </div>
              )}

              {/* Nota sobre corona y botón de referencia rápida como en la captura */}
              <p style={{ fontSize: 10.5, color: "#94a3b8", margin: "0 0 10px 0", lineHeight: 1.35 }}>
                Las plantillas automáticas nunca generan una corona puntiaguda.
              </p>

              <button
                type="button"
                onClick={cargarReferenciaPyV}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  borderRadius: 999,
                  border: "1.5px solid #22c55e",
                  background: "rgba(34, 197, 94, 0.08)",
                  color: "#4ade80",
                  cursor: "pointer",
                  textAlign: "center",
                  marginBottom: 14,
                  boxShadow: "0 0 14px rgba(34, 197, 94, 0.18)",
                  transition: "all 0.15s ease",
                }}
              >
                CARGAR REFERENCIA P&amp;V · JUMBO 3.5 × 3.5 RMR 31-40
              </button>

              {/* Botones de plantilla en cuadrícula 2x2 con descripciones */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {(
                  [
                    { id: "rectangular", label: "Rectangular", desc: "Piso, hastiales y techo horizontales." },
                    { id: "herradura", label: "Herradura", desc: "Hastiales rectos y corona semic..." },
                    { id: "tipo_d", label: "Tipo D", desc: "Hastiales rectos y corona rebaja..." },
                    { id: "arco_personalizado", label: "Arco pers...", desc: "Hastiales rectos y altura de corona mo..." },
                  ] as const
                ).map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      hasUserInteractedRef.current = true;
                      setTipoSeccion(sec.id);
                      sincronizarMallaYTaladros({ tipo: sec.id });
                    }}
                    style={{
                      padding: "10px 10px",
                      borderRadius: 12,
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      border:
                        tipoSeccion === sec.id
                          ? "2px solid #ec4899"
                          : "1px solid #263348",
                      background:
                        tipoSeccion === sec.id
                          ? "rgba(236, 72, 153, 0.16)"
                          : "rgba(13, 20, 32, 0.6)",
                      color: tipoSeccion === sec.id ? "#ffffff" : "#94a3b8",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: tipoSeccion === sec.id ? "0 0 16px rgba(236, 72, 153, 0.25)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: tipoSeccion === sec.id ? "#ffffff" : "#e2e8f0" }}>
                      {sec.label}
                    </span>
                    <span style={{ fontSize: 9.5, color: "#94a3b8", lineHeight: 1.25 }}>
                      {sec.desc}
                    </span>
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
                      hasUserInteractedRef.current = true;
                      setAnchoGaleria(Math.max(0.5, Number(e.target.value)));
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
                      hasUserInteractedRef.current = true;
                      setAltoGaleria(Math.max(0.5, Number(e.target.value)));
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
                      hasUserInteractedRef.current = true;
                      setAlturaCorona(Math.max(0.1, Number(e.target.value)));
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

            {/* BOTONES DE REFERENCIA Y ACTUALIZACIÓN 3D */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  hasUserInteractedRef.current = true;
                  sincronizarMallaYTaladros({ notificar: true });
                }}
                style={{
                  padding: "10px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  borderRadius: 10,
                  border: "1.5px solid #ec4899",
                  background: "rgba(236, 72, 153, 0.15)",
                  color: "#f472b6",
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                  boxShadow: "0 0 16px rgba(236, 72, 153, 0.2)",
                }}
              >
                <span>🔄 ACTUALIZAR CONTORNO Y TALADROS EN 3D</span>
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
                  <b>¿Por qué diámetro equivalente?</b> En voladura subterránea no hay cara libre: el
                  frente entero está confinado. Los taladros de alivio (vacíos, sin cargar) abren el
                  volumen de expansión inicial hacia el cual rompe el resto del cuele. Cuando se
                  agrupan N taladros pequeños en vez de perforar uno grande, el área de alivio
                  equivalente se calcula como <code>De = D · √N</code> (diámetro individual × raíz
                  del número de taladros) — López Jimeno et al. (1995) <i>Drilling and Blasting of
                  Rocks</i>, cap. 22, p. 219.
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

            {/* SECCIÓN: ROCA Y EXPLOSIVO (producción, carga y factor de carga) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 10 }}>
                Roca y explosivo (zona de producción)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Dureza de la roca
                  </label>
                  <select
                    value={tipoRoca}
                    onChange={(e) => setTipoRoca(e.target.value as TipoRoca)}
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
                  >
                    {TIPOS_ROCA.map((r) => (
                      <option key={r.valor} value={r.valor}>
                        {r.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Explosivo
                  </label>
                  <select
                    value={explosivoIdx}
                    onChange={(e) => setExplosivoIdx(Number(e.target.value))}
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
                  >
                    {EXPLOSIVOS_PRESET.map((e, i) => (
                      <option key={e.nombre} value={i}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Ø carga (mm)
                  </label>
                  <input
                    type="number"
                    min={25}
                    step={1}
                    value={diametroCargaMm}
                    onChange={(e) => setDiametroCargaMm(Math.max(25, Number(e.target.value)))}
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
                    Densidad roca (t/m³)
                  </label>
                  <input
                    type="number"
                    min={1.5}
                    max={4}
                    step={0.05}
                    value={densidadRocaGcm3}
                    onChange={(e) => setDensidadRocaGcm3(Math.max(1.5, Number(e.target.value)))}
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
                    Eficiencia corte
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={0.98}
                    step={0.01}
                    value={eficienciaCorte}
                    onChange={(e) => setEficienciaCorte(Math.min(0.98, Math.max(0.5, Number(e.target.value))))}
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
              <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
                Burden/espaciamiento de producción (pestaña Método) usan estos valores con las
                fórmulas de Ash (1963) y Langefors-Kihlström/Konya ya citadas en @suite/core.
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
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 2: RMR */}
        {/* ================================================================= */}
        {tab === "rmr" && (
          <>
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
                  <b>Concepto geomecánico:</b> el índice RMR de Bieniawski, Z.T. (1989)
                  <i> Engineering Rock Mass Classifications</i>, John Wiley &amp; Sons, resume en
                  0-100 puntos la resistencia de la roca intacta, el RQD, el espaciamiento y
                  condición de discontinuidades y la presencia de agua — en esencia, mide qué tan
                  auto-sostenible es el macizo, no la dureza de la roca intacta frente al explosivo
                  (eso ya se ingresa aparte, con el tipo de roca/explosivo de la pestaña Datos). Aquí
                  el RMR se usa solo para lo que sí mide directamente: en macizos de peor clase
                  (más fracturados, menor tiempo de auto-sostenimiento) conviene un contorno más
                  cerrado para limitar la sobre-rotura, y un taladro de alivio adicional para abrir
                  el cuele de forma más gradual y predecible.
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
                    Espaciamiento contorno:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.espaciamientoContorno.toFixed(2)} m</b>
                  </div>
                  <div>
                    Regla aplicada:{" "}
                    <b style={{ color: "#ffffff" }}>
                      {(recomendacionRmr.espaciamientoContorno / (diametroCargaMm / 1000)).toFixed(0)}×Ø
                    </b>
                  </div>
                  <div>
                    Alivios recomendados:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.aliviosSugeridos} taladros</b>
                  </div>
                  <div>
                    Clase Bieniawski:{" "}
                    <b style={{ color: "#ffffff" }}>{recomendacionRmr.clase.split("(")[0].trim()}</b>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 10, lineHeight: 1.4 }}>
                  El factor de carga (kg/m³) no se estima aquí desde el RMR: se calcula de abajo
                  hacia arriba a partir del diámetro, explosivo y geometría real en la pestaña
                  Resultado (ver tarjeta "Carga explosiva").
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
                Matriz de Recomendaciones por Clase Bieniawski (1989)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(() => {
                  const diamM = diametroCargaMm / 1000;
                  return [
                    { nombre: "Clase I-II · Buena/Muy buena (RMR > 60)", esp: diamM * 16, alivios: 4, activo: rmrScore > 60 },
                    { nombre: "Clase III · Media (RMR 41-60)", esp: diamM * 13, alivios: 4, activo: rmrScore >= 41 && rmrScore <= 60 },
                    { nombre: "Clase IV-V · Mala/Muy mala (RMR ≤ 40)", esp: diamM * 10, alivios: 5, activo: rmrScore <= 40 },
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
                      Contorno {item.esp.toFixed(2)}m · {item.alivios} alivios
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>
                Fuente: Bieniawski, Z.T. (1989) <i>Engineering Rock Mass Classifications</i>, Wiley
                (clases RMR) — combinado con la regla de espaciamiento de contorno "K×diámetro" de
                OSMRE (2016) <i>Blast Design — Module 3</i>, U.S. Office of Surface Mining
                Reclamation and Enforcement.
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 3: MÉTODO (SECUENCIA GEOMÉTRICA DEL ARRANQUE) */}
        {/* ================================================================= */}
        {tab === "metodo" && (
          <>
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
                Se calculan {etapasArranque.length} secciones para un avance de {avanceM.toFixed(2)} m
                (se detienen cuando el espaciamiento supera √avance = {Math.sqrt(Math.max(0.1, avanceM)).toFixed(2)} m).
                La última sección queda como control de expansión hacia la zona de producción.
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
                  <b>Fundamento físico:</b> cada sección de taladros rompe hacia un hueco cuadrado
                  cuyos 4 vértices son los taladros de esa sección; el <i>burden (Bn)</i> es la
                  distancia crítica desde cada taladro a la cara libre del hueco anterior, y el
                  <i> espaciamiento (En)</i> es el lado del nuevo hueco que deja esa sección al
                  romper. Sección 1: <code>B1 = 1.5·De</code>, <code>E1 = B1·√2</code> (diagonal de
                  un cuadrado de lado B1). Secciones siguientes: <code>Bn = E(n-1)</code> (el burden
                  usa el hueco ya abierto) y <code>En = 1.5·Bn·√2</code> (el factor 1.5 compensa que
                  la nueva cara libre, al estar rotada 45°, es más difícil de romper que la cara
                  original). Se agregan secciones mientras <code>En &lt; √avance</code> — el lado de
                  la última sección no debería ser menor que la raíz del avance de la tanda.
                  Fórmula: Holmberg, R. (1982) "Charge calculations for tunnelling", en
                  <i> Underground Mining Methods Handbook</i>, SME, simplificada por Olofsson, S.
                  (1990) <i>Applied Explosives Technology for Construction and Mining</i>, APEX
                  Consultants, y reproducida en López Jimeno et al. (1995) cap. 22, Tabla 22.2.
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

            {/* ZONA DE PRODUCCIÓN (DESTROZA) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.65)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", marginBottom: 6 }}>
                Producción (destroza)
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4, marginBottom: 10 }}>
                Una vez abierto el arranque, el resto de la ronda se calcula como un banco de altura
                = avance/eficiencia, con las mismas fórmulas de Ash (1963) / Langefors-Kihlström y
                espaciamiento de Konya ya usadas para el banco a cielo abierto.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  fontSize: 11,
                  background: "rgba(7, 12, 22, 0.7)",
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                <div>
                  Burden diseño: <b style={{ color: "#ffffff" }}>{produccionResultado.burden_m.toFixed(3)} m</b>
                </div>
                <div>
                  Espaciamiento: <b style={{ color: "#ffffff" }}>{produccionResultado.espaciamiento_m.toFixed(3)} m</b>
                </div>
                <div>
                  Longitud taladro: <b style={{ color: "#ffffff" }}>{profundidadTaladro_m.toFixed(2)} m</b>
                </div>
                <div>
                  Razón rigidez H/B: <b style={{ color: "#ffffff" }}>{produccionResultado.razonRigidezHB.toFixed(2)}</b>
                </div>
              </div>
            </div>

            {/* GENERAR TALADROS DE RONDA */}
            <button
              type="button"
              onClick={generarTaladrosRonda}
              style={{
                padding: "12px 14px",
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 10,
                border: "1px solid #38bdf8",
                background: "rgba(56, 189, 248, 0.14)",
                color: "#38bdf8",
                cursor: "pointer",
                textAlign: "center",
                letterSpacing: "0.03em",
              }}
              title="Ubica alivio + arranque + contorno + producción sobre el polígono de galería dibujado"
            >
              ⚡ GENERAR TALADROS DE RONDA (SIMULACIÓN)
            </button>
            <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
              Es una simulación: reemplaza los taladros del editor CAD con la ronda calculada. Para
              solidificarla como entidades CAD editables, usa después "Convertir malla calculada a
              CAD editable".
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* TAB 4: RESULTADO */}
        {/* ================================================================= */}
        {tab === "resultado" && (
          <>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>
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
                {galeriaDetectada.corona.toFixed(1)} m
              </div>
            </div>

            {/* TARJETA 2: TALADROS MANUALES */}
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
                TALADROS MANUALES
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 6,
                }}
              >
                {taladrosDetectados.total} taladros · {taladrosDetectados.metros} m perforados
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#cbd5e1",
                  marginBottom: 4,
                }}
              >
                Cargados {taladrosDetectados.cargados} · Alivio/no cargados{" "}
                {taladrosDetectados.alivio}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  fontStyle: "italic",
                }}
              >
                Fuente: Dibujo CAD
              </div>
            </div>

            {/* CARGA EXPLOSIVA Y FACTOR DE CARGA (cálculo ascendente) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderRadius: 12,
                padding: 14,
                border: "1px solid #a855f7",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#a855f7", letterSpacing: "0.05em", marginBottom: 8 }}>
                CARGA EXPLOSIVA ({explosivo.nombre.toUpperCase()})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "#cbd5e1" }}>
                <div>
                  Carga lineal: <b style={{ color: "#ffffff" }}>{cargaExplosiva.cargaLineal_kgm.toFixed(2)} kg/m</b>
                </div>
                <div>
                  Peso por taladro: <b style={{ color: "#ffffff" }}>{cargaExplosiva.pesoPorTaladro_kg.toFixed(2)} kg</b>
                </div>
                <div>
                  Peso total estimado:{" "}
                  <b style={{ color: "#ffffff" }}>
                    {(cargaExplosiva.pesoPorTaladro_kg * Math.max(taladrosDetectados.total, 1)).toFixed(0)} kg
                  </b>
                </div>
                <div>
                  Factor de carga:{" "}
                  <b style={{ color: "#ffffff" }}>
                    {cargaExplosiva.volumenRonda_m3 > 0
                      ? (
                          (cargaExplosiva.pesoPorTaladro_kg * Math.max(taladrosDetectados.total, 1)) /
                          cargaExplosiva.volumenRonda_m3
                        ).toFixed(2)
                      : "0"}{" "}
                    kg/m³
                  </b>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>
                Carga lineal Mc = (π/4)·d²·ρ_explosivo y factor de carga = peso explosivo / volumen
                de roca — Ash, R.L. (1963) "The Mechanics of Rock Breakage", <i>Pit &amp; Quarry</i>{" "}
                (fórmulas ya implementadas y citadas en el motor compartido @suite/core). El peso
                total usa el conteo real de taladros generados; antes de generar la ronda es solo
                una estimación por taladro.
              </div>
            </div>

            {/* DIAGNÓSTICO TÉCNICO DE VOLADURA */}
            <div
              style={{
                background: "rgba(7, 12, 22, 0.6)",
                borderRadius: 10,
                border: "1px solid #1e293b",
                padding: 12,
                fontSize: 11,
                color: "#cbd5e1",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--acento, #f97316)" }}>
                Diagnóstico de Diseño
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Volumen roto por avance (eficiencia {(eficienciaCorte * 100).toFixed(0)}%):</span>
                <b>{(galeriaDetectada.area * avanceM * eficienciaCorte).toFixed(2)} m³</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Toneladas rotas (ρ = {densidadRocaGcm3.toFixed(2)} t/m³):</span>
                <b>{(galeriaDetectada.area * avanceM * eficienciaCorte * densidadRocaGcm3).toFixed(1)} ton</b>
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
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Estimación previa de taladros (alivio+arranque+contorno+producción):</span>
                <b>≈ {estimacionTaladros.total}</b>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
                Eficiencia de corte típica de un cuele paralelo bien diseñado: 85-95% (López Jimeno
                et al., 1995, cap. 22). La estimación de taladros es un conteo propio de este panel
                (perímetro/espaciamiento de contorno + área/burden·espaciamiento de producción); al
                generar la ronda real (pestaña Método) se reemplaza por el conteo exacto.
              </div>
            </div>
          </>
        )}
      </div>

      {/* PIE / BOTONES DE NAVEGACIÓN (ANTERIOR / SIGUIENTE) */}
      <div
        style={{
          padding: "12px 18px",
          borderTop: "1px solid #1e293b",
          background: "rgba(7, 12, 22, 0.9)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={irPasoAnterior}
          disabled={tab === "datos"}
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #475569",
            background: "transparent",
            color: tab === "datos" ? "#475569" : "#e2e8f0",
            fontSize: 12,
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
            padding: "10px",
            borderRadius: 8,
            border: "none",
            background: "var(--acento, #f97316)",
            color: "#ffffff",
            fontSize: 12,
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
    </div>
  );
}
