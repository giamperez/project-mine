import { generarCSV } from "@suite/engine";
import { direccionBuzamientoDesdeRumboRHR } from "@suite/core";
import type { Discontinuidad } from "@suite/core";

/** Texto de ayuda mostrado en el panel de importacion (mismo formato que EXSA/DIPS/OpenStereo). */
export const FORMATO_IMPORTACION_DISCONTINUIDADES =
  "Excel (XLSX), CSV, TSV o TXT con columnas DIP y DIPDIR (o DIRECCION/AZIMUT). " +
  "Tambien admite RUMBO/STRIKE + DIP, convertido con la regla de la mano derecha " +
  "(direccion de buzamiento = rumbo + 90°). Sin encabezado, se asume nombre,dip,dipdireccion.";

function normalizarEncabezado(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quita tildes: "dirección" -> "direccion"
}

function detectarDelimitador(linea: string): string {
  if (linea.includes("\t")) return "\t";
  if (linea.includes(";")) return ";";
  return ",";
}

interface ColumnasDetectadas {
  nombre: number;
  dip: number;
  dipDir: number;
  rumbo: number;
}

/** Busca por nombre de columna (encabezado) los indices de nombre/dip/dipdireccion/rumbo. -1 si no se encuentra. */
function detectarColumnas(encabezado: string[]): ColumnasDetectadas | null {
  const norm = encabezado.map(normalizarEncabezado);
  const buscar = (candidatos: string[]) => norm.findIndex((h) => candidatos.some((c) => h === c || h.includes(c)));

  const dip = buscar(["dip", "buzamiento"]);
  // ojo: "dip" tambien matchea "dipdir"/"dipdireccion" por el .includes() de arriba, asi que dip
  // debe buscarse EXCLUYENDO las columnas que ya matchean direccion/dipdir.
  const dipDir = buscar(["dipdir", "dip_dir", "dipdireccion", "direcciondebuzamiento", "direccion", "azimut", "azimuth"]);
  const dipReal = norm.findIndex((h, i) => i !== dipDir && (h === "dip" || h === "buzamiento" || (h.includes("dip") && !h.includes("dir"))));
  const rumbo = buscar(["rumbo", "strike"]);
  const nombre = buscar(["nombre", "name", "id", "punto", "discontinuidad"]);

  if (dipReal === -1 && dip === -1) return null;
  if (dipDir === -1 && rumbo === -1) return null;
  return { nombre, dip: dipReal !== -1 ? dipReal : dip, dipDir, rumbo };
}

/**
 * Importa discontinuidades desde texto tabular (CSV/TSV/TXT, o Excel ya convertido a CSV por
 * `leerArchivoTabularComoTexto`). Dos modos:
 * - Con encabezado reconocible (fila con "dip"/"dipdir"/"rumbo"/etc.): mapea columnas por nombre,
 *   sin importar el orden, y admite rumbo+dip (regla de la mano derecha) en vez de dip+dipdireccion.
 * - Sin encabezado (compatibilidad con el formato anterior): asume "nombre,dip,dipdireccion".
 */
export function importarDiscontinuidadesDesdeCSV(texto: string): Discontinuidad[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lineas.length === 0) return [];

  const delimitador = detectarDelimitador(lineas[0]);
  const filas = lineas.map((l) => l.split(delimitador).map((p) => p.trim().replace(/^"|"$/g, "")));
  const columnas = detectarColumnas(filas[0]);

  const discontinuidades: Discontinuidad[] = [];
  let contador = 1;

  if (columnas) {
    for (const partes of filas.slice(1)) {
      const dip = Number(partes[columnas.dip]);
      let dipDir: number;
      if (columnas.dipDir !== -1) {
        dipDir = Number(partes[columnas.dipDir]);
      } else {
        const rumbo = Number(partes[columnas.rumbo]);
        if (Number.isNaN(rumbo)) continue;
        dipDir = direccionBuzamientoDesdeRumboRHR(rumbo);
      }
      if (Number.isNaN(dip) || Number.isNaN(dipDir)) continue;
      const nombre = columnas.nombre !== -1 ? partes[columnas.nombre] : "";
      discontinuidades.push({
        id: `D-${contador}`,
        nombre: nombre || `D-${contador}`,
        dip_grados: dip,
        dipDirection_grados: dipDir,
      });
      contador++;
    }
    return discontinuidades;
  }

  // Sin encabezado reconocible: formato historico nombre,dip,dipdireccion (retrocompatibilidad).
  for (const partes of filas) {
    if (partes.length < 3) continue;
    const dip = Number(partes[1]);
    const dipDir = Number(partes[2]);
    if (Number.isNaN(dip) || Number.isNaN(dipDir)) continue;
    discontinuidades.push({ id: `D-${contador}`, nombre: partes[0] || `D-${contador}`, dip_grados: dip, dipDirection_grados: dipDir });
    contador++;
  }
  return discontinuidades;
}

export function exportarDiscontinuidadesCSV(discontinuidades: Discontinuidad[]): string {
  const columnas = ["nombre", "dip_grados", "dipDirection_grados"];
  const filas = discontinuidades.map((d) => ({
    nombre: d.nombre,
    dip_grados: d.dip_grados,
    dipDirection_grados: d.dipDirection_grados,
  }));
  return generarCSV(filas, columnas);
}
