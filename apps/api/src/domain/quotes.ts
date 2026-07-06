import { and, eq, isNull } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import { db } from "../db/client.js";
import {
  customers,
  presupuestos,
  tenants,
  workOrders,
  type Presupuesto,
  type QuoteItem,
  type TenantSettings,
  type WorkOrder,
} from "../db/schema.js";
import { localDisk } from "../storage/provider.js";
import { renderQuotePdf } from "./quotePdf.js";
import { createOrder } from "./orders.js";
import type { Actor } from "./movements.js";

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
    currency: settings.currency ?? "ARS",
    quote,
  });
}

/** Se lanza al intentar convertir un presupuesto que ya tiene orden. */
export class QuoteAlreadyConvertedError extends Error {
  constructor(public readonly workOrderId?: string) {
    super("El presupuesto ya fue convertido en orden");
    this.name = "QuoteAlreadyConvertedError";
  }
}

export interface ConvertQuoteResult {
  order: WorkOrder;
  quote: Presupuesto;
}

/**
 * Convierte un presupuesto aprobado en una orden de trabajo (PAY-5).
 *
 * Reusa `createOrder`, que resuelve/crea el vehículo (por patente) y el cliente
 * (por nombre) y recalcula los totales — así el total de la orden queda idéntico
 * al del presupuesto. Los ítems del presupuesto entran como repuestos NO de
 * inventario (el presupuesto no separa mano de obra); se pueden reclasificar en
 * la orden. El presupuesto queda `aceptado` con `workOrderId` mediante un claim
 * atómico, que impide convertirlo dos veces.
 *
 * Devuelve `null` si el presupuesto no existe; lanza `QuoteAlreadyConvertedError`
 * si ya fue convertido.
 */
export async function convertQuoteToOrder(
  tdb: TenantDb,
  actor: Actor,
  quoteId: string,
): Promise<ConvertQuoteResult | null> {
  const quote = await tdb.findById(presupuestos, quoteId);
  if (!quote) return null;
  if (quote.workOrderId) throw new QuoteAlreadyConvertedError(quote.workOrderId);

  return tdb.transaction(async (tx) => {
    const parts = quote.items.map((i) => ({
      productId: null,
      name: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      fromInventory: false,
    }));

    // El presupuesto guarda la descripción del vehículo como texto ("Marca Modelo");
    // se parte para poder crear el vehículo si la patente es nueva.
    const [brand, ...rest] = (quote.vehicleInfo ?? "").trim().split(/\s+/);
    const order = await createOrder(tx, actor, {
      customerId: quote.customerId,
      customerName: quote.customerName,
      phone: quote.customerPhone ?? undefined,
      plate: quote.vehiclePlate ?? undefined,
      brand: brand || undefined,
      model: rest.join(" ") || undefined,
      parts,
      laborCost: 0,
      discountAmount: quote.discountAmount,
      taxRate: quote.taxRate,
      notes: quote.notes ?? undefined,
    });

    // Sin patente no hay vehículo vinculado: preservar la descripción en la orden.
    if (!order.vehicleId && quote.vehicleInfo) {
      await tx.updateById(workOrders, order.id, { vehicleInfo: quote.vehicleInfo });
      order.vehicleInfo = quote.vehicleInfo;
    }

    // Claim atómico: marcar aceptado sólo si sigue sin orden (guard anti doble
    // conversión). Si otra conversión ganó, esto no matchea y hacemos ROLLBACK.
    const claimed = await tx.update(
      presupuestos,
      { status: "aceptado", workOrderId: order.id },
      and(eq(presupuestos.id, quoteId), isNull(presupuestos.workOrderId)),
    );
    if (claimed.length === 0) throw new QuoteAlreadyConvertedError();

    return { order, quote: claimed[0] as Presupuesto };
  });
}
