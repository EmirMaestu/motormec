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

/** Genera un presupuesto en PDF con la marca del taller y los colores de Momec. */
export async function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  const { quote } = input;
  const currency: Currency = input.currency ?? "ARS";
  /** Formatea centavos con la moneda del taller (ej. 123456 → "$ 1.235"). */
  const money = (cents: number): string => formatArs(cents, currency);
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 40;

  /* --- Banda superior (verde bosque) con logo/nombre + N° --- */
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

  /* --- Tabla de ítems --- */
  const cCant = width - 250;
  const cPrecio = width - 150;
  const cSub = width - M;
  page.drawRectangle({ x: M - 4, y: y - 7, width: width - 2 * (M - 4), height: 22, color: SAGE });
  page.drawText("DETALLE", { x: M, y, size: 9, font: bold, color: FOREST });
  drawRight(page, "CANT.", cCant + 34, y, 9, bold, FOREST);
  drawRight(page, "PRECIO", cPrecio + 40, y, 9, bold, FOREST);
  drawRight(page, "SUBTOTAL", cSub, y, 9, bold, FOREST);
  y -= 24;

  const maxItems = 24; // una página; el resto se resume
  const shown = quote.items.slice(0, maxItems);
  for (const it of shown) {
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
  if (quote.items.length > maxItems) {
    page.drawText(`… y ${quote.items.length - maxItems} ítem(s) más`, {
      x: M,
      y,
      size: 9,
      font,
      color: MUTED,
    });
    y -= 18;
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

  y -= 10;
  const breakdown: Array<[string, string]> = [["Subtotal", money(subtotal)]];
  if (discount > 0) breakdown.push(["Descuento", `- ${money(discount)}`]);
  if (taxRate > 0) breakdown.push([`IVA (${taxRate / 100}%)`, money(taxAmount)]);
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

  /* --- Observaciones --- */
  if (quote.notes) {
    page.drawText("Observaciones", { x: M, y, size: 10, font: bold, color: FOREST });
    y -= 15;
    for (const line of wrap(quote.notes, font, 10, width - 2 * M).slice(0, 6)) {
      page.drawText(line, { x: M, y, size: 10, font, color: INK });
      y -= 14;
    }
  }

  /* --- Pie: hecho con Momec --- */
  const footY = 46;
  page.drawLine({
    start: { x: M, y: footY + 18 },
    end: { x: width - M, y: footY + 18 },
    thickness: 0.5,
    color: HAIRLINE,
  });
  const foot = "Presupuesto generado con Momec   ·   momec.pro";
  page.drawText(foot, {
    x: (width - font.widthOfTextAtSize(foot, 9)) / 2,
    y: footY,
    size: 9,
    font,
    color: MUTED,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
