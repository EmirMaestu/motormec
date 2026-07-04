import type { FastifyInstance } from "fastify";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { transactions } from "../db/schema.js";
import { authed, requireRole } from "../auth/middleware.js";

const INCOME_CATEGORIES = [
  "Servicio General",
  "Mantenimiento",
  "Frenos",
  "Motor",
  "Transmisión",
  "Suspensión",
  "Electricidad",
  "Llantas",
  "Carrocería",
  "Aire Acondicionado",
  "Diagnóstico",
  "Venta de Repuestos",
  "Otros",
];
const EXPENSE_CATEGORIES = [
  "Repuestos",
  "Herramientas",
  "Sueldos",
  "Alquiler",
  "Servicios (luz/agua/gas)",
  "Impuestos",
  "Insumos",
  "Marketing",
  "Otros",
];

function enhanceDescription(input: {
  description: string;
  supplier?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
}): string {
  let d = input.description;
  if (input.supplier) d += ` (Persona: ${input.supplier})`;
  if (input.paymentMethod && input.paymentMethod !== "Efectivo")
    d += ` - Pago: ${input.paymentMethod}`;
  if (input.notes) d += ` - Notas: ${input.notes}`;
  return d;
}

const createSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1).max(1000),
  type: z.enum(["Ingreso", "Egreso"]),
  category: z.string().max(120),
  amount: z.number(),
  vehicleId: z.string().uuid().optional().nullable(),
  vehicleDetails: z
    .object({ plate: z.string(), brand: z.string(), model: z.string(), customer: z.string() })
    .optional()
    .nullable(),
  supplier: z.string().max(200).optional(),
  paymentMethod: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
});

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/transactions",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const q = request.query as {
        status?: string;
        type?: string;
        category?: string;
        startDate?: string;
        endDate?: string;
      };
      const conds = [];
      if (q.type === "Ingreso" || q.type === "Egreso")
        conds.push(eq(transactions.type, q.type));
      if (q.category) conds.push(eq(transactions.category, q.category));
      if (q.startDate) conds.push(gte(transactions.date, q.startDate));
      if (q.endDate) conds.push(lte(transactions.date, q.endDate));
      if (q.status === "suspended") conds.push(eq(transactions.active, false));
      else if (q.status !== "all") conds.push(eq(transactions.active, true));
      let rows = await tenantDb.select(
        transactions,
        conds.length ? (and(...conds) as ReturnType<typeof and>) : undefined,
      );
      rows.sort((a, b) => (a.date < b.date ? 1 : -1));
      return reply.send({ transactions: rows });
    },
  );

  app.get(
    "/api/transactions/summary",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const q = request.query as { startDate?: string; endDate?: string };
      const conds = [eq(transactions.active, true)];
      if (q.startDate) conds.push(gte(transactions.date, q.startDate));
      if (q.endDate) conds.push(lte(transactions.date, q.endDate));
      const rows = await tenantDb.select(transactions, and(...conds) as ReturnType<typeof and>);
      const totalIngresos = rows
        .filter((t) => t.type === "Ingreso")
        .reduce((s, t) => s + t.amount, 0);
      const totalEgresos = rows
        .filter((t) => t.type === "Egreso")
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const byCategory = new Map<string, { ingresos: number; egresos: number; total: number; count: number }>();
      for (const t of rows) {
        const e = byCategory.get(t.category) ?? { ingresos: 0, egresos: 0, total: 0, count: 0 };
        if (t.type === "Ingreso") {
          e.ingresos += t.amount;
          e.total += t.amount;
        } else {
          e.egresos += Math.abs(t.amount);
          e.total -= Math.abs(t.amount);
        }
        e.count += 1;
        byCategory.set(t.category, e);
      }
      return reply.send({
        totalIngresos,
        totalEgresos,
        balance: totalIngresos - totalEgresos,
        transactionCount: rows.length,
        averageTransaction: rows.length ? (totalIngresos + totalEgresos) / rows.length : 0,
        categorySummary: [...byCategory.entries()].map(([categoria, v]) => ({ categoria, ...v })),
      });
    },
  );

  app.get(
    "/api/transactions/service-stats",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const q = request.query as { startDate?: string; endDate?: string };
      const conds = [eq(transactions.active, true), eq(transactions.type, "Ingreso")];
      if (q.startDate) conds.push(gte(transactions.date, q.startDate));
      if (q.endDate) conds.push(lte(transactions.date, q.endDate));
      const rows = await tenantDb.select(transactions, and(...conds) as ReturnType<typeof and>);
      const byCat = new Map<string, { total: number; count: number }>();
      for (const t of rows) {
        const e = byCat.get(t.category) ?? { total: 0, count: 0 };
        e.total += t.amount;
        e.count += 1;
        byCat.set(t.category, e);
      }
      const stats = [...byCat.entries()]
        .map(([service, v]) => ({ service, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      return reply.send({ stats });
    },
  );

  app.get(
    "/api/transactions/categories",
    { preHandler: requireRole("admin") },
    async (_request, reply) =>
      reply.send({ income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES }),
  );

  app.get(
    "/api/transactions/used-categories",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const rows = await tenantDb.select(transactions);
      const cats = [...new Set(rows.map((t) => t.category).filter(Boolean))].sort();
      return reply.send({ categories: cats });
    },
  );

  app.post(
    "/api/transactions",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const d = parsed.data;
      const created = await tenantDb.insertOne(transactions, {
        date: d.date,
        description: enhanceDescription(d),
        type: d.type,
        category: d.category,
        amount: d.amount,
        active: true,
        vehicleId: d.vehicleId ?? null,
        vehicleDetails: d.vehicleDetails ?? null,
        supplier: d.supplier ?? null,
        paymentMethod: d.paymentMethod ?? null,
        notes: d.notes ?? null,
      });
      return reply.code(201).send({ transaction: created });
    },
  );

  app.patch(
    "/api/transactions/:id",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const parsed = createSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const existing = await tenantDb.findById(transactions, id);
      if (!existing) return reply.code(404).send({ error: "not_found" });
      const d = parsed.data;
      const patch: Record<string, unknown> = { ...d, updatedAt: new Date() };
      if (d.description !== undefined || d.supplier !== undefined || d.paymentMethod !== undefined || d.notes !== undefined) {
        patch.description = enhanceDescription({
          description: d.description ?? existing.description,
          supplier: d.supplier ?? existing.supplier,
          paymentMethod: d.paymentMethod ?? existing.paymentMethod,
          notes: d.notes ?? existing.notes,
        });
      }
      const updated = await tenantDb.updateById(transactions, id, patch);
      return reply.send({ transaction: updated });
    },
  );

  app.post(
    "/api/transactions/:id/suspend",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const updated = await tenantDb.updateById(transactions, id, {
        active: false,
        suspendedAt: new Date().toISOString(),
        updatedAt: new Date(),
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });
      return reply.send({ transaction: updated });
    },
  );

  app.post(
    "/api/transactions/:id/reactivate",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const updated = await tenantDb.updateById(transactions, id, {
        active: true,
        suspendedAt: null,
        updatedAt: new Date(),
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });
      return reply.send({ transaction: updated });
    },
  );
}
