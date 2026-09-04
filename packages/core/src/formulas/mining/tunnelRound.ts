/**
 * Diseno de arranque (cut) tipo Holmberg para voladura de tunel/galeria, y geometria del frente.
 *
 * Fuente: C. Lopez Jimeno, E. Lopez Jimeno & F.J. Ayala Carcedo, "Drilling and Blasting of Rocks",
 * A.A. Balkema, 1995, cap. 22 "Blasting for tunnels and drifts" (traduccion del "Manual de
 * Perforacion y Voladura de Rocas" espanol) — que a su vez cita y reproduce el metodo de
 * Holmberg, R. (1982) "Charge calculations for tunnelling", en Underground Mining Methods
 * Handbook, SME, simplificado por Olofsson, S. (1990) "Applied Explosives Technology for
 * Construction and Mining".
 *
 * Se implementa el metodo SIMPLIFICADO de la Tabla 22.2 de Jimeno (p.225): calculo geometrico
 * rapido de burden/espaciamiento por seccion, sin pasar por la concentracion de carga lineal
 * (ese es el metodo riguroso de la seccion 22.4.2, mas complejo, no implementado aca). Ambos
 * metodos estan documentados en la misma fuente; el simplificado es el que reproduce EXACTAMENTE
 * los valores B1-B5/E1-E5 de la app de referencia (verificado a mano, 3 decimales, con
 * diametroIndividualAlivio=102mm, numeroTaladrosAlivio=4 -> diametroEquivalente=204mm):
 *   B1=0.306, E1=0.433, B2=0.433, E2=0.918, B3=0.918, E3=1.947, B4=1.947, E4=4.131, B5=4.131, E5=8.763
 *
 * Formulas (Jimeno Tabla 22.2, "Simplified calculation"):
 *   diametro equivalente:  De = D_individual * sqrt(N)          (p.219, para N taladros de alivio)
 *   1a seccion:   B1 = 1.5 * De          E1 = B1 * sqrt(2)
 *   seccion n>=2: Bn = E(n-1)            En = 1.5 * Bn * sqrt(2)
 *
 * Regla de parada (p.221): se agregan secciones mientras el lado/espaciamiento resultante sea
 * menor que sqrt(avance) — "el lado de la ultima seccion no deberia ser menor que la raiz
 * cuadrada del avance". Limite de seguridad `maximoSecciones` (default 8) por si el avance es muy
 * grande y la regla de parada tardaria demasiadas secciones en cumplirse.
 */

import type {
  EntradaArranqueHolmberg,
  EntradaTaladrosFrente,
  GeometriaFrenteTunel,
  PuntoTaladroFrente,
  ResultadoArranqueHolmberg,
  ResultadoGeometriaFrente,
  ResultadoTaladrosFrente,
  SeccionArranque,
} from "../../domain/tunnelRound.js";
import { centroide, puntoEnPoligono, type Punto2D } from "./geometry.js";

export function diametroEquivalente_mm(diametroIndividual_mm: number, numeroTaladros: number): number {
  return diametroIndividual_mm * Math.sqrt(Math.max(numeroTaladros, 0));
}

/** Calcula las secciones del arranque (burden/espaciamiento progresivo) por el metodo simplificado de Jimeno Tabla 22.2. */
export function calcularArranqueHolmberg(entrada: EntradaArranqueHolmberg): ResultadoArranqueHolmberg {
  const de_mm = diametroEquivalente_mm(entrada.diametroIndividualAlivio_mm, entrada.numeroTaladrosAlivio);
  const de_m = de_mm / 1000;
  const maximoSecciones = entrada.maximoSecciones ?? 8;
  const objetivoParada_m = Math.sqrt(Math.max(entrada.avance_m, 0));

  const secciones: SeccionArranque[] = [];
  if (de_m <= 0) return { diametroEquivalente_mm: de_mm, secciones };

  // 1a seccion: factor 1.0 (E1 = B1*sqrt(2), sin el 1.5 adicional que llevan las siguientes)
  let burden_m = 1.5 * de_m;
  let espaciamiento_m = burden_m * Math.SQRT2;
  secciones.push({ numero: 1, burden_m, espaciamiento_m, factor: 1.0 });

  while (espaciamiento_m < objetivoParada_m && secciones.length < maximoSecciones) {
    burden_m = espaciamiento_m; // Bn = E(n-1)
    espaciamiento_m = 1.5 * burden_m * Math.SQRT2;
    secciones.push({ numero: secciones.length + 1, burden_m, espaciamiento_m, factor: 1.5 });
  }

  return { diametroEquivalente_mm: de_mm, secciones };
}

/**
 * Area/perimetro del frente. "herradura": hastiales rectos + corona semicircular (radio = ancho/2),
 * la forma tunelera estandar para excavacion con jumbo. "rectangular": seccion recta simple.
 */
export function calcularGeometriaFrente(geometria: GeometriaFrenteTunel): ResultadoGeometriaFrente {
  const { tipo, ancho_m, alto_m } = geometria;
  if (ancho_m <= 0 || alto_m <= 0) {
    return { area_m2: 0, perimetro_m: 0, alturaCorona_m: 0, alturaHastial_m: 0 };
  }

  if (tipo === "rectangular") {
    return {
      area_m2: ancho_m * alto_m,
      perimetro_m: 2 * (ancho_m + alto_m),
      alturaCorona_m: 0,
      alturaHastial_m: alto_m,
    };
  }

  // herradura: radio de la corona = ancho/2 (semicirculo apoyado sobre los hastiales)
  const radioCorona_m = ancho_m / 2;
  const alturaCorona_m = Math.min(radioCorona_m, alto_m);
  const alturaHastial_m = Math.max(alto_m - alturaCorona_m, 0);
  const areaHastiales_m2 = ancho_m * alturaHastial_m;
  const areaCorona_m2 = (Math.PI * radioCorona_m * radioCorona_m) / 2;
  const perimetroCorona_m = Math.PI * radioCorona_m;

  return {
    area_m2: areaHastiales_m2 + areaCorona_m2,
    perimetro_m: ancho_m + 2 * alturaHastial_m + perimetroCorona_m,
    alturaCorona_m,
    alturaHastial_m,
  };
}

/**
 * Genera el layout 2D (en el plano de la cara del frente) de una ronda completa de tunel/galeria:
 * alivio + secciones del arranque (cuele) + cuadro/contorno + arrastre + produccion (destroza).
 *
 * Lo que SI esta tomado de una fuente citable:
 * - El radio de cada anillo del arranque, `r_k = E_k / sqrt(2)`, se deduce de que cada seccion del
 *   cuele Holmberg/Jimeno (ver `calcularArranqueHolmberg`) rompe hacia un hueco cuadrado de lado
 *   `E_k`; un cuadrado centrado en el origen con lado `E_k` tiene sus 4 vertices a distancia
 *   `E_k/sqrt(2)` del centro. Los taladros de cada seccion se ubican en esos vertices.
 * - La alternancia de 45 grados entre anillos consecutivos ("pinwheel") es la construccion
 *   estandar de los diagramas de cuele de secciones (p.ej. Jimeno cap. 22, fig. 22.4; manual EXSA
 *   "Manual Practico de Voladura"): cada taladro nuevo apunta al punto medio del lado ya roto de la
 *   seccion anterior (la nueva cara libre), que es precisamente la direccion que bisecta dos
 *   vertices consecutivos del cuadrado anterior — de ahi el giro de 45 grados. Se puede verificar
 *   algebraicamente que esta construccion reproduce exactamente `r_k = B_k + r_(k-1)/sqrt(2)`
 *   (burden medido perpendicular al lado anterior), consistente con `r_k = E_k/sqrt(2)`.
 * - El espaciamiento de los taladros de contorno (corona/hastial/arrastre) sigue la regla de
 *   voladura controlada/recorte (smooth blasting): espaciamiento = 12-16 veces el diametro del
 *   taladro (OSMRE, 2016, "Blast Design — Module 3: Surface Blast Design", Office of Surface
 *   Mining Reclamation and Enforcement, EE.UU.; el mismo principio de espaciamiento~diametro para
 *   recorte se usa en tuneleria, ver Olofsson, S. 1990, "Applied Explosives Technology for
 *   Construction and Mining"), pero el VALOR final (`entrada.espaciamientoContorno_m`) lo decide
 *   quien llama a esta funcion.
 *
 * Lo que NO esta tomado de una fuente (es una heuristica geometrica de este generador, no una
 * formula de ingenieria):
 * - La clasificacion de cada punto de contorno en corona/hastial/arrastre, hecha por posicion
 *   relativa a la caja delimitadora del poligono (simple heuristica de dibujo, no de diseno).
 * - El radio de exclusion del arranque para la grilla de produccion (`radioUltimoAnillo * 1.2`).
 */
export function generarTaladrosFrenteTunel(entrada: EntradaTaladrosFrente): ResultadoTaladrosFrente {
  const advertencias: string[] = [];
  const poligono: Punto2D[] = entrada.poligonoCresta;
  if (poligono.length < 3) {
    return { puntos: [], advertencias: ["El poligono de la galeria necesita al menos 3 vertices."] };
  }

  const z = entrada.cotaFrente_m ?? 0;
  const centro = centroide(poligono);
  const xs = poligono.map((p) => p.x);
  const ys = poligono.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const ancho = maxX - minX;
  const alto = maxY - minY;

  const puntos: PuntoTaladroFrente[] = [];
  let contador = 0;
  const push = (x: number, y: number, zona: PuntoTaladroFrente["zona"], diametroMm: number, cargado: boolean, etapa?: number) => {
    contador++;
    puntos.push({ id: `F-${zona}-${contador}`, x, y, z, zona, diametroMm, cargado, etapa });
  };

  // --- 1. Alivio: agrupados muy cerca del centro (actuan como un unico taladro equivalente). ---
  const nAlivio = Math.max(1, Math.round(entrada.numeroTaladrosAlivio));
  const radioClusterAlivio = Math.max(0.03, (entrada.diametroIndividualAlivio_mm / 1000) * 0.65);
  if (nAlivio === 1) {
    push(centro.x, centro.y, "alivio", entrada.diametroIndividualAlivio_mm, false);
  } else {
    for (let i = 0; i < nAlivio; i++) {
      const ang = (i / nAlivio) * Math.PI * 2;
      push(
        centro.x + radioClusterAlivio * Math.cos(ang),
        centro.y + radioClusterAlivio * Math.sin(ang),
        "alivio",
        entrada.diametroIndividualAlivio_mm,
        false
      );
    }
  }

  // --- 2. Secciones del arranque: anillos cuadrados alternando 45 grados (pinwheel). ---
  let radioUltimoAnillo = radioClusterAlivio;
  entrada.secciones.forEach((seccion, idx) => {
    const k = idx + 1;
    const r = seccion.espaciamiento_m / Math.SQRT2;
    radioUltimoAnillo = r;
    const anguloBase = k % 2 === 1 ? Math.PI / 4 : 0; // 45 deg en anillos impares, 0 deg en pares
    const zona: PuntoTaladroFrente["zona"] = k === 1 ? "arranque" : "cuadrante";
    for (let j = 0; j < 4; j++) {
      const ang = anguloBase + j * (Math.PI / 2);
      push(centro.x + r * Math.cos(ang), centro.y + r * Math.sin(ang), zona, entrada.diametroCargaMm, true, k);
    }
  });

  if (radioUltimoAnillo * 2 > Math.min(ancho, alto) * 0.9) {
    advertencias.push(
      `El arranque calculado (ultimo anillo a ${radioUltimoAnillo.toFixed(2)} m del centro) es grande respecto a la seccion (${ancho.toFixed(2)}×${alto.toFixed(2)} m): reduce el numero de secciones, el diametro de alivio o el numero de taladros de alivio.`
    );
  }

  // --- 3. Contorno: recorre el perimetro del poligono y clasifica cada muestra por posicion. ---
  const margenPiso = Math.max(0.15, alto * 0.08);
  const paso = Math.max(0.1, entrada.espaciamientoContorno_m);
  const contornoPuntos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo = Math.hypot(dx, dy);
    if (largo <= 1e-6) continue;
    const nSub = Math.max(1, Math.round(largo / paso));
    for (let s = 0; s < nSub; s++) {
      const t = s / nSub;
      contornoPuntos.push({ x: a.x + dx * t, y: a.y + dy * t });
    }
  }
  contornoPuntos.forEach((p) => {
    let zona: PuntoTaladroFrente["zona"];
    if (p.y <= minY + margenPiso) {
      zona = "arrastre";
    } else if (Math.abs(p.x - centro.x) > ancho * 0.32 && p.y < minY + alto * 0.6) {
      zona = "hastial";
    } else {
      zona = "corona";
    }
    push(p.x, p.y, zona, entrada.diametroCargaMm, true);
  });

  // --- 4. Produccion (destroza): grilla burden x espaciamiento, evita el arranque y el contorno. ---
  const radioExclusionArranque = radioUltimoAnillo * 1.2;
  const margenContorno = paso * 0.6;
  const bStep = Math.max(0.1, entrada.burdenProduccion_m);
  const eStep = Math.max(0.1, entrada.espaciamientoProduccion_m);
  for (let y = minY + bStep / 2; y <= maxY - bStep / 4; y += bStep) {
    for (let x = minX + eStep / 2; x <= maxX - eStep / 4; x += eStep) {
      const distCentro = Math.hypot(x - centro.x, y - centro.y);
      if (distCentro < radioExclusionArranque) continue;
      if (!puntoEnPoligono({ x, y }, poligono)) continue;
      const cercaContorno = contornoPuntos.some((c) => Math.hypot(c.x - x, c.y - y) < margenContorno);
      if (cercaContorno) continue;
      push(x, y, "produccion", entrada.diametroCargaMm, true);
    }
  }

  return { puntos, advertencias };
}
