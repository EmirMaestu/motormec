import type { TenantDb } from "../db/scope.js";
import { customers, presupuestos, type Presupuesto, type QuoteItem } from "../db/schema.js";

export interface CreateQuoteInput {
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  vehiclePlate?: string;
  vehicleInfo?: string;
  items: QuoteItem[];
  notes?: string;
  validUntil?: string;
}

function computeTotals(items: QuoteItem[]): { subtotal: number; total: number } {
  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  return { subtotal, total: subtotal };
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
  const { subtotal, total } = computeTotals(input.items);
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
    total,
    validUntil: input.validUntil ?? null,
    createdByName: actorName,
  });
}

export async function listQuotes(tdb: TenantDb): Promise<Presupuesto[]> {
  const rows = await tdb.select(presupuestos);
  return rows.sort((a, b) => b.number - a.number);
}
