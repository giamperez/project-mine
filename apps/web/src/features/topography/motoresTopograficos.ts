export type TipoMotorTopo = "POL" | "NIV" | "COO" | "CH" | "CV" | "PEN" | "AREA" | "BUZ";

export interface MotorTopoInfo {
  id: TipoMotorTopo;
  nombre: string;
  subtitulo: string;
  abreviatura: string;
  icono: string;
  descripcion: string;
}

export const MOTORES_TOPOGRAFICOS: MotorTopoInfo[] = [
  {
    id: "POL",
    nombre: "Poligonal cerrada",
    subtitulo: "Cierre angular, Bowditch, coordenadas y área",
    abreviatura: "POL",
    icono: "diamond",
    descripcion: "Compensación rigurosa de poligonales cerradas mediante método Bowditch (brújula) y cálculo de precisión.",
  },
  {
    id: "NIV",
    nombre: "Nivelación compuesta",
    subtitulo: "Cotas, error de cierre y compensación por distancia",
    abreviatura: "NIV",
    icono: "waves",
    descripcion: "Cálculo de cotas por altura de instrumento (HI) y compensación proporcional a distancias acumuladas.",
  },
  {
    id: "COO",
    nombre: "Coordenadas",
    subtitulo: "Problema directo e inverso, azimut y rumbo",
    abreviatura: "COO",
    icono: "target",
    descripcion: "Conversión de problemas directos (radiaciones) e inversos con cálculo geodésico y topográfico planar.",
  },
  {
    id: "CH",
    nombre: "Curva horizontal",
    subtitulo: "PC, PI, PT, elementos y tabla de replanteo",
    abreviatura: "CH",
    icono: "horizontal-arc",
    descripcion: "Cálculo geométrico de curvas circulares simples con deflexiones y cuerdas para replanteo en campo.",
  },
  {
    id: "CV",
    nombre: "Curva vertical",
    subtitulo: "PVC, PVI, PVT, cotas y punto crítico",
    abreviatura: "CV",
    icono: "vertical-curve",
    descripcion: "Curva parabólica simétrica definida por PVI, pendientes de entrada/salida y longitud total.",
  },
  {
    id: "PEN",
    nombre: "Pendiente y emplantillado",
    subtitulo: "Pendiente, desnivel y cotas de rasante",
    abreviatura: "PEN",
    icono: "slope",
    descripcion: "Genera cotas de rasante a intervalos regulares para una pendiente constante.",
  },
  {
    id: "AREA",
    nombre: "Área por coordenadas",
    subtitulo: "Área, perímetro y centroide de un polígono",
    abreviatura: "AREA",
    icono: "polygon",
    descripcion: "Ingrese los vértices en orden horario o antihorario; el cierre se realiza automáticamente.",
  },
  {
    id: "BUZ",
    nombre: "Replanteo de buzones",
    subtitulo: "Cotas de fondo, profundidad y control de pendiente",
    abreviatura: "BUZ",
    icono: "manhole",
    descripcion: "Cada fila es el siguiente buzón. La pendiente positiva se interpreta como descenso del fondo.",
  },
];

export interface ProyectoTopografico {
  id: string;
  nombre: string;
  motorId: TipoMotorTopo;
  datum: string;
  zonaUtm: string;
  fechaCreacion: string;
  fechaModificacion: string;
  datosMotor: Record<string, any>;
}

// -------------------------------------------------------------
// MOTOR: CURVA VERTICAL (CV)
// -------------------------------------------------------------
export interface DatosCurvaVertical {
  progresivaPVI: string; // ej "1+000.000"
  cotaPVI: number; // ej 250.000
  pendienteG1: number; // ej 4.0 (%)
  pendienteG2: number; // ej -2.0 (%)
  longitudL: number; // ej 120.0 (m)
  intervalo: number; // ej 10.0 (m)
}

export interface FilaTablaCurvaVertical {
  progresivaStr: string;
  progresivaNum: number;
  x: number;
  cotaTangente: number;
  correccion: number;
  cotaCurva: number;
  etiqueta?: "PVC" | "PVI" | "PVT" | "CRIT";
}

export interface ResultadoCurvaVertical {
  pvcProgStr: string;
  pvcProgNum: number;
  pvcCota: number;
  pviProgStr: string;
  pviProgNum: number;
  pviCota: number;
  pvtProgStr: string;
  pvtProgNum: number;
  pvtCota: number;
  diferenciaA: number; // g2 - g1
  parametroK: number; // L / |A|
  tipo: "Convexa" | "Cóncava";
  puntoCriticoProgStr: string;
  puntoCriticoProgNum: number;
  puntoCriticoCota: number;
  tabla: FilaTablaCurvaVertical[];
}

export function parseProgresiva(pStr: string): number {
  if (!pStr) return 0;
  const clean = pStr.replace(/\s+/g, "").replace("+", "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function formatProgresiva(val: number): string {
  if (isNaN(val)) return "0+000.000";
  const signo = val < 0 ? "-" : "";
  const absVal = Math.abs(val);
  const km = Math.floor(absVal / 1000);
  const m = (absVal % 1000).toFixed(3).padStart(7, "0");
  return `${signo}${km}+${m}`;
}

export function calcularCurvaVertical(datos: DatosCurvaVertical): ResultadoCurvaVertical {
  const pviProg = parseProgresiva(datos.progresivaPVI);
  const pviCota = Number(datos.cotaPVI) || 0;
  const g1 = Number(datos.pendienteG1) || 0;
  const g2 = Number(datos.pendienteG2) || 0;
  const L = Math.max(1, Number(datos.longitudL) || 100);
  const intervalo = Math.max(1, Number(datos.intervalo) || 10);

  const L_2 = L / 2;
  const pvcProg = pviProg - L_2;
  const pvtProg = pviProg + L_2;

  const g1_dec = g1 / 100;
  const g2_dec = g2 / 100;

  const pvcCota = pviCota - g1_dec * L_2;
  const pvtCota = pviCota + g2_dec * L_2;

  const A = g2 - g1; // Diferencia algebraica
  const A_dec = A / 100;
  const tipo = A < 0 ? "Convexa" : "Cóncava";
  const parametroK = Math.abs(A) > 0.00001 ? L / Math.abs(A) : 9999;

  // Punto crítico (máximo o mínimo)
  // x_crit = - (g1 * L) / (g2 - g1) = - (g1_dec * L) / A_dec
  let xCrit = 0;
  let hayPuntoCritico = false;
  if (Math.abs(A_dec) > 0.00001) {
    xCrit = (-g1_dec * L) / A_dec;
    if (xCrit >= 0 && xCrit <= L) {
      hayPuntoCritico = true;
    }
  }

  const puntoCriticoProg = pvcProg + xCrit;
  // y = (A / (2 * L * 100)) * x^2
  const correccionCrit = (A_dec / (2 * L)) * Math.pow(xCrit, 2);
  const cotaTangenteCrit = pvcCota + g1_dec * xCrit;
  const puntoCriticoCota = cotaTangenteCrit + correccionCrit;

  // Generar tabla
  const tabla: FilaTablaCurvaVertical[] = [];
  const startProg = Math.floor(pvcProg / intervalo) * intervalo;
  const endProg = Math.ceil(pvtProg / intervalo) * intervalo;

  // Añadimos progresivas regulares
  const progsSet = new Set<number>();
  for (let p = startProg; p <= endProg + 0.001; p += intervalo) {
    if (p >= pvcProg - 0.001 && p <= pvtProg + 0.001) {
      progsSet.add(Math.round(p * 1000) / 1000);
    }
  }
  // Añadir PVC, PVI, PVT
  progsSet.add(Math.round(pvcProg * 1000) / 1000);
  progsSet.add(Math.round(pviProg * 1000) / 1000);
  progsSet.add(Math.round(pvtProg * 1000) / 1000);
  if (hayPuntoCritico) {
    progsSet.add(Math.round(puntoCriticoProg * 1000) / 1000);
  }

  const sortedProgs = Array.from(progsSet).sort((a, b) => a - b);

  for (const prog of sortedProgs) {
    const x = Math.max(0, Math.min(L, prog - pvcProg));
    const cotaTangente = pvcCota + g1_dec * x;
    const correccion = (A_dec / (2 * L)) * Math.pow(x, 2);
    const cotaCurva = cotaTangente + correccion;

    let etiqueta: "PVC" | "PVI" | "PVT" | "CRIT" | undefined = undefined;
    if (Math.abs(prog - pvcProg) < 0.005) etiqueta = "PVC";
    else if (Math.abs(prog - pvtProg) < 0.005) etiqueta = "PVT";
    else if (Math.abs(prog - pviProg) < 0.005) etiqueta = "PVI";
    else if (hayPuntoCritico && Math.abs(prog - puntoCriticoProg) < 0.005) etiqueta = "CRIT";

    tabla.push({
      progresivaStr: formatProgresiva(prog),
      progresivaNum: prog,
      x,
      cotaTangente,
      correccion,
      cotaCurva,
      etiqueta,
    });
  }

  return {
    pvcProgStr: formatProgresiva(pvcProg),
    pvcProgNum: pvcProg,
    pvcCota,
    pviProgStr: formatProgresiva(pviProg),
    pviProgNum: pviProg,
    pviCota,
    pvtProgStr: formatProgresiva(pvtProg),
    pvtProgNum: pvtProg,
    pvtCota,
    diferenciaA: A,
    parametroK,
    tipo,
    puntoCriticoProgStr: formatProgresiva(hayPuntoCritico ? puntoCriticoProg : pviProg),
    puntoCriticoProgNum: hayPuntoCritico ? puntoCriticoProg : pviProg,
    puntoCriticoCota: hayPuntoCritico ? puntoCriticoCota : pviCota,
    tabla,
  };
}

// -------------------------------------------------------------
// MOTOR: REPLANTEO DE BUZONES (BUZ)
// -------------------------------------------------------------
export interface FilaBuzon {
  id: string; // "BZ-01"
  longitudDesdeAnterior: number; // m
  pendienteDescendente: number; // %
  cotaTerreno: number; // m
  caidaAdicional?: number; // m
}

export interface DatosReplanteoBuzones {
  progresivaInicial: string; // "0+000.000"
  cotaTerrenoInicial: number; // m
  cotaFondoInicial: number; // m
  buzones: FilaBuzon[];
}

export function calcularReplanteoBuzones(datos: DatosReplanteoBuzones) {
  const pIni = parseProgresiva(datos.progresivaInicial || "0+000.000");
  const cotaTerrenoIni = Number(datos.cotaTerrenoInicial) || 100.0;
  const cotaFondoIni = Number(datos.cotaFondoInicial) || 98.5;
  const buzones = datos.buzones || [];

  let progAcum = pIni;
  let cotaFondoActual = cotaFondoIni;
  let longitudTotal = 0;

  const tabla = buzones.map((b) => {
    const long = Number(b.longitudDesdeAnterior) || 0;
    const pend = Number(b.pendienteDescendente) || 0;
    const terreno = Number(b.cotaTerreno) || 0;
    const caida = Number(b.caidaAdicional) || 0;

    progAcum += long;
    longitudTotal += long;

    // Descenso por pendiente: d = long * (pend / 100) + caída adicional
    const desnivel = long * (pend / 100) + caida;
    cotaFondoActual -= desnivel;
    const profundidad = terreno - cotaFondoActual;

    return {
      id: b.id,
      nombre: b.id,
      progresivaStr: formatProgresiva(progAcum),
      progresivaNum: progAcum,
      longitud: long,
      pendienteDescendente: pend,
      cotaTerreno: terreno,
      cotaFondo: cotaFondoActual,
      profundidad,
      desnivelTramo: desnivel,
    };
  });

  const cotaFondoFinal = tabla.length > 0 ? tabla[tabla.length - 1].cotaFondo : cotaFondoIni;
  const cotaTerrenoFinal = tabla.length > 0 ? tabla[tabla.length - 1].cotaTerreno : cotaTerrenoIni;
  const desnivelAcumulado = cotaFondoIni - cotaFondoFinal;
  const profundidadFinal = cotaTerrenoFinal - cotaFondoFinal;

  const perfil = [
    {
      progresivaNum: pIni,
      progresivaStr: formatProgresiva(pIni),
      cotaFondo: cotaFondoIni,
      cotaTerreno: cotaTerrenoIni,
      nombre: "Inicio",
    },
    ...tabla.map((t) => ({
      progresivaNum: t.progresivaNum,
      progresivaStr: t.progresivaStr,
      cotaFondo: t.cotaFondo,
      cotaTerreno: t.cotaTerreno,
      nombre: t.id,
    })),
  ];

  return {
    buzonesCalculados: buzones.length,
    longitudTotal,
    cotaFondoInicial: cotaFondoIni,
    cotaFondoFinal,
    desnivelAcumulado,
    profundidadFinal,
    porcentajeControl: 100,
    tabla,
    perfil,
  };
}

// -------------------------------------------------------------
// MOTOR: CURVA HORIZONTAL (CH)
// -------------------------------------------------------------
export interface DatosCurvaHorizontal {
  progresivaPI: string; // ej "1+000.000"
  estePI: number; // ej 500000.000
  nortePI: number; // ej 8660000.000
  azimutEntrada_deg: number; // ej 45.000000
  radioR: number; // ej 120.000 (m)
  deflexionDelta_deg: number; // ej 38.000000 (grados)
  sentido: "Derecha" | "Izquierda";
  intervaloReplanteo: number; // ej 10.000 (m)
}

export interface FilaTablaCurvaHorizontal {
  etiqueta?: string;
  progresivaStr: string;
  progresivaNum: number;
  arco: number;
  deflexionDeg: number;
  deflexionStr: string;
  cuerda: number;
  este: number;
  norte: number;
}

export function calcularCurvaHorizontal(datos: DatosCurvaHorizontal) {
  const piProg = parseProgresiva(datos.progresivaPI || "1+000.000");
  const estePI = Number(datos.estePI) || 500000.0;
  const nortePI = Number(datos.nortePI) || 8660000.0;
  const azInDeg = Number(datos.azimutEntrada_deg) || 45.0;
  const azInRad = (azInDeg * Math.PI) / 180;
  const R = Math.max(1, Number(datos.radioR) || 120);
  const Delta_deg = Number(datos.deflexionDelta_deg) || 38;
  const Delta_rad = (Delta_deg * Math.PI) / 180;
  const sentido = datos.sentido || "Derecha";
  const intervalo = Math.max(1, Number(datos.intervaloReplanteo) || 10);

  // Elementos geométricos
  // Tangente T = R * tan(Delta / 2)
  const T = R * Math.tan(Delta_rad / 2);
  // Longitud de curva L = R * Delta_rad
  const L = R * Delta_rad;
  // Externa E = R * (1/cos(Delta/2) - 1)
  const E = R * (1 / Math.cos(Delta_rad / 2) - 1);
  // Flecha media (Ordenada Media) M = R * (1 - cos(Delta/2))
  const M = R * (1 - Math.cos(Delta_rad / 2));
  // Cuerda principal CL = 2 * R * sin(Delta/2)
  const CL = 2 * R * Math.sin(Delta_rad / 2);

  const pcProg = piProg - T;
  const ptProg = pcProg + L;

  // Coordenadas PC (a distancia T atrás en la tangente de entrada)
  const estePC = estePI - T * Math.sin(azInRad);
  const nortePC = nortePI - T * Math.cos(azInRad);

  // Coordenadas Centro
  // Si es a la derecha, el centro está a azIn + 90° desde PC
  // Si es a la izquierda, el centro está a azIn - 90° desde PC
  const azCenterFromPC = sentido === "Derecha" ? azInRad + Math.PI / 2 : azInRad - Math.PI / 2;
  const esteCentro = estePC + R * Math.sin(azCenterFromPC);
  const norteCentro = nortePC + R * Math.cos(azCenterFromPC);

  // Azimut de salida
  const azOutDeg = sentido === "Derecha" ? azInDeg + Delta_deg : azInDeg - Delta_deg;
  const azOutRad = (azOutDeg * Math.PI) / 180;

  // Coordenadas PT
  const estePT = estePI + T * Math.sin(azOutRad);
  const nortePT = nortePI + T * Math.cos(azOutRad);

  // Generación de puntos de replanteo (PC, estaciones redondas intermedias, PT)
  const progsSet = new Set<number>();
  progsSet.add(Math.round(pcProg * 1000) / 1000);

  const startRound = Math.ceil(pcProg / intervalo) * intervalo;
  for (let p = startRound; p < ptProg - 0.001; p += intervalo) {
    progsSet.add(Math.round(p * 1000) / 1000);
  }
  progsSet.add(Math.round(ptProg * 1000) / 1000);

  const sortedProgs = Array.from(progsSet).sort((a, b) => a - b);

  let prevEste = estePC;
  let prevNorte = nortePC;

  const tabla: FilaTablaCurvaHorizontal[] = sortedProgs.map((prog, idx) => {
    const arco = Math.max(0, prog - pcProg);
    const deflRad = arco / (2 * R);
    const deflDeg = (deflRad * 180) / Math.PI;

    // Ángulo en el círculo desde PC hacia el punto
    const thetaOnCircle = arco / R;
    const azFromCenter = sentido === "Derecha"
      ? (azInRad - Math.PI / 2) + thetaOnCircle
      : (azInRad + Math.PI / 2) - thetaOnCircle;

    const este = idx === 0 ? estePC : (idx === sortedProgs.length - 1 ? estePT : esteCentro + R * Math.sin(azFromCenter));
    const norte = idx === 0 ? nortePC : (idx === sortedProgs.length - 1 ? nortePT : norteCentro + R * Math.cos(azFromCenter));

    // Cuerda respecto al punto anterior (para replanteo continuo) o cuerda acumulada desde PC
    let cuerda = 0;
    if (idx > 0) {
      const de = este - prevEste;
      const dn = norte - prevNorte;
      cuerda = Math.sqrt(de * de + dn * dn);
    }
    prevEste = este;
    prevNorte = norte;

    let etiqueta = "";
    if (idx === 0) etiqueta = "PC";
    else if (idx === sortedProgs.length - 1) etiqueta = "PT";
    else etiqueta = `C${idx}`;

    return {
      etiqueta,
      progresivaStr: formatProgresiva(prog),
      progresivaNum: prog,
      arco,
      deflexionDeg: deflDeg,
      deflexionStr: degToDms(deflDeg),
      cuerda,
      este,
      norte,
    };
  });

  return {
    pcProgStr: formatProgresiva(pcProg),
    pcProgNum: pcProg,
    piProgStr: formatProgresiva(piProg),
    piProgNum: piProg,
    ptProgStr: formatProgresiva(ptProg),
    ptProgNum: ptProg,
    T,
    L,
    E,
    M,
    CL,
    controlGeometricoPT: 0.0,
    estePC,
    nortePC,
    estePI,
    nortePI,
    estePT,
    nortePT,
    esteCentro,
    norteCentro,
    porcentajeControl: 100,
    tabla,
  };
}

// -------------------------------------------------------------
// MOTOR: POLIGONAL CERRADA (POL)
// -------------------------------------------------------------
export interface VerticePoligonal {
  estacion: string;
  anguloObservado_deg: number; // Grados decimales o sexagesimales
  distancia_m: number;
}

export interface DatosPoligonalCerrada {
  puntoInicial: { este: number; norte: number; cota: number };
  azimutInicial_deg: number;
  vertices: VerticePoligonal[];
  sentido?: "Horario" | "Antihorario";
  factorAngularC?: number; // Constante de tolerancia angular (segundos), tolerancia = C * sqrt(n)
}

export function calcularPoligonalCerrada(datos: DatosPoligonalCerrada) {
  const verts = datos.vertices || [];
  const n = verts.length;
  if (n < 3) {
    return {
      valido: false,
      error: "Se requieren al menos 3 vértices para una poligonal cerrada.",
      tabla: [],
      errorCierreLineal: 0,
      precision: "1:0",
      areaM2: 0,
      perimetro: 0,
      errorAngularSeg: 0,
      toleranciaAngularSeg: 0,
      cumpleToleranciaAngular: true,
    };
  }

  const sentido = datos.sentido || "Horario";
  const factorC = datos.factorAngularC ?? 20;

  const sumaAngulosTeorica = (n - 2) * 180;
  const sumaAngulosObs = verts.reduce((acc, v) => acc + (v.anguloObservado_deg || 0), 0);
  const errorAngular = sumaAngulosObs - sumaAngulosTeorica;
  const correccionPorAngulo = -errorAngular / n;
  const errorAngularSeg = errorAngular * 3600;
  const toleranciaAngularSeg = factorC * Math.sqrt(n);
  const cumpleToleranciaAngular = Math.abs(errorAngularSeg) <= toleranciaAngularSeg;

  let perimetro = 0;
  const tramos: Array<{
    estacion: string;
    distancia: number;
    anguloComp: number;
    azimut: number;
    dx: number;
    dy: number;
  }> = [];

  let azimutActual = datos.azimutInicial_deg;

  verts.forEach((v, idx) => {
    const d = v.distancia_m || 0;
    perimetro += d;
    const angComp = v.anguloObservado_deg + correccionPorAngulo;
    if (idx > 0) {
      azimutActual =
        sentido === "Antihorario"
          ? ((azimutActual - angComp + 180) % 360 + 360) % 360
          : (azimutActual + angComp - 180 + 360) % 360;
    }
    const azRad = (azimutActual * Math.PI) / 180;
    const dx = d * Math.sin(azRad);
    const dy = d * Math.cos(azRad);
    tramos.push({
      estacion: v.estacion,
      distancia: d,
      anguloComp: angComp,
      azimut: azimutActual,
      dx,
      dy,
    });
  });

  const sumDx = tramos.reduce((acc, t) => acc + t.dx, 0);
  const sumDy = tramos.reduce((acc, t) => acc + t.dy, 0);
  const errorCierreLineal = Math.sqrt(sumDx * sumDx + sumDy * sumDy);
  const precisionNum = errorCierreLineal > 0.0001 ? Math.round(perimetro / errorCierreLineal) : 999999;

  // Coordenadas calculadas y compensadas (Bowditch)
  let eActual = datos.puntoInicial.este;
  let nActual = datos.puntoInicial.norte;
  const tablaCoordenadas: Array<{
    estacion: string;
    distancia: number;
    azimut: number;
    este: number;
    norte: number;
  }> = [];
  const coordsPoligono: Array<{ x: number; y: number }> = [{ x: eActual, y: nActual }];

  tramos.forEach((t) => {
    const corrDx = perimetro > 0 ? -(sumDx * (t.distancia / perimetro)) : 0;
    const corrDy = perimetro > 0 ? -(sumDy * (t.distancia / perimetro)) : 0;
    eActual += t.dx + corrDx;
    nActual += t.dy + corrDy;
    coordsPoligono.push({ x: eActual, y: nActual });
    tablaCoordenadas.push({
      estacion: t.estacion,
      distancia: t.distancia,
      azimut: t.azimut,
      este: eActual,
      norte: nActual,
    });
  });

  // Área por Shoelace / Gauss
  let areaShoelace = 0;
  for (let i = 0; i < coordsPoligono.length - 1; i++) {
    const p1 = coordsPoligono[i];
    const p2 = coordsPoligono[i + 1];
    areaShoelace += p1.x * p2.y - p2.x * p1.y;
  }
  const areaM2 = Math.abs(areaShoelace) / 2;

  return {
    valido: true,
    errorAngular,
    errorAngularSeg,
    toleranciaAngularSeg,
    cumpleToleranciaAngular,
    errorCierreLineal,
    precision: `1 : ${precisionNum.toLocaleString()}`,
    perimetro,
    areaM2,
    tabla: tablaCoordenadas,
    coordenadasVector: coordsPoligono,
    cotaInicial: datos.puntoInicial.cota,
  };
}

// -------------------------------------------------------------
// MOTOR: NIVELACIÓN COMPUESTA (NIV)
// -------------------------------------------------------------
export interface FilaNivelacion {
  id?: string;
  punto: string;
  vistaAtras: number; // Backsight (VA / BS)
  vistaAdelante: number; // Foresight (VD / FS)
  distanciaTramo: number; // m
}

export interface DatosNivelacion {
  cotaInicial: number;
  cotaFinalConocida: number;
  factorCierre: number; // mm / sqrt(km), ej 12
  filas: FilaNivelacion[];
}

export interface FilaResultadoNivelacion {
  punto: string;
  va: number;
  vd: number;
  deltaH: number;
  dist: number;
  progresivaStr: string;
  progresivaNum: number;
  cota: number;
  corr: number;
  cotaCorr: number;
}

export function calcularNivelacionCompuesta(datos: DatosNivelacion) {
  const cotaIni = Number(datos.cotaInicial) || 100.0;
  const cotaFinConocida = Number(datos.cotaFinalConocida) || cotaIni;
  const factorCierre = Math.max(1, Number(datos.factorCierre) || 12);
  const filas = datos.filas || [];

  let sumVA = 0;
  let sumVD = 0;
  let distTotal = 0;

  filas.forEach((f) => {
    sumVA += Number(f.vistaAtras) || 0;
    sumVD += Number(f.vistaAdelante) || 0;
    distTotal += Number(f.distanciaTramo) || 0;
  });

  const cotaCalculadaFinal = cotaIni + (sumVA - sumVD);
  const errorCierreM = cotaCalculadaFinal - cotaFinConocida;
  const errorCierreMm = errorCierreM * 1000;

  const distKm = distTotal / 1000;
  const toleranciaMm = factorCierre * Math.sqrt(Math.max(0.0001, distKm));
  const cumpleTolerancia = Math.abs(errorCierreMm) <= toleranciaMm;
  const porcentajeControl = cumpleTolerancia ? 100 : Math.max(0, Math.round(100 - (Math.abs(errorCierreMm) - toleranciaMm) * 10));

  let cotaAcum = cotaIni;
  let distAcum = 0;

  const tabla: FilaResultadoNivelacion[] = filas.map((f) => {
    const va = Number(f.vistaAtras) || 0;
    const vd = Number(f.vistaAdelante) || 0;
    const d = Number(f.distanciaTramo) || 0;
    const deltaH = va - vd;

    distAcum += d;
    cotaAcum += deltaH;

    // Compensación proporcional a la distancia acumulada: corr = -E * (distAcum / distTotal)
    const corr = distTotal > 0 ? -errorCierreM * (distAcum / distTotal) : 0;
    const cotaCorr = cotaAcum + corr;

    return {
      punto: f.punto || "PC",
      va,
      vd,
      deltaH,
      dist: d,
      progresivaStr: formatProgresiva(distAcum),
      progresivaNum: distAcum,
      cota: cotaAcum,
      corr,
      cotaCorr,
    };
  });

  return {
    sumVistaAtras: sumVA,
    sumVistaAdelante: sumVD,
    cotaCalculada: cotaCalculadaFinal,
    cotaConocida: cotaFinConocida,
    errorCierreM,
    errorCierreMm,
    errorCierreMmStr: `${errorCierreMm >= 0 ? "+" : ""}${errorCierreMm.toFixed(2)} mm`,
    distanciaTotalM: distTotal,
    distanciaTotalKm: distKm,
    toleranciaMm,
    toleranciaMmStr: `±${toleranciaMm.toFixed(2)} mm`,
    cumpleTolerancia,
    porcentajeControl,
    cotaInicial: cotaIni,
    tabla,
  };
}

// -------------------------------------------------------------
// MOTOR: COORDENADAS DIRECTO / INVERSO (COO)
// -------------------------------------------------------------
export interface DatosCoordenadas {
  este1: number;
  norte1: number;
  cota1?: number;
  azimut_deg: number;
  distanciaHorizontal: number;
  este2: number;
  norte2: number;
  cota2?: number;
}

export function degToDms(deg: number): string {
  if (isNaN(deg)) return "00° 00' 00.000\"";
  let norm = ((deg % 360) + 360) % 360;
  const d = Math.floor(norm);
  const minFloat = (norm - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;
  return `${d.toString().padStart(2, "0")}° ${m.toString().padStart(2, "0")}' ${s.toFixed(3).padStart(6, "0")}"`;
}

export function degToRumbo(deg: number): string {
  if (isNaN(deg)) return "N 00° 00' 00.000\" E";
  let norm = ((deg % 360) + 360) % 360;
  let prefix = "N";
  let suffix = "E";
  let angle = norm;

  if (norm >= 0 && norm <= 90) {
    prefix = "N";
    suffix = "E";
    angle = norm;
  } else if (norm > 90 && norm <= 180) {
    prefix = "S";
    suffix = "E";
    angle = 180 - norm;
  } else if (norm > 180 && norm <= 270) {
    prefix = "S";
    suffix = "W";
    angle = norm - 180;
  } else {
    prefix = "N";
    suffix = "W";
    angle = 360 - norm;
  }

  const dms = degToDms(angle);
  return `${prefix} ${dms} ${suffix}`;
}

export function calcularCoordenadas(datos: DatosCoordenadas) {
  const e1 = Number(datos.este1) || 500000.0;
  const n1 = Number(datos.norte1) || 8660000.0;
  const azDirecto = Number(datos.azimut_deg) || 0.0;
  const distDirecto = Number(datos.distanciaHorizontal) || 100.0;
  const e2Inverso = Number(datos.este2) || (e1 + 70.711);
  const n2Inverso = Number(datos.norte2) || (n1 + 70.711);

  // 1. Directo: P1 + Az + Dist -> P2 Calculado
  const azRadDirecto = (azDirecto * Math.PI) / 180;
  const deDirecto = distDirecto * Math.sin(azRadDirecto);
  const dnDirecto = distDirecto * Math.cos(azRadDirecto);
  const e2Calculado = e1 + deDirecto;
  const n2Calculado = n1 + dnDirecto;
  const rumboDirecto = degToRumbo(azDirecto);

  // 2. Inverso: P1 -> P2 (usando e2Inverso, n2Inverso)
  const deInverso = e2Inverso - e1;
  const dnInverso = n2Inverso - n1;
  const distInversa = Math.sqrt(deInverso * deInverso + dnInverso * dnInverso);

  let azRadInverso = Math.atan2(deInverso, dnInverso);
  if (azRadInverso < 0) azRadInverso += 2 * Math.PI;
  const azInversoDeg = (azRadInverso * 180) / Math.PI;
  const rumboInverso = degToRumbo(azInversoDeg);

  // Control de consistencia entre P2 directo y P2 inverso
  const diffE = Math.abs(e2Calculado - e2Inverso);
  const diffN = Math.abs(n2Calculado - n2Inverso);
  const esConsistente = diffE < 0.05 && diffN < 0.05;
  const porcentajeControl = esConsistente ? 100 : Math.max(0, Math.round(100 - (diffE + diffN) * 50));

  const tabla = [
    {
      operacion: "Directo",
      este: e2Calculado,
      norte: n2Calculado,
      distancia: distDirecto,
      azimut: azDirecto,
      azimutStr: degToDms(azDirecto),
      rumbo: rumboDirecto,
    },
    {
      operacion: "Inverso",
      este: e2Inverso,
      norte: n2Inverso,
      distancia: distInversa,
      azimut: azInversoDeg,
      azimutStr: degToDms(azInversoDeg),
      rumbo: rumboInverso,
    },
  ];

  return {
    este1: e1,
    norte1: n1,
    esteCalculadoP2: e2Calculado,
    norteCalculadoP2: n2Calculado,
    deltaEste: deInverso,
    deltaNorte: dnInverso,
    distanciaInversa: distInversa,
    azimutInversoDeg: azInversoDeg,
    rumboInverso,
    porcentajeControl,
    esConsistente,
    tabla,
    // Coordenadas para visualización técnica
    puntosVisor: {
      p1: { este: e1, norte: n1, label: "P1" },
      p2Directo: { este: e2Calculado, norte: n2Calculado, label: "P2 directo" },
      p2Inverso: { este: e2Inverso, norte: n2Inverso, label: "P2 ingresado" },
    },
  };
}

// -------------------------------------------------------------
// MOTOR: PENDIENTE Y EMPLANTILLADO (PEN)
// -------------------------------------------------------------
export interface DatosPendiente {
  progresivaInicial: string;
  cotaInicial: number;
  pendientePct: number;
  longitudHorizontal: number;
  intervalo: number;
}

export function calcularPendiente(datos: DatosPendiente) {
  const pIni = parseProgresiva(datos.progresivaInicial || "0+000.000");
  const cotaIni = Number(datos.cotaInicial) || 100.0;
  const pendPct = Number(datos.pendientePct) || 2.0;
  const distH = Math.max(0.1, Number(datos.longitudHorizontal) || 100.0);
  const intervalo = Math.max(1, Number(datos.intervalo) || 10.0);

  const desnivelTotal = distH * (pendPct / 100);
  const anguloRad = Math.atan(pendPct / 100);
  const anguloDeg = (anguloRad * 180) / Math.PI;
  const distInclinada = Math.sqrt(distH * distH + desnivelTotal * desnivelTotal);
  const cotaFinal = cotaIni + desnivelTotal;
  const pFin = pIni + distH;

  const tabla: Array<{
    progresivaStr: string;
    progresivaNum: number;
    distancia: number;
    desnivel: number;
    cotaRasante: number;
  }> = [];

  const numPasos = Math.floor(distH / intervalo);
  for (let i = 0; i <= numPasos; i++) {
    const d = i * intervalo;
    const desnivel = d * (pendPct / 100);
    const cota = cotaIni + desnivel;
    tabla.push({
      progresivaStr: formatProgresiva(pIni + d),
      progresivaNum: pIni + d,
      distancia: d,
      desnivel,
      cotaRasante: cota,
    });
  }

  // Si el final no coincide exactamente con el último paso del intervalo
  if (Math.abs(distH - (numPasos * intervalo)) > 0.001) {
    tabla.push({
      progresivaStr: formatProgresiva(pFin),
      progresivaNum: pFin,
      distancia: distH,
      desnivel: desnivelTotal,
      cotaRasante: cotaFinal,
    });
  }

  return {
    progresivaInicialStr: formatProgresiva(pIni),
    progresivaFinalStr: formatProgresiva(pFin),
    cotaInicial: cotaIni,
    cotaFinal,
    pendientePct: pendPct,
    anguloDeg,
    desnivelTotal,
    distanciaHorizontal: distH,
    distanciaInclinada: distInclinada,
    porcentajeControl: 100,
    tabla,
  };
}

// -------------------------------------------------------------
// MOTOR: ÁREA POR COORDENADAS (AREA)
// -------------------------------------------------------------
export interface DatosArea {
  puntos: Array<{ id: string; este: number; norte: number }>;
}

export function calcularAreaPorCoordenadas(datos: DatosArea) {
  const pts = datos.puntos || [];
  if (pts.length < 3) {
    return {
      areaM2: 0,
      areaHa: 0,
      perimetro: 0,
      centroideEste: 0,
      centroideNorte: 0,
      recorrido: "—",
      porcentajeControl: 0,
      tabla: [],
      puntos: [],
    };
  }

  const n = pts.length;
  // Coordenadas relativas al primer punto para garantizar máxima precisión con números UTM grandes
  const x0 = Number(pts[0].este) || 0;
  const y0 = Number(pts[0].norte) || 0;

  let signedAreaShoelace = 0;
  let perimetro = 0;
  let cxRel = 0;
  let cyRel = 0;

  const tabla: Array<{
    punto: string;
    este: number;
    norte: number;
    ladoSiguiente: number;
  }> = [];

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];

    const e1 = Number(p1.este) || 0;
    const n1 = Number(p1.norte) || 0;
    const e2 = Number(p2.este) || 0;
    const n2 = Number(p2.norte) || 0;

    const x1 = e1 - x0;
    const y1 = n1 - y0;
    const x2 = e2 - x0;
    const y2 = n2 - y0;

    const cross = x1 * y2 - x2 * y1;
    signedAreaShoelace += cross;

    cxRel += (x1 + x2) * cross;
    cyRel += (y1 + y2) * cross;

    const dx = e2 - e1;
    const dy = n2 - n1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    perimetro += dist;

    tabla.push({
      punto: p1.id || `P${i + 1}`,
      este: e1,
      norte: n1,
      ladoSiguiente: dist,
    });
  }

  const signedArea = signedAreaShoelace / 2;
  const areaM2 = Math.abs(signedArea);
  const areaHa = areaM2 / 10000;

  let centroideEste = 0;
  let centroideNorte = 0;

  if (Math.abs(signedAreaShoelace) > 1e-7) {
    centroideEste = x0 + cxRel / (3 * signedAreaShoelace);
    centroideNorte = y0 + cyRel / (3 * signedAreaShoelace);
  } else {
    centroideEste = pts.reduce((acc, p) => acc + (Number(p.este) || 0), 0) / n;
    centroideNorte = pts.reduce((acc, p) => acc + (Number(p.norte) || 0), 0) / n;
  }

  // Recorrido: en coordenadas cartesianas topográficas (Este=X, Norte=Y):
  // Área con signo > 0 indica orientación Antihoraria (CCW), < 0 indica Horaria (CW)
  const recorrido = signedArea > 0 ? "Antihorario" : "Horario";

  return {
    areaM2,
    areaHa,
    perimetro,
    centroideEste,
    centroideNorte,
    recorrido,
    porcentajeControl: 100,
    tabla,
    puntos: pts,
  };
}
