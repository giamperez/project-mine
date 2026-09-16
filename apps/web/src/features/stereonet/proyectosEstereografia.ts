import type {
  Discontinuidad,
  Hemisferio,
  ModoDensidad,
  ModoElementos,
  TaludEstereografia,
  TipoFallaSMR,
  TipoProyeccion,
  MetodoExcavacionSMR,
} from "@suite/core";

export type TipoEscenarioEstereo = "MIN" | "VIAL" | "SUB" | "EST";

export interface EscenarioEstereoDef {
  id: TipoEscenarioEstereo;
  abreviatura: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  taludDefecto: TaludEstereografia;
  anguloFriccionDefecto: number;
  toleranciaDefecto: number;
  discontinuidadesDefecto: Discontinuidad[];
}

export const ESCENARIOS_ESTEREOGRAFIA: EscenarioEstereoDef[] = [
  {
    id: "MIN",
    abreviatura: "MIN",
    nombre: "Talud Minero a Tajo Abierto",
    subtitulo: "Banco de explotación y bermas de seguridad",
    descripcion: "Evaluación cinemática de falla planar, en cuña y volcamiento con tolerancia de 20° para bancos.",
    taludDefecto: { dip_grados: 65, dipDirection_grados: 195 },
    anguloFriccionDefecto: 34,
    toleranciaDefecto: 20,
    discontinuidadesDefecto: [
      { id: "D-1", nombre: "J1 (Principal)", dip_grados: 55, dipDirection_grados: 190 },
      { id: "D-2", nombre: "J2 (Transversal)", dip_grados: 70, dipDirection_grados: 110 },
      { id: "D-3", nombre: "J3 (Estratificación)", dip_grados: 40, dipDirection_grados: 280 },
      { id: "D-4", nombre: "J4 (Falla local)", dip_grados: 75, dipDirection_grados: 10 },
    ],
  },
  {
    id: "VIAL",
    abreviatura: "VIAL",
    nombre: "Talud Vial y Corte de Carretera",
    subtitulo: "Estabilidad de taludes en accesos y vías mineras",
    descripcion: "Corte de roca para rampa o carretera con análisis cinemático y cálculo de factor de seguridad planar.",
    taludDefecto: { dip_grados: 75, dipDirection_grados: 90 },
    anguloFriccionDefecto: 35,
    toleranciaDefecto: 20,
    discontinuidadesDefecto: [
      { id: "D-1", nombre: "Falla-A", dip_grados: 70, dipDirection_grados: 275 },
      { id: "D-2", nombre: "Junta-1", dip_grados: 50, dipDirection_grados: 85 },
      { id: "D-3", nombre: "Junta-2", dip_grados: 45, dipDirection_grados: 140 },
    ],
  },
  {
    id: "SUB",
    abreviatura: "SUB",
    nombre: "Frente de Avance Subterráneo",
    subtitulo: "Galerías, bypass y bóvedas en roca fracturada",
    descripcion: "Análisis de cuñas formadas en corona y hastiales con clasificación geomecánica SMR adaptada.",
    taludDefecto: { dip_grados: 85, dipDirection_grados: 90 },
    anguloFriccionDefecto: 32,
    toleranciaDefecto: 15,
    discontinuidadesDefecto: [
      { id: "D-1", nombre: "Corte Frontal", dip_grados: 75, dipDirection_grados: 85 },
      { id: "D-2", nombre: "Lateral Techo", dip_grados: 60, dipDirection_grados: 355 },
      { id: "D-3", nombre: "Cizalla", dip_grados: 80, dipDirection_grados: 180 },
    ],
  },
  {
    id: "EST",
    abreviatura: "EST",
    nombre: "Estudio Estructural Personalizado",
    subtitulo: "Análisis cinemático completo y familias Fisher K",
    descripcion: "Configuración libre de datos estructurales con importación de CSV (DIPS/OpenStereo) y red de Schmidt.",
    taludDefecto: { dip_grados: 60, dipDirection_grados: 180 },
    anguloFriccionDefecto: 30,
    toleranciaDefecto: 20,
    discontinuidadesDefecto: [
      { id: "D-1", nombre: "J1", dip_grados: 40, dipDirection_grados: 185 },
      { id: "D-2", nombre: "J2", dip_grados: 65, dipDirection_grados: 260 },
      { id: "D-3", nombre: "J3", dip_grados: 75, dipDirection_grados: 10 },
      { id: "D-4", nombre: "J4", dip_grados: 55, dipDirection_grados: 150 },
    ],
  },
];

export interface ProyectoEstereografico {
  id: string;
  nombre: string;
  escenarioId: TipoEscenarioEstereo;
  talud: TaludEstereografia;
  anguloFriccion_grados: number;
  toleranciaDireccion_grados: number;
  discontinuidades: Discontinuidad[];
  proyeccion: TipoProyeccion;
  hemisferio: Hemisferio;
  elementos: ModoElementos;
  modoDensidad: ModoDensidad;
  radioConteo_grados: number;
  numeroFamilias: number;
  rmrBasicoSMR: number;
  discontinuidadSmrId: string | null;
  tipoFallaSMR: TipoFallaSMR;
  metodoExcavacionSMR: MetodoExcavacionSMR;
  fechaCreacion: string;
  fechaModificacion: string;
}

export const PROYECTOS_ESTEREOGRAFIA_INICIALES: ProyectoEstereografico[] = [
  {
    id: "est-1",
    nombre: "Talud Sur Banco 4200",
    escenarioId: "MIN",
    talud: { dip_grados: 65, dipDirection_grados: 195 },
    anguloFriccion_grados: 34,
    toleranciaDireccion_grados: 20,
    discontinuidades: [
      { id: "D-1", nombre: "J1 (Principal)", dip_grados: 55, dipDirection_grados: 190 },
      { id: "D-2", nombre: "J2 (Transversal)", dip_grados: 70, dipDirection_grados: 110 },
      { id: "D-3", nombre: "J3 (Estratificación)", dip_grados: 40, dipDirection_grados: 280 },
      { id: "D-4", nombre: "J4 (Falla local)", dip_grados: 75, dipDirection_grados: 10 },
    ],
    proyeccion: "schmidt",
    hemisferio: "inferior",
    elementos: "polos",
    modoDensidad: "ninguna",
    radioConteo_grados: 24,
    numeroFamilias: 4,
    rmrBasicoSMR: 55,
    discontinuidadSmrId: "D-1",
    tipoFallaSMR: "planar",
    metodoExcavacionSMR: "voladura_o_mecanico",
    fechaCreacion: "2026-09-15T18:30:00.000Z",
    fechaModificacion: "2026-09-15T19:45:00.000Z",
  },
  {
    id: "est-2",
    nombre: "Talud Vial Acceso Planta",
    escenarioId: "VIAL",
    talud: { dip_grados: 75, dipDirection_grados: 90 },
    anguloFriccion_grados: 35,
    toleranciaDireccion_grados: 20,
    discontinuidades: [
      { id: "D-1", nombre: "Falla-A", dip_grados: 70, dipDirection_grados: 275 },
      { id: "D-2", nombre: "Junta-1", dip_grados: 50, dipDirection_grados: 85 },
      { id: "D-3", nombre: "Junta-2", dip_grados: 45, dipDirection_grados: 140 },
    ],
    proyeccion: "schmidt",
    hemisferio: "inferior",
    elementos: "polos_y_planos",
    modoDensidad: "ninguna",
    radioConteo_grados: 24,
    numeroFamilias: 3,
    rmrBasicoSMR: 62,
    discontinuidadSmrId: "D-2",
    tipoFallaSMR: "planar",
    metodoExcavacionSMR: "presplitting",
    fechaCreacion: "2026-09-14T14:15:00.000Z",
    fechaModificacion: "2026-09-14T16:20:00.000Z",
  },
  {
    id: "est-3",
    nombre: "Frente Rampa Principal Nv 3900",
    escenarioId: "SUB",
    talud: { dip_grados: 85, dipDirection_grados: 90 },
    anguloFriccion_grados: 32,
    toleranciaDireccion_grados: 15,
    discontinuidades: [
      { id: "D-1", nombre: "Corte Frontal", dip_grados: 75, dipDirection_grados: 85 },
      { id: "D-2", nombre: "Lateral Techo", dip_grados: 60, dipDirection_grados: 355 },
      { id: "D-3", nombre: "Cizalla", dip_grados: 80, dipDirection_grados: 180 },
    ],
    proyeccion: "schmidt",
    hemisferio: "inferior",
    elementos: "polos",
    modoDensidad: "ninguna",
    radioConteo_grados: 24,
    numeroFamilias: 3,
    rmrBasicoSMR: 48,
    discontinuidadSmrId: "D-1",
    tipoFallaSMR: "volcamiento",
    metodoExcavacionSMR: "voladura_suave",
    fechaCreacion: "2026-09-12T11:00:00.000Z",
    fechaModificacion: "2026-09-12T11:30:00.000Z",
  },
];
