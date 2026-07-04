/**
 * Serialización de CSV segura contra "CSV formula injection": una celda que
 * empieza con = + - @ (o tab / CR) puede ejecutarse como fórmula en Excel/Sheets.
 * Prefijamos esas celdas con una comilla simple y aplicamos escaping RFC-4180.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (FORMULA_START.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s) || s.startsWith("'")) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}
