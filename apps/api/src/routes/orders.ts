import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { customers, historialTaller, orderStatus, payments, vehicles, workOrders } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import * as O from "../domain/orders.js";
import { registrarPago } from "../domain/payments.js";
import { notifyOrderStatusChange } from "../domain/notifications.js";
import { localDisk } from "../storage/provider.js";
import { detectImageType } from "../lib/imageType.js";
import { env } from "../config/env.js";

/** Fotos (fotoPaths) de todo el historial ligado a una orden. */
async function orderPhotos(
  tdb: ReturnType<typeof authed>["tenantDb"],
  orderId: string,
): Promise<string[]> {
  const hist = await tdb.select(historialTaller, eq(historialTaller.workOrderId, orderId));
  return hist.flatMap((h) => h.fotoPaths ?? []);
}

const IMG_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Tipos de imagen aceptados (validados por magic bytes, no por el data-URL).
const ALLOWED = Object.keys(IMG_EXT);

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

const paymentSchema = z.object({
  amount: z.number().int().positive(),
  method: z.string().max(40).optional(),
  note: z.string().max(500).optional(),
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
    const photos = await orderPhotos(tenantDb, id);
    return reply.send({ order, vehicle, customer, photos });
  });

  // Subir una foto a una orden (el "momento" del ingreso). Recibe la imagen en
  // base64 (data URL); el cliente la comprime antes de enviar.
  app.post(
    "/api/orders/:id/photos",
    {
      preHandler: requireAuth,
      bodyLimit: 15 * 1024 * 1024,
      config: { rateLimit: { max: env.NODE_ENV === "production" ? 30 : 100000, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { tenantDb, auth } = authed(request);
      const { id } = request.params as { id: string };
      const parsed = z.object({ image: z.string().min(16) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });

      const order = await tenantDb.findById(workOrders, id);
      if (!order) return reply.code(404).send({ error: "not_found" });

      const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(parsed.data.image);
      if (!match) return reply.code(400).send({ error: "invalid_image" });
      const ext = IMG_EXT[match[1]!] ?? "jpg";
      const bytes = Buffer.from(match[2]!, "base64");
      const realType = detectImageType(bytes);
      if (!realType || !ALLOWED.includes(realType)) {
        return reply
          .code(400)
          .send({ error: "invalid_image", message: "El archivo no es una imagen válida." });
      }
      if (bytes.length > 12 * 1024 * 1024) return reply.code(413).send({ error: "too_large" });

      // Reusar el historial ligado a esta orden, o crear uno para las fotos web.
      let hist = await tenantDb.selectOne(
        historialTaller,
        eq(historialTaller.workOrderId, id),
      );
      if (!hist) {
        hist = await tenantDb.insertOne(historialTaller, {
          waMessageId: `web-${id}`,
          waFrom: auth.userName,
          waTimestamp: String(Math.floor(Date.now() / 1000)),
          patente: order.vehiclePlate,
          workOrderId: id,
          vehicleId: order.vehicleId,
          customerId: order.customerId,
          status: "linked",
          fotoPaths: [],
        });
      }

      const path = await localDisk.save(auth.tenantId, hist.id, bytes, ext);
      await tenantDb.updateById(historialTaller, hist.id, {
        fotoPaths: [...(hist.fotoPaths ?? []), path],
      });
      return reply.code(201).send({ path, photos: await orderPhotos(tenantDb, id) });
    },
  );

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
    let order;
    try {
      order = await O.updateOrder(tenantDb, id, parsed.data);
    } catch (err) {
      return reply.code(409).send({
        error: "order_finalized",
        message: "No se puede editar una orden finalizada. Reabrila primero.",
      });
    }
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

  // Registrar un pago (incluidos parciales; el fiado está permitido) contra una orden.
  app.post("/api/orders/:id/payments", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = paymentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    let result;
    try {
      result = await registrarPago(
        tenantDb,
        { userId: auth.userId, userName: auth.userName },
        id,
        parsed.data,
      );
    } catch {
      return reply.code(400).send({ error: "invalid_amount" });
    }
    if (!result) return reply.code(404).send({ error: "not_found" });
    const { payment, order, saldo, estado } = result;
    return reply.code(201).send({
      payment,
      order: {
        id: order.id,
        number: order.number,
        total: order.total,
        paidAmount: order.paidAmount,
        saldo,
        estado,
      },
    });
  });

  // Pagos de una orden, del más antiguo al más reciente.
  app.get("/api/orders/:id/payments", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const rows = await tenantDb.select(payments, eq(payments.workOrderId, id));
    rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    return reply.send({ payments: rows });
  });
}
