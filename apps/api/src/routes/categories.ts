import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { categories } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(60),
  active: z.boolean().default(true),
});

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/categories", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const type = (request.query as { type?: string }).type;
    const rows = type
      ? await tenantDb.select(
          categories,
          and(eq(categories.type, type), eq(categories.active, true)) as ReturnType<typeof and>,
        )
      : await tenantDb.select(categories);
    return reply.send({ categories: rows });
  });

  app.post("/api/categories", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const created = await tenantDb.insertOne(categories, parsed.data);
    return reply.code(201).send({ category: created });
  });

  app.patch("/api/categories/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = createSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const updated = await tenantDb.updateById(categories, id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ category: updated });
  });

  app.delete("/api/categories/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const removed = await tenantDb.deleteById(categories, id);
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });
}
