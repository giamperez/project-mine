import React, { useState, useMemo } from "react";
import { CATALOGO_EXPLOSIVOS_PERU } from "@suite/core";
import type { Taladro } from "@suite/core";
import { BotonInfoTeoria, TarjetaTeoriaMalla, type DatosEnVivoMalla } from "./TarjetaTeoriaMalla.js";

export type TipoArranqueSubterraneo =
  | "cuatro_cuadrantes_holmberg"
  | "cuna_v_cut"
  | "abanico_fan_cut"
  | "piramidal_pyramid_cut"
  | "coromant_doble_alivio"
  | string;

export interface TrazoArranqueCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  subtitulo: string;
  categoria: "quemado_chimenea" | "tunel_paralelo" | "anti_simpatia" | "angular";
  numAlivios: number;
  diametroAlivioSugeridoMm: number;
  cotaAnchoTexto: string; // ej. '8"', '12"', '16"', '24"', '30"'
  cotaAnchoMetros: number;
  aplicacion: string;
  reglaSimpatia: string;
  tipoCorte: "paralelo_quemado" | "cuna" | "piramidal" | "abanico" | "diamante";
  // Puntos normalizados en [-1, 1] para el dibujo del trazo
  alivios: Array<{ x: number; y: number; rRelativo?: number }>;
  cargados: Array<{ x: number; y: number; id?: string }>;
  lineasGuia?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

export const CATALOGO_TRAZOS_ARRANQUE: TrazoArranqueCatalogo[] = [
  // 1. CHIMENEAS Y PIQUES - FIGURA A: 1 Alivio grande central + 4 cargados en diamante
  {
    id: "trazo-chimenea-a",
    codigo: "Trazo A",
    nombre: "Corte Quemado Diamante Simple",
    subtitulo: "1 Alivio central + 4 cargados cruzados",
    categoria: "quemado_chimenea",
    numAlivios: 1,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '8"',
    cotaAnchoMetros: 0.20,
    aplicacion: "Chimeneas, piques estrechos y labores de avance rápido con roca de calidad media a tenaz.",
    reglaSimpatia: "La distancia mínima alivio-cargado (B1) previene la deformación por compresión dinámica.",
    tipoCorte: "paralelo_quemado",
    alivios: [{ x: 0, y: 0, rRelativo: 1.2 }],
    cargados: [
      { x: 0, y: 0.55 },
      { x: 0.55, y: 0 },
      { x: 0, y: -0.55 },
      { x: -0.55, y: 0 },
    ],
    lineasGuia: [],
  },

  // 2. CHIMENEAS Y PIQUES - FIGURA B: 1 Alivio pequeño central + 4 cargados externos
  {
    id: "trazo-chimenea-b",
    codigo: "Trazo B",
    nombre: "Quemado Compacto de Pique",
    subtitulo: "1 Alivio central + 4 taladros cargados en rombo",
    categoria: "quemado_chimenea",
    numAlivios: 1,
    diametroAlivioSugeridoMm: 89,
    cotaAnchoTexto: '8"',
    cotaAnchoMetros: 0.20,
    aplicacion: "Piques de ventilación y chimeneas raise borer / convencionales.",
    reglaSimpatia: "Excelente simetría radial que asegura fragmentación concéntrica.",
    tipoCorte: "paralelo_quemado",
    alivios: [{ x: 0, y: 0, rRelativo: 1.0 }],
    cargados: [
      { x: 0, y: 0.65 },
      { x: 0.65, y: 0 },
      { x: 0, y: -0.65 },
      { x: -0.65, y: 0 },
    ],
    lineasGuia: [],
  },

  // 3. ANTI-SIMPATÍA - FIGURA B: 2 ALIVIOS VERTICALES
  {
    id: "trazo-simpatia-doble",
    codigo: "Anti-Simpatía 2 Alivios",
    nombre: "Doble Alivio Vertical Tándem",
    subtitulo: "2 Alivios verticales + 6 cargados perimetrales",
    categoria: "anti_simpatia",
    numAlivios: 2,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '8" - 12"',
    cotaAnchoMetros: 0.25,
    aplicacion: "Evita la simpatía o desensibilización por onda de choque en macizos masivos saturados.",
    reglaSimpatia: "Crea una ranura elíptica vertical que canaliza los gases sin comprimir el barreno adyacente.",
    tipoCorte: "paralelo_quemado",
    alivios: [
      { x: 0, y: 0.22, rRelativo: 1.1 },
      { x: 0, y: -0.22, rRelativo: 1.1 },
    ],
    cargados: [
      { x: 0, y: 0.70 },
      { x: -0.45, y: 0.22 },
      { x: 0.45, y: 0.22 },
      { x: -0.45, y: -0.22 },
      { x: 0.45, y: -0.22 },
      { x: 0, y: -0.70 },
    ],
    lineasGuia: [],
  },

  // 4. ANTI-SIMPATÍA - FIGURA C: 3 ALIVIOS EN TRIÁNGULO
  {
    id: "trazo-simpatia-triple",
    codigo: "Anti-Simpatía 3 Alivios",
    nombre: "Triple Alivio Triangular",
    subtitulo: "3 Alivios en triángulo equilátero + cargados en vértices",
    categoria: "anti_simpatia",
    numAlivios: 3,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '12"',
    cotaAnchoMetros: 0.30,
    aplicacion: "Roca extremadamente tenaz (granodiorita, cuarcita) con alta tenacidad a la fractura.",
    reglaSimpatia: "Apertura tridimensional equilibrada que anula la transmisión parasitaria del retardo 1 al 2.",
    tipoCorte: "paralelo_quemado",
    alivios: [
      { x: -0.24, y: 0.14, rRelativo: 1.15 },
      { x: 0.24, y: 0.14, rRelativo: 1.15 },
      { x: 0, y: -0.26, rRelativo: 1.15 },
    ],
    cargados: [
      { x: 0, y: 0.65 },
      { x: -0.60, y: -0.38 },
      { x: 0.60, y: -0.38 },
    ],
    lineasGuia: [],
  },

  // 5. TÚNELES - TRAZO Nº 5: Diamante alargado (1 Alivio grande central)
  {
    id: "trazo-tunel-5",
    codigo: "Trazo Nº 5",
    nombre: "Cuele en Diamante Estándar",
    subtitulo: "1 Alivio central + 4 taladros diamante + 4 ayudas",
    categoria: "tunel_paralelo",
    numAlivios: 1,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '16"',
    cotaAnchoMetros: 0.40,
    aplicacion: "Galerías y túneles de 2.0x2.0m a 3.0x3.0m con perforación con jumbo o jackleg.",
    reglaSimpatia: "El alivio central actúa como primera cara libre instantánea.",
    tipoCorte: "diamante",
    alivios: [{ x: 0, y: 0, rRelativo: 1.3 }],
    cargados: [
      { x: 0, y: 0.40 },
      { x: 0.40, y: 0 },
      { x: 0, y: -0.40 },
      { x: -0.40, y: 0 },
      { x: 0.35, y: 0.35 },
      { x: -0.35, y: 0.35 },
      { x: -0.35, y: -0.35 },
      { x: 0.35, y: -0.35 },
    ],
    lineasGuia: [],
  },

  // 6. TÚNELES - TRAZO Nº 4 / HOLMBERG: 4 Alivios centrales en cuadrado
  {
    id: "trazo-tunel-4-holmberg",
    codigo: "Trazo Nº 4",
    nombre: "Holmberg Sueco (4 Alivios)",
    subtitulo: "4 Alivios centrales en racimo + 4 cuadrantes",
    categoria: "tunel_paralelo",
    numAlivios: 4,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '14" - 16"',
    cotaAnchoMetros: 0.40,
    aplicacion: "Secciones medianas y grandes (2.5×2.5m a 4.0×4.0m) con jumbo electrohidráulico.",
    reglaSimpatia: "Máxima superficie de descompresión (Deq = D·√4 = 204 mm). Elimina el riesgo de congelamiento.",
    tipoCorte: "paralelo_quemado",
    alivios: [
      { x: -0.16, y: 0.16, rRelativo: 1.05 },
      { x: 0.16, y: 0.16, rRelativo: 1.05 },
      { x: 0.16, y: -0.16, rRelativo: 1.05 },
      { x: -0.16, y: -0.16, rRelativo: 1.05 },
    ],
    cargados: [
      { x: 0, y: 0.48 },
      { x: 0.48, y: 0 },
      { x: 0, y: -0.48 },
      { x: -0.48, y: 0 },
      { x: 0.42, y: 0.42 },
      { x: -0.42, y: 0.42 },
      { x: -0.42, y: -0.42 },
      { x: 0.42, y: -0.42 },
    ],
    lineasGuia: [],
  },

  // 7. TÚNELES - TRAZO Nº 16: Círculo / Hexágono (Konya Cut)
  {
    id: "trazo-tunel-16-hexagonal",
    codigo: "Trazo Nº 16",
    nombre: "Arranque Hexagonal Konya",
    subtitulo: "1 Alivio central + 6 taladros en corona circular",
    categoria: "tunel_paralelo",
    numAlivios: 1,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '10" - 12"',
    cotaAnchoMetros: 0.28,
    aplicacion: "Distribución isotrópica óptima para macizos rocosos homogéneos.",
    reglaSimpatia: "Burden equidistante en 360° con menor número total de perforaciones.",
    tipoCorte: "paralelo_quemado",
    alivios: [{ x: 0, y: 0, rRelativo: 1.25 }],
    cargados: [
      { x: 0, y: 0.52 },
      { x: 0.45, y: 0.26 },
      { x: 0.45, y: -0.26 },
      { x: 0, y: -0.52 },
      { x: -0.45, y: -0.26 },
      { x: -0.45, y: 0.26 },
    ],
    lineasGuia: [],
  },

  // 8. TÚNELES - TRAZO Nº 15: Coromant (Ranura Lineal Continua)
  {
    id: "trazo-tunel-15-coromant",
    codigo: "Trazo Nº 15",
    nombre: "Coromant Ranura Lineal",
    subtitulo: "Línea central de alivios + filas paralelas con guías",
    categoria: "tunel_paralelo",
    numAlivios: 3,
    diametroAlivioSugeridoMm: 89,
    cotaAnchoTexto: '30"',
    cotaAnchoMetros: 0.75,
    aplicacion: "Labores estrechas en vetas angostas y túneles con estratificación horizontal marcada.",
    reglaSimpatia: "La ranura continua absorbe totalmente la sobrepresión hidrodinámica lateral.",
    tipoCorte: "paralelo_quemado",
    alivios: [
      { x: 0, y: 0.40, rRelativo: 0.9 },
      { x: 0, y: 0.20, rRelativo: 0.9 },
      { x: 0, y: 0.00, rRelativo: 0.9 },
      { x: 0, y: -0.20, rRelativo: 0.9 },
      { x: 0, y: -0.40, rRelativo: 0.9 },
    ],
    cargados: [
      { x: -0.55, y: 0.35 },
      { x: 0.55, y: 0.35 },
      { x: -0.55, y: 0.00 },
      { x: 0.55, y: 0.00 },
      { x: -0.55, y: -0.35 },
      { x: 0.55, y: -0.35 },
    ],
    lineasGuia: [
      { x1: -0.55, y1: 0.35, x2: -0.05, y2: 0.35 },
      { x1: 0.05, y1: 0.35, x2: 0.55, y2: 0.35 },
      { x1: -0.55, y1: 0.00, x2: -0.05, y2: 0.00 },
      { x1: 0.05, y1: 0.00, x2: 0.55, y2: 0.00 },
      { x1: -0.55, y1: -0.35, x2: -0.05, y2: -0.35 },
      { x1: 0.05, y1: -0.35, x2: 0.55, y2: -0.35 },
    ],
  },

  // 9. TÚNELES - TRAZO CUÑA (V-Cut / Arranque Angular)
  {
    id: "trazo-angular-v-cut",
    codigo: "Arranque en Cuña",
    nombre: "V-Cut Angular Clásico",
    subtitulo: "Taladros convergentes en V hacia el eje central",
    categoria: "angular",
    numAlivios: 0,
    diametroAlivioSugeridoMm: 45,
    cotaAnchoTexto: '24" - 36"',
    cotaAnchoMetros: 0.80,
    aplicacion: "Túneles de gran sección con perforación manual Jackleg o perforadoras guiadas sin alivio grande.",
    reglaSimpatia: "No requiere barreno de alivio vacío; la cuña angulada expulsa la roca hacia afuera.",
    tipoCorte: "cuna",
    alivios: [],
    cargados: [
      { x: -0.40, y: 0.40 },
      { x: 0.40, y: 0.40 },
      { x: -0.40, y: 0.00 },
      { x: 0.40, y: 0.00 },
      { x: -0.40, y: -0.40 },
      { x: 0.40, y: -0.40 },
    ],
    lineasGuia: [
      { x1: -0.40, y1: 0.40, x2: 0, y2: 0.40 },
      { x1: 0.40, y1: 0.40, x2: 0, y2: 0.40 },
      { x1: -0.40, y1: 0.00, x2: 0, y2: 0.00 },
      { x1: 0.40, y1: 0.00, x2: 0, y2: 0.00 },
      { x1: -0.40, y1: -0.40, x2: 0, y2: -0.40 },
      { x1: 0.40, y1: -0.40, x2: 0, y2: -0.40 },
    ],
  },

  // 10. TÚNELES - TRAZO PIRAMIDAL (Corte en X / Pirámide de 4 caras)
  {
    id: "trazo-angular-piramidal",
    codigo: "Arranque Piramidal",
    nombre: "Corte Piramidal (en X)",
    subtitulo: "4 Alivios centrales + 2 niveles en las 4 diagonales en X",
    categoria: "angular",
    numAlivios: 4,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '16" - 24"',
    cotaAnchoMetros: 0.50,
    aplicacion: "Piques, chimeneas y túneles con macizo homogéneo y necesidad de alta concentración de energía en el núcleo.",
    reglaSimpatia: "Los barrenos convergen hacia el ápice piramidal en 4 direcciones simétricas en X.",
    tipoCorte: "piramidal",
    alivios: [
      { x: -0.12, y: 0.12, rRelativo: 1.0 },
      { x: 0.12, y: 0.12, rRelativo: 1.0 },
      { x: 0.12, y: -0.12, rRelativo: 1.0 },
      { x: -0.12, y: -0.12, rRelativo: 1.0 },
    ],
    cargados: [
      // Nivel 1 (Diagonales interiores)
      { x: -0.32, y: 0.32 },
      { x: 0.32, y: 0.32 },
      { x: 0.32, y: -0.32 },
      { x: -0.32, y: -0.32 },
      // Nivel 2 (Diagonales exteriores)
      { x: -0.58, y: 0.58 },
      { x: 0.58, y: 0.58 },
      { x: 0.58, y: -0.58 },
      { x: -0.58, y: -0.58 },
    ],
    lineasGuia: [
      { x1: -0.58, y1: 0.58, x2: 0, y2: 0 },
      { x1: 0.58, y1: 0.58, x2: 0, y2: 0 },
      { x1: 0.58, y1: -0.58, x2: 0, y2: 0 },
      { x1: -0.58, y1: -0.58, x2: 0, y2: 0 },
    ],
  },

  // 11. TÚNELES - TRAZO EN ABANICO (Fan Cut Radial)
  {
    id: "trazo-angular-abanico",
    codigo: "Arranque en Abanico",
    nombre: "Corte en Abanico (Fan Cut)",
    subtitulo: "Anillo radial concéntrico + arco superior de salida",
    categoria: "angular",
    numAlivios: 4,
    diametroAlivioSugeridoMm: 102,
    cotaAnchoTexto: '20" - 28"',
    cotaAnchoMetros: 0.60,
    aplicacion: "Túneles donde la cara libre principal se orienta hacia la clave o hastial.",
    reglaSimpatia: "Distribución angular progresiva que escalona la apertura en abanico.",
    tipoCorte: "abanico",
    alivios: [
      { x: -0.10, y: 0.10, rRelativo: 1.0 },
      { x: 0.10, y: 0.10, rRelativo: 1.0 },
      { x: 0.10, y: -0.10, rRelativo: 1.0 },
      { x: -0.10, y: -0.10, rRelativo: 1.0 },
    ],
    cargados: [
      { x: 0.32, y: 0 },
      { x: 0.23, y: 0.23 },
      { x: 0, y: 0.32 },
      { x: -0.23, y: 0.23 },
      { x: -0.32, y: 0 },
      { x: -0.23, y: -0.23 },
      { x: 0, y: -0.32 },
      { x: 0.23, y: -0.23 },
      // Abanico superior
      { x: 0.55, y: 0.15 },
      { x: 0.38, y: 0.45 },
      { x: 0, y: 0.60 },
      { x: -0.38, y: 0.45 },
      { x: -0.55, y: 0.15 },
    ],
    lineasGuia: [],
  },
];

export interface EsquemaArranqueCotasProps {
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  avanceM: number;
  rmr: number;
  anchoGaleria: number;
  altoGaleria: number;
  tipoSeccion?: string;
  centroCuele?: { x: number; y: number };
  taladros?: Taladro[];
  tipoArranque?: string;
  explosivoId?: string;
  onCambiarTipoArranque?: (tipo: any) => void;
  onAplicarTrazoSeleccionado?: (config: {
    numAlivios: number;
    diametroAlivioMm: number;
    tipoCorte: string;
    nombreTrazo: string;
  }) => void;
  onLimpiarGuiasCad?: () => void;
}

export default function EsquemaArranqueCotas({
  numAlivios,
  diametroAlivioMm,
  diametroProdMm,
  avanceM,
  rmr: rmrInicial,
  anchoGaleria,
  altoGaleria,
  explosivoId = "semexsa-65",
  onAplicarTrazoSeleccionado,
  onLimpiarGuiasCad,
}: EsquemaArranqueCotasProps) {
  // Trazo seleccionado activo
  const [trazoActivoId, setTrazoActivoId] = useState<string>("trazo-tunel-4-holmberg");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todos");
  const [rmrLocal, setRmrLocal] = useState<number>(rmrInicial);
  const [explosivoIdLocal, setExplosivoIdLocal] = useState<string>(explosivoId);

  const explosivo =
    CATALOGO_EXPLOSIVOS_PERU.find((e) => e.id === explosivoIdLocal) ?? CATALOGO_EXPLOSIVOS_PERU[0];

  const trazosFiltrados = CATALOGO_TRAZOS_ARRANQUE.filter((t) => {
    if (categoriaFiltro === "todos") return true;
    return t.categoria === categoriaFiltro;
  });

  const trazoSeleccionado =
    CATALOGO_TRAZOS_ARRANQUE.find((t) => t.id === trazoActivoId) ?? CATALOGO_TRAZOS_ARRANQUE[0];

  // Reglas geomecánicas basadas en RMR
  const infoRoca = React.useMemo(() => {
    if (rmrLocal > 65) {
      return {
        clase: "Clase I/II · Roca Muy Dura",
        aliviosRecomendados: "3 a 4 Alivios Ø102mm",
        color: "#ef4444",
        recomendacion: "Requiere alta superficie libre (Holmberg 4 alivios o Triple Alivio) para evitar sinterización.",
      };
    }
    if (rmrLocal >= 41) {
      return {
        clase: "Clase III · Roca Regular / Media",
        aliviosRecomendados: "2 a 4 Alivios Ø102mm",
        color: "#f59e0b",
        recomendacion: "Cuele estándar en diamante o 4 cuadrantes con excelente rendimiento y avance >95%.",
      };
    }
    return {
      clase: "Clase IV/V · Roca Suave / Friable",
      aliviosRecomendados: "1 a 2 Alivios Ø89-102mm",
      color: "#10b981",
      recomendacion: "Menor requerimiento de expansión. Vigilar el emboquille para evitar el desmoronamiento de los barrenos.",
    };
  }, [rmrLocal]);

  // Estado para la ficha de teoría técnica desplegable
  const [teoriaAbierta, setTeoriaAbierta] = useState<string | null>(null);

  // Datos en vivo para alimentar las fórmulas y fundamentos teóricos de la tarjeta
  const datosEnVivoArranque: DatosEnVivoMalla = useMemo(() => {
    const area = anchoGaleria * altoGaleria * 0.88;
    const deMm = Math.round(diametroAlivioMm * Math.sqrt(Math.max(1, numAlivios)));
    const volumen = area * avanceM * 0.92;
    const totalCargados = 36;
    const q_l = (Math.PI / 4) * Math.pow(diametroProdMm / 1000, 2) * explosivo.densidadGcm3 * 1000;
    const pesoTotalKg = totalCargados * q_l * (avanceM - (diametroProdMm * 10) / 1000);
    return {
      tipoSeccion: "herradura",
      anchoGaleria,
      altoGaleria,
      alturaCorona: anchoGaleria / 2,
      areaSeccion: area,
      perimetroSeccion: 2 * anchoGaleria + 2 * altoGaleria,
      numAlivios,
      diametroAlivioMm,
      diametroProdMm,
      diametroEquivalenteDeMm: deMm,
      avanceM,
      rmrScore: rmrLocal,
      claseRmr: infoRoca.clase,
      tipoRoca: rmrLocal > 60 ? "Roca Dura" : rmrLocal >= 41 ? "Roca Semidura" : "Roca Suave",
      explosivoNombre: explosivo.nombre,
      explosivoVod: explosivo.vodMs,
      explosivoDensidad: explosivo.densidadGcm3,
      explosivoPresionDetKbar: explosivo.presionDetonacionKbar,
      explosivoRws: explosivo.rwsPeso,
      factorCargaKgM3: pesoTotalKg / Math.max(0.1, volumen),
      volumenRotoM3: volumen,
      toneladasRotas: volumen * 2.7,
      pesoTotalExplosivoKg: pesoTotalKg,
      cargaLinealKgM: q_l,
      metodoDiseno: "holmberg_1982",
      patronContorno: "corona_recorte",
      totalTaladros: totalCargados + numAlivios,
      taladrosCargados: totalCargados,
      taladrosAlivio: numAlivios,
    };
  }, [
    anchoGaleria,
    altoGaleria,
    numAlivios,
    diametroAlivioMm,
    diametroProdMm,
    avanceM,
    rmrLocal,
    infoRoca,
    explosivo,
  ]);

  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(7, 12, 22, 0.99) 100%)",
        borderRadius: 14,
        padding: 16,
        border: "1.5px solid rgba(56, 189, 248, 0.35)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.55)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* CABECERA CON LEYENDA TÉCNICA OFICIAL */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          borderBottom: "1px solid rgba(51, 65, 85, 0.6)",
          paddingBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: 7 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.35" />
                <circle cx="12" cy="12" r="6" strokeOpacity="0.7" />
                <circle cx="12" cy="12" r="2" fill="#38bdf8" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              <span>CATÁLOGO OFICIAL DE TRAZOS DE ARRANQUE (CUELES MINEROS)</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>
              Modelos de Corte Quemado, Anti-Simpatía y Trazos para Túneles y Piques · Ref: Manual de Perforación y Voladura Subterránea
            </div>
          </div>
          <BotonInfoTeoria
            activo={teoriaAbierta === "catalogo_trazos"}
            onClick={() => setTeoriaAbierta(teoriaAbierta === "catalogo_trazos" ? null : "catalogo_trazos")}
            titulo="Ver teoría de cueles mineros, cálculo de corte quemado, alivios y fórmulas (?)"
          />
        </div>

        {/* LEYENDA CLARA: TALADRO CARGADO VS TALADRO DE ALIVIO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "rgba(30, 41, 59, 0.7)",
            padding: "5px 12px",
            borderRadius: 8,
            border: "1px solid rgba(56, 189, 248, 0.25)",
            fontSize: 10.5,
          }}
        >
          <span style={{ fontWeight: 800, color: "#e2e8f0" }}>LEYENDA:</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 6px #ef4444",
                display: "inline-block",
              }}
            />
            <span style={{ color: "#ef4444", fontWeight: 700 }}>TALADRO CARGADO</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "#fef08a",
                border: "2px solid #ca8a04",
                display: "inline-block",
              }}
            />
            <span style={{ color: "#fef08a", fontWeight: 700 }}>TALADRO DE ALIVIO (SIN CARGA)</span>
          </div>
        </div>
      </div>

      {/* TARJETA DESPLEGABLE DE TEORÍA Y FÓRMULAS TÉCNICAS */}
      {teoriaAbierta === "catalogo_trazos" && (
        <TarjetaTeoriaMalla
          id="catalogo_trazos"
          onCerrar={() => setTeoriaAbierta(null)}
          datosEnVivo={datosEnVivoArranque}
        />
      )}

      {/* BARRA DE FILTROS Y CONTROL RMR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          background: "rgba(15, 23, 42, 0.6)",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #1e293b",
        }}
      >
        {/* FILTRO POR CATEGORÍA */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>Categoría:</span>
          {[
            {
              id: "todos",
              label: "Todos los Trazos",
              icon: (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ),
            },
            {
              id: "tunel_paralelo",
              label: "Túneles (Corte Paralelo)",
              icon: (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 20V12a7 7 0 0 1 14 0v8" />
                  <path d="M4 20h16" />
                </svg>
              ),
            },
            {
              id: "anti_simpatia",
              label: "Anti-Simpatía",
              icon: (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="7" r="3.5" />
                  <circle cx="12" cy="17" r="3.5" />
                </svg>
              ),
            },
            {
              id: "quemado_chimenea",
              label: "Chimeneas / Piques",
              icon: (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="6" y="3" width="12" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
                </svg>
              ),
            },
            {
              id: "angular",
              label: "Cuña (V-Cut)",
              icon: (
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 5l8 14 8-14" />
                </svg>
              ),
            },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoriaFiltro(cat.id)}
              style={{
                padding: "4px 9px",
                fontSize: 10,
                fontWeight: categoriaFiltro === cat.id ? 700 : 500,
                borderRadius: 5,
                border: categoriaFiltro === cat.id ? "1px solid #38bdf8" : "1px solid #334155",
                background: categoriaFiltro === cat.id ? "rgba(56, 189, 248, 0.22)" : "rgba(7, 12, 22, 0.5)",
                color: categoriaFiltro === cat.id ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* BOTÓN LIMPIAR CAD */}
        {onLimpiarGuiasCad && (
          <button
            type="button"
            onClick={onLimpiarGuiasCad}
            style={{
              padding: "5px 10px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              borderRadius: 6,
              color: "#fca5a5",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Quitar las líneas y cotas superpuestas del visor CAD 3D"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Limpiar Guías CAD</span>
          </button>
        )}
      </div>

      {/* GALERÍA DE TRAZOS EN MATRIZ (IDÉNTICO A LAS FICHAS TÉCNICAS DE LA IMAGEN) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {trazosFiltrados.map((t) => {
          const esActivo = t.id === trazoActivoId;
          return (
            <div
              key={t.id}
              onClick={() => setTrazoActivoId(t.id)}
              style={{
                background: esActivo ? "rgba(14, 30, 56, 0.9)" : "rgba(10, 15, 26, 0.8)",
                borderRadius: 10,
                border: esActivo ? "2px solid #38bdf8" : "1px solid #1e293b",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s ease",
                boxShadow: esActivo ? "0 0 16px rgba(56, 189, 248, 0.25)" : "none",
              }}
            >
              {/* BADGE DE CÓDIGO */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: esActivo ? "#38bdf8" : "#f1f5f9",
                    textTransform: "uppercase",
                  }}
                >
                  {t.codigo}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    background: "rgba(51, 65, 85, 0.6)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    color: "#94a3b8",
                    fontWeight: 600,
                  }}
                >
                  {t.numAlivios > 0 ? `${t.numAlivios} Alivio${t.numAlivios > 1 ? "s" : ""}` : "Sin Alivio"}
                </span>
              </div>

              {/* CAJA DE DIBUJO DEL TRAZO (FONDO BLANCO/CREMA IDÉNTICO A LOS MANUALES TÉCNICOS) */}
              <div
                style={{
                  width: "100%",
                  height: 140,
                  background: "#fefefe",
                  borderRadius: 6,
                  border: "1.5px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow: "inset 0 0 8px rgba(0,0,0,0.06)",
                }}
              >
                <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ width: "90%", height: "90%" }}>
                  {/* Definición de flecha de cota en negro */}
                  <defs>
                    <marker id={`arr-cat-${t.id}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                      <polygon points="0 0, 5 2.5, 0 5" fill="#1e293b" />
                    </marker>
                    <marker id={`arr-cat-rev-${t.id}`} markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto">
                      <polygon points="5 0, 0 2.5, 5 5" fill="#1e293b" />
                    </marker>
                  </defs>

                  {/* LÍNEAS GUÍA (ej. Trazo Coromant / Cuña) */}
                  {t.lineasGuia?.map((l, idx) => (
                    <line
                      key={idx}
                      x1={l.x1}
                      y1={-l.y1}
                      x2={l.x2}
                      y2={-l.y2}
                      stroke="#475569"
                      strokeWidth="0.035"
                    />
                  ))}

                  {/* TALADROS DE ALIVIO (CÍRCULOS AMARILLOS CON BORDE O VACÍOS SEGÚN LEYENDA) */}
                  {t.alivios.map((a, idx) => {
                    const r = 0.16 * (a.rRelativo ?? 1.0);
                    return (
                      <g key={`alivio-${idx}`}>
                        <circle
                          cx={a.x}
                          cy={-a.y}
                          r={r}
                          fill="#fef08a"
                          stroke="#ca8a04"
                          strokeWidth="0.04"
                        />
                      </g>
                    );
                  })}

                  {/* TALADROS CARGADOS (PUNTOS ROJOS RELLENOS) */}
                  {t.cargados.map((c, idx) => (
                    <circle
                      key={`cargado-${idx}`}
                      cx={c.x}
                      cy={-c.y}
                      r={0.08}
                      fill="#dc2626"
                      stroke="#991b1b"
                      strokeWidth="0.02"
                    />
                  ))}

                  {/* COTA INFERIOR DE APERTURA (ej. 8", 12", 16", 24") */}
                  <g>
                    <line
                      x1="-0.85"
                      y1="0.95"
                      x2="0.85"
                      y2="0.95"
                      stroke="#0f172a"
                      strokeWidth="0.03"
                      markerStart={`url(#arr-cat-rev-${t.id})`}
                      markerEnd={`url(#arr-cat-${t.id})`}
                    />
                    <rect
                      x="-0.38"
                      y="0.75"
                      width="0.76"
                      height="0.32"
                      fill="#ffffff"
                      rx="0.06"
                    />
                    <text
                      x="0"
                      y="0.98"
                      fill="#0f172a"
                      fontSize="0.22"
                      fontWeight="900"
                      textAnchor="middle"
                      fontFamily="Arial, sans-serif"
                    >
                      {t.cotaAnchoTexto}
                    </text>
                  </g>
                </svg>
              </div>

              {/* TÍTULO Y DESCRIPCIÓN RÁPIDA */}
              <div style={{ marginTop: 8, width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc" }}>
                  {t.nombre}
                </div>
                <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>
                  {t.subtitulo}
                </div>
              </div>

              {/* BOTÓN SELECCIONAR / APLICAR */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTrazoActivoId(t.id);
                  onAplicarTrazoSeleccionado?.({
                    numAlivios: t.numAlivios,
                    diametroAlivioMm: t.diametroAlivioSugeridoMm,
                    tipoCorte: t.tipoCorte,
                    nombreTrazo: `${t.codigo} · ${t.nombre}`,
                  });
                }}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: esActivo ? "1px solid #38bdf8" : "1px solid #334155",
                  background: esActivo
                    ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                    : "rgba(30, 41, 59, 0.6)",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{esActivo ? "✓ Aplicado a Malla" : "★ Seleccionar Trazo"}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* DETALLE TÉCNICO Y RECOMENDACIÓN GEOMECÁNICA DEL TRAZO SELECCIONADO */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.8)",
          borderRadius: 10,
          border: "1px solid #334155",
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#38bdf8", marginBottom: 4 }}>
            Especificación Técnica: {trazoSeleccionado.codigo} · {trazoSeleccionado.nombre}
          </div>
          <div style={{ fontSize: 10.5, color: "#cbd5e1", lineHeight: 1.45 }}>
            {trazoSeleccionado.aplicacion}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
            <b style={{ color: "#f59e0b" }}>Control de Simpatía: </b>
            {trazoSeleccionado.reglaSimpatia}
          </div>
        </div>

        <div style={{ background: "rgba(7, 12, 22, 0.6)", padding: 10, borderRadius: 8, border: "1px solid #1e293b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#cbd5e1" }}>Compatibilidad Geomecánica:</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: infoRoca.color }}>{infoRoca.clase}</span>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
            {infoRoca.recomendacion}
          </div>
          <div style={{ marginTop: 6, fontSize: 9.5, color: "#38bdf8" }}>
            Avance estimado por tanda: <b>{(avanceM * 0.95).toFixed(2)} m</b> (Eficiencia: 95%)
          </div>
        </div>
      </div>
    </div>
  );
}
