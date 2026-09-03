import { PREFIJO_ALMACENAMIENTO } from "../hooks/usePersistedState.js";
import { generarSondajesDemo } from "./demoBlockModel.js";
import { generarTerrenoDemo } from "./demoTerreno.js";

export interface PlantillaDemo {
  id: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  icono: string;
  color: string;
  categoria: "cieloAbierto" | "subterranea" | "geologia";
  datos: Record<string, unknown>;
}

export const PLANTILLAS_DEMO: PlantillaDemo[] = [
  {
    id: "tajo-abierto",
    nombre: "Tajo Abierto - Banco 4200",
    subtitulo: "Malla de producción, acarreo y talud",
    descripcion: "Proyecto completo de cielo abierto: malla regular de 35 taladros con ANFO, ruta de acarreo hacia chancadora primaria y análisis de talud.",
    icono: "⛏️",
    color: "#f97316",
    categoria: "cieloAbierto",
    datos: {
      "malla.modoDiseno": "banco",
      "malla.largoRectangulo": 35,
      "malla.anchoRectangulo": 20,
      "malla.entrada": {
        burden_m: 4.5,
        espaciamiento_m: 5.5,
        profundidadBanco_m: 12,
        diametro_mm: 165,
        sobreperforacion_m: 1.2,
        inclinacion_grados: 0,
        patron: "tresbolillo",
      },
      "malla.entradaVoladura": {
        nombreExplosivo: "ANFO",
        densidadGcm3: 0.85,
        fuerzaRelativaANFO: 1.0,
        taco_m: 3.5,
        tipoRoca: "media",
        retardoFila_ms: 25,
        retardoEntreTaladros_ms: 17,
      },
      "acarreo.entrada": {
        capacidadCamion_t: 100,
        numeroCamiones: 4,
        tiempoCarga_min: 3.5,
        tiempoDescarga_min: 1.2,
        tiempoManiobra_min: 0.8,
        disponibilidadMecanica: 0.88,
        utilizacionEfectiva: 0.82,
        costoPorHoraCamion: 120,
        costoPorHoraPala: 220,
        consumoCombustibleLh: 55,
        precioCombustiblePorLitro: 1.15,
        velocidadCargadoPlano_kmh: 30,
        velocidadVacioPlano_kmh: 42,
        velocidadCargadoSubida_kmh: 16,
        velocidadVacioBajada_kmh: 28,
        distanciaTotal_km: 2.8,
        pendienteMedia_pct: 7.5,
      },
      "geomecanica.entrada": {
        ucs_mpa: 85,
        rqd_pct: 75,
        espaciamiento_m: 0.45,
        condicionDiscontinuidades: "ligeramente_rugosas",
        presenciaAgua: "humedo",
        ajusteOrientacion: "regular",
        jn: 9,
        jr: 2,
        ja: 2,
        jw: 1,
        srf: 2.5,
        esfuerzoVertical_mpa: 12,
        anchoExcavacion_m: 15,
        alturaExcavacion_m: 12,
        esr: 1.6,
        mi: 15,
      },
      "estereografia.talud": { dip_grados: 65, dipDirection_grados: 195 },
      "estereografia.anguloFriccion_grados": 34,
      "estereografia.toleranciaDireccion_grados": 20,
      "estereografia.discontinuidades": [
        { id: "disc-1", dip_grados: 55, dipDirection_grados: 190, tipo: "diaclasa", descripcion: "Familia principal F1 - paralela al talud" },
        { id: "disc-2", dip_grados: 70, dipDirection_grados: 110, tipo: "falla", descripcion: "Falla transversal F2" },
        { id: "disc-3", dip_grados: 40, dipDirection_grados: 280, tipo: "estratificacion", descripcion: "Estratificación F3" },
      ],
      "topografia.puntosActuales": generarTerrenoDemo(),
    },
  },
  {
    id: "subterranea-tunel",
    nombre: "Galería Subterránea 4.0 x 4.0m",
    subtitulo: "Frente de avance Holmberg y sostenimiento",
    descripcion: "Excavación subterránea en roca volcánica: corte de cuatro secciones con barreno de alivio de 102mm y clasificación RMR/Q para sostenimiento.",
    icono: "🚇",
    color: "#38bdf8",
    categoria: "subterranea",
    datos: {
      "malla.modoDiseno": "tunel",
      "malla.tunel.geometria": {
        ancho_m: 4.0,
        altura_m: 4.0,
        tipoSeccion: "boveda",
        radioBoveda_m: 2.0,
      },
      "malla.tunel.arranque": {
        diametroAlivio_mm: 102,
        diametroProduccion_mm: 45,
        avanceEsperado_m: 3.2,
        tipoExplosivo: "Dinamita / Emulsión",
      },
      "geomecanica.entrada": {
        ucs_mpa: 110,
        rqd_pct: 68,
        espaciamiento_m: 0.35,
        condicionDiscontinuidades: "rugosas",
        presenciaAgua: "goteo",
        ajusteOrientacion: "desfavorable",
        jn: 9,
        jr: 1.5,
        ja: 2,
        jw: 0.66,
        srf: 5.0,
        esfuerzoVertical_mpa: 18,
        anchoExcavacion_m: 4.0,
        alturaExcavacion_m: 4.0,
        esr: 1.3,
        mi: 17,
      },
      "estereografia.talud": { dip_grados: 85, dipDirection_grados: 90 },
      "estereografia.anguloFriccion_grados": 32,
      "estereografia.toleranciaDireccion_grados": 15,
      "estereografia.discontinuidades": [
        { id: "disc-s1", dip_grados: 75, dipDirection_grados: 85, tipo: "diaclasa", descripcion: "Corte frontal" },
        { id: "disc-s2", dip_grados: 60, dipDirection_grados: 355, tipo: "diaclasa", descripcion: "Lateral techo" },
        { id: "disc-s3", dip_grados: 80, dipDirection_grados: 180, tipo: "falla", descripcion: "Cizalla transversal" },
      ],
    },
  },
  {
    id: "campana-sondajes",
    nombre: "Modelo de Bloques y Recursos Cu-Au",
    subtitulo: "Sondajes exploratorios y ley de corte",
    descripcion: "Campaña de perforación diamantina con intervalos ensayados de cobre y oro, interpolación IDW/Kriging y visualización tridimensional.",
    icono: "💎",
    color: "#a855f7",
    categoria: "geologia",
    datos: (() => {
      const demo = generarSondajesDemo();
      return {
        "modeloBloques.colares": demo.colares,
        "modeloBloques.intervalos": demo.intervalos,
        "modeloBloques.metodo": "idw",
        "modeloBloques.parametros": {
          tamanoBloque_m: 5,
          radioBusqueda_m: 35,
          minMuestras: 2,
          maxMuestras: 8,
          potenciaIDW: 2,
          tipoLey: "Cu",
          leyCorte: 0.5,
        },
      };
    })(),
  },
];

/** Aplica una plantilla al localStorage y opcionalmente recarga o notifica */
export function aplicarPlantilla(plantillaId: string): boolean {
  const plantilla = PLANTILLAS_DEMO.find((p) => p.id === plantillaId);
  if (!plantilla) return false;

  for (const [clave, valor] of Object.entries(plantilla.datos)) {
    localStorage.setItem(PREFIJO_ALMACENAMIENTO + clave, JSON.stringify(valor));
  }
  return true;
}
