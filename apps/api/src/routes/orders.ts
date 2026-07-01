import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { customers, orderStatus, vehicles, workOrders } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import * as O from "../domain/orders.js";
import { notifyOrderStatusChange } from "../domain/notifications.js";

const partSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  fromInventory: z.boolean(),
});

const createSchema = z.object({
  vehicleId: z.string().uuid().nullable().optional(),
  plate: z.string().max(20).optional(),
  brand: z.string().max(60).optional(),
  model: z.string().max(80).optional(),
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  services: z.array(z.string()).optional(),
  parts: z.array(partSchema).optional(),
  laborCost: z.number().min(0).optional(),
  mileage: z.number().int().nullable().optional(),
  notes: z.string().max(4000).optional(),
  estimatedDate: z.string().max(40).nullable().optional(),
  entryDate: z.string().max(40).optional(),
});

const updateSchema = z.object({
  status: z.enum(orderStatus).optional(),
  services: z.array(z.string()).optional(),
  parts: z.array(partSchema).optional(),
  laborCost: z.number().min(0).optional(),
  notes: z.string().max(4000).optional(),
  estimatedDate: z.string().max(40).nullable().optional(),
  mileage: z.number().int().nullable().optional(),
});

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/orders", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { status?: string; vehicleId?: string };
    let rows;
    if (q.vehicleId) {
      rows = await tenantDb.select(workOrders, eq(workOrders.vehicleId, q.vehicleId));
    } else if (q.status) {
      rows = await tenantDb.select(
        workOrders,
        eq(workOrders.status, q.status as (typeof orderStatus)[number]),
      );
    } else {
      rows = await tenantDb.select(workOrders);
    }
    rows.sort((a, b) => b.number - a.number);
    return reply.send({ orders: rows });
  });

  app.get("/api/orders/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const order = await tenantDb.findById(workOrders, id);
    if (!order) return reply.code(404).send({ error: "not_found" });
    const vehicle = order.vehicleId ? await tenantDb.findById(vehicles, order.vehicleId) : null;
    const customer = order.customerId ? await tenantDb.findById(customers, order.customerId) : null;
    return reply.send({ order, vehicle, customer });
  });

  app.post("/api/orders", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    if (!parsed.data.vehicleId && !parsed.data.plate) {
      return reply.code(400).send({ error: "vehicle_required" });
    }
    const order = await O.createOrder(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      parsed.data,
    );
    return reply.code(201).send({ order });
  });

  app.patch("/api/orders/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const before = await tenantDb.findById(workOrders, id);
    const order = await O.updateOrder(tenantDb, id, parsed.data);
    if (!order) return reply.code(404).send({ error: "not_found" });
    // Aviso al cliente sólo si el estado cambió (best-effort, no bloquea).
    if (parsed.data.status && before && before.status !== order.status) {
      void notifyOrderStatusChange(order).catch(() => {});
    }
    return reply.send({ order });
  });

  app.delete("/api/orders/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const removed = await tenantDb.deleteById(workOrders, id);
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  app.post("/api/orders/:id/finalize", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    try {
      const result = await O.finalizeOrder(
        tenantDb,
        { userId: auth.userId, userName: auth.userName },
        id,
      );
      if (!result) return reply.code(404).send({ error: "not_found" });
      // Aviso de entrega al cliente (best-effort).
      void notifyOrderStatusChange(result.order).catch(() => {});
      return reply.send(result);
    } catch (err) {
      return reply.code(409).send({ error: "stock_error", message: (err as Error).message });
    }
  });
}
