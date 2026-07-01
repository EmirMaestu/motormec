import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { presupuestos, tenants, type TenantSettings } from "../db/schema.js";
import { localDisk } from "../storage/provider.js";
import * as Q from "../domain/quotes.js";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const createSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(200).optional(),
  customerPhone: z.string().max(50).optional(),
  vehiclePlate: z.string().max(20).optional(),
  vehicleInfo: z.string().max(120).optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().max(4000).optional(),
  validUntil: z.string().max(40).optional(),
});

const IMG_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function quoteRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/quotes", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    return reply.send({ quotes: await Q.listQuotes(tenantDb) });
  });

  app.get("/api/quotes/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const quote = await tenantDb.findById(presupuestos, id);
    if (!quote) return reply.code(404).send({ error: "not_found" });
    return reply.send({ quote });
  });

  app.post("/api/quotes", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const quote = await Q.createQuote(tenantDb, auth.userName, parsed.data);
    return reply.code(201).send({ quote });
  });

  app.delete("/api/quotes/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const removed = await tenantDb.deleteById(presupuestos, id);
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  // Logo propio del taller para los presupuestos (base64; sólo admin).
  app.post(
    "/api/settings/logo",
    { preHandler: requireRole("admin"), bodyLimit: 6 * 1024 * 1024 },
    async (request, reply) => {
      const { auth } = authed(request);
      const parsed = z.object({ image: z.string().min(16) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const match = /^data:(image\/(?:jpeg|png|webp|svg\+xml));base64,(.+)$/.exec(parsed.data.image);
      if (!match) return reply.code(400).send({ error: "invalid_image" });
      const ext = IMG_EXT[match[1]!] ?? "png";
      const bytes = Buffer.from(match[2]!, "base64");
      if (bytes.length > 5 * 1024 * 1024) return reply.code(413).send({ error: "too_large" });

      const path = await localDisk.save(auth.tenantId, "branding", bytes, ext);
      const [row] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId));
      const settings: TenantSettings = { ...((row?.settings as TenantSettings | null) ?? {}), logoPath: path };
      await db.update(tenants).set({ settings }).where(eq(tenants.id, auth.tenantId));
      return reply.code(201).send({ logoPath: path });
    },
  );

  // Datos de contacto que salen en el presupuesto (sólo admin).
  app.patch("/api/settings/quote-header", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { auth } = authed(request);
    const parsed = z
      .object({ phone: z.string().max(60).optional(), address: z.string().max(200).optional(), email: z.string().max(120).optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const [row] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId));
    const settings: TenantSettings = {
      ...((row?.settings as TenantSettings | null) ?? {}),
      quoteHeader: parsed.data,
    };
    await db.update(tenants).set({ settings }).where(eq(tenants.id, auth.tenantId));
    return reply.send({ ok: true, quoteHeader: parsed.data });
  });
}
