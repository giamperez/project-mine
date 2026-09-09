import { useEffect, useRef, useState } from "react";
import {
  agregarVertice,
  areaPoligono_m2,
  eliminarVertice,
  longitudPoligono_m,
  moverVertice,
  snapAGrilla,
  verticeMasCercano,
  type Punto2D,
} from "@suite/core";

type Herramienta = "agregar" | "mover" | "pan" | "medir";
type Arrastre =
  | { tipo: "pan"; inicioPantalla: Punto2D; inicioCentro: Punto2D }
  | { tipo: "vertice"; indice: number };
interface EstadoPinch {
  distanciaInicial: number;
  escalaInicial: number;
  centroMundoInicial: Punto2D;
  puntoMedioInicial: Punto2D;
}

interface Props<T extends Punto2D> {
  puntos: T[];
  onCambiarPuntos: (nuevos: T[]) => void;
  /** Fabrica un punto nuevo (con sus campos extra, si T los tiene) al tocar en modo "Agregar". Default: {x,y}. */
  crearPunto?: (x: number, y: number) => T;
  /**
   * true (default) = poligono cerrado con relleno y area/perimetro; "abierto" = polilinea sin
   * cerrar ni rellenar, con longitud total (p.ej. una ruta de acarreo); false = marcadores libres
   * sin conectar, p.ej. collares de sondaje.
   */
  conectado?: boolean | "abierto";
  /** Texto junto a cada punto. Default: numero de orden (1,2,3...). */
  etiquetaPunto?: (punto: T, indice: number) => string;
  /** Color del punto (no seleccionado). Default: naranja fijo. Util para codificar una categoria por color (p.ej. zona de un taladro). */
  colorPunto?: (punto: T, indice: number) => string;
}

const ESCALA_MIN = 2;
const ESCALA_MAX = 200;
const MAX_LINEAS_GRILLA = 60;
const TOLERANCIA_SNAP_VERTICE_PX = 16;
const MAX_HISTORIAL = 50;

export default function EditorPoligono2D<T extends Punto2D = Punto2D>({
  puntos,
  onCambiarPuntos,
  crearPunto,
  conectado = true,
  etiquetaPunto,
  colorPunto,
}: Props<T>) {
  const fabricarPunto = crearPunto ?? ((x: number, y: number) => ({ x, y }) as T);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [herramienta, setHerramienta] = useState<Herramienta>("agregar");
  const [escala, setEscala] = useState(10); // px por metro
  const [centro, setCentro] = useState<Punto2D>(() => {
    if (puntos.length === 0) return { x: 0, y: 0 };
    const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
    const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
    return { x: cx, y: cy };
  });
  const [snapGrillaActivo, setSnapGrillaActivo] = useState(true);
  const [tamanoGrilla, setTamanoGrilla] = useState(1);
  const [verticeSeleccionado, setVerticeSeleccionado] = useState<number | null>(null);
  const [verticeSnapObjetivo, setVerticeSnapObjetivo] = useState<number | null>(null);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const [puedeRehacer, setPuedeRehacer] = useState(false);
  const [puntosMedicion, setPuntosMedicion] = useState<Punto2D[]>([]);

  const arrastreRef = useRef<Arrastre | null>(null);
  const snapshotPendienteRef = useRef<T[] | null>(null);
  const historialRef = useRef<T[][]>([]);
  const rehacerRef = useRef<T[][]>([]);
  const punterosActivosRef = useRef<Map<number, Punto2D>>(new Map());
  const pinchRef = useRef<EstadoPinch | null>(null);

  function sincronizarBotonesHistorial() {
    setPuedeDeshacer(historialRef.current.length > 0);
    setPuedeRehacer(rehacerRef.current.length > 0);
  }

  /** Registra `previo` en el historial (una entrada = una accion discreta o un gesto de arrastre completo). */
  function registrarHistorial(previo: T[]) {
    historialRef.current.push(previo);
    if (historialRef.current.length > MAX_HISTORIAL) historialRef.current.shift();
    rehacerRef.current = [];
    sincronizarBotonesHistorial();
  }

  function cambiarConHistorial(nuevos: T[]) {
    registrarHistorial(puntos);
    onCambiarPuntos(nuevos);
  }

  function deshacer() {
    const anterior = historialRef.current.pop();
    if (anterior === undefined) return;
    rehacerRef.current.push(puntos);
    onCambiarPuntos(anterior);
    setVerticeSeleccionado(null);
    sincronizarBotonesHistorial();
  }

  function rehacer() {
    const siguiente = rehacerRef.current.pop();
    if (siguiente === undefined) return;
    historialRef.current.push(puntos);
    onCambiarPuntos(siguiente);
    setVerticeSeleccionado(null);
    sincronizarBotonesHistorial();
  }

  function tamanoLienzo(): { ancho: number; alto: number } {
    const rect = contenedorRef.current?.getBoundingClientRect();
    return { ancho: rect?.width ?? 300, alto: rect?.height ?? 300 };
  }

  function pantallaAMundo(sx: number, sy: number): Punto2D {
    return pantallaAMundoCon(centro, escala, sx, sy);
  }

  function pantallaAMundoCon(centroRef: Punto2D, escalaRef: number, sx: number, sy: number): Punto2D {
    const { ancho, alto } = tamanoLienzo();
    return { x: centroRef.x + (sx - ancho / 2) / escalaRef, y: centroRef.y - (sy - alto / 2) / escalaRef };
  }

  /** Al llegar a 2 dedos activos, arranca (o reinicia) el pellizco y cancela cualquier arrastre de un solo dedo en curso. */
  function evaluarInicioPinch() {
    if (punterosActivosRef.current.size !== 2) return;
    arrastreRef.current = null;
    snapshotPendienteRef.current = null;
    const [p1, p2] = Array.from(punterosActivosRef.current.values());
    const puntoMedio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    pinchRef.current = {
      distanciaInicial: Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y), 1),
      escalaInicial: escala,
      centroMundoInicial: centro,
      puntoMedioInicial: puntoMedio,
    };
  }

  function mundoAPantalla(p: Punto2D): Punto2D {
    const { ancho, alto } = tamanoLienzo();
    return { x: ancho / 2 + (p.x - centro.x) * escala, y: alto / 2 - (p.y - centro.y) * escala };
  }

  function coordenadasEvento(e: { clientX: number; clientY: number }): Punto2D {
    const rect = contenedorRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Snap combinado: enganche a vertice existente o grilla */
  function coordenadasConSnap(p: Punto2D, excluirIndice?: number): Punto2D {
    const candidatos = excluirIndice === undefined ? puntos : puntos.filter((_, i) => i !== excluirIndice);
    const toleranciaMundo = TOLERANCIA_SNAP_VERTICE_PX / escala;
    const idx = verticeMasCercano(candidatos, p, toleranciaMundo);
    if (idx !== null) {
      setVerticeSnapObjetivo(puntos.indexOf(candidatos[idx]));
      return { x: candidatos[idx].x, y: candidatos[idx].y };
    }
    setVerticeSnapObjetivo(null);
    return snapGrillaActivo ? snapAGrilla(p, tamanoGrilla) : p;
  }

  function handlePointerDownFondo(e: React.PointerEvent<SVGSVGElement>) {
    const pantalla = coordenadasEvento(e);
    punterosActivosRef.current.set(e.pointerId, pantalla);
    if (punterosActivosRef.current.size >= 2) {
      evaluarInicioPinch();
      return;
    }
    if (herramienta === "agregar") {
      const coords = coordenadasConSnap(pantallaAMundo(pantalla.x, pantalla.y));
      cambiarConHistorial(agregarVertice(puntos, fabricarPunto(coords.x, coords.y)));
      setVerticeSnapObjetivo(null);
    } else if (herramienta === "pan") {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      arrastreRef.current = { tipo: "pan", inicioPantalla: pantalla, inicioCentro: centro };
    } else if (herramienta === "medir") {
      const coords = coordenadasConSnap(pantallaAMundo(pantalla.x, pantalla.y));
      setPuntosMedicion((prev) => (prev.length >= 2 ? [coords] : [...prev, coords]));
    } else {
      setVerticeSeleccionado(null);
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const pantalla = coordenadasEvento(e);
    if (punterosActivosRef.current.has(e.pointerId)) {
      punterosActivosRef.current.set(e.pointerId, pantalla);
    }

    if (punterosActivosRef.current.size >= 2 && pinchRef.current) {
      const [p1, p2] = Array.from(punterosActivosRef.current.values());
      const distancia = Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y), 1);
      const puntoMedio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const pinch = pinchRef.current;
      const nuevaEscala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, pinch.escalaInicial * (distancia / pinch.distanciaInicial)));
      const puntoMundoFijo = pantallaAMundoCon(
        pinch.centroMundoInicial,
        pinch.escalaInicial,
        pinch.puntoMedioInicial.x,
        pinch.puntoMedioInicial.y
      );
      const { ancho, alto } = tamanoLienzo();
      setEscala(nuevaEscala);
      setCentro({
        x: puntoMundoFijo.x - (puntoMedio.x - ancho / 2) / nuevaEscala,
        y: puntoMundoFijo.y + (puntoMedio.y - alto / 2) / nuevaEscala,
      });
      return;
    }

    const arrastre = arrastreRef.current;
    if (!arrastre) return;
    if (arrastre.tipo === "pan") {
      const dx = (pantalla.x - arrastre.inicioPantalla.x) / escala;
      const dy = (pantalla.y - arrastre.inicioPantalla.y) / escala;
      setCentro({ x: arrastre.inicioCentro.x - dx, y: arrastre.inicioCentro.y + dy });
    } else {
      if (snapshotPendienteRef.current) {
        registrarHistorial(snapshotPendienteRef.current);
        snapshotPendienteRef.current = null;
      }
      const coords = coordenadasConSnap(pantallaAMundo(pantalla.x, pantalla.y), arrastre.indice);
      const actualizado = { ...puntos[arrastre.indice], ...coords } as T;
      onCambiarPuntos(moverVertice(puntos, arrastre.indice, actualizado));
    }
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    punterosActivosRef.current.delete(e.pointerId);
    if (punterosActivosRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (punterosActivosRef.current.size === 0) {
      arrastreRef.current = null;
      snapshotPendienteRef.current = null;
      setVerticeSnapObjetivo(null);
    }
  }

  function handlePointerDownVertice(e: React.PointerEvent<SVGCircleElement>, indice: number) {
    e.stopPropagation();
    const pantalla = coordenadasEvento(e);
    punterosActivosRef.current.set(e.pointerId, pantalla);
    if (punterosActivosRef.current.size >= 2) {
      evaluarInicioPinch();
      return;
    }
    setVerticeSeleccionado(indice);
    if (herramienta === "mover") {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      snapshotPendienteRef.current = puntos;
      arrastreRef.current = { tipo: "vertice", indice };
    }
  }

  function acercar() {
    setEscala((s) => Math.min(ESCALA_MAX, s * 1.35));
  }
  function alejar() {
    setEscala((s) => Math.max(ESCALA_MIN, s / 1.35));
  }
  function centrarVista() {
    if (puntos.length === 0) {
      setCentro({ x: 0, y: 0 });
      setEscala(10);
      return;
    }
    const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
    const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
    setCentro({ x: cx, y: cy });
  }
  function limpiar() {
    if (puntos.length === 0) return;
    cambiarConHistorial([]);
    setVerticeSeleccionado(null);
  }
  function eliminarSeleccionado() {
    if (verticeSeleccionado === null) return;
    cambiarConHistorial(eliminarVertice(puntos, verticeSeleccionado));
    setVerticeSeleccionado(null);
  }

  // Zoom con rueda del mouse centrado exactamente en la posición del cursor
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { ancho, alto } = { ancho: rect.width || 300, alto: rect.height || 300 };

      // Punto en el mundo antes del zoom
      const puntoMundo = {
        x: centro.x + (sx - ancho / 2) / escala,
        y: centro.y - (sy - alto / 2) / escala,
      };

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const nuevaEscala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, escala * factor));

      setEscala(nuevaEscala);
      setCentro({
        x: puntoMundo.x - (sx - ancho / 2) / nuevaEscala,
        y: puntoMundo.y + (sy - alto / 2) / nuevaEscala,
      });
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [centro, escala]);

  // Atajos de teclado (desktop)
  useEffect(() => {
    function esCampoDeTexto(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }
    function manejarTeclado(e: KeyboardEvent) {
      if (esCampoDeTexto(e.target)) return;
      const ctrlOMeta = e.ctrlKey || e.metaKey;
      const tecla = e.key.toLowerCase();
      if (ctrlOMeta && tecla === "z" && !e.shiftKey) {
        e.preventDefault();
        deshacer();
      } else if ((ctrlOMeta && tecla === "z" && e.shiftKey) || (ctrlOMeta && tecla === "y")) {
        e.preventDefault();
        rehacer();
      } else if ((e.key === "Delete" || e.key === "Backspace") && verticeSeleccionado !== null) {
        e.preventDefault();
        eliminarSeleccionado();
      } else if (e.key === "Escape") {
        setVerticeSeleccionado(null);
      }
    }
    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [puntos, verticeSeleccionado]);

  useEffect(() => {
    if (herramienta !== "medir") setPuntosMedicion([]);
  }, [herramienta]);

  const { ancho, alto } = tamanoLienzo();
  const lineasGrilla: Array<{ x1: number; y1: number; x2: number; y2: number; eje?: boolean }> = [];
  {
    let paso = tamanoGrilla;
    const anchoMundo = ancho / escala;
    const altoMundo = alto / escala;
    while ((anchoMundo / paso > MAX_LINEAS_GRILLA || altoMundo / paso > MAX_LINEAS_GRILLA) && paso < 1e6) {
      paso *= 5;
    }
    const xMin = Math.floor((centro.x - anchoMundo / 2) / paso) * paso;
    const xMax = centro.x + anchoMundo / 2;
    const yMin = Math.floor((centro.y - altoMundo / 2) / paso) * paso;
    const yMax = centro.y + altoMundo / 2;
    for (let x = xMin; x <= xMax; x += paso) {
      const p1 = mundoAPantalla({ x, y: yMin });
      const p2 = mundoAPantalla({ x, y: yMax });
      lineasGrilla.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, eje: Math.abs(x) < 1e-6 });
    }
    for (let y = yMin; y <= yMax; y += paso) {
      const p1 = mundoAPantalla({ x: xMin, y });
      const p2 = mundoAPantalla({ x: xMax, y });
      lineasGrilla.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, eje: Math.abs(y) < 1e-6 });
    }
  }

  const puntosPantalla = puntos.map(mundoAPantalla);
  const poligonoCerrado = conectado === true;
  const area = poligonoCerrado && puntos.length >= 3 ? areaPoligono_m2(puntos) : 0;
  const perimetro = poligonoCerrado ? longitudPoligono_m(puntos, puntos.length >= 3) : 0;
  const longitudRuta = conectado === "abierto" ? longitudPoligono_m(puntos, false) : 0;

  const puntosMedicionPantalla = puntosMedicion.map(mundoAPantalla);
  const distanciaMedicion =
    puntosMedicion.length === 2 ? Math.hypot(puntosMedicion[1].x - puntosMedicion[0].x, puntosMedicion[1].y - puntosMedicion[0].y) : null;

  return (
    <div className="editor2d">
      <div className="editor2d-toolbar">
        <div className="editor2d-modos">
          <button className="btn" type="button" data-activo={herramienta === "agregar"} onClick={() => setHerramienta("agregar")} title="Agregar vértices o puntos">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Agregar</span>
          </button>
          <button className="btn" type="button" data-activo={herramienta === "mover"} onClick={() => setHerramienta("mover")} title="Mover vértices">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="5 9 2 12 5 15" />
              <polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" />
              <polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            <span>Mover</span>
          </button>
          <button className="btn" type="button" data-activo={herramienta === "pan"} onClick={() => setHerramienta("pan")} title="Encuadre y desplazamiento del plano">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v3" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
            <span>Desplazar</span>
          </button>
          <button className="btn" type="button" data-activo={herramienta === "medir"} onClick={() => setHerramienta("medir")} title="Medir distancia entre 2 puntos">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21.3 15.3l-6.6 6.6c-.4.4-1 .4-1.4 0l-9.6-9.6a1 1 0 0 1 0-1.4l6.6-6.6c.4-.4 1-.4 1.4 0l9.6 9.6c.4.4.4 1 0 1.4z" />
              <line x1="7.5" y1="10.5" x2="9" y2="12" />
              <line x1="10.5" y1="7.5" x2="12" y2="9" />
              <line x1="13.5" y1="4.5" x2="15" y2="6" />
            </svg>
            <span>Medir</span>
          </button>
        </div>
        <div className="editor2d-modos">
          <button className="btn" type="button" data-activo={snapGrillaActivo} onClick={() => setSnapGrillaActivo((v) => !v)} title="Activar/Desactivar ajuste a grilla">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Snap {tamanoGrilla}m</span>
          </button>
          {verticeSeleccionado !== null && (
            <button className="btn btn-peligro" type="button" onClick={eliminarSeleccionado} title="Eliminar punto seleccionado">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Eliminar</span>
            </button>
          )}
          <button className="btn" type="button" onClick={deshacer} disabled={!puedeDeshacer} title="Deshacer (Ctrl+Z)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <button className="btn" type="button" onClick={rehacer} disabled={!puedeRehacer} title="Rehacer (Ctrl+Y)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button className="btn" type="button" onClick={limpiar} disabled={puntos.length === 0} title="Limpiar todos los puntos">
            Limpiar
          </button>
        </div>
      </div>

      <div className="editor2d-lienzo" ref={contenedorRef} style={{ position: "relative" }}>
        {/* Controles flotantes de Zoom y Vista con rueda de mouse */}
        <div className="editor2d-floating-tools">
          <button type="button" onClick={acercar} title="Acercar (+ o Rueda de mouse arriba)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button type="button" onClick={alejar} title="Alejar (- o Rueda de mouse abajo)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button type="button" onClick={centrarVista} title="Centrar y encuadrar vista">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
          <span className="editor2d-zoom-badge">{Math.round(escala)} px/m</span>
        </div>

        <svg
          width="100%"
          height="100%"
          style={{ touchAction: "none", display: "block" }}
          onPointerDown={handlePointerDownFondo}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {lineasGrilla.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.eje ? "rgba(56, 189, 248, 0.4)" : "rgba(255, 255, 255, 0.05)"} strokeWidth={l.eje ? 1.5 : 1} />
          ))}

          {poligonoCerrado && puntos.length >= 2 && (
            <polygon
              points={puntosPantalla.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(249,115,22,0.18)"
              stroke="#f97316"
              strokeWidth={2}
            />
          )}

          {conectado === "abierto" && puntos.length >= 2 && (
            <polyline
              points={puntosPantalla.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#f97316"
              strokeWidth={2}
            />
          )}

          {puntosPantalla.map((p, i) => (
            <g key={i}>
              {i === verticeSnapObjetivo && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="#38bdf8" strokeWidth={2} />}
              <circle
                cx={p.x}
                cy={p.y}
                r={18}
                fill="transparent"
                onPointerDown={(e) => handlePointerDownVertice(e, i)}
                style={{ cursor: herramienta === "mover" ? "grab" : "pointer" }}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={i === verticeSeleccionado ? 8 : 6}
                fill={i === verticeSeleccionado ? "#38bdf8" : colorPunto ? colorPunto(puntos[i], i) : "#f97316"}
                stroke="#0b0f16"
                strokeWidth={1.5}
                pointerEvents="none"
              />
              <text x={p.x + 10} y={p.y - 10} fill="#94a3b8" fontSize={11} fontWeight="600" pointerEvents="none">
                {etiquetaPunto ? etiquetaPunto(puntos[i], i) : i + 1}
              </text>
            </g>
          ))}

          {puntosMedicionPantalla.length === 2 && (
            <line
              x1={puntosMedicionPantalla[0].x}
              y1={puntosMedicionPantalla[0].y}
              x2={puntosMedicionPantalla[1].x}
              y2={puntosMedicionPantalla[1].y}
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}
          {puntosMedicionPantalla.map((p, i) => (
            <circle key={`medicion-${i}`} cx={p.x} cy={p.y} r={5} fill="#38bdf8" stroke="#0b0f16" strokeWidth={1.5} pointerEvents="none" />
          ))}
          {distanciaMedicion !== null && (
            <text
              x={(puntosMedicionPantalla[0].x + puntosMedicionPantalla[1].x) / 2}
              y={(puntosMedicionPantalla[0].y + puntosMedicionPantalla[1].y) / 2 - 10}
              fill="#38bdf8"
              fontSize={13}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
            >
              {distanciaMedicion.toFixed(2)} m
            </text>
          )}
        </svg>

        <div className="editor2d-estado">
          <span className="editor2d-hint-wheel">💡 Rueda del mouse: Acercar / Alejar</span>
          {poligonoCerrado ? (
            <span>
              <b>{puntos.length}</b> vértices · Área <b>{area.toFixed(1)} m²</b> · Perímetro <b>{perimetro.toFixed(1)} m</b>
            </span>
          ) : conectado === "abierto" ? (
            <span>
              <b>{puntos.length}</b> puntos · Longitud <b>{longitudRuta.toFixed(1)} m</b>
            </span>
          ) : (
            <span><b>{puntos.length}</b> puntos</span>
          )}
          {herramienta === "medir" &&
            (distanciaMedicion !== null ? (
              <span> · Medición: <b>{distanciaMedicion.toFixed(2)} m</b></span>
            ) : puntosMedicion.length === 1 ? (
              <span> · Toca el segundo punto…</span>
            ) : (
              <span> · Toca dos puntos para medir</span>
            ))}
        </div>
      </div>
    </div>
  );
}
