import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { QuoteItem } from "../db/schema.js";
import { formatArs, type Currency } from "../lib/money.js";

/* Paleta Momec */
const FOREST = rgb(4 / 255, 63 / 255, 46 / 255);
const LIME = rgb(200 / 255, 241 / 255, 105 / 255);
const INK = rgb(0.06, 0.1, 0.09);
const MUTED = rgb(0.42, 0.45, 0.44);
const HAIRLINE = rgb(0.88, 0.88, 0.86);
const SAGE = rgb(0.93, 0.95, 0.89);
const WHITE = rgb(1, 1, 1);

export interface QuotePdfInput {
  tallerNombre: string;
  header?: { phone?: string; address?: string; email?: string } | null;
  logo?: { bytes: Buffer; mime: string } | null;
  /** Moneda del taller para todos los montos del PDF (default "ARS"). */
  currency?: Currency;
  quote: {
    number: number;
    customerName: string;
    customerPhone?: string | null;
    vehiclePlate?: string | null;
    vehicleInfo?: string | null;
    items: QuoteItem[];
    subtotal?: number;
    discountAmount?: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
    validUntil?: string | null;
    notes?: string | null;
    createdAt: string | Date;
  };
}

function drawRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
): void {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}

/** Trunca un texto para que quepa en `maxWidth` (agrega … si hace falta). */
function ellipsize(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Genera un presupuesto en PDF con la marca del taller y los colores de Momec.
 * Multipágina: si los ítems (u observaciones) no entran en una hoja, sigue en
 * la siguiente repitiendo el encabezado de columnas. Nada se recorta. */
export async function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  const { quote } = input;
  const currency: Currency = input.currency ?? "ARS";
  /** Formatea centavos con la moneda del taller (ej. 123456 → "$ 1.235"). */
  const money = (cents: number): string => formatArs(cents, currency);
  const doc = await PDFDocument.create();
  const A4: [number, number] = [595.28, 841.89];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 40;
  const [width, height] = A4;

  const cCant = width - 250;
  const cPrecio = width - 150;
  const cSub = width - M;
  const FOOT_Y = 46;
  const BOTTOM = 78; // los contenidos no bajan de acá (arriba del pie)

  /* Pie "hecho con Momec" (en TODAS las páginas). */
  function drawFooter(p: PDFPage): void {
    p.drawLine({
      start: { x: M, y: FOOT_Y + 18 },
      end: { x: width - M, y: FOOT_Y + 18 },
      thickness: 0.5,
      color: HAIRLINE,
    });
    const foot = "Presupuesto generado con Momec   ·   momec.pro";
    p.drawText(foot, {
      x: (width - font.widthOfTextAtSize(foot, 9)) / 2,
      y: FOOT_Y,
      size: 9,
      font,
      color: MUTED,
    });
  }

  /* Encabezado de columnas de la tabla; devuelve la `y` de la primera fila. */
  function drawItemsHeader(p: PDFPage, top: number): number {
    p.drawRectangle({ x: M - 4, y: top - 7, width: width - 2 * (M - 4), height: 22, color: SAGE });
    p.drawText("DETALLE", { x: M, y: top, size: 9, font: bold, color: FOREST });
    drawRight(p, "CANT.", cCant + 34, top, 9, bold, FOREST);
    drawRight(p, "PRECIO", cPrecio + 40, top, 9, bold, FOREST);
    drawRight(p, "SUBTOTAL", cSub, top, 9, bold, FOREST);
    return top - 24;
  }

  /* Banda superior slim para páginas de continuación; devuelve la `y` inicial. */
  function drawContHeader(p: PDFPage): number {
    const hH = 44;
    p.drawRectangle({ x: 0, y: height - hH, width, height: hH, color: FOREST });
    p.drawText(ellipsize(input.tallerNombre || "Taller", bold, 13, width - 2 * M - 160), {
      x: M,
      y: height - 28,
      size: 13,
      font: bold,
      color: WHITE,
    });
    drawRight(p, `Presupuesto #${quote.number} (cont.)`, width - M, height - 28, 10, font, LIME);
    return height - hH - 28;
  }

  let page = doc.addPage(A4);
  drawFooter(page);

  /* --- Banda superior (verde bosque) con logo/nombre + N° (página 1) --- */
  const headerH = 96;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: FOREST });

  let nameX = M;
  if (input.logo) {
    try {
      const img = input.logo.mime.includes("png")
        ? await doc.embedPng(input.logo.bytes)
        : await doc.embedJpg(input.logo.bytes);
      const scale = Math.min(1, 56 / img.height, 150 / img.width);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: M, y: height - headerH / 2 - h / 2, width: w, height: h });
      nameX = M + w + 16;
    } catch {
      /* logo inválido → seguimos con el nombre */
    }
  }
  page.drawText(ellipsize(input.tallerNombre || "Taller", bold, 20, width - nameX - 150), {
    x: nameX,
    y: height - 50,
    size: 20,
    font: bold,
    color: WHITE,
  });
  const contacto = [input.header?.phone, input.header?.address, input.header?.email]
    .filter(Boolean)
    .join("   ·   ");
  if (contacto) {
    page.drawText(ellipsize(contacto, font, 9, width - nameX - 150), {
      x: nameX,
      y: height - 68,
      size: 9,
      font,
      color: LIME,
    });
  }
  drawRight(page, "PRESUPUESTO", width - M, height - 44, 11, bold, LIME);
  drawRight(page, `#${quote.number}`, width - M, height - 72, 22, bold, WHITE);

  /* --- Cliente / fecha / vehículo --- */
  let y = height - headerH - 34;
  page.drawText(
    `Cliente: ${quote.customerName || "—"}${quote.customerPhone ? "   ·   " + quote.customerPhone : ""}`,
    { x: M, y, size: 11, font: bold, color: INK },
  );
  const fecha = new Date(quote.createdAt).toLocaleDateString("es-AR");
  drawRight(page, `Fecha: ${fecha}`, width - M, y, 10, font, MUTED);
  y -= 16;
  const veh = [quote.vehicleInfo, quote.vehiclePlate].filter(Boolean).join("   ·   ");
  if (veh) page.drawText(`Vehículo: ${veh}`, { x: M, y, size: 11, font, color: INK });
  if (quote.validUntil) drawRight(page, `Válido hasta ${quote.validUntil}`, width - M, y, 10, font, MUTED);
  y -= 26;

  /* Salta a una página nueva si no queda `space` px por encima del pie. */
  const ensure = (space: number, contHeader = true): void => {
    if (y - space >= BOTTOM) return;
    page = doc.addPage(A4);
    drawFooter(page);
    y = contHeader ? drawContHeader(page) : height - 40;
  };

  /* --- Tabla de ítems (todos; pagina si hace falta) --- */
  y = drawItemsHeader(page, y);
  for (const it of quote.items) {
    if (y - 22 < BOTTOM) {
      ensure(0);
      y = drawItemsHeader(page, y);
    }
    const sub = (it.quantity || 0) * (it.unitPrice || 0);
    page.drawText(ellipsize(it.description, font, 11, cCant - M - 10), {
      x: M,
      y,
      size: 11,
      font,
      color: INK,
    });
    drawRight(page, String(it.quantity), cCant + 34, y, 11, font, INK);
    drawRight(page, money(it.unitPrice), cPrecio + 40, y, 11, font, INK);
    drawRight(page, money(sub), cSub, y, 11, font, INK);
    y -= 8;
    page.drawLine({ start: { x: M - 4, y }, end: { x: cSub, y }, thickness: 0.5, color: HAIRLINE });
    y -= 14;
  }

  /* --- Desglose: Subtotal / Descuento / IVA --- */
  const boxW = 210;
  const boxX = width - M - boxW;
  const labelX = boxX + 16;
  const valueX = boxX + boxW - 16;
  const discount = quote.discountAmount ?? 0;
  const taxRate = quote.taxRate ?? 0;
  const taxAmount = quote.taxAmount ?? 0;
  // Subtotal: usar el guardado o, si no vino, sumarlo desde los ítems (bot legacy).
  const subtotal =
    quote.subtotal ??
    quote.items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);

  const breakdown: Array<[string, string]> = [["Subtotal", money(subtotal)]];
  if (discount > 0) breakdown.push(["Descuento", `- ${money(discount)}`]);
  if (taxRate > 0) breakdown.push([`IVA (${taxRate / 100}%)`, money(taxAmount)]);

  // El desglose + el recuadro de total deben quedar juntos en la misma página.
  ensure(10 + breakdown.length * 16 + 2 + 36 + 10);
  y -= 10;
  for (const [label, value] of breakdown) {
    page.drawText(label, { x: labelX, y, size: 10, font, color: MUTED });
    drawRight(page, value, valueX, y, 10, font, INK);
    y -= 16;
  }

  /* --- Total (recuadro chartreuse) --- */
  y -= 2;
  const boxH = 36;
  const boxY = y - boxH;
  page.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, color: LIME });
  page.drawText("TOTAL", { x: boxX + 16, y: boxY + boxH / 2 - 5, size: 12, font: bold, color: FOREST });
  drawRight(page, money(quote.total), boxX + boxW - 16, boxY + boxH / 2 - 6, 16, bold, INK);
  y = boxY - 28;

  /* --- Observaciones (completas; paginan si hace falta) --- */
  if (quote.notes) {
    const lines = wrap(quote.notes, font, 10, width - 2 * M);
    ensure(15 + lines.length * 14 + 6);
    page.drawText("Observaciones", { x: M, y, size: 10, font: bold, color: FOREST });
    y -= 15;
    for (const line of lines) {
      if (y - 14 < BOTTOM) {
        ensure(0);
        y -= 4;
      }
      page.drawText(line, { x: M, y, size: 10, font, color: INK });
      y -= 14;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
