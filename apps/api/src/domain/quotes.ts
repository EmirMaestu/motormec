import { eq } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import { db } from "../db/client.js";
import {
  customers,
  presupuestos,
  tenants,
  type Presupuesto,
  type QuoteItem,
  type TenantSettings,
} from "../db/schema.js";
import { localDisk } from "../storage/provider.js";
import { renderQuotePdf } from "./quotePdf.js";

export interface CreateQuoteInput {
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  vehiclePlate?: string;
  vehicleInfo?: string;
  items: QuoteItem[];
  discountAmount?: number;
  taxRate?: number;
  notes?: string;
  validUntil?: string;
}

function computeTotals(
  items: QuoteItem[],
  discountAmount = 0,
  taxRate = 0,
): {
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const base = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((base * taxRate) / 10000);
  const total = base + taxAmount;
  return { subtotal, discountAmount, taxRate, taxAmount, total };
}

async function nextNumber(tdb: TenantDb): Promise<number> {
  const rows = await tdb.select(presupuestos);
  return rows.reduce((max, q) => Math.max(max, q.number), 0) + 1;
}

/** Crea un presupuesto (numera por taller, resuelve cliente, calcula totales). */
export async function createQuote(
  tdb: TenantDb,
  actorName: string,
  input: CreateQuoteInput,
): Promise<Presupuesto> {
  let name = input.customerName?.trim() ?? "";
  let phone = input.customerPhone ?? null;
  if (input.customerId) {
    const c = await tdb.findById(customers, input.customerId);
    if (c) {
      name = name || c.name;
      phone = phone || c.phone;
    }
  }
  const { subtotal, discountAmount, taxRate, taxAmount, total } = computeTotals(
    input.items,
    input.discountAmount ?? 0,
    input.taxRate ?? 0,
  );
  return tdb.insertOne(presupuestos, {
    number: await nextNumber(tdb),
    customerId: input.customerId ?? null,
    customerName: name,
    customerPhone: phone,
    vehiclePlate: input.vehiclePlate ?? null,
    vehicleInfo: input.vehicleInfo ?? null,
    items: input.items,
    notes: input.notes ?? null,
    subtotal,
    discountAmount,
    taxRate,
    taxAmount,
    total,
    validUntil: input.validUntil ?? null,
    createdByName: actorName,
  });
}

export async function listQuotes(tdb: TenantDb): Promise<Presupuesto[]> {
  const rows = await tdb.select(presupuestos);
  return rows.sort((a, b) => b.number - a.number);
}

/**
 * Arma el PDF del presupuesto con la marca del taller (nombre + logo + contacto).
 * ÚNICA fuente del PDF: la usan tanto la web como el bot de WhatsApp, así el
 * documento es idéntico en los dos canales.
 */
export async function buildQuotePdf(tenantId: string, quote: Presupuesto): Promise<Buffer> {
  const [row] = await db
    .select({ name: tenants.name, settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  const settings = (row?.settings as TenantSettings | null) ?? {};
  let logo: { bytes: Buffer; mime: string } | null = null;
  const lp = settings.logoPath;
  if (lp && /\.(png|jpe?g)$/i.test(lp)) {
    try {
      const bytes = await localDisk.read(lp);
      logo = { bytes, mime: lp.toLowerCase().endsWith("png") ? "image/png" : "image/jpeg" };
    } catch {
      /* sin logo */
    }
  }
  return renderQuotePdf({
    tallerNombre: row?.name ?? "Taller",
    header: settings.quoteHeader ?? null,
    logo,
    quote,
  });
}
