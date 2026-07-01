import type { FastifyInstance } from "fastify";
import { and, desc, eq, ne, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { customers, historialTaller, vehicles } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import { recalcCustomerMetrics } from "../domain/customerMetrics.js";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional().default(""),
  email: z.string().email().max(200).optional().or(z.literal("")),
  address: z.string().max(300).optional(),
  documentType: z.string().max(40).optional(),
  documentNumber: z.string().max(60).optional(),
  notes: z.string().max(4000).optional(),
});

const updateSchema = createSchema.partial();

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  // List active customers (optional text search by name/phone/email).
  app.get("/api/customers", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = (request.query as { q?: string } | undefined)?.q?.trim();
    const base = eq(customers.active, true);
    const where = q
      ? and(
          base,
          or(
            ilike(customers.name, `%${q}%`),
            ilike(customers.phone, `%${q}%`),
            ilike(customers.email, `%${q}%`),
          ),
        )
      : base;
    const rows = await tenantDb.select(customers, where);
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return reply.send({ customers: rows });
  });

  // Aggregate stats (admin view).
  app.get(
    "/api/customers/stats",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const active = await tenantDb.select(customers, eq(customers.active, true));
      const totalCustomers = active.length;
      const totalSpent = active.reduce((s, c) => s + (c.totalSpent ?? 0), 0);
      const totalVehicles = active.reduce((s, c) => s + (c.totalVehicles ?? 0), 0);
      const topCustomers = [...active]
        .sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0))
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          name: c.name,
          totalSpent: c.totalSpent ?? 0,
          totalVehicles: c.totalVehicles ?? 0,
        }));
      return reply.send({
        totalCustomers,
        totalSpent,
        totalVehicles,
        averageSpentPerCustomer: totalCustomers ? totalSpent / totalCustomers : 0,
        topCustomers,
      });
    },
  );

  app.post(
    "/api/customers",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const data = parsed.data;

      if (data.phone) {
        const existing = await tenantDb.selectOne(
          customers,
          and(eq(customers.phone, data.phone), eq(customers.active, true)),
        );
        if (existing) {
          return reply
            .code(409)
            .send({ error: "duplicate_phone", message: "Ya existe un cliente con este teléfono" });
        }
      }

      const created = await tenantDb.insertOne(customers, {
        name: data.name,
        phone: data.phone ?? "",
        email: data.email || null,
        address: data.address ?? null,
        documentType: data.documentType ?? null,
        documentNumber: data.documentNumber ?? null,
        notes: data.notes ?? null,
      });
      return reply.code(201).send({ customer: created });
    },
  );

  app.get("/api/customers/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const customer = await tenantDb.findById(customers, id);
    if (!customer) return reply.code(404).send({ error: "not_found" });
    return reply.send({ customer });
  });

  app.patch(
    "/api/customers/:id",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const data = parsed.data;

      if (data.phone) {
        const conflict = await tenantDb.selectOne(
          customers,
          and(
            eq(customers.phone, data.phone),
            eq(customers.active, true),
            ne(customers.id, id),
          ),
        );
        if (conflict) {
          return reply
            .code(409)
            .send({ error: "duplicate_phone", message: "Otro cliente ya usa este teléfono" });
        }
      }

      const updated = await tenantDb.updateById(customers, id, {
        ...data,
        email: data.email === "" ? null : data.email,
        updatedAt: new Date(),
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });
      return reply.send({ customer: updated });
    },
  );

  // Deactivate (soft delete). Blocked if the customer has vehicles not delivered.
  app.delete(
    "/api/customers/:id",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const active = await tenantDb.select(
        vehicles,
        and(eq(vehicles.customerId, id), ne(vehicles.status, "Entregado")),
      );
      if (active.length > 0) {
        return reply.code(409).send({
          error: "has_active_vehicles",
          message: "El cliente tiene vehículos sin entregar",
        });
      }
      const updated = await tenantDb.updateById(customers, id, {
        active: false,
        updatedAt: new Date(),
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });
      return reply.send({ ok: true });
    },
  );

  app.get(
    "/api/customers/:id/vehicles",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const rows = await tenantDb.select(vehicles, eq(vehicles.customerId, id));
      rows.sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
      return reply.send({ vehicles: rows });
    },
  );

  app.get(
    "/api/customers/:id/metrics",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const customer = await tenantDb.findById(customers, id);
      if (!customer) return reply.code(404).send({ error: "not_found" });
      const rows = await tenantDb.select(vehicles, eq(vehicles.customerId, id));
      const totalVehicles = rows.length;
      const totalSpent = rows.reduce((s, v) => s + (v.cost ?? 0), 0);
      const completedVehicles = rows.filter((v) => v.status === "Entregado").length;
      const activeVehicles = rows.filter((v) => v.status !== "Entregado").length;
      const lastVisit =
        rows.length > 0
          ? rows.map((v) => v.entryDate).sort((a, b) => (a < b ? 1 : -1))[0]
          : null;
      return reply.send({
        totalVehicles,
        totalSpent,
        completedVehicles,
        activeVehicles,
        lastVisit,
        visitCount: totalVehicles,
      });
    },
  );

  // Merge two customers: move vehicles + historial, consolidate notes, deactivate source.
  app.post(
    "/api/customers/merge",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const schema = z.object({
        sourceCustomerId: z.string().uuid(),
        targetCustomerId: z.string().uuid(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const { sourceCustomerId, targetCustomerId } = parsed.data;
      if (sourceCustomerId === targetCustomerId) {
        return reply.code(400).send({ error: "same_customer" });
      }
      const source = await tenantDb.findById(customers, sourceCustomerId);
      const target = await tenantDb.findById(customers, targetCustomerId);
      if (!source || !target) return reply.code(404).send({ error: "not_found" });

      const movedVehiclesRows = await tenantDb.update(
        vehicles,
        { customerId: targetCustomerId, owner: target.name, phone: target.phone, updatedAt: new Date() },
        eq(vehicles.customerId, sourceCustomerId),
      );
      const movedHistorialRows = await tenantDb.update(
        historialTaller,
        { customerId: targetCustomerId },
        eq(historialTaller.customerId, sourceCustomerId),
      );

      const mergedNotes = [target.notes, source.notes]
        .filter((n) => n && n.trim())
        .join("\n---\n");
      await tenantDb.updateById(customers, targetCustomerId, {
        notes: mergedNotes || null,
        updatedAt: new Date(),
      });
      await recalcCustomerMetrics(tenantDb, targetCustomerId);

      const stamp = `[Unido el ${new Date().toISOString()} con cliente ${target.name}]`;
      await tenantDb.updateById(customers, sourceCustomerId, {
        active: false,
        notes: `${stamp}\n${source.notes ?? ""}`,
        updatedAt: new Date(),
      });

      return reply.send({
        targetCustomerId,
        movedVehicles: movedVehiclesRows.length,
        movedHistorial: movedHistorialRows.length,
      });
    },
  );

  // Recalculate metrics for all active customers (admin maintenance tool).
  app.post(
    "/api/customers/recalc-metrics",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const active = await tenantDb.select(customers, eq(customers.active, true));
      for (const c of active) {
        await recalcCustomerMetrics(tenantDb, c.id);
      }
      return reply.send({ updated: active.length });
    },
  );
}
