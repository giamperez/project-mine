/** Tipos de dominio del diseno de rounds de tunel/galeria (arranque tipo Holmberg, zonas del frente). */

export type TipoSeccionTunel = "rectangular" | "herradura";

export interface GeometriaFrenteTunel {
  tipo: TipoSeccionTunel;
  ancho_m: number;
  alto_m: number;
}

export interface ResultadoGeometriaFrente {
  area_m2: number;
  perimetro_m: number;
  /** Altura de la corona (arco semicircular), solo para tipo "herradura". */
  alturaCorona_m: number;
  /** Altura de los hastiales rectos, solo para tipo "herradura" (alto total - alturaCorona). */
  alturaHastial_m: number;
}

export interface EntradaArranqueHolmberg {
  /** Diametro de cada taladro de alivio (vacio, sin carga), mm. */
  diametroIndividualAlivio_mm: number;
  /** Numero de taladros de alivio agrupados en el arranque. */
  numeroTaladrosAlivio: number;
  /** Avance objetivo de la tanda, m — usado solo para la regla de parada (num. de secciones). */
  avance_m: number;
  /** Maximo de secciones a generar aunque la regla de parada no se cumpla antes (limite de seguridad). Default 8. */
  maximoSecciones?: number;
}

export interface SeccionArranque {
  numero: number;
  /** Burden de la seccion, m. */
  burden_m: number;
  /** Lado/apertura resultante tras volar la seccion (espaciamiento equivalente), m. */
  espaciamiento_m: number;
  /** Factor B->E aplicado en esta seccion (1.0 para la 1a seccion, 1.5 para las siguientes — ver formula.ts). */
  factor: number;
}

export interface ResultadoArranqueHolmberg {
  diametroEquivalente_mm: number;
  secciones: SeccionArranque[];
}

export type ZonaTaladroTunel =
  | "alivio"
  | "cuadrante1"
  | "cuadrante2"
  | "cuadrante3"
  | "cuadrante4"
  | "produccion"
  | "cuadrador"
  | "corona"
  | "recorte"
  | "arrastre";

export const ETIQUETAS_ZONA_TUNEL: Record<ZonaTaladroTunel, string> = {
  alivio: "Alivios",
  cuadrante1: "Cuadrante 1",
  cuadrante2: "Cuadrante 2",
  cuadrante3: "Cuadrante 3",
  cuadrante4: "Cuadrante 4",
  produccion: "Producción",
  cuadrador: "Cuadradores",
  corona: "Corona",
  recorte: "Recorte / control",
  arrastre: "Arrastres",
};

/** Color por zona — mismo lenguaje visual que la referencia (celeste=alivio, blanco=recorte, verde=corona, ...). */
export const COLOR_ZONA_TUNEL: Record<ZonaTaladroTunel, string> = {
  alivio: "#38bdf8",
  cuadrante1: "#ef4444",
  cuadrante2: "#f97316",
  cuadrante3: "#eab308",
  cuadrante4: "#a855f7",
  produccion: "#ec4899",
  cuadrador: "#38bdf8",
  corona: "#22c55e",
  recorte: "#f8fafc",
  arrastre: "#facc15",
}

export interface TaladroTunel {
  id: string;
  /** Posicion en el plano de la seccion (x=horizontal, y=vertical, origen en el piso-centro). */
  x: number;
  y: number;
  zona: ZonaTaladroTunel;
}

/**
 * Zonas de una ronda (round) de frente para el generador de layout `generarTaladrosFrenteTunel`.
 * Vocabulario reducido a 7 grupos (a diferencia de `ZonaTaladroTunel`, mas granular) porque asi
 * es como el editor CAD agrupa/colorea taladros (ver `GrupoTaladroCad` en EditorCadMalla.tsx).
 */
export type ZonaTaladroFrente =
  | "alivio"
  | "arranque"
  | "cuadrante"
  | "produccion"
  | "corona"
  | "hastial"
  | "arrastre";

export interface PuntoTaladroFrente {
  id: string;
  x: number;
  y: number;
  z: number;
  zona: ZonaTaladroFrente;
  diametroMm: number;
  cargado: boolean;
  /** Numero de seccion del arranque (1..N), solo para zona "arranque"/"cuadrante". */
  etapa?: number;
}

export interface EntradaTaladrosFrente {
  /** Vertices del contorno de la galeria (plano XY), en orden, >=3. */
  poligonoCresta: Array<{ x: number; y: number }>;
  /** Cota Z de la cara del frente (donde se ubican los collares). Default 0. */
  cotaFrente_m?: number;
  /** Secciones del arranque ya calculadas por `calcularArranqueHolmberg`. */
  secciones: SeccionArranque[];
  diametroIndividualAlivio_mm: number;
  numeroTaladrosAlivio: number;
  /** Diametro de los taladros cargados (cuadrante/produccion/contorno/arrastre), mm. */
  diametroCargaMm: number;
  /** Burden y espaciamiento de la zona de produccion/destroza, m. */
  burdenProduccion_m: number;
  espaciamientoProduccion_m: number;
  /** Espaciamiento de los taladros de contorno (corona/hastial/arrastre), m — ver regla de
   * voladura controlada (smooth blasting) en `generarTaladrosFrenteTunel`. */
  espaciamientoContorno_m: number;
}

export interface ResultadoTaladrosFrente {
  puntos: PuntoTaladroFrente[];
  advertencias: string[];
}

/** Propiedades técnicas completas de explosivos para minería subterránea y tajo abierto (EXSA / FAMESA, Perú). */
export interface PropiedadesExplosivoMina {
  id: string;
  nombre: string;
  fabricante: "EXSA" | "FAMESA" | "GENERICO";
  /** Densidad del encartuchado o a granel, g/cm³ (o kg/dm³). */
  densidadGcm3: number;
  /** Velocidad de detonación nominal, m/s. */
  vodMs: number;
  /** Presión de detonación nominal, kbar. PoD = 0.25e-5 * rho_e * VOD^2. */
  presionDetonacionKbar: number;
  /** Potencia relativa en peso respecto al ANFO (RWS %), ANFO = 100%. */
  rwsPeso: number;
  /** Potencia relativa en volumen respecto al ANFO (RBS %), ANFO = 100%. */
  rbsVolumen?: number;
  usoPrincipal: string;
}

/** Catálogo oficial de explosivos mineros comunes en Perú (EXSA / FAMESA). */
export const CATALOGO_EXPLOSIVOS_PERU: PropiedadesExplosivoMina[] = [
  {
    id: "gelatina-especial-75",
    nombre: "Gelatina Especial 75",
    fabricante: "EXSA",
    densidadGcm3: 1.38,
    vodMs: 5500,
    presionDetonacionKbar: 170, // 157-183 kbar
    rwsPeso: 105,
    usoPrincipal: "Arranque y cuele en roca muy dura / tenaz",
  },
  {
    id: "semexsa-80",
    nombre: "Semexsa 80",
    fabricante: "EXSA",
    densidadGcm3: 1.18,
    vodMs: 4500,
    presionDetonacionKbar: 138, // 125-152 kbar
    rwsPeso: 99,
    usoPrincipal: "Roca dura, arranque y ayudas",
  },
  {
    id: "semexsa-65",
    nombre: "Semexsa 65",
    fabricante: "EXSA",
    densidadGcm3: 1.12,
    vodMs: 4200,
    presionDetonacionKbar: 117, // 94-141 kbar
    rwsPeso: 92,
    usoPrincipal: "Producción y tajeo en roca media",
  },
  {
    id: "semexsa-45",
    nombre: "Semexsa 45",
    fabricante: "EXSA",
    densidadGcm3: 1.08,
    vodMs: 3800,
    presionDetonacionKbar: 110, // 87-134 kbar
    rwsPeso: 89,
    usoPrincipal: "Roca suave / friable, labores secundarias",
  },
  {
    id: "emulnor-3000",
    nombre: "Emulnor 3000",
    fabricante: "FAMESA",
    densidadGcm3: 1.14,
    vodMs: 5700,
    presionDetonacionKbar: 93,
    rwsPeso: 100,
    rbsVolumen: 145,
    usoPrincipal: "Arrastre y contorno con presencia de agua",
  },
  {
    id: "anfo-superfam",
    nombre: "ANFO / SUPERFAM DOS",
    fabricante: "FAMESA",
    densidadGcm3: 0.82,
    vodMs: 3750,
    presionDetonacionKbar: 48, // 45-51 kbar
    rwsPeso: 100,
    rbsVolumen: 100,
    usoPrincipal: "Patrón de referencia, labores secas y tajo abierto",
  },
];

export type MetodoDisenoSubterraneo =
  | "holmberg_1982"
  | "langefors_kihlstrom"
  | "empirico_famesa"
  | "area_influencia_coneingemmet"
  | "practico_empirico";

export type TipoCorteSubterraneo =
  | "paralelo_quemado"
  | "cuna"
  | "piramidal"
  | "abanico";

export interface DesgloseZonasTaladros {
  alivios: number;
  arranque: number;
  ayudas: number;
  cuadradores: number;
  corona: number;
  arrastre: number;
  recorte?: number;
  totalCargados: number;
  totalTaladros: number;
}

export interface ResultadoKuzRam {
  /** Tamaño medio de fragmento (X50), cm. */
  x50_cm: number;
  /** Índice de uniformidad de Cunningham (n). */
  indiceUniformidad_n: number;
  /** Tamaño característico de Rosin-Rammler (Xc), cm. */
  xc_cm: number;
  /** Porcentaje estimado pasante bajo 5 cm (finos). */
  porcentajeFinos_5cm: number;
  /** Porcentaje estimado retenido sobre 30 cm (sobretamaño / bolones). */
  porcentajeSobretamano_30cm: number;
  calidadFragmentacion: "fina" | "optima" | "gruesa_con_bolones";
}

export interface ResultadoHolmbergPersson {
  /** Velocidad pico de partícula estimada en el contorno (PPV), mm/s. */
  ppvContorno_mms: number;
  /** Distancia crítica de daño estructural a la roca circundante (PPV > 700-1000 mm/s), m. */
  radioDanoCritico_m: number;
  /** Evaluación del riesgo de sobre-excavación en corona/hastiales. */
  riesgoSobreExcavacion: "bajo" | "moderado" | "alto";
  recomendacionVoladuraSuave: string;
}

export interface ResultadoRondaSubterraneaCompleta {
  metodo: MetodoDisenoSubterraneo;
  tipoCorte: TipoCorteSubterraneo;
  area_m2: number;
  perimetro_m: number;
  diametroEquivalenteAlivio_mm: number;
  avanceObjetivo_m: number;
  avanceRealEstimado_m: number;
  eficienciaAvance_pct: number;
  constanteRoca_c: number;
  constanteRocaCorregida_cBar: number;
  factorK_Famesa: number;
  espaciamientoEmpirico_E: number;
  distanciaPerifericos_dt: number;
  seccionesCorte: SeccionArranque[];
  desgloseZonas: DesgloseZonasTaladros;
  metrosPerforadosTotal_m: number;
  perforacionEspecifica_m_m3: number;
  volumenRocaPorDisparo_m3: number;
  toneladasPorDisparo: number;
  pesoExplosivoTotal_kg: number;
  factorCarga_kg_m3: number;
  kuzRam: ResultadoKuzRam;
  holmbergPersson: ResultadoHolmbergPersson;
  advertencias: string[];
}

