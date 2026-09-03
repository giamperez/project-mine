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
