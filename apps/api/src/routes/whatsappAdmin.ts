import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { historialTaller, numerosAutorizados, tenants } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import { encryptSecret } from "../crypto/secrets.js";
import { limitsFor, withinLimit } from "../domain/plans.js";
import { sameNumber } from "../whatsapp/phone.js";
import type { TenantSettings } from "../db/schema.js";

export async function whatsappAdminRoutes(app: FastifyInstance): Promise<void> {
  // Intake history (WhatsApp bot dashboard).
  app.get("/api/whatsapp/historial", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const status = (request.query as { status?: string }).status;
    const rows = status
      ? await tenantDb.select(
          historialTaller,
          eq(historialTaller.status, status as "pending" | "processed" | "error" | "linked"),
        )
      : await tenantDb.select(historialTaller);
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return reply.send({ historial: rows });
  });

  // Authorized numbers (per-tenant whitelist).
  app.get("/api/whatsapp/numeros", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const rows = await tenantDb.select(numerosAutorizados);
    return reply.send({ numeros: rows });
  });

  app.post("/api/whatsapp/numeros", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const parsed = z
      .object({ phone: z.string().min(5).max(30), name: z.string().min(1).max(120) })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    // Tope de números del plan del taller.
    const [planRow] = await db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);
    const max = limitsFor(planRow?.plan).maxNumbers;
    const current = await tenantDb.count(numerosAutorizados);
    if (!withinLimit(current, max)) {
      return reply.code(409).send({
        error: "plan_limit",
        message: `Tu plan permite hasta ${max} números de WhatsApp. Actualizá el plan para agregar más.`,
      });
    }
    // Un número sólo puede pertenecer a UN taller (el bot rutea por remitente).
    const activos = await db
      .select({ phone: numerosAutorizados.phone })
      .from(numerosAutorizados)
      .where(eq(numerosAutorizados.active, true));
    if (activos.some((n) => sameNumber(n.phone, parsed.data.phone))) {
      return reply
        .code(409)
        .send({ error: "number_taken", message: "Ese número ya está autorizado en otro taller." });
    }
    const created = await tenantDb.insertOne(numerosAutorizados, {
      phone: parsed.data.phone,
      name: parsed.data.name,
      active: true,
      addedBy: auth.userId,
    });
    return reply.code(201).send({ numero: created });
  });

  app.patch("/api/whatsapp/numeros/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ active: z.boolean().optional(), name: z.string().optional(), phone: z.string().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const updated = await tenantDb.updateById(numerosAutorizados, id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ numero: updated });
  });

  app.delete("/api/whatsapp/numeros/:id", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const removed = await tenantDb.deleteById(numerosAutorizados, id);
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  // Per-tenant WhatsApp credentials (token stored encrypted at rest).
  app.get("/api/whatsapp/config", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { auth } = authed(request);
    const rows = await db
      .select({
        waPhoneNumberId: tenants.waPhoneNumberId,
        waDisplayNumber: tenants.waDisplayNumber,
        waAccessToken: tenants.waAccessToken,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);
    const t = rows[0];
    return reply.send({
      waPhoneNumberId: t?.waPhoneNumberId ?? null,
      waDisplayNumber: t?.waDisplayNumber ?? null,
      hasAccessToken: Boolean(t?.waAccessToken),
      // Default ON: sólo está apagado si se setea explícitamente en false.
      notifyCustomers: (t?.settings as TenantSettings | null)?.notifyCustomers !== false,
    });
  });

  app.put("/api/whatsapp/config", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { auth } = authed(request);
    const parsed = z
      .object({
        waPhoneNumberId: z.string().max(60).optional(),
        waDisplayNumber: z.string().max(40).optional(),
        waAccessToken: z.string().max(2000).optional(),
        notifyCustomers: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const patch: Record<string, unknown> = {};
    if (parsed.data.waPhoneNumberId !== undefined) patch.waPhoneNumberId = parsed.data.waPhoneNumberId;
    if (parsed.data.waDisplayNumber !== undefined) patch.waDisplayNumber = parsed.data.waDisplayNumber;
    if (parsed.data.waAccessToken) patch.waAccessToken = encryptSecret(parsed.data.waAccessToken);
    if (parsed.data.notifyCustomers !== undefined) {
      const [row] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .limit(1);
      patch.settings = {
        ...((row?.settings as TenantSettings | null) ?? {}),
        notifyCustomers: parsed.data.notifyCustomers,
      };
    }
    if (Object.keys(patch).length > 0) {
      await db.update(tenants).set(patch).where(eq(tenants.id, auth.tenantId));
    }
    return reply.send({ ok: true });
  });
}
