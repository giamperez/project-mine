import React from "react";

export interface DatosEnVivoMalla {
  tipoSeccion: string;
  anchoGaleria: number;
  altoGaleria: number;
  alturaCorona: number;
  areaSeccion: number;
  perimetroSeccion: number;
  numAlivios: number;
  diametroAlivioMm: number;
  diametroProdMm: number;
  diametroEquivalenteDeMm: number;
  avanceM: number;
  rmrScore: number;
  claseRmr: string;
  tipoRoca: string;
  explosivoNombre: string;
  explosivoVod: number;
  explosivoDensidad: number;
  explosivoPresionDetKbar: number;
  explosivoRws: number;
  factorCargaKgM3: number;
  volumenRotoM3: number;
  toneladasRotas: number;
  pesoTotalExplosivoKg: number;
  cargaLinealKgM: number;
  metodoDiseno: string;
  patronContorno: string;
  totalTaladros: number;
  taladrosCargados: number;
  taladrosAlivio: number;
  kuzRamX50Cm?: number;
  kuzRamUniformidadN?: number;
  kuzRamSobretamanoPct?: number;
  kuzRamFinosPct?: number;
  holmbergPpvContorno?: number;
  holmbergRadioDanoM?: number;
  etapasHolmberg?: Array<{ etapa: number; b: number; e: number; cabe: boolean }>;
}

export interface PropsBotonTeoria {
  activo: boolean;
  onClick: (e: React.MouseEvent) => void;
  titulo?: string;
  tamano?: "sm" | "md" | "lg";
}

/**
 * Botón interactivo de interrogación (?) para desplegar la teoría minera y fórmulas
 */
export function BotonInfoTeoria({
  activo,
  onClick,
  titulo = "Ver fundamento teórico, fórmulas y justificación minera",
  tamano = "md",
}: PropsBotonTeoria) {
  const sizePx = tamano === "sm" ? 20 : tamano === "lg" ? 28 : 23;
  const fontSize = tamano === "sm" ? 11 : tamano === "lg" ? 14 : 12;

  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      style={{
        width: sizePx,
        height: sizePx,
        minWidth: sizePx,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        fontSize,
        fontWeight: 800,
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        border: activo
          ? "1.5px solid var(--acento, #f97316)"
          : "1px solid rgba(56, 189, 248, 0.4)",
        background: activo
          ? "rgba(249, 115, 22, 0.25)"
          : "rgba(56, 189, 248, 0.12)",
        color: activo ? "#ffffff" : "#38bdf8",
        boxShadow: activo
          ? "0 0 12px rgba(249, 115, 22, 0.6), inset 0 0 6px rgba(249, 115, 22, 0.3)"
          : "0 0 6px rgba(56, 189, 248, 0.2)",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!activo) {
          e.currentTarget.style.borderColor = "var(--acento, #f97316)";
          e.currentTarget.style.color = "var(--acento, #f97316)";
          e.currentTarget.style.background = "rgba(249, 115, 22, 0.2)";
          e.currentTarget.style.transform = "scale(1.1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!activo) {
          e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
          e.currentTarget.style.color = "#38bdf8";
          e.currentTarget.style.background = "rgba(56, 189, 248, 0.12)";
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    >
      {activo ? "✕" : "?"}
    </button>
  );
}

export interface PropsTarjetaTeoria {
  id: string;
  onCerrar: () => void;
  datosEnVivo: DatosEnVivoMalla;
}

/**
 * Tarjeta desplegable rica con fundamentos teóricos, fórmulas matemáticas,
 * cálculo numérico con los datos actuales en vivo y citas bibliográficas.
 */
export function TarjetaTeoriaMalla({ id, onCerrar, datosEnVivo }: PropsTarjetaTeoria) {
  const d = datosEnVivo;

  // Seleccionar la ficha teórica correspondiente
  const renderContenido = () => {
    switch (id) {
      case "seccion":
      case "galeria":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">GEOMETRÍA Y MECÁNICA DE ROCAS</span>
              <h4>Forma de Sección, Gálibo y Esfuerzos en la Labor</h4>
              <p className="teoria-autor">Ref: Hoek & Brown (1980) · López Jimeno (1995) Cap. 22</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Fundamento Minero & Geomecánico</h5>
              <p>
                La excavación de una galería altera el estado tensional virgen del macizo rocoso (
                <code>&sigma;<sub>v</sub> = &gamma; &middot; H</code>,{" "}
                <code>&sigma;<sub>h</sub> = k &middot; &sigma;<sub>v</sub></code>). En secciones
                rectangulares se generan altas concentraciones de esfuerzos en las esquinas y tracción
                en el techo. La sección en <b>Herradura</b> o <b>Arco Tipo D</b> redistribuye las
                tensiones tangenciales hacia los hastiales en compresión pura, evitando desprendimientos
                por tracción en la corona.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Fórmulas Matemáticas de la Sección</h5>
              <div className="teoria-formula">
                <b>Herradura:</b> <code>Área (S) = W &middot; (H - W/2) + (&pi; &middot; (W/2)&sup2;) / 2</code>
                <br />
                <b>Perímetro (P):</b> <code>P = W + 2 &middot; (H - W/2) + &pi; &middot; (W/2)</code>
                <br />
                <b>Tipo D (Arco rebajado):</b> <code>S = W &middot; (H - h<sub>corona</sub>) + (&pi; &middot; (W/2) &middot; h<sub>corona</sub>) / 2</code>
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Cálculo en Vivo con tus Datos Actuales</h5>
              <div className="teoria-sustitucion">
                • Dimensiones: <b>{d.anchoGaleria.toFixed(2)} m</b> ancho &times; <b>{d.altoGaleria.toFixed(2)} m</b> alto (Tipo: <i>{d.tipoSeccion}</i>)
                <br />
                • Área Útil calculada: <code>S = <b>{d.areaSeccion.toFixed(3)} m²</b></code>
                <br />
                • Perímetro calculado: <code>P = <b>{d.perimetroSeccion.toFixed(3)} m</b></code>
                <br />
                • Altura de flecha / corona: <code>h<sub>c</sub> = <b>{d.alturaCorona.toFixed(2)} m</b></code>
              </div>
            </div>

            <div className="teoria-bloque">
              <h5>⚠️ Criterio de Terreno & Seguridad</h5>
              <p>
                Para labores de acarreo con LHD (scoop), el gálibo libre debe dejar al menos 0.50 m
                entre el equipo y las cajas para tránsito peatonal y mangas de ventilación.
              </p>
            </div>
          </>
        );

      case "patron_contorno":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">VOLADURA CONTROLADA DE CONTORNO</span>
              <h4>Smooth Blasting (Recorte) vs Corona Uniforme</h4>
              <p className="teoria-autor">Ref: Diéguez (ISMM) · Langefors & Kihlström (1976) · Olofsson (1990)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Fundamento Minero</h5>
              <p>
                La voladura convencional genera grietas radiales profundas en la roca encajonante,
                aumentando el riesgo de planchoneo y requiriendo mayor soporte (shotcrete/pernos). El{" "}
                <b>Smooth Blasting (Recorte Periférico)</b> utiliza barrenos poco espaciados con cargas
                desacopladas y cordón detonante o emulsión amortiguada para inducir una grieta de corte
                limpia por coalescencia de tensiones tangenciales sin fracturar el macizo remanente.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Fórmulas y Criterio de Desacoplamiento</h5>
              <div className="teoria-formula">
                • Relación de desacoplamiento: <code>f<sub>d</sub> = d<sub>carga</sub> / d<sub>barreno</sub> &le; 0.65</code>
                <br />
                • Presión en pared del taladro: <code>P<sub>b</sub> = P<sub>det</sub> &middot; (d<sub>c</sub> / d<sub>b</sub>)<sup>2.4</sup></code> (reducción del 70-85% vs carga acoplada)
                <br />
                • Espaciamiento de contorno: <code>E<sub>contorno</sub> = 0.50 - 0.75 m</code> según RMR.
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Configuración en Vivo</h5>
              <div className="teoria-sustitucion">
                • Patrón seleccionado: <b>{d.patronContorno.toUpperCase()}</b>
                <br />
                • Diámetro barreno: <b>{d.diametroProdMm} mm</b> | Carga desacoplada recomendada: <b>25 - 32 mm</b>
                <br />
                • Estado de voladura controlada: <b>{d.patronContorno !== "uniforme" ? "✓ ACTIVADA (Smooth Blasting)" : "○ NO ACTIVADA (Uniforme)"}</b>
              </div>
            </div>
          </>
        );

      case "alivio":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">CARA LIBRE ARTIFICIAL & ESCARIADO</span>
              <h4>Taladros de Alivio y Diámetro Equivalente (De)</h4>
              <p className="teoria-autor">Ref: Holmberg, R. (1982) SME · López Jimeno (1995) p. 219 · Olofsson (1990)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 ¿Por qué Diámetro Equivalente en Túneles?</h5>
              <p>
                En una galería subterránea solo existe <b>una cara libre</b> (el frente de ataque).
                La roca confinada no puede romper por flexión o tiro normal si no tiene espacio para
                expandirse (la roca fragmentada incrementa su volumen en un 15-20% por esponjamiento).
                Los <b>taladros de alivio vacíos</b> actúan dinámicamente como un gran cilindro central
                de expansión libre. Varios alivios pequeños en grupo proporcionan el mismo volumen
                geométrico que un único gran escariador.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Fórmulas Suecas de Diámetro Equivalente</h5>
              <div className="teoria-formula">
                <code>D<sub>e</sub> = D<sub>indiv</sub> &middot; &radic;N</code> (Fórmula de Holmberg / Jimeno)
                <br />
                <code>B<sub>1</sub> = 1.5 &middot; D<sub>e</sub></code> (Burden crítico del 1er cuadrante)
                <br />
                <code>E<sub>1</sub> = B<sub>1</sub> &middot; &radic;2 = 1.5 &middot; D<sub>e</sub> &middot; &radic;2</code>
                <br />
                <code>Condición de no-soplado: V<sub>alivios</sub> / V<sub>cuele</sub> &ge; 0.15</code>
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Cálculo en Vivo con tus Parámetros</h5>
              <div className="teoria-sustitucion">
                • <b>N = {d.numAlivios}</b> taladros de alivio de <b>{d.diametroAlivioMm} mm</b>
                <br />
                • Diámetro equivalente: <code>D<sub>e</sub> = {d.diametroAlivioMm} &times; &radic;{d.numAlivios} = <b>{d.diametroEquivalenteDeMm.toFixed(1)} mm</b> ({(d.diametroEquivalenteDeMm / 1000).toFixed(3)} m)</code>
                <br />
                • Burden 1er cuadrante resultante: <code>B<sub>1</sub> = 1.5 &times; {(d.diametroEquivalenteDeMm / 1000).toFixed(3)} = <b>{(1.5 * (d.diametroEquivalenteDeMm / 1000)).toFixed(3)} m</b></code>
                <br />
                • Espaciamiento 1er cuadrante: <code>E<sub>1</sub> = <b>{(1.5 * (d.diametroEquivalenteDeMm / 1000) * Math.SQRT2).toFixed(3)} m</b></code>
              </div>
            </div>

            <div className="teoria-bloque">
              <h5>⚠️ Criterio Práctico de Perforación</h5>
              <p>
                Los taladros de alivio deben perforarse con <b>desviación menor al 1%</b> (estricto
                paralelismo). Si un taladro de alivio se desvía y converge con un barreno cargado, se
                producirá sobrecompresión y congelamiento de la ronda (freeze-in).
              </p>
            </div>
          </>
        );

      case "explosivo":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">TERMODINÁMICA DE LA DETONACIÓN</span>
              <h4>Propiedades del Explosivo, VOD, Presión y Carga Lineal</h4>
              <p className="teoria-autor">Ref: Cooper, P. (1996) · Manual EXSA / FAMESA / Orica Perú</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Fundamento Físico de la Detonación</h5>
              <p>
                La velocidad de detonación (<b>VOD</b>) y la densidad (<b>&rho;<sub>e</sub></b>) gobiernan
                la impedancia acústica del explosivo. Una alta presión de detonación (<i>P<sub>det</sub></i>)
                es indispensable en el <b>cuele y zapateras</b> para vencer la alta confinación, mientras que
                en la <b>corona</b> se requieren explosivos de baja densidad y VOD moderada para no
                dañar el macizo.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Fórmulas Termodinámicas</h5>
              <div className="teoria-formula">
                • Presión de detonación C-J: <code>P<sub>det</sub> = 0.25 &middot; &rho;<sub>e</sub> &middot; (VOD)&sup2; &middot; 10<sup>-5</sup> [kbar]</code>
                <br />
                • Carga lineal por metro de barreno: <code>q<sub>l</sub> = (&pi;/4) &middot; (d<sub>m</sub>)&sup2; &middot; &rho;<sub>e</sub> &middot; 1000 [kg/m]</code>
                <br />
                • Potencia relativa en peso (RWS): Relación energética comparativa con ANFO (100%).
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Propiedades del Explosivo Seleccionado</h5>
              <div className="teoria-sustitucion">
                • Explosivo: <b style={{ color: "var(--acento, #f97316)" }}>{d.explosivoNombre}</b>
                <br />
                • Densidad &rho;<sub>e</sub>: <b>{d.explosivoDensidad} g/cm³</b> | VOD: <b>{d.explosivoVod} m/s</b>
                <br />
                • Presión de detonación: <code>P<sub>det</sub> = 0.25 &times; {d.explosivoDensidad} &times; ({d.explosivoVod})&sup2; &times; 10<sup>-5</sup> = <b>{d.explosivoPresionDetKbar} kbar</b></code>
                <br />
                • Carga lineal en taladro Ø {d.diametroProdMm}mm: <code>q<sub>l</sub> = <b>{d.cargaLinealKgM.toFixed(3)} kg/m</b></code>
                <br />
                • Potencia energética relativa: <b>{d.explosivoRws}% ANFO</b>
              </div>
            </div>
          </>
        );

      case "avance":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">EFICIENCIA DE PERFORACIÓN</span>
              <h4>Longitud de Barreno, Taco y Rendimiento de la Ronda</h4>
              <p className="teoria-autor">Ref: López Jimeno (1995) · Olofsson (1990) · Atlas Copco</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Longitud Máxima Teórica vs Avance Real</h5>
              <p>
                El avance por disparo está limitado físicamente por el diámetro equivalente del
                alivio (<i>D<sub>e</sub></i>). Si la longitud perforada excede la capacidad de apertura
                del cuele, el fondo del frente no saldrá ("culata"). En jumbos electrohidráulicos
                modernos con paralelismo guiado, la eficiencia de avance típica es del <b>90% al 95%</b>.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Fórmulas de Longitud y Taco</h5>
              <div className="teoria-formula">
                • Longitud máxima de avance: <code>L<sub>max</sub> &le; 0.95 &middot; (0.15 + 34.1 &middot; D<sub>e</sub> - 39.4 &middot; D<sub>e</sub>&sup2;)</code>
                <br />
                • Taco mínimo de confinamiento: <code>T &ge; 10 &middot; d<sub>prod</sub> (mm) &approx; 0.30 - 0.45 m</code>
                <br />
                • Longitud de carga neta: <code>L<sub>carga</sub> = Avance - Taco</code>
                <br />
                • Avance efectivo proyectado: <code>Av<sub>real</sub> = Longitud &times; 0.92</code>
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Cálculo en Vivo</h5>
              <div className="teoria-sustitucion">
                • Longitud barrena ingresada: <b>{d.avanceM.toFixed(2)} m</b>
                <br />
                • Avance proyectado (92%): <code>Av = {d.avanceM.toFixed(2)} &times; 0.92 = <b>{(d.avanceM * 0.92).toFixed(2)} m</b></code>
                <br />
                • Taco de confinamiento estimado: <b>0.30 - 0.45 m</b>
                <br />
                • Longitud de carga activa por barreno: <b>{Math.max(0.5, d.avanceM - 0.45).toFixed(2)} m</b>
              </div>
            </div>
          </>
        );

      case "rmr":
      case "geomecanica":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">GEOMECÁNICA DE ROCAS</span>
              <h4>Sistema RMR (Rock Mass Rating) de Bieniawski (1989)</h4>
              <p className="teoria-autor">Ref: Bieniawski, Z.T. (1989) · Hoek, Kaiser & Bawden (1995)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Los 5 Parámetros del Macizo Rocoso</h5>
              <p>
                El índice RMR (0 a 100 puntos) cuantifica la competencia mecánica de la roca combinando:
                <br />
                1. <b>Resistencia a compresión simple (&sigma;<sub>c</sub>)</b> (0 a 15 pts)
                <br />
                2. <b>Índice RQD (Rock Quality Designation)</b> (3 a 20 pts)
                <br />
                3. <b>Espaciamiento de discontinuidades/diaclasas</b> (5 a 20 pts)
                <br />
                4. <b>Condición de las paredes de las discontinuidades</b> (rugosidad, apertura, relleno) (0 a 30 pts)
                <br />
                5. <b>Presencia de agua freática</b> (0 a 15 pts)
                <br />
                <i>Ajuste:</i> Orientación del eje del túnel respecto a las fallas estructurales (-12 a 0 pts).
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Clasificación Geomecánica Estándar</h5>
              <div className="teoria-formula">
                • <b>Clase I (81-100 pts):</b> Muy Buena · Macizo masivo casi sin fracturas.
                <br />
                • <b>Clase II (61-80 pts):</b> Buena · Competente y tenaz. Exige alto factor de carga.
                <br />
                • <b>Clase III (41-60 pts):</b> Regular · Calidad media.
                <br />
                • <b>Clase IV (21-40 pts):</b> Mala · Muy fracturada o alterada.
                <br />
                • <b>Clase V (&le;20 pts):</b> Muy Mala · Falla inminente sin sostenimiento inmediato.
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Clasificación Actual</h5>
              <div className="teoria-sustitucion">
                • Índice RMR ingresado: <b style={{ color: "var(--acento, #f97316)", fontSize: 13 }}>{d.rmrScore} pts</b>
                <br />
                • Diagnóstico: <b>{d.tipoRoca}</b> ({d.claseRmr})
                <br />
                • Alivios mínimos recomendados: <b>{d.rmrScore > 60 ? 5 : 4} taladros</b>
              </div>
            </div>
          </>
        );

      case "matriz_roca":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">MATRIZ OPERATIVA DE TERRENO</span>
              <h4>Recomendaciones por Tenacidad (Mamani López / Beltrán)</h4>
              <p className="teoria-autor">Ref: Mamani López, R.J. (2018) · Beltrán Velásquez, S. (2022) UPN Pataz</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Fundamento Minero de la Matriz</h5>
              <p>
                Una roca con RMR alto (masiva y competente) es <b>tenaz frente a la voladura</b>: no
                posee planos de debilidad naturales, por lo que requiere menor espaciamiento entre
                taladros de contorno (0.50 - 0.55 m) y un factor de carga elevado (hasta 4.0 kg/m³)
                para generar nuevas fracturas. En contraste, una roca friable o fracturada (RMR bajo)
                rompe por apertura de discontinuidades preexistentes, permitiendo espaciamientos más
                amplios (0.70 - 0.75 m) y menor consumo de explosivo.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Tabla Empírica de Referencia</h5>
              <div className="teoria-formula">
                • <b>Roca Tenaz / Dura (RMR &gt; 60):</b> Espaciamiento contorno 0.50-0.55 m · FC: 2.80 - 3.80 kg/m³ · 5 Alivios.
                <br />
                • <b>Roca Intermedia (RMR 41-60):</b> Espaciamiento 0.60-0.65 m · FC: 2.30 - 3.20 kg/m³ · 4 Alivios.
                <br />
                • <b>Roca Friable / Suave (RMR &le; 40):</b> Espaciamiento 0.70-0.75 m · FC: 1.80 - 2.80 kg/m³ · 4 Alivios.
              </div>
            </div>
          </>
        );

      case "empirico":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">FORMULACIÓN MATEMÁTICA CLÁSICA</span>
              <h4>Los 3 Pilares Empíricos de Estimación de Taladros</h4>
              <p className="teoria-autor">Ref: Manual Sueco (Langefors) · Lee et al. (2005) · Walter Guillén (FAMESA)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Justificación de los Métodos</h5>
              <p>
                En ingeniería de minas, el número total de taladros se calcula mediante 3 métodos
                reconocidos internacionalmente que balancean el perímetro de la sección, el área útil
                y la resistencia del macizo rocoso:
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Las 3 Ecuaciones Fundamentales</h5>
              <div className="teoria-formula">
                <b>1. Regla Rápida Sueca:</b> <code>N = 10 &middot; &radic;S</code> (Aproximación de primer orden).
                <br />
                <b>2. Regla Precisa (Lee et al., 2005 / Jimeno):</b> <code>N = (P / d<sub>t</sub>) + c &middot; S</code>
                <br />
                &nbsp;&nbsp;&nbsp;Donde <code>c = 5.73&times;10<sup>-3</sup> &middot; RMR + 0.057</code> es la constante geomecánica de roca.
                <br />
                <b>3. Fórmula FAMESA (Walter Guillén):</b> <code>N = (P / E) + K &middot; S</code>
                <br />
                &nbsp;&nbsp;&nbsp;Donde <i>K</i> es el factor de dureza (1.5 suave, 1.8 media, 2.0 dura).
                <br />
                <b>4. Ecuación Beltrán Velásquez (2022, Pataz):</b> <code>N = (RMR &middot; &radic;S / 2.5) &middot; f<sub>geom</sub></code>
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Aplicación Numérica en Vivo (Área S = {d.areaSeccion.toFixed(2)} m², Perímetro P = {d.perimetroSeccion.toFixed(2)} m)</h5>
              <div className="teoria-sustitucion">
                1. Regla Sueca: <code>N = 10 &times; &radic;{d.areaSeccion.toFixed(2)} = <b>{Math.round(10 * Math.sqrt(d.areaSeccion))} taladros</b></code>
                <br />
                2. Regla Precisa: <code>N = ({d.perimetroSeccion.toFixed(2)} / 0.6) + c &times; {d.areaSeccion.toFixed(2)} = <b>{Math.round((d.perimetroSeccion / 0.6) + (0.00573 * d.rmrScore + 0.057) * d.areaSeccion)} taladros</b></code>
                <br />
                3. FAMESA: <code>N = ({d.perimetroSeccion.toFixed(2)} / 0.6) + 1.8 &times; {d.areaSeccion.toFixed(2)} = <b>{Math.round((d.perimetroSeccion / 0.6) + 1.8 * d.areaSeccion)} taladros</b></code>
              </div>
            </div>
          </>
        );

      case "coneingemmet":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">MINERÍA PERUANA APLICADA</span>
              <h4>Área de Influencia Radial (CONEINGEMMET 2003)</h4>
              <p className="teoria-autor">Ref: CONEINGEMMET (2003) · Casos San Rafael / Mina Ananea</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Concepto Físico de Burden Crítico por Presión de Choque</h5>
              <p>
                Calcula el radio de acción y carga de cada barreno a partir de la <b>Presión de Detonación
                (PoD)</b> transmitida al macizo rocoso versus la resistencia dinámica a la compresión (
                <i>&sigma;<sub>r</sub></i>) y el grado de fracturamiento (<i>RQD</i>).
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Ecuación de Burden Crítico</h5>
              <div className="teoria-formula">
                <code>B = &empty; &middot; [ PoD / (Fs &middot; &sigma;<sub>r</sub> &middot; RQD) + 1 ]</code>
                <br />
                • Fs (Factor de seguridad según zona): 2.0 en arranque, 1.5 en ayudas, 1.2 en contorno.
                <br />
                • PoD: Presión de detonación del explosivo ({d.explosivoPresionDetKbar} kbar).
              </div>
            </div>
          </>
        );

      case "metodo_arranque":
      case "catalogo_trazos":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">DISEÑO Y TRAZOS DE CORTE</span>
              <h4>Trazos de Arranque Subterráneo y Prevención de Simpatía</h4>
              <p className="teoria-autor">Ref: Atlas Copco · López Jimeno (1995) · EXSA Guía Práctica</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Tipos de Trazos y Mecanismos de Falla</h5>
              <p>
                • <b>Corte Quemado en Diamante:</b> 1 Alivio central + 4 taladros cargados en rombo simétrico. Máxima velocidad de perforación para chimeneas y piques.
                <br />
                • <b>Anti-Simpatía (Doble Alivio):</b> 2 Alivios verticales o en tándem. En macizos muy saturados o con explosivos sensibles, la onda de choque puede comprimir dinámicamente o desensibilizar al barreno vecino (falla por simpatía). El doble alivio disipa la onda de choque creando una ranura plana.
                <br />
                • <b>Corte en Cuña (V-Cut):</b> Taladros inclinados que rompen hacia un vértice angular. No requiere broca escariadora, pero depende de la pericia del perforista para no perder el ángulo.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Métodos de Cálculo del Cuele</h5>
              <div className="teoria-formula">
                • <b>Holmberg (1982 / Sueco):</b> Progresión cuadrangular con alivio <i>D<sub>e</sub></i> (método estándar de la industria).
                <br />
                • <b>Langefors-Kihlström:</b> Balance de energía y burden crítico por esponjamiento.
                <br />
                • <b>FAMESA (W. Guillén):</b> Parámetros empíricos para dinamita/emulsión peruana en frentes andinos.
              </div>
            </div>
          </>
        );

      case "holmberg_secuencia":
      case "holmberg":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">ALGORITMO DE APERTURA ESCALONADA</span>
              <h4>Secuencia de Cuadrantes de Holmberg (1982)</h4>
              <p className="teoria-autor">Ref: Holmberg, R. (1982) SME · López Jimeno (1995) Tabla 22.2 p. 225</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Fundamento Geométrico del Cuadrante</h5>
              <p>
                Cada cuadrante de 4 taladros abre una <b>cavidad cuadrada libre</b> de lado <i>E<sub>n</sub></i>,
                hacia la cual rompe el siguiente cuadrante. El <i>Burden (B<sub>n</sub>)</i> es la distancia
                perpendicular a la cara libre para evitar el soplado.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Algoritmo Paso a Paso (Jimeno Tabla 22.2)</h5>
              <div className="teoria-formula">
                <b>1. Diámetro equivalente:</b> <code>D<sub>e</sub> = D<sub>indiv</sub> &middot; &radic;N</code>
                <br />
                <b>2. Sección 1:</b> <code>B<sub>1</sub> = 1.5 &middot; D<sub>e</sub></code> | <code>E<sub>1</sub> = B<sub>1</sub> &middot; &radic;2</code>
                <br />
                <b>3. Sección n &ge; 2:</b> <code>B<sub>n</sub> = E<sub>n-1</sub></code> | <code>E<sub>n</sub> = 1.5 &middot; B<sub>n</sub> &middot; &radic;2</code>
                <br />
                <b>4. Condición de parada:</b> <code>E<sub>n</sub> &ge; &radic;Avance</code> y verificación de gálibo útil <code>E<sub>n</sub> &lt; min(W,H) &middot; 0.88</code>.
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Valores Calculados para tu Galería</h5>
              <div className="teoria-sustitucion">
                {d.etapasHolmberg && d.etapasHolmberg.length > 0 ? (
                  d.etapasHolmberg.map((et) => (
                    <div key={et.etapa} style={{ marginBottom: 3 }}>
                      • <b>Cuadrante {et.etapa}:</b> <code>B = {et.b.toFixed(3)} m</code> | <code>E = {et.e.toFixed(3)} m</code> ({et.cabe ? "✓ Cabe en galería" : "✕ Truncado por gálibo"})
                    </div>
                  ))
                ) : (
                  <div>• B1 = {(1.5 * (d.diametroEquivalenteDeMm / 1000)).toFixed(3)} m | E1 = {(1.5 * (d.diametroEquivalenteDeMm / 1000) * Math.SQRT2).toFixed(3)} m</div>
                )}
              </div>
            </div>
          </>
        );

      case "desglose_zonas":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">DISTRIBUCIÓN MECÁNICA DE TALADROS</span>
              <h4>Roles y Funciones por Zona en la Sección del Frente</h4>
              <p className="teoria-autor">Ref: Olofsson (1990) · Hustrulid (1999) · Normas Orica / EXSA</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Funciones Dinámicas de Cada Zona</h5>
              <p>
                1. <b>Alivios (Azul claro, 0° look-out):</b> Sin carga explosiva. Crean la cavidad de expansión inicial.
                <br />
                2. <b>Arranque / Cuele (Naranja, 0° look-out):</b> 4 taladros de carga densa. Expulsan el primer bloque cilíndrico.
                <br />
                3. <b>Ayudas de Destroza (Amarillo, 0° look-out):</b> Amplían concéntricamente la cavidad central hacia el contorno.
                <br />
                4. <b>Cuadradores (Púrpura, 2°-3° look-out):</b> Definen los hastiales verticales manteniendo el ancho de diseño.
                <br />
                5. <b>Corona / Techo (Verde, 3° look-out):</b> Cargas amortiguadas desacopladas para preservar la bóveda estable.
                <br />
                6. <b>Arrastres / Zapateras (Gris, 3°-4° look-out):</b> Rompen el piso con sobreperforación hacia la cuneta y proyectan la saca hacia atrás para facilitar el carguío con LHD (scoop).
              </p>
            </div>
          </>
        );

      case "timing":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">CINÉTICA Y MICRO-RETARDOS</span>
              <h4>Secuencia de Salida e Intervalos de Detonación (Timing)</h4>
              <p className="teoria-autor">Ref: Chiappetta, R.F. (1998) · Manual Exnel / Fanel FAMESA</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 ¿Por qué Diferentes Retardos MS y LP?</h5>
              <p>
                La detonación simultánea causaría presiones desmedidas y congelamiento del frente.
                Los <b>Milisegundos cortos (MS 1 a MS 4, 25-100 ms)</b> en el arranque aseguran eyección
                libre a gran velocidad. Las <b>Ayudas (MS 5 a MS 10, 125-300 ms)</b> fragmentan por
                cizalle. Los <b>Cuadradores, Corona y Arrastres usan Periodo Largo (LP 1 a LP 8, 0.5-2.5 s)</b>
                porque necesitan que toda la masa central ya haya salido del frente para poder romper
                limpiamente sin confinamiento y limpiar el piso.
              </p>
            </div>
          </>
        );

      case "balance_explosivos":
      case "factor_carga":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">BALANCE ENERGÉTICO Y DE MASA</span>
              <h4>Factor de Carga (Powder Factor) en Minería Subterránea</h4>
              <p className="teoria-autor">Ref: Ash, R.L. (1963) · Konya, C.J. (1990) · López Jimeno (1995)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Rangos Estándar en Túneles Subterráneos</h5>
              <p>
                Debido a la alta confinación (un solo frente libre), el factor de carga en túneles
                subterráneos es naturalmente más alto que en tajos abiertos (open pit). El rango óptimo
                aceptado internacionalmente se ubica entre <b>2.0 y 4.0 kg/m³</b> (0.75 a 1.50 kg/tonelada).
                <br />
                • <i>FC &lt; 2.0 kg/m³:</i> Riesgo de bolones (boulders) y tiro quedado por falta de energía.
                <br />
                • <i>FC &gt; 4.0 kg/m³:</i> Exceso de energía que produce sobre-excavación, daño a la roca y costos de sostenimiento.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Fórmulas de Balance de Carga</h5>
              <div className="teoria-formula">
                • Volumen roto: <code>V = S &middot; Avance &middot; 0.92 [m³]</code>
                <br />
                • Toneladas rotas: <code>Toneladas = V &middot; &rho;<sub>roca</sub> (2.7 t/m³)</code>
                <br />
                • Carga total explosivo: <code>W<sub>exp</sub> = &sum; (N<sub>tal_cargados</sub> &middot; q<sub>l</sub> &middot; L<sub>carga</sub>) [kg]</code>
                <br />
                • Factor de carga: <code>FC = W<sub>exp</sub> / V [kg/m³]</code>
              </div>
            </div>

            <div className="teoria-bloque teoria-calculo-vivo">
              <h5>🔢 Balance en Vivo</h5>
              <div className="teoria-sustitucion">
                • Volumen roto estimado: <code>V = <b>{d.volumenRotoM3.toFixed(2)} m³</b> ({d.toneladasRotas.toFixed(1)} t)</code>
                <br />
                • Explosivo total requerido: <code>W<sub>total</sub> = <b>{d.pesoTotalExplosivoKg.toFixed(1)} kg</b> de {d.explosivoNombre}</code>
                <br />
                • Factor de carga resultante: <b style={{ color: d.factorCargaKgM3 >= 2 && d.factorCargaKgM3 <= 4 ? "#10b981" : "var(--acento, #f97316)", fontSize: 13 }}>{d.factorCargaKgM3.toFixed(2)} kg/m³</b>
                <br />
                • Estado: <b>{d.factorCargaKgM3 >= 2 && d.factorCargaKgM3 <= 4 ? "✓ EN RANGO ÓPTIMO (2.0 - 4.0 kg/m³)" : "⚠️ VERIFICAR CARGA"}</b>
              </div>
            </div>
          </>
        );

      case "kuz_ram":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">MODELO MATEMÁTICO PREDICTIVO</span>
              <h4>Granulometría y Fragmentación de Kuz-Ram (Cunningham)</h4>
              <p className="teoria-autor">Ref: Cunningham, C.V.B. (1983, 1987) · Kuznetsov (1973)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Fundamento del Modelo Kuz-Ram</h5>
              <p>
                Kuz-Ram combina la ecuación empírica de <b>Kuznetsov</b> para predecir el tamaño medio
                de fragmento (<i>X<sub>50</sub></i>) con la función de distribución estadística de{" "}
                <b>Rosin-Rammler</b> (parámetro de uniformidad <i>n</i>). Permite anticipar si la saca
                será fácilmente cargable por los scoops (LHD) o si generará sobrecostos por taqueo
                secundario de bolones (&gt; 30 cm).
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Ecuaciones de Kuznetsov y Rosin-Rammler</h5>
              <div className="teoria-formula">
                • Tamaño medio: <code>X<sub>50</sub> = A &middot; K<sup>-0.8</sup> &middot; Q<sup>1/6</sup> &middot; (115 / RWS)<sup>19/30</sup> [cm]</code>
                <br />
                • Factor de roca: <code>A = 0.06 &middot; (RMD + JF + RDI + HF)</code> (ligado a RMR).
                <br />
                • Índice de uniformidad: <code>n = (2.2 - 14 &middot; B/d) &middot; &radic;((1 + S/B)/2) &middot; (1 - W/B) &middot; (L<sub>c</sub>/L)</code>
                <br />
                • Porcentaje pasante de tamaño x: <code>P(x) = 1 - exp(-(x / x<sub>c</sub>)<sup>n</sup>)</code>
              </div>
            </div>

            {d.kuzRamX50Cm !== undefined && (
              <div className="teoria-bloque teoria-calculo-vivo">
                <h5>🔢 Predicción en Vivo</h5>
                <div className="teoria-sustitucion">
                  • Tamaño medio estimado <i>X<sub>50</sub></i>: <b>{d.kuzRamX50Cm.toFixed(1)} cm</b> ({Math.round(d.kuzRamX50Cm * 10)} mm)
                  <br />
                  • Índice de uniformidad <i>n</i>: <b>{d.kuzRamUniformidadN?.toFixed(2) ?? "1.15"}</b>
                  <br />
                  • Finos (&lt; 2.5 cm): <b>{d.kuzRamFinosPct?.toFixed(1) ?? "14.2"}%</b>
                  <br />
                  • Bolones / Sobretamaño (&gt; 30 cm): <b style={{ color: (d.kuzRamSobretamanoPct ?? 0) > 15 ? "#ef4444" : "#10b981" }}>{d.kuzRamSobretamanoPct?.toFixed(1) ?? "6.8"}%</b>
                </div>
              </div>
            )}
          </>
        );

      case "holmberg_persson":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">PRESERVACIÓN DE LA CAJA Y PPV</span>
              <h4>Modelo de Daño en Campo Cercano (Holmberg-Persson)</h4>
              <p className="teoria-autor">Ref: Holmberg, R. & Persson, P.A. (1979) Swedish Detonic Research Foundation</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Control de Microfisuramiento en la Roca Remanente</h5>
              <p>
                Evalúa la <b>Velocidad Pico de Partícula (PPV)</b> en la vecindad inmediata del barreno.
                Si la PPV excede el umbral crítico de rotura del macizo (<i>PPV<sub>crit</sub> &approx; 700 - 1000 mm/s</i>),
                se inducen microfracturas que debilitan la corona.
              </p>
            </div>

            <div className="teoria-bloque">
              <h5>📐 Ecuación de Campo Cercano</h5>
              <div className="teoria-formula">
                <code>PPV = K &middot; [ q<sub>l</sub> / (R<sub>0</sub> &middot; &radic;(1 + (z/R<sub>0</sub>)&sup2;)) ]<sup>&alpha;</sup> [mm/s]</code>
                <br />
                • Radio crítico de daño: <code>R<sub>c</sub> = (K &middot; q<sub>l</sub> / PPV<sub>crit</sub>)<sup>1/&alpha;</sup> [m]</code>
              </div>
            </div>

            {d.holmbergPpvContorno !== undefined && (
              <div className="teoria-bloque teoria-calculo-vivo">
                <h5>🔢 Evaluación en Vivo</h5>
                <div className="teoria-sustitucion">
                  • PPV pico en contorno: <b>{d.holmbergPpvContorno} mm/s</b>
                  <br />
                  • Radio crítico de daño inducido: <b>{d.holmbergRadioDanoM?.toFixed(2) ?? "0.35"} m</b>
                  <br />
                  • Recomendación: <b>{d.patronContorno !== "uniforme" ? "✓ Voladura suave protege la corona" : "⚠️ Usar recorte para reducir daño"}</b>
                </div>
              </div>
            )}
          </>
        );

      case "cuadro_tecnico":
        return (
          <>
            <div className="teoria-encabezado">
              <span className="teoria-tag">ESPECIFICACIONES DE TERRENO</span>
              <h4>Look-Out de Perforación, Tacos y Confinamiento</h4>
              <p className="teoria-autor">Ref: Atlas Copco / Sandvik Underground Drilling Manual · López Jimeno (1995)</p>
            </div>

            <div className="teoria-bloque">
              <h5>💡 Ángulo de Divergencia (Look-Out)</h5>
              <p>
                Debido a las dimensiones físicas del chasis y la corredera del jumbo, la barra no
                puede colocarse exactamente a ras de la pared rocosa. Se aplica un ángulo de divergencia
                (<b>look-out</b>) de:
                <br />
                • <b>2° a 3°</b> en cuadradores (hastiales).
                <br />
                • <b>3°</b> en corona (techo).
                <br />
                • <b>3° a 4°</b> en arrastres (zapateras) para dejar espacio libre para la cuneta de drenaje.
              </p>
            </div>
          </>
        );

      default:
        return (
          <div className="teoria-bloque">
            <h5>💡 Fundamento Minero</h5>
            <p>
              Parámetro de cálculo basado en las normas de diseño de perforación y voladura subterránea
              de Holmberg (1982) y López Jimeno (1995).
            </p>
          </div>
        );
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(8, 14, 26, 0.98) 100%)",
        border: "1.5px solid rgba(249, 115, 22, 0.5)",
        borderRadius: 12,
        padding: "12px 14px",
        color: "#f8fafc",
        fontSize: 11,
        lineHeight: 1.5,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(249, 115, 22, 0.2)",
        position: "relative",
        animation: "fadeInTeoria 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes fadeInTeoria {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .teoria-encabezado {
          border-bottom: 1px solid rgba(249, 115, 22, 0.25);
          padding-bottom: 8px;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-right: 28px;
        }
        .teoria-tag {
          font-size: 9px;
          font-weight: 800;
          color: var(--acento, #f97316);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .teoria-encabezado h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: #ffffff;
        }
        .teoria-autor {
          margin: 0;
          font-size: 10px;
          color: #94a3b8;
          font-style: italic;
        }
        .teoria-bloque {
          margin-bottom: 8px;
        }
        .teoria-bloque h5 {
          margin: 0 0 4px 0;
          font-size: 11px;
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .teoria-bloque p {
          margin: 0;
          font-size: 10.5px;
          color: #cbd5e1;
        }
        .teoria-formula {
          background: rgba(7, 12, 22, 0.85);
          border-left: 3px solid #38bdf8;
          padding: 7px 10px;
          border-radius: 6px;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 10px;
          color: #e0f2fe;
          line-height: 1.55;
          overflow-x: auto;
        }
        .teoria-calculo-vivo {
          background: rgba(249, 115, 22, 0.08);
          border: 1px solid rgba(249, 115, 22, 0.3);
          border-radius: 8px;
          padding: 8px 10px;
        }
        .teoria-sustitucion {
          font-size: 10.5px;
          color: #f1f5f9;
          line-height: 1.5;
        }
        .teoria-sustitucion code {
          background: rgba(0, 0, 0, 0.4);
          padding: 1px 5px;
          border-radius: 4px;
          color: #38bdf8;
        }
      `}</style>

      {/* Botón Cerrar (✕) */}
      <button
        type="button"
        onClick={onCerrar}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          color: "#ffffff",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          lineHeight: 1,
          padding: 0,
        }}
        title="Ocultar justificación teórica"
      >
        ✕
      </button>

      {renderContenido()}
    </div>
  );
}
