import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { inventoryMovements, products } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import { logInventoryMovement } from "../domain/movements.js";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().default(0),
  unit: z.string().max(40).default("unidad"),
  type: z.string().max(80).default(""),
  price: z.number().default(0),
  reorderPoint: z.number().default(0),
});

const updateSchema = createSchema.partial().extend({ reason: z.string().max(500).optional() });

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/products", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const rows = await tenantDb.select(products);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return reply.send({ products: rows });
  });

  app.get("/api/products/low-stock", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const rows = await tenantDb.select(products, eq(products.lowStock, true));
    return reply.send({ products: rows });
  });

  app.get("/api/products/movements", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { limit?: string; productId?: string };
    const limit = Math.min(Number(q.limit) || 100, 500);
    const rows = q.productId
      ? await tenantDb.select(inventoryMovements, eq(inventoryMovements.productId, q.productId))
      : await tenantDb.select(inventoryMovements);
    rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return reply.send({ movements: rows.slice(0, limit) });
  });

  app.get("/api/products/movement-stats", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const rows = await tenantDb.select(inventoryMovements);
    const count = (t: string) => rows.filter((m) => m.movementType === t).length;
    return reply.send({
      total: rows.length,
      created: count("created"),
      updated: count("updated"),
      deleted: count("deleted"),
      stockIncreases: count("stock_increase"),
      stockDecreases: count("stock_decrease"),
    });
  });

  app.post("/api/products", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const d = parsed.data;
    const lowStock = d.quantity <= d.reorderPoint;
    const created = await tenantDb.insertOne(products, { ...d, lowStock });
    await logInventoryMovement(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      {
        productId: created.id,
        productName: created.name,
        productType: created.type,
        movementType: "created",
        newQuantity: created.quantity,
        newPrice: created.price,
        details: { newData: created, notes: "Producto creado en el inventario" },
      },
    );
    return reply.code(201).send({ product: created });
  });

  app.patch("/api/products/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const existing = await tenantDb.findById(products, id);
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const d = parsed.data;

    const newQuantity = d.quantity ?? existing.quantity;
    if (newQuantity < 0) {
      return reply.code(400).send({ error: "invalid_quantity", message: "El stock no puede ser negativo." });
    }

    const newReorder = d.reorderPoint ?? existing.reorderPoint;
    const lowStock = newQuantity <= newReorder;
    const { reason, ...fields } = d;
    const updated = await tenantDb.updateById(products, id, {
      ...fields,
      lowStock,
      updatedAt: new Date(),
    });

    const quantityChanged = d.quantity !== undefined && d.quantity !== existing.quantity;
    const movementType = quantityChanged
      ? newQuantity > existing.quantity
        ? "stock_increase"
        : "stock_decrease"
      : "updated";
    await logInventoryMovement(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      {
        productId: id,
        productName: updated?.name ?? existing.name,
        productType: updated?.type ?? existing.type,
        movementType,
        previousQuantity: existing.quantity,
        newQuantity,
        quantityChange: quantityChanged ? newQuantity - existing.quantity : null,
        previousPrice: existing.price,
        newPrice: updated?.price ?? existing.price,
        reason: reason ?? null,
        details: { previousData: existing, newData: updated },
      },
    );
    return reply.send({ product: updated });
  });

  app.post("/api/products/:id/adjust", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ delta: z.number().int(), reason: z.string().max(500).optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const { delta, reason } = parsed.data;

    const existing = await tenantDb.findById(products, id);
    if (!existing) return reply.code(404).send({ error: "not_found" });

    // Update atómico: quantity = quantity + delta. La constraint QW-1
    // (products_quantity_non_negative) lanza si el resultado quedara negativo.
    let updated;
    try {
      const rows = await tenantDb.update(
        products,
        { quantity: sql`${products.quantity} + ${delta}`, updatedAt: new Date() },
        eq(products.id, id),
      );
      updated = rows[0];
    } catch {
      return reply
        .code(400)
        .send({ error: "stock_insuficiente", message: "Stock insuficiente para ese ajuste." });
    }
    if (!updated) return reply.code(404).send({ error: "not_found" });

    // Recalcular lowStock con la nueva cantidad.
    const lowStock = updated.quantity <= updated.reorderPoint;
    if (lowStock !== updated.lowStock) {
      const relowered = await tenantDb.updateById(products, id, { lowStock });
      if (relowered) updated = relowered;
    }

    await logInventoryMovement(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      {
        productId: id,
        productName: updated.name,
        productType: updated.type,
        movementType: delta >= 0 ? "stock_increase" : "stock_decrease",
        previousQuantity: existing.quantity,
        newQuantity: updated.quantity,
        quantityChange: delta,
        previousPrice: existing.price,
        newPrice: updated.price,
        reason: reason ?? null,
        details: { previousData: existing, newData: updated },
      },
    );
    return reply.send({ product: updated });
  });

  app.delete(
    "/api/products/:id",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb, auth } = authed(request);
      const { id } = request.params as { id: string };
      const reason = (request.body as { reason?: string } | undefined)?.reason;
      const existing = await tenantDb.findById(products, id);
      if (!existing) return reply.code(404).send({ error: "not_found" });
      await tenantDb.deleteById(products, id);
      await logInventoryMovement(
        tenantDb,
        { userId: auth.userId, userName: auth.userName },
        {
          productId: null,
          productName: existing.name,
          productType: existing.type,
          movementType: "deleted",
          previousQuantity: existing.quantity,
          previousPrice: existing.price,
          reason: reason ?? null,
          details: { previousData: existing },
        },
      );
      return reply.send({ ok: true });
    },
  );
}
