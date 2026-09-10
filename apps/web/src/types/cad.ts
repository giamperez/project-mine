import type { Punto2D, Taladro } from "@suite/core";

export type SistemaCoordenadas = "local" | "utm_18s" | "utm_19s" | "psad56";
export type TipoLinea = "continua" | "discontinua" | "puntos" | "centro";
export type RolIngenieria = "geometria" | "galeria" | "burden_spacing";
export type TipoPuntoCad = "cruz_x" | "cruz_mas" | "circulo_x" | "punto";

export type GrupoTaladroCad =
  | "arranque"
  | "alivio"
  | "cuadrante"
  | "cuadrante1"
  | "cuadrante2"
  | "cuadrante3"
  | "cuadrante4"
  | "produccion"
  | "cuadradores"
  | "corona"
  | "recorte"
  | "contorno"
  | "hastial"
  | "arrastre";

export interface PuntoCad3D {
  id: string;
  x: number;
  y: number;
  z: number;
  capaId: string;
  tipo?: TipoPuntoCad;
  etiqueta?: string;
  color?: string;
  grupoTaladro?: GrupoTaladroCad;
  anguloLookoutRad?: number;
}

export interface LineaCad3D {
  id: string;
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
  capaId: string;
  tipo: TipoLinea;
  rol: RolIngenieria;
  longitud: number;
  azimut: number;
}

export interface PolilineaCad3D {
  id: string;
  puntos: { x: number; y: number; z: number }[];
  cerrada: boolean;
  capaId: string;
  tipo: TipoLinea;
  rol: RolIngenieria;
  longitud: number;
}

export type MetodoArco = "inicio_fin_r" | "centro_r" | "tres_puntos";

export interface ArcoCad3D {
  id: string;
  metodo: MetodoArco;
  centro: { x: number; y: number; z: number };
  radio: number;
  anguloInicio: number;
  anguloFin: number;
  puntos: { x: number; y: number; z: number }[];
  capaId: string;
  tipo: TipoLinea;
  rol: RolIngenieria;
  longitud: number;
}

export type TipoCotaCad = "distancia" | "b1" | "b2" | "b3" | "b4" | "b5" | "4g";

export interface CotaCad3D {
  id: string;
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
  desplazamiento: number;
  texto: string;
  tipo: TipoCotaCad;
  capaId: string;
}

export interface AristaSolidoCad {
  id: string;
  solidoId: string;
  tipo: "superior" | "inferior" | "vertical";
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
  longitud: number;
}

export interface SolidoCad3D {
  id: string;
  nombre: string;
  perfil: { x: number; y: number }[];
  modoExtrusion?: "profundidad" | "levantamiento" | "ambos";
  profundidad: number;
  levantamiento?: number;
  area_m2: number;
  volumen_m3: number;
  centroide: { x: number; y: number; z: number };
  color: string;
  capaId: string;
  aristas?: AristaSolidoCad[];
}

export interface MallaFinalSnapshot {
  id: string;
  nombre: string;
  fechaIso: string;
  taladros: Taladro[];
  puntosCad: PuntoCad3D[];
  polilineasCad: PolilineaCad3D[];
  lineasCad: LineaCad3D[];
  cotasCad: CotaCad3D[];
  poligonoCresta: Punto2D[];
  totalTaladros: number;
  metrosPerforacion: number;
  totalEntidades: number;
}

export interface InfoGrupoTaladro {
  id: GrupoTaladroCad;
  label: string;
  abrev: string;
  colorDefecto: string;
  radioMmDefecto: string;
  longitudMDefecto: string;
  lookOutDefecto: string;
  gradienteDefecto: string;
  cargadoDefecto: boolean;
}

export interface CapaCad {
  id: string;
  nombre: string;
  color: string;
  visible: boolean;
  bloqueada: boolean;
  carpetaId: string;
  elementosCount: number;
}

export interface CarpetaCad {
  id: string;
  nombre: string;
  abierta: boolean;
  visible: boolean;
}
