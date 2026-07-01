import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { partners } from "../db/schema.js";
import { authed, requireRole } from "../auth/middleware.js";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().max(200).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  investmentPercentage: z.number().default(0),
  monthlyContribution: z.number().default(0),
  totalContributed: z.number().default(0),
  joinDate: z.string().min(1),
  active: z.boolean().default(true),
});

export async function partnerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/partners", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { active?: string };
    const rows =
      q.active === "true"
        ? await tenantDb.select(partners, eq(partners.active, true))
        : await tenantDb.select(partners);
    return reply.send({ partners: rows });
  });

  app.post("/api/partners", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const created = await tenantDb.insertOne(partners, parsed.data);
    return reply.code(201).send({ partner: created });
  });

  app.patch("/api/partners/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = createSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const updated = await tenantDb.updateById(partners, id, {
      ...parsed.data,
      updatedAt: new Date(),
    });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ partner: updated });
  });

  app.post(
    "/api/partners/:id/contribution",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const parsed = z.object({ amount: z.number() }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const existing = await tenantDb.findById(partners, id);
      if (!existing) return reply.code(404).send({ error: "not_found" });
      const updated = await tenantDb.updateById(partners, id, {
        totalContributed: existing.totalContributed + parsed.data.amount,
        updatedAt: new Date(),
      });
      return reply.send({ partner: updated });
    },
  );

  app.delete("/api/partners/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const removed = await tenantDb.deleteById(partners, id);
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });
}
