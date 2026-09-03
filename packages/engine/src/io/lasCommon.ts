/**
 * Piezas compartidas entre el lector LAS (packages/engine/src/io/lasReader.ts, acceso aleatorio
 * directo al buffer) y el lector LAZ (lazReader.ts, streaming via WASM) — cabecera ASPRS LAS
 * 1.2-1.4, extraccion de X/Y/Z/clasificacion de un registro de punto, y las dos estrategias de
 * filtrado+decimacion (ver JSDoc de cada una: difieren porque LAS permite acceso aleatorio y LAZ
 * solo streaming hacia adelante).
 *
 * Fuente: especificacion ASPRS LAS (asprs.org, LAS_1-4_R6.pdf). Ver lasReader.ts para el detalle
 * de offsets de cabecera.
 */

export interface CabeceraLAS {
  versionMayor: number;
  versionMenor: number;
  offsetDatos: number;
  formatoRegistro: number;
  comprimido: boolean;
  longitudRegistro: number;
  numeroPuntos: number;
  escalaX: number;
  escalaY: number;
  escalaZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

const OFFSET_CLASIFICACION = 15; // igual en los formatos de punto 0-3
/** Los bits 5-7 del byte de clasificacion son flags (Synthetic/KeyPoint/Withheld en LAS<=1.3, Overlap en 1.4), no parte del codigo de clase. */
const MASCARA_CLASIFICACION = 0b0001_1111;

export function parsearCabeceraLAS(vista: DataView, tamanoBufferTotal: number): CabeceraLAS {
  if (tamanoBufferTotal < 227) throw new Error("Archivo LAS invalido: mas corto que una cabecera minima.");

  const firma = String.fromCharCode(vista.getUint8(0), vista.getUint8(1), vista.getUint8(2), vista.getUint8(3));
  if (firma !== "LASF") {
    throw new Error('Archivo LAS/LAZ invalido: falta la firma "LASF" en la cabecera.');
  }

  const versionMayor = vista.getUint8(24);
  const versionMenor = vista.getUint8(25);
  const tamanoCabecera = vista.getUint16(94, true);
  const offsetDatos = vista.getUint32(96, true);
  const byteFormato = vista.getUint8(104);
  const formatoRegistro = byteFormato & 0x7f;
  const comprimido = (byteFormato & 0x80) !== 0;
  const longitudRegistro = vista.getUint16(105, true);
  const conteoLegado = vista.getUint32(107, true);
  const escalaX = vista.getFloat64(131, true);
  const escalaY = vista.getFloat64(139, true);
  const escalaZ = vista.getFloat64(147, true);
  const offsetX = vista.getFloat64(155, true);
  const offsetY = vista.getFloat64(163, true);
  const offsetZ = vista.getFloat64(171, true);

  let numeroPuntos = conteoLegado;
  if (versionMayor === 1 && versionMenor >= 4 && tamanoCabecera >= 247 + 8) {
    const conteoExtendido = vista.getBigUint64(247, true);
    if (conteoExtendido > 0n) numeroPuntos = Number(conteoExtendido);
  }

  return {
    versionMayor,
    versionMenor,
    offsetDatos,
    formatoRegistro,
    comprimido,
    longitudRegistro,
    numeroPuntos,
    escalaX,
    escalaY,
    escalaZ,
    offsetX,
    offsetY,
    offsetZ,
  };
}

export interface PuntoLASCrudo {
  x: number;
  y: number;
  z: number;
  clasificacion: number;
}

/** Extrae X/Y/Z reales (aplicando escala+offset) y clasificacion de un registro de punto sin comprimir, en formatos 0-3. */
export function extraerPuntoLAS(
  vista: DataView,
  baseOffsetRegistro: number,
  cabecera: Pick<CabeceraLAS, "escalaX" | "escalaY" | "escalaZ" | "offsetX" | "offsetY" | "offsetZ">
): PuntoLASCrudo {
  const xRaw = vista.getInt32(baseOffsetRegistro, true);
  const yRaw = vista.getInt32(baseOffsetRegistro + 4, true);
  const zRaw = vista.getInt32(baseOffsetRegistro + 8, true);
  const clasificacion = vista.getUint8(baseOffsetRegistro + OFFSET_CLASIFICACION) & MASCARA_CLASIFICACION;
  return {
    x: xRaw * cabecera.escalaX + cabecera.offsetX,
    y: yRaw * cabecera.escalaY + cabecera.offsetY,
    z: zRaw * cabecera.escalaZ + cabecera.offsetZ,
    clasificacion,
  };
}

export interface OpcionesLecturaPuntos {
  /**
   * Si el archivo tiene puntos clasificados como terreno (codigo ASPRS 2 = "Ground") y este flag
   * esta activo (default true), se usan SOLO esos puntos ("bare earth"). Si ninguno esta
   * clasificado (comun en nubes de fotogrametria sin clasificar), se usan todos.
   */
  soloTerreno?: boolean;
  /** Maximo de puntos a devolver, decimando. Default 20000. */
  maximoPuntos?: number;
}

export interface ResultadoLecturaPuntos {
  puntos: Array<{ x: number; y: number; z: number }>;
  numeroPuntosOriginal: number;
  numeroPuntosCandidatos: number;
  seFiltroPorTerreno: boolean;
}

/**
 * Filtra (a solo terreno, si corresponde) y decima uniformemente, con ACCESO ALEATORIO a
 * cualquier punto por indice — usado por LAS sin comprimir, donde leer el punto i es directo
 * (offsetDatos + i*longitudRegistro). Hace 2 pasadas: cuenta cuantos son terreno, y recien ahi
 * calcula el paso de decimacion exacto sobre esos candidatos.
 */
export function filtrarYDecimarConAccesoAleatorio(
  numeroPuntosOriginal: number,
  leerPunto: (indice: number) => PuntoLASCrudo,
  opciones: OpcionesLecturaPuntos
): ResultadoLecturaPuntos {
  const quiereSoloTerreno = opciones.soloTerreno ?? true;
  let hayTerreno = false;
  let numeroPuntosCandidatos = numeroPuntosOriginal;
  if (quiereSoloTerreno) {
    let conteoTerreno = 0;
    for (let i = 0; i < numeroPuntosOriginal; i++) {
      if (leerPunto(i).clasificacion === 2) conteoTerreno++;
    }
    hayTerreno = conteoTerreno > 0;
    if (hayTerreno) numeroPuntosCandidatos = conteoTerreno;
  }
  const seFiltroPorTerreno = quiereSoloTerreno && hayTerreno;

  const maximoPuntos = opciones.maximoPuntos ?? 20000;
  // ceil (no floor): con floor, un resto no exacto agota el cupo de maximoPuntos antes de llegar
  // al final del archivo, dejando sin muestrear todo ese tramo final (mala cobertura espacial).
  const paso = Math.max(1, Math.ceil(numeroPuntosCandidatos / maximoPuntos));

  const puntos: Array<{ x: number; y: number; z: number }> = [];
  let indiceCandidato = 0;
  for (let i = 0; i < numeroPuntosOriginal && puntos.length < maximoPuntos; i++) {
    const p = leerPunto(i);
    if (seFiltroPorTerreno && p.clasificacion !== 2) continue;
    if (indiceCandidato % paso === 0) puntos.push({ x: p.x, y: p.y, z: p.z });
    indiceCandidato++;
  }

  return { puntos, numeroPuntosOriginal, numeroPuntosCandidatos, seFiltroPorTerreno };
}

/**
 * Filtra y decima con acceso SOLO STREAMING hacia adelante (un punto a la vez, sin poder
 * "volver atras") — usado por LAZ, donde el decodificador de LASzip solo entrega los puntos en
 * orden. A diferencia de la version con acceso aleatorio, esta decima PRIMERO (sobre el total de
 * puntos, que si se conoce de antemano) y filtra por terreno DESPUES, dentro de la muestra ya
 * decimada — evita tener que decodificar el archivo dos veces (la decompresion es cara) a costa
 * de que, si el terreno es una fraccion pequeña del total, el resultado final puede tener menos
 * puntos que `maximoPuntos` (proporcional a esa fraccion, no un defecto).
 */
export function filtrarYDecimarStreaming(
  numeroPuntosTotal: number,
  obtenerSiguientePunto: () => PuntoLASCrudo,
  opciones: OpcionesLecturaPuntos
): ResultadoLecturaPuntos {
  const maximoPuntos = opciones.maximoPuntos ?? 20000;
  const quiereSoloTerreno = opciones.soloTerreno ?? true;
  // ceil (no floor): con floor, un resto no exacto puede hacer que el ultimo tramo del archivo
  // nunca se muestree (el cupo de maximoPuntos se agota antes de llegar al final del stream).
  const paso = Math.max(1, Math.ceil(numeroPuntosTotal / maximoPuntos));

  const muestreados: PuntoLASCrudo[] = [];
  for (let i = 0; i < numeroPuntosTotal; i++) {
    const p = obtenerSiguientePunto();
    // el stream debe consumirse entero (no se puede "saltar" un punto sin decodificarlo), pero solo
    // se retiene hasta el cupo — doble resguardo junto con ceil por si el redondeo aun se pasa por 1.
    if (i % paso === 0 && muestreados.length < maximoPuntos) muestreados.push(p);
  }

  const deTerreno = muestreados.filter((p) => p.clasificacion === 2);
  const seFiltroPorTerreno = quiereSoloTerreno && deTerreno.length > 0;
  const finales = seFiltroPorTerreno ? deTerreno : muestreados;

  return {
    puntos: finales.map(({ x, y, z }) => ({ x, y, z })),
    numeroPuntosOriginal: numeroPuntosTotal,
    numeroPuntosCandidatos: seFiltroPorTerreno ? deTerreno.length : muestreados.length,
    seFiltroPorTerreno,
  };
}
