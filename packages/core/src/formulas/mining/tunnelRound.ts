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
  GeometriaFrenteTunel,
  ResultadoArranqueHolmberg,
  ResultadoGeometriaFrente,
  SeccionArranque,
} from "../../domain/tunnelRound.js";

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
