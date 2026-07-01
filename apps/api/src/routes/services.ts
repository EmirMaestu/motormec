import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { services } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";

export const DEFAULT_SERVICES = [
  "Cambio de aceite",
  "Cambio de filtros",
  "Revisión de frenos",
  "Alineación",
  "Balanceado",
  "Cambio de llantas",
  "Revisión de motor",
  "Cambio de bujías",
  "Revisión eléctrica",
  "Cambio de batería",
  "Revisión de suspensión",
  "Cambio de amortiguadores",
  "Mantenimiento general",
  "Diagnóstico",
  "Reparación de transmisión",
  "Cambio de embrague",
  "Reparación de aire acondicionado",
  "Cambio de correa de distribución",
  "Revisión de escape",
  "Cambio de pastillas de freno",
];

export async function serviceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/services", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const all = (request.query as { all?: string }).all === "true";
    const rows = all
      ? await tenantDb.select(services)
      : await tenantDb.select(services, eq(services.active, true));
    rows.sort(
      (a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0) || a.name.localeCompare(b.name),
    );
    return reply.send({ services: rows });
  });

  // Create or bump usage of a service (dedup by name within tenant).
  app.post("/api/services", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const parsed = z.object({ name: z.string().min(1).max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const existing = await tenantDb.selectOne(services, eq(services.name, parsed.data.name));
    if (existing) {
      const updated = await tenantDb.updateById(services, existing.id, {
        usageCount: (existing.usageCount ?? 0) + 1,
        active: true,
      });
      return reply.send({ service: updated });
    }
    const created = await tenantDb.insertOne(services, {
      name: parsed.data.name,
      active: true,
      usageCount: 1,
    });
    return reply.code(201).send({ service: created });
  });

  app.patch("/api/services/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ name: z.string().min(1).optional(), active: z.boolean().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const updated = await tenantDb.updateById(services, id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ service: updated });
  });

  app.delete("/api/services/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const updated = await tenantDb.updateById(services, id, { active: false });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  // Seed the 20 default services (skips existing by name).
  app.post(
    "/api/services/init-defaults",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const existing = await tenantDb.select(services);
      const have = new Set(existing.map((s) => s.name));
      let initialized = 0;
      for (const name of DEFAULT_SERVICES) {
        if (!have.has(name)) {
          await tenantDb.insertOne(services, { name, active: true, usageCount: 0 });
          initialized += 1;
        }
      }
      return reply.send({ initialized });
    },
  );
}
