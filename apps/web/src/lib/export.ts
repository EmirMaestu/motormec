/** Utilidades de exportación sin dependencias (CSV nativo + print→PDF). */

function escapeCsv(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Descarga un CSV (separador ';' — Excel-AR lo abre en columnas). */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsv).join(";"));
  // BOM para que Excel respete acentos.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Abre un documento imprimible en una ventana nueva y dispara el diálogo de
 * impresión (el usuario elige "Guardar como PDF"). Sin librerías de PDF.
 */
export function printDocument(title: string, innerHtml: string, extraCss = ""): void {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { margin: 18mm; }
      * { box-sizing: border-box; }
      body { font-family: Inter, system-ui, sans-serif; color: #0f1b16; margin: 0; }
      h1,h2,h3 { font-family: Georgia, serif; color: #043f2e; margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #0000001a; }
      th { color: #2a6f2b; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
      .right { text-align: right; }
      .muted { color: #6b7280; font-size: 12px; }
      ${extraCss}
    </style></head><body>${innerHtml}</body></html>`);
  w.document.close();
  w.focus();
  // Dar tiempo a renderizar antes de imprimir.
  setTimeout(() => {
    w.print();
  }, 300);
}

/** Tabla HTML simple para printDocument. */
export function htmlTable(headers: string[], rows: (string | number)[][]): string {
  const head = headers.map((h) => `<th>${h}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${i > 0 ? "right" : ""}">${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
