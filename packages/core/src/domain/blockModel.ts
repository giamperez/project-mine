/** Tipos de dominio del modulo mining.block-model (Modelo de Bloques). */

export interface ColarSondaje {
  id: string;
  x: number;
  y: number;
  z: number;
  profundidadTotal_m: number;
  /** Azimut de la perforacion, grados (0-360, desde el norte). Default 0. */
  azimut_grados?: number;
  /** Inclinacion desde la horizontal, grados; -90 = vertical hacia abajo (convencion estandar de sondajes). Default -90. */
  inclinacion_grados?: number;
}

export interface IntervaloEnsayo {
  sondajeId: string;
  desde_m: number;
  hasta_m: number;
  ley: number;
}

export interface CompositoEnsayo {
  sondajeId: string;
  desde_m: number;
  hasta_m: number;
  ley: number;
  x: number;
  y: number;
  z: number;
}

export interface DefinicionModeloBloques {
  origen: { x: number; y: number; z: number };
  numeroBloques: { x: number; y: number; z: number };
  tamanoBloque: { x: number; y: number; z: number };
}

export interface Bloque {
  i: number;
  j: number;
  k: number;
  centro: { x: number; y: number; z: number };
  ley: number | null;
  numeroMuestras: number;
  /** Varianza de kriging (incertidumbre de la estimacion), solo si metodo="kriging". */
  varianzaKriging?: number | null;
}

export interface ModeloBloques {
  definicion: DefinicionModeloBloques;
  bloques: Bloque[];
}

export type TipoModeloVariograma = "esferico" | "exponencial" | "gaussiano";

export interface ModeloVariograma {
  tipo: TipoModeloVariograma;
  /** Efecto pepita (nugget, C0): discontinuidad en el origen, variabilidad a escala menor que el muestreo. */
  pepita: number;
  /** Meseta total (sill, C0+C): varianza a la que tiende la semivarianza para h grande. */
  meseta: number;
  /** Alcance (a), metros: parametro de forma. Para exponencial/gaussiano el alcance PRACTICO (95% de la meseta) es ~3a y a*sqrt(3) respectivamente. */
  alcance_m: number;
}

export interface PuntoVariogramaExperimental {
  distancia_m: number;
  semivarianza: number;
  numeroPares: number;
}

export type MetodoInterpolacion = "idw" | "kriging";

export interface EntradaInterpolacionModelo {
  compositos: CompositoEnsayo[];
  definicion: DefinicionModeloBloques;
  /** Metodo de interpolacion. Default "idw". */
  metodo?: MetodoInterpolacion;
  /** Exponente de la distancia (p) para IDW. Default 2. */
  potencia?: number;
  /** Modelo de variograma para kriging ordinario (requerido si metodo="kriging"). */
  variograma?: ModeloVariograma;
  radioBusqueda_m: number;
  numeroMinimoMuestras?: number;
  numeroMaximoMuestras?: number;
}

export interface PuntoCurvaLeyTonelaje {
  leyCorte: number;
  tonelaje_ton: number;
  leyMedia: number;
}

export interface ResumenTonelajeCorte {
  /** Bloques que quedan del lado seleccionado del corte (con ley conocida). */
  bloques: Bloque[];
  numeroBloques: number;
  tonelaje_ton: number;
  volumen_m3: number;
  leyMedia: number;
}
