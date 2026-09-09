import { useMemo, useState, useEffect, useRef } from "react";
import type { PatronIniciacion, ResultadoMallaPerforacion, ResultadoVoladura, Taladro } from "@suite/core";
import { SceneManager, LayerManager } from "@suite/engine";
import { construirEscenaMalla } from "@suite/mining-blast-pattern";
import { construirEscenaSecuencia, SecuenciaAnimador } from "@suite/mining-blasting";

export interface EntradaVoladuraUI {
  patronIniciacion: PatronIniciacion;
  msPorMetroBurden: number;
  msPorMetroEspaciamiento: number;
}

interface Props {
  entrada: EntradaVoladuraUI;
  onCambiarEntrada: (nueva: EntradaVoladuraUI) => void;
  resultado: ResultadoVoladura;
  resultadoMalla?: ResultadoMallaPerforacion;
  taladros?: Taladro[];
  reproduciendo: boolean;
  tiempoActual_ms: number;
  onPlay: () => void;
  onPausar: () => void;
  onReiniciar: () => void;
  onExportarCSV: () => void;
}

function MiniVisor3DVoladura({
  resultadoVoladura,
  taladros,
  resultadoMalla,
  tiempoActual_ms,
}: {
  resultadoVoladura: ResultadoVoladura;
  taladros?: Taladro[];
  resultadoMalla?: ResultadoMallaPerforacion;
  tiempoActual_ms: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<{ scene: SceneManager; layers: LayerManager; encuadrado: boolean } | null>(null);
  const animadorRef = useRef<SecuenciaAnimador | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new SceneManager({ contenedor: containerRef.current });
    const layers = new LayerManager(scene.escena);
    managerRef.current = { scene, layers, encuadrado: false };
    scene.iniciarLoop();
    return () => {
      scene.destruir();
      managerRef.current = null;
      animadorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    if (resultadoMalla && resultadoMalla.taladros.length > 0) {
      const xs = resultadoMalla.taladros.map((t) => t.collar.x);
      const ys = resultadoMalla.taladros.map((t) => t.collar.y);
      const minX = Math.min(...xs) - 4;
      const maxX = Math.max(...xs) + 4;
      const minY = Math.min(...ys) - 4;
      const maxY = Math.max(...ys) + 4;
      const poligonoCresta = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      construirEscenaMalla(manager.layers, resultadoMalla, {
        poligonoCresta,
        cotaCresta: resultadoMalla.taladros[0]?.collar.z ?? 100,
        alturaBanco_m: 10,
      });
      if (!manager.encuadrado) {
        const capaBanco = manager.layers.obtenerCapa("layer.mining.blast-pattern.bench");
        if (capaBanco) {
          manager.scene.encuadrarObjeto(capaBanco.grupo);
          manager.encuadrado = true;
        }
      }
    }
  }, [resultadoMalla]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !resultadoVoladura) return;
    animadorRef.current = construirEscenaSecuencia(manager.layers, resultadoVoladura, taladros ?? []);
    if (!manager.encuadrado) {
      manager.scene.encuadrarObjeto(manager.scene.escena);
      manager.encuadrado = true;
    }
  }, [resultadoVoladura, taladros]);

  useEffect(() => {
    animadorRef.current?.actualizarTiempo(tiempoActual_ms);
  }, [tiempoActual_ms]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        cursor: "grab",
      }}
    />
  );
}

const OPCIONES_PATRON_TUNEL: Array<{ valor: PatronIniciacion; etiqueta: string; desc: string }> = [
  {
    valor: "tunel_concentrico",
    etiqueta: "Concéntrico Estándar (Por zonas y anillos)",
    desc: "Iniciación de cuele al centro hacia afuera (Cuele -> Ayudas -> Destroza -> Zapateras -> Hastiales -> Corona).",
  },
  {
    valor: "tunel_secuencial_cuadrantes",
    etiqueta: "Cuadrantes MS / LP (Escalonado)",
    desc: "Retardos progresivos independientes por cuadrantes y sub-etapas para minimizar vibraciones (PPV).",
  },
  {
    valor: "tunel_espiral",
    etiqueta: "Espiral Radial (Rotacional continuo)",
    desc: "Disparo continuo en espiral que genera alivio y cara libre angular rotatoria sin confinamiento.",
  },
];

const OPCIONES_PATRON_BANCO: Array<{ valor: PatronIniciacion; etiqueta: string; desc: string }> = [
  {
    valor: "fila_por_fila",
    etiqueta: "Fila por fila (Tajo abierto)",
    desc: "Todos los taladros de la misma fila detonan simultáneamente hacia la cara libre.",
  },
  {
    valor: "echelon",
    etiqueta: "Echelon (Diagonal desde esquina)",
    desc: "Detonación escalonada diagonal en V oblicua desde una esquina del banco.",
  },
  {
    valor: "v_corte",
    etiqueta: "Corte en V (Diagonal desde el centro)",
    desc: "Detonación en V simétrica abriendo cara libre desde el centro hacia los extremos.",
  },
];

function colorPorRetardo(tiempo_ms: number, duracionTotal_ms: number): string {
  const t = Math.max(0, Math.min(1, tiempo_ms / Math.max(duracionTotal_ms, 1)));
  if (tiempo_ms === 0) return "#38bdf8"; // cyan alivio / tiempo cero
  if (t < 0.15) return "#ef4444"; // rojo vivo (cuele / arranque inicial)
  if (t < 0.35) return "#f97316"; // naranja (ayudas 1 y 2)
  if (t < 0.6) return "#f59e0b"; // ambar (destroza / producción)
  if (t < 0.8) return "#10b981"; // esmeralda (zapateras / cuadradores)
  return "#a855f7"; // violeta / púrpura (corona / recorte final)
}

function abreviaturaDetonador(serie?: string, tiempo_ms?: number, zona?: string): string {
  if (serie && serie.includes("MS")) {
    const match = serie.match(/MS\s*(\d+)/i);
    if (match) return `MS${match[1]}`;
  }
  if (serie && serie.includes("LP")) {
    const match = serie.match(/LP\s*(\d+)/i);
    if (match) return `LP${match[1]}`;
  }
  if (zona === "alivio" || tiempo_ms === 0) return "AL";
  if (zona === "cuadrante1") return "C1";
  if (zona === "cuadrante2") return "C2";
  if (zona === "cuadrante3") return "C3";
  if (zona === "cuadrante4") return "C4";
  if (zona === "arrastre") return "AR";
  if (zona === "cuadrador") return "CD";
  if (zona === "corona") return "CO";
  return `${Math.round(tiempo_ms ?? 0)}ms`;
}

export default function PanelVoladura({
  entrada,
  onCambiarEntrada,
  resultado,
  resultadoMalla,
  taladros,
  reproduciendo,
  tiempoActual_ms,
  onPlay,
  onPausar,
  onReiniciar,
  onExportarCSV,
}: Props) {
  const [modoVista, setModoVista] = useState<"3d" | "2d">("2d");
  const set = <K extends keyof EntradaVoladuraUI>(campo: K, valor: EntradaVoladuraUI[K]) =>
    onCambiarEntrada({ ...entrada, [campo]: valor });

  const esTunel = useMemo(() => {
    if (entrada.patronIniciacion.startsWith("tunel_")) return true;
    if (resultado.esTunel) return true;
    if (taladros?.some((t) => t.zona && t.zona !== "banco")) return true;
    if (resultado.cargas?.some((c) => c.zona && c.zona !== "banco")) return true;
    return false;
  }, [entrada.patronIniciacion, resultado, taladros]);

  const duracionTotal = Math.max(resultado.duracionTotalSecuencia_ms, 1);
  const progreso = Math.min(tiempoActual_ms / duracionTotal, 1);

  // Mapear taladros con posiciones 2D reales y metadatos de secuencia
  const itemsTaladros = useMemo(() => {
    if (!resultado.cargas || resultado.cargas.length === 0) return [];
    const mapaCollar = new Map(taladros?.map((t) => [t.id, t.collar]));
    const mapaTaladro = new Map(taladros?.map((t) => [t.id, t]));

    return resultado.cargas.map((carga, idx) => {
      const collar = mapaCollar.get(carga.taladroId);
      const taladroOriginal = mapaTaladro.get(carga.taladroId);
      const x = collar ? collar.x : carga.columna * 3;
      const y = collar ? (esTunel && collar.z !== undefined && collar.z !== 0 ? collar.z : collar.y) : carga.fila * 3;
      const zona = carga.zona || taladroOriginal?.zona || "produccion";
      const serieDetonador = carga.serieDetonador || `${Math.round(carga.tiempoDetonacion_ms)} ms`;

      return {
        id: carga.taladroId,
        x,
        y,
        tiempo_ms: carga.tiempoDetonacion_ms,
        fila: carga.fila,
        columna: carga.columna,
        zona,
        serieDetonador,
        periodo: carga.periodo,
        pesoExplosivo_kg: carga.pesoExplosivo_kg,
        indice: idx + 1,
      };
    });
  }, [resultado.cargas, taladros, esTunel]);

  const CANVAS_W = 320;
  const CANVAS_H = 150;
  const PAD_X = 26;
  const PAD_Y = 22;

  // Proyectar coordenadas a píxeles exactos dentro del lienzo
  const taladrosProyectados = useMemo(() => {
    if (itemsTaladros.length === 0) return [];
    const xs = itemsTaladros.map((t) => t.x);
    const ys = itemsTaladros.map((t) => t.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 0.001);
    const spanY = Math.max(maxY - minY, 0.001);

    const availW = CANVAS_W - PAD_X * 2;
    const availH = CANVAS_H - PAD_Y * 2;

    const scale = Math.min(availW / spanX, availH / spanY);
    const offX = PAD_X + (availW - spanX * scale) / 2;
    const offY = PAD_Y + (availH - spanY * scale) / 2;

    return itemsTaladros.map((t) => {
      const px = offX + (t.x - minX) * scale;
      const py = CANVAS_H - offY - (t.y - minY) * scale;
      return {
        ...t,
        px,
        py,
      };
    });
  }, [itemsTaladros]);

  // Líneas técnicas de enlace de amarre (Tie-In Harness) limpias y sin cruces
  const lineasAmarreProyectadas = useMemo(() => {
    if (taladrosProyectados.length < 2) return [];

    const enlaces: { x1: number; y1: number; x2: number; y2: number; tiempo: number }[] = [];

    if (esTunel) {
      if (entrada.patronIniciacion === "tunel_espiral") {
        // 1. ESPIRAL RADIAL: Un enlace continuo en espiral desde el centro hacia afuera
        const cargados = taladrosProyectados
          .filter((t) => t.zona !== "alivio" && t.tiempo_ms > 0)
          .sort((a, b) => a.tiempo_ms - b.tiempo_ms);

        for (let i = 0; i < cargados.length - 1; i++) {
          enlaces.push({
            x1: cargados[i].px,
            y1: cargados[i].py,
            x2: cargados[i + 1].px,
            y2: cargados[i + 1].py,
            tiempo: cargados[i + 1].tiempo_ms,
          });
        }
        return enlaces;
      }

      // 2. PATRÓN CONCÉNTRICO & CUADRANTES MS/LP:
      // Agrupamos los taladros por su rol estructural en el frente de túnel
      const centroX = taladrosProyectados.reduce((acc, t) => acc + t.px, 0) / taladrosProyectados.length;
      const centroY = taladrosProyectados.reduce((acc, t) => acc + t.py, 0) / taladrosProyectados.length;

      // A. Cuele y Cuadrantes (C1, C2, C3, C4)
      const zonasCuadrantes = ["cuadrante1", "cuadrante2", "cuadrante3", "cuadrante4"];
      let ultimoPuntoCuele: (typeof taladrosProyectados)[0] | null = null;

      for (const z of zonasCuadrantes) {
        const pts = taladrosProyectados.filter((t) => t.zona === z);
        if (pts.length === 0) continue;

        // Ordenar en sentido horario para formar un rombo/cuadrado cerrado limpio
        pts.sort((a, b) => {
          const angA = Math.atan2(a.py - centroY, a.px - centroX);
          const angB = Math.atan2(b.py - centroY, b.px - centroX);
          return angA - angB;
        });

        // Enlazar los 4 puntos del cuadrante en bucle cerrado
        for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          enlaces.push({
            x1: p1.px,
            y1: p1.py,
            x2: p2.px,
            y2: p2.py,
            tiempo: Math.max(p1.tiempo_ms, p2.tiempo_ms),
          });
        }

        // Si hay un cuadrante previo, conectar con un puente corto al mismo ángulo
        if (ultimoPuntoCuele) {
          enlaces.push({
            x1: ultimoPuntoCuele.px,
            y1: ultimoPuntoCuele.py,
            x2: pts[0].px,
            y2: pts[0].py,
            tiempo: pts[0].tiempo_ms,
          });
        }
        ultimoPuntoCuele = pts[0];
      }

      // B. Producción / Destroza (anillo intermedio)
      const ptsProd = taladrosProyectados.filter((t) => t.zona === "produccion");
      if (ptsProd.length > 0) {
        ptsProd.sort((a, b) => {
          const angA = Math.atan2(a.py - centroY, a.px - centroX);
          const angB = Math.atan2(b.py - centroY, b.px - centroX);
          return angA - angB;
        });
        for (let i = 0; i < ptsProd.length; i++) {
          const p1 = ptsProd[i];
          const p2 = ptsProd[(i + 1) % ptsProd.length];
          enlaces.push({
            x1: p1.px,
            y1: p1.py,
            x2: p2.px,
            y2: p2.py,
            tiempo: Math.max(p1.tiempo_ms, p2.tiempo_ms),
          });
        }
        // Puente desde el cuele a la producción
        if (ultimoPuntoCuele && ptsProd.length > 0) {
          enlaces.push({
            x1: ultimoPuntoCuele.px,
            y1: ultimoPuntoCuele.py,
            x2: ptsProd[0].px,
            y2: ptsProd[0].py,
            tiempo: ptsProd[0].tiempo_ms,
          });
        }
      }

      // C. Arrastres / Zapateras (Piso) -> Orden estricto de izquierda a derecha por PX
      const ptsArrastre = taladrosProyectados.filter((t) => t.zona === "arrastre");
      if (ptsArrastre.length > 1) {
        ptsArrastre.sort((a, b) => a.px - b.px);
        for (let i = 0; i < ptsArrastre.length - 1; i++) {
          enlaces.push({
            x1: ptsArrastre[i].px,
            y1: ptsArrastre[i].py,
            x2: ptsArrastre[i + 1].px,
            y2: ptsArrastre[i + 1].py,
            tiempo: Math.max(ptsArrastre[i].tiempo_ms, ptsArrastre[i + 1].tiempo_ms),
          });
        }
      }

      // D. Cuadradores / Hastiales (Izquierdo y Derecho por separado)
      const ptsCuadrador = taladrosProyectados.filter((t) => t.zona === "cuadrador");
      const cuadradorIzq = ptsCuadrador.filter((t) => t.px < centroX).sort((a, b) => b.py - a.py); // De abajo hacia arriba
      const cuadradorDer = ptsCuadrador.filter((t) => t.px >= centroX).sort((a, b) => b.py - a.py); // De abajo hacia arriba

      if (cuadradorIzq.length > 1) {
        for (let i = 0; i < cuadradorIzq.length - 1; i++) {
          enlaces.push({
            x1: cuadradorIzq[i].px,
            y1: cuadradorIzq[i].py,
            x2: cuadradorIzq[i + 1].px,
            y2: cuadradorIzq[i + 1].py,
            tiempo: Math.max(cuadradorIzq[i].tiempo_ms, cuadradorIzq[i + 1].tiempo_ms),
          });
        }
      }
      if (cuadradorDer.length > 1) {
        for (let i = 0; i < cuadradorDer.length - 1; i++) {
          enlaces.push({
            x1: cuadradorDer[i].px,
            y1: cuadradorDer[i].py,
            x2: cuadradorDer[i + 1].px,
            y2: cuadradorDer[i + 1].py,
            tiempo: Math.max(cuadradorDer[i].tiempo_ms, cuadradorDer[i + 1].tiempo_ms),
          });
        }
      }

      // E. Corona (Techo / Bóveda) -> Orden de izquierda a derecha a lo largo del arco
      const ptsCorona = taladrosProyectados.filter((t) => t.zona === "corona");
      if (ptsCorona.length > 1) {
        ptsCorona.sort((a, b) => a.px - b.px);
        for (let i = 0; i < ptsCorona.length - 1; i++) {
          enlaces.push({
            x1: ptsCorona[i].px,
            y1: ptsCorona[i].py,
            x2: ptsCorona[i + 1].px,
            y2: ptsCorona[i + 1].py,
            tiempo: Math.max(ptsCorona[i].tiempo_ms, ptsCorona[i + 1].tiempo_ms),
          });
        }
      }

      // F. Troncales de alimentación limpias hacia la periferia (sin cruces)
      if (ptsArrastre.length > 0 && ultimoPuntoCuele) {
        const arrastreMedio = ptsArrastre[Math.floor(ptsArrastre.length / 2)];
        enlaces.push({
          x1: ultimoPuntoCuele.px,
          y1: ultimoPuntoCuele.py,
          x2: arrastreMedio.px,
          y2: arrastreMedio.py,
          tiempo: arrastreMedio.tiempo_ms,
        });
      }
      if (ptsCorona.length > 0 && ultimoPuntoCuele) {
        const coronaCima = ptsCorona[Math.floor(ptsCorona.length / 2)];
        enlaces.push({
          x1: ultimoPuntoCuele.px,
          y1: ultimoPuntoCuele.py,
          x2: coronaCima.px,
          y2: coronaCima.py,
          tiempo: coronaCima.tiempo_ms,
        });
      }
      if (cuadradorIzq.length > 0 && ultimoPuntoCuele) {
        const izqMedio = cuadradorIzq[Math.floor(cuadradorIzq.length / 2)];
        enlaces.push({
          x1: ultimoPuntoCuele.px,
          y1: ultimoPuntoCuele.py,
          x2: izqMedio.px,
          y2: izqMedio.py,
          tiempo: izqMedio.tiempo_ms,
        });
      }
      if (cuadradorDer.length > 0 && ultimoPuntoCuele) {
        const derMedio = cuadradorDer[Math.floor(cuadradorDer.length / 2)];
        enlaces.push({
          x1: ultimoPuntoCuele.px,
          y1: ultimoPuntoCuele.py,
          x2: derMedio.px,
          y2: derMedio.py,
          tiempo: derMedio.tiempo_ms,
        });
      }

      return enlaces;
    }

    // TAJO ABIERTO / BANCOS (fila por fila, echelon, corte en V)
    const ordenados = [...taladrosProyectados].sort((a, b) => a.tiempo_ms - b.tiempo_ms);
    for (let i = 0; i < ordenados.length - 1; i++) {
      enlaces.push({
        x1: ordenados[i].px,
        y1: ordenados[i].py,
        x2: ordenados[i + 1].px,
        y2: ordenados[i + 1].py,
        tiempo: ordenados[i + 1].tiempo_ms,
      });
    }

    return enlaces;
  }, [taladrosProyectados, esTunel, entrada.patronIniciacion]);

  const detonadosCount = itemsTaladros.filter((t) => tiempoActual_ms >= t.tiempo_ms).length;

  // Fase actual de detonación en palabras para telemetría
  const faseActual = useMemo(() => {
    if (tiempoActual_ms <= 0) return "Preparado (0 ms)";
    if (!esTunel) return `Frente activo (${tiempoActual_ms.toFixed(0)} ms)`;
    if (tiempoActual_ms <= 35) return "⚡ Fase 1: Cuele / Arranque (MS 1)";
    if (tiempoActual_ms <= 120) return "⚡ Fase 2: Ayudas / Cuadrantes (MS 2-4)";
    if (tiempoActual_ms <= 400) return "⚡ Fase 3: Producción / Destroza (MS 6-10)";
    if (tiempoActual_ms <= 680) return "⚡ Fase 4: Arrastres / Zapateras (LP 1-2)";
    if (tiempoActual_ms <= 880) return "⚡ Fase 5: Cuadradores / Hastiales (LP 3-4)";
    return "⚡ Fase 6: Corona / Smooth Blasting (LP 5)";
  }, [tiempoActual_ms, esTunel]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* 1. Secuencia de Iniciación */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#f97316", background: "rgba(249,115,22,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span>Secuencia de Iniciación {esTunel ? "(Túnel)" : "(Banco)"}</span>
          </div>
          <span
            className="panel-seccion-badge"
            style={{
              background: esTunel ? "rgba(56,189,248,0.15)" : "rgba(249,115,22,0.15)",
              color: esTunel ? "#38bdf8" : "#f97316",
              border: `1px solid ${esTunel ? "rgba(56,189,248,0.3)" : "rgba(249,115,22,0.3)"}`,
            }}
          >
            {esTunel ? "Subterráneo MS/LP" : "Tajo Abierto"}
          </span>
        </div>
        <div className="panel-seccion-body">
          <div className="campo">
            <label>Patrón de amarre</label>
            <select
              value={entrada.patronIniciacion}
              onChange={(e) => {
                set("patronIniciacion", e.target.value as PatronIniciacion);
                onReiniciar();
              }}
            >
              {esTunel
                ? OPCIONES_PATRON_TUNEL.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.etiqueta}
                    </option>
                  ))
                : OPCIONES_PATRON_BANCO.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.etiqueta}
                    </option>
                  ))}
            </select>
          </div>

          {!esTunel && (
            <div className="fila-dos">
              <div className="campo">
                <label>Retardo entre filas (ms/m)</label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={entrada.msPorMetroBurden}
                  onChange={(e) => set("msPorMetroBurden", Number(e.target.value))}
                />
              </div>
              <div className="campo">
                <label>Retardo entre taladros (ms/m)</label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  disabled={entrada.patronIniciacion === "fila_por_fila"}
                  value={entrada.msPorMetroEspaciamiento}
                  onChange={(e) => set("msPorMetroEspaciamiento", Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {esTunel && (
            <div style={{ fontSize: 11, color: "var(--texto-tenue)", lineHeight: 1.4, padding: "4px 0" }}>
              💡 {OPCIONES_PATRON_TUNEL.find((p) => p.valor === entrada.patronIniciacion)?.desc || "Secuencia técnica concéntrica por zonas geomecánicas."}
            </div>
          )}
        </div>
      </div>

      {/* 2. Carga y Factor de Carga */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#10b981", background: "rgba(16,185,129,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </span>
            <span>Carga y Factor de Carga</span>
          </div>
          <span className="panel-seccion-badge" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
            {resultado.cargas.length} taladros
          </span>
        </div>
        <div className="panel-seccion-body">
          <div className="resultados">
            <div className="dato dato-destacado">
              <span>Factor de carga</span>
              <b style={{ color: "#10b981" }}>{resultado.factorCarga_kgm3.toFixed(2)} kg/m³</b>
            </div>
            <div className="dato dato-destacado">
              <span>Peso total explosivo</span>
              <b style={{ color: "#f97316" }}>{resultado.pesoExplosivoTotal_kg.toFixed(0)} kg</b>
            </div>
            <div className="dato">
              <span>Carga lineal</span>
              <b>{resultado.cargaLineal_kgm.toFixed(2)} kg/m</b>
            </div>
            <div className="dato">
              <span>Volumen de disparo</span>
              <b>{resultado.volumenRocaTotal_m3.toFixed(0)} m³</b>
            </div>
            <div className="dato">
              <span>Duración secuencia</span>
              <b style={{ color: "#38bdf8" }}>{resultado.duracionTotalSecuencia_ms.toFixed(0)} ms</b>
            </div>
            <div className="dato">
              <span>Tipo de labor</span>
              <b style={{ color: esTunel ? "#38bdf8" : "#f97316" }}>{esTunel ? "Túnel / Galería" : "Banco / Tajo"}</b>
            </div>
          </div>
          {resultado.advertencias.length > 0 && (
            <div className="advertencias">
              {resultado.advertencias.map((a, i) => (
                <div className="advertencia" key={i}>
                  ⚠ {a}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Simulación Interactiva 3D/2D de Secuencia */}
      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span className="seccion-icon-pill" style={{ color: "#f97316", background: "rgba(249,115,22,0.15)" }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <span>Simulación de Detonación</span>
          </div>

          {/* Selector de modo 3D / 2D */}
          <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(15,23,42,0.7)", borderRadius: "6px", padding: "2px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              type="button"
              onClick={() => setModoVista("2d")}
              style={{
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 700,
                borderRadius: "4px",
                background: modoVista === "2d" ? "linear-gradient(135deg, #0284c7, #0369a1)" : "transparent",
                color: modoVista === "2d" ? "#ffffff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
                boxShadow: modoVista === "2d" ? "0 2px 6px rgba(2,132,199,0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              2D Frente / Amarre
            </button>
            <button
              type="button"
              onClick={() => setModoVista("3d")}
              style={{
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 700,
                borderRadius: "4px",
                background: modoVista === "3d" ? "linear-gradient(135deg, #f97316, #ea580c)" : "transparent",
                color: modoVista === "3d" ? "#ffffff" : "var(--texto-tenue)",
                border: "none",
                cursor: "pointer",
                boxShadow: modoVista === "3d" ? "0 2px 6px rgba(249,115,22,0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              🧊 3D Colapso
            </button>
          </div>
        </div>

        <div className="panel-seccion-body">
          {modoVista === "3d" ? (
            /* Mini Visor 3D Interactivo de Voladura y Colapso */
            <div
              className="simulacion-3d-container"
              style={{
                position: "relative",
                width: "100%",
                height: "190px",
                background: "#080c14",
                border: "1px solid rgba(249, 115, 22, 0.4)",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "10px",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.9), 0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              {/* HUD Superior 3D */}
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 10,
                  right: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94a3b8",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fb923c" }}>
                  <span className="pulse-dot" style={{ background: "#fb923c", width: 6, height: 6 }} />
                  3D FÍSICA: {tiempoActual_ms.toFixed(0)} ms
                </span>
                <span
                  style={{
                    background: "rgba(15,23,42,0.8)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(249,115,22,0.3)",
                    color: "#f97316",
                  }}
                >
                  {detonadosCount} / {itemsTaladros.length} Detonados
                </span>
              </div>

              {/* HUD Inferior - Instrucción de cámara 3D */}
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 10,
                  fontSize: 9,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.4)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                🖱 Arrastra para rotar cámara 3D
              </div>

              <MiniVisor3DVoladura
                resultadoVoladura={resultado}
                resultadoMalla={resultadoMalla}
                taladros={taladros}
                tiempoActual_ms={tiempoActual_ms}
              />
            </div>
          ) : (
            /* Lienzo 2D Interactivo de la Detonación y Red de Amarre */
            <div
              className="simulacion-2d-container"
              style={{
                position: "relative",
                width: "100%",
                height: "185px",
                background: "radial-gradient(ellipse at center, rgba(14,22,38,0.98) 0%, rgba(6,10,18,0.98) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "10px",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8), 0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              {/* HUD de Telemetría sobre el Lienzo 2D */}
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 8,
                  right: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "#94a3b8",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#38bdf8" }}>
                  <span className="pulse-dot" style={{ background: "#38bdf8", width: 5, height: 5 }} />
                  {faseActual}
                </span>
                <span
                  style={{
                    background: "rgba(15,23,42,0.85)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(56,189,248,0.3)",
                    color: "#38bdf8",
                  }}
                >
                  {detonadosCount} / {itemsTaladros.length} taladros
                </span>
              </div>

              <svg
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              >
                <defs>
                  {/* Cuadrícula de fondo */}
                  <pattern id="grid-voladura-mini" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
                  </pattern>
                  {/* Gradiente de onda expansiva */}
                  <radialGradient id="grad-onda-mini">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="35%" stopColor="#ffedd5" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#f97316" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <rect
                  x="0"
                  y="0"
                  width={CANVAS_W}
                  height={CANVAS_H}
                  fill="url(#grid-voladura-mini)"
                />

                {/* 1. Líneas de Amarre / Cuerdas de detonación técnicas */}
                {lineasAmarreProyectadas.map((lin, idx) => {
                  const encendida = tiempoActual_ms >= lin.tiempo;
                  return (
                    <line
                      key={`amarre-${idx}`}
                      x1={lin.x1}
                      y1={lin.y1}
                      x2={lin.x2}
                      y2={lin.y2}
                      stroke={encendida ? "#fb923c" : "rgba(255,255,255,0.22)"}
                      strokeWidth={encendida ? 1.7 : 1.1}
                      strokeDasharray={encendida ? undefined : "3,3"}
                      opacity={encendida ? 0.95 : 0.5}
                    />
                  );
                })}

                {/* 2. Taladros con estados interactivos de detonación */}
                {taladrosProyectados.map((t) => {
                  const colorBase = colorPorRetardo(t.tiempo_ms, duracionTotal);
                  const detonado = tiempoActual_ms >= t.tiempo_ms;
                  const deltaTiempo = tiempoActual_ms - t.tiempo_ms;
                  const detonandoAhora = deltaTiempo >= 0 && deltaTiempo <= Math.max(duracionTotal * 0.08, 50);
                  const esAlivio = t.zona === "alivio" || t.pesoExplosivo_kg === 0;

                  // Si ya detonó y pasó la onda, desvanecer
                  const opacidadRestante = detonado ? Math.max(0.18, 1 - deltaTiempo / 200) : 1;
                  const etiquetaSerie = abreviaturaDetonador(t.serieDetonador, t.tiempo_ms, t.zona);

                  return (
                    <g
                      key={t.id}
                      transform={`translate(${t.px}, ${t.py})`}
                      style={{ opacity: opacidadRestante, transition: "opacity 0.12s ease-out" }}
                    >
                      {/* Anillo de Onda Expansiva (Flash de detonación) */}
                      {detonandoAhora && !esAlivio && (
                        <>
                          <circle
                            r={15}
                            fill="url(#grad-onda-mini)"
                            opacity={0.9}
                          />
                          <circle
                            r={12}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={1.4}
                            opacity={0.95}
                          />
                        </>
                      )}

                      {/* Cuerpo del Taladro */}
                      {esAlivio ? (
                        // Taladro de Alivio (hueco vacío sin carga con doble anillo)
                        <>
                          <circle
                            r={6}
                            fill="rgba(8,12,20,0.8)"
                            stroke="#38bdf8"
                            strokeWidth={1.2}
                            strokeDasharray="2,2"
                          />
                          <circle
                            r={3}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth={0.8}
                          />
                        </>
                      ) : detonado ? (
                        <>
                          <circle
                            r={4.5}
                            fill="#0f172a"
                            stroke="#f97316"
                            strokeWidth={1}
                          />
                          <circle
                            r={1.8}
                            fill="#ea580c"
                          />
                        </>
                      ) : (
                        <>
                          <circle
                            r={4.8}
                            fill="rgba(15, 23, 42, 0.9)"
                            stroke={colorBase}
                            strokeWidth={1.2}
                          />
                          <circle
                            r={2}
                            fill={colorBase}
                          />
                        </>
                      )}

                      {/* Etiqueta Superior: Tiempo en ms */}
                      {!detonado && (
                        <text
                          y={-6}
                          textAnchor="middle"
                          fontSize="6.5"
                          fontWeight="700"
                          fill={colorBase}
                          style={{ userSelect: "none", pointerEvents: "none" }}
                        >
                          {Math.round(t.tiempo_ms)}ms
                        </text>
                      )}

                      {/* Etiqueta Inferior: Serie de detonador / Código de zona */}
                      {!detonado && (
                        <text
                          y={9}
                          textAnchor="middle"
                          fontSize="5.8"
                          fontWeight="700"
                          fill="rgba(255,255,255,0.75)"
                          style={{ userSelect: "none", pointerEvents: "none" }}
                        >
                          {etiquetaSerie}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Barra de progreso y Controles */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--texto-tenue)", marginBottom: 4 }}>
            <span>Progreso: {(progreso * 100).toFixed(0)}%</span>
            <span>Tiempo: {tiempoActual_ms.toFixed(0)} / {resultado.duracionTotalSecuencia_ms.toFixed(0)} ms</span>
          </div>
          <div className="barra-progreso" style={{ height: 8, borderRadius: 4, background: "rgba(15,23,42,0.8)", border: "1px solid var(--borde)", overflow: "hidden", marginBottom: 12 }}>
            <div
              className="barra-progreso-relleno"
              style={{
                width: `${progreso * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #38bdf8 0%, #f97316 100%)",
                boxShadow: "0 0 8px rgba(249,115,22,0.6)",
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <div className="acciones" style={{ marginBottom: 0 }}>
            {!reproduciendo ? (
              <button className="btn btn-primario" type="button" onClick={onPlay}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Reproducir</span>
              </button>
            ) : (
              <button className="btn btn-primario" type="button" onClick={onPausar}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                <span>Pausar</span>
              </button>
            )}
            <button className="btn" type="button" onClick={onReiniciar} title="Reiniciar animación">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>Reiniciar</span>
            </button>
            <button className="btn" type="button" onClick={onExportarCSV} title="Exportar secuencia en CSV">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
