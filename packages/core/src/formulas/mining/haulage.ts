/**
 * Motor de calculo del modulo `mining.haulage` (Acarreo): tiempo de ciclo, velocidad estimada por
 * potencia disponible, productividad, factor de calce (match factor) y dimensionamiento de flota.
 *
 * Fuentes:
 * - Resistencia a la rodadura (RR) por condicion de via: valores tipicos de referencia usados en
 *   ingenieria de acarreo minero (p.ej. Caterpillar "Performance Handbook"): via en buen estado y
 *   bien mantenida ≈ 2%, regular ≈ 4%, en mal estado/blanda ≈ 6%. Deben calibrarse con datos de
 *   la via real del sitio.
 * - Resistencia total (RT) = resistencia de pendiente (igual al % de pendiente) + RR. Es el
 *   metodo estandar de "resistencia equivalente" para acarreo (Peurifoy et al., "Construction
 *   Planning, Equipment, and Methods").
 * - Velocidad limitada por potencia: en equilibrio, potencia disponible = fuerza de resistencia x
 *   velocidad. Fuerza de resistencia (N) = peso(kg) x 9.81 x RT(fraccion). Con eficiencia de
 *   transmision eta: velocidad(m/s) = (potencia(W) x eta) / (peso(kg) x 9.81 x RT). Se limita al
 *   tope mecanico del camion. Nota: en tramos de bajada donde RT<=0, la velocidad no esta limitada
 *   por potencia sino por la capacidad de frenado (no modelada en esta version) — se usa el tope
 *   mecanico como aproximacion y se advierte.
 * - Tiempo de ciclo Tc = t_carga + t_acarreo + t_descarga + t_retorno + t_colas.
 * - Productividad P = (capacidad x 3600 / Tc(s)) x eficiencia operativa, t/h.
 * - Match Factor MF = (N_camiones x Tc_cargador) / (N_cargadores x Tc_camion), donde Tc_cargador
 *   es el tiempo del cargador para llenar UN CAMION completo (baldadas x ciclo de una baldada;
 *   ver tiempoCarga_s), no el ciclo de una sola baldada. MF≈1 flota balanceada; MF<1 el cargador
 *   espera; MF>1 los camiones hacen cola.
 * - Numero de camiones "optimo" (MF=1): N ≈ Tc_camion / t_carga (redondeado).
 * - Regla practica: el numero de baldes por camion debe estar entre 4 y 6 (fuera de ese rango,
 *   advertir: muy pocos baldes da baja precision de carga, muchos alarga el tiempo de carga).
 */

import type { CondicionVia, EntradaAcarreo, ResultadoAcarreo } from "../../domain/haulage.js";
import { DEFAULTS_ACARREO } from "../../domain/haulage.js";

const RESISTENCIA_RODADURA_PCT: Record<CondicionVia, number> = {
  buena: 2,
  regular: 4,
  pobre: 6,
};

export function resistenciaRodadura_pct(condicionVia: CondicionVia): number {
  return RESISTENCIA_RODADURA_PCT[condicionVia];
}

/** Resistencia total (%) = resistencia de pendiente + resistencia a la rodadura. */
export function resistenciaTotal_pct(pendiente_pct: number, resistenciaRodadura_pct: number): number {
  return pendiente_pct + resistenciaRodadura_pct;
}

/**
 * Velocidad estimada por equilibrio de potencia, km/h. Si la resistencia total es muy baja o
 * negativa (tramo de bajada donde la gravedad ayuda mas de lo que la rodadura frena), la potencia
 * deja de ser el factor limitante y se usa el tope mecanico del camion.
 */
export function velocidadPorPotencia_kmh(
  peso_kg: number,
  resistenciaTotal_pct: number,
  potencia_kW: number,
  eficienciaTransmision: number,
  velocidadMaxima_kmh: number
): number {
  if (resistenciaTotal_pct <= 0.5) return velocidadMaxima_kmh;
  const fuerzaResistente_N = peso_kg * 9.81 * (resistenciaTotal_pct / 100);
  const velocidad_ms = (potencia_kW * 1000 * eficienciaTransmision) / fuerzaResistente_N;
  return Math.min(velocidad_ms * 3.6, velocidadMaxima_kmh);
}

export function numeroBaldesPorCamion(capacidadCamion_ton: number, capacidadBalde_ton: number): number {
  return Math.max(1, Math.round(capacidadCamion_ton / capacidadBalde_ton));
}

export function tiempoCarga_s(numeroBaldes: number, tiempoCicloCargador_s: number): number {
  return numeroBaldes * tiempoCicloCargador_s;
}

export function productividadCamion_tph(capacidad_ton: number, tiempoCiclo_s: number, eficienciaOperativa: number): number {
  return tiempoCiclo_s > 0 ? (capacidad_ton * 3600 / tiempoCiclo_s) * eficienciaOperativa : 0;
}

/** tiempoCicloCargador_s = tiempo del cargador para llenar UN CAMION completo (ver tiempoCarga_s), no el ciclo de una sola baldada. */
export function matchFactor(
  numeroCamiones: number,
  tiempoCicloCargador_s: number,
  numeroCargadores: number,
  tiempoCicloCamion_s: number
): number {
  return numeroCargadores > 0 && tiempoCicloCamion_s > 0
    ? (numeroCamiones * tiempoCicloCargador_s) / (numeroCargadores * tiempoCicloCamion_s)
    : 0;
}

export function numeroCamionesOptimo(tiempoCicloCamion_s: number, tiempoCarga_s: number): number {
  return tiempoCarga_s > 0 ? Math.max(1, Math.round(tiempoCicloCamion_s / tiempoCarga_s)) : 1;
}

/** Orquesta el diseno completo de acarreo a partir de las especificaciones de camion/cargador/via. */
export function disenarAcarreo(entrada: EntradaAcarreo): ResultadoAcarreo {
  const advertencias: string[] = [];

  const eficienciaTransmision = entrada.eficienciaTransmision ?? DEFAULTS_ACARREO.eficienciaTransmision;
  const velocidadMaxima_kmh = entrada.velocidadMaxima_kmh ?? DEFAULTS_ACARREO.velocidadMaxima_kmh;
  const eficienciaOperativa = entrada.eficienciaOperativa ?? DEFAULTS_ACARREO.eficienciaOperativa;
  const tiempoColas_s = entrada.tiempoColas_s ?? DEFAULTS_ACARREO.tiempoColas_s;

  const rr = resistenciaRodadura_pct(entrada.condicionVia);
  const resistenciaTotalCargado_pct = resistenciaTotal_pct(entrada.pendientePromedio_pct, rr);
  const resistenciaTotalVacio_pct = resistenciaTotal_pct(-entrada.pendientePromedio_pct, rr);

  const pesoCargado_kg = entrada.pesoVacioCamion_kg + entrada.capacidadCamion_ton * 1000;

  const velocidadCargado_kmh = velocidadPorPotencia_kmh(
    pesoCargado_kg,
    resistenciaTotalCargado_pct,
    entrada.potenciaCamion_kW,
    eficienciaTransmision,
    velocidadMaxima_kmh
  );
  const velocidadVacio_kmh = velocidadPorPotencia_kmh(
    entrada.pesoVacioCamion_kg,
    resistenciaTotalVacio_pct,
    entrada.potenciaCamion_kW,
    eficienciaTransmision,
    velocidadMaxima_kmh
  );

  if (resistenciaTotalVacio_pct <= 0.5) {
    advertencias.push(
      "El tramo de retorno (vacío) es de bajada pronunciada: la velocidad ahí está limitada por el freno/retardador, no por potencia. Se usó el tope mecánico como aproximación — valida en campo."
    );
  }

  const distancia_km = entrada.distanciaUnidireccional_m / 1000;
  const tiempoAcarreoCargado_s = (distancia_km / velocidadCargado_kmh) * 3600;
  const tiempoRetornoVacio_s = (distancia_km / velocidadVacio_kmh) * 3600;

  const nBaldes = numeroBaldesPorCamion(entrada.capacidadCamion_ton, entrada.capacidadBalde_ton);
  if (nBaldes < 4 || nBaldes > 6) {
    advertencias.push(
      `El camión se llena en ${nBaldes} baldadas: fuera del rango práctico recomendado (4-6). Considera ajustar la relación capacidad camión/balde.`
    );
  }
  const tCarga = tiempoCarga_s(nBaldes, entrada.tiempoCicloCargador_s);

  const tiempoCicloCamion_s = tCarga + tiempoAcarreoCargado_s + entrada.tiempoDescarga_s + tiempoRetornoVacio_s + tiempoColas_s;

  const productividad = productividadCamion_tph(entrada.capacidadCamion_ton, tiempoCicloCamion_s, eficienciaOperativa);

  const nOptimo = numeroCamionesOptimo(tiempoCicloCamion_s, tCarga);
  const nUsado = entrada.numeroCamiones ?? nOptimo;
  // El "tiempo de ciclo del cargador" del Match Factor es el tiempo para cargar UN CAMION
  // completo (tCarga = baldadas x ciclo de una baldada), no el ciclo de una sola baldada.
  const mf = matchFactor(nUsado, tCarga, entrada.numeroCargadores, tiempoCicloCamion_s);

  if (mf < 0.85) {
    advertencias.push(`Match Factor = ${mf.toFixed(2)} < 1: el cargador queda esperando camiones. Considera reducir la flota o agregar otro cargador.`);
  } else if (mf > 1.15) {
    advertencias.push(`Match Factor = ${mf.toFixed(2)} > 1: los camiones hacen cola en el cargador. Considera agregar camiones o reducir el ciclo.`);
  }

  return {
    numeroBaldesPorCamion: nBaldes,
    tiempoCarga_s: tCarga,
    resistenciaRodadura_pct: rr,
    resistenciaTotalCargado_pct,
    resistenciaTotalVacio_pct,
    velocidadCargado_kmh,
    velocidadVacio_kmh,
    tiempoAcarreoCargado_s,
    tiempoRetornoVacio_s,
    tiempoCicloCamion_s,
    productividadCamion_tph: productividad,
    numeroCamionesOptimo: nOptimo,
    numeroCamionesUsado: nUsado,
    matchFactor: mf,
    produccionFlota_tph: productividad * nUsado,
    advertencias,
  };
}
