/** Genera un CSV simple (separador coma, punto decimal) a partir de filas de objetos planos. */
export function generarCSV(filas: Array<Record<string, string | number>>, columnas: string[]): string {
  const encabezado = columnas.join(",");
  const cuerpo = filas.map((fila) =>
    columnas
      .map((c) => {
        const valor = fila[c];
        if (typeof valor === "number") return Number.isFinite(valor) ? valor.toFixed(4) : "0";
        const texto = String(valor ?? "");
        return texto.includes(",") ? `"${texto.replace(/"/g, '""')}"` : texto;
      })
      .join(",")
  );
  return [encabezado, ...cuerpo].join("\n");
}
