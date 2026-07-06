import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  customers,
  numerosAutorizados,
  tenants,
  users,
  vehicles,
  workOrders,
} from "../db/schema.js";
import { createTenant, createUser } from "../db/admin.js";
import { assertStrongPassword } from "../auth/passwordPolicy.js";
import { encryptSecret } from "../crypto/secrets.js";
import { env } from "../config/env.js";
import { PLANS, limitsFor, limitsForJson, withinLimit } from "../domain/plans.js";
import { getIaTokens, getIaUsage } from "../domain/usage.js";
import { sameNumber } from "../whatsapp/phone.js";
import {
  ADMIN_COOKIE,
  destroyPlatformSession,
  loginPlatformAdmin,
} from "../auth/platform.js";
import { cookieOptions } from "../auth/session.js";
import { platformAuthed, requirePlatformAdmin } from "../auth/middleware.js";

async function tenantById(id: string) {
  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /* ----------------------------- auth ---------------------------------- */
  app.post(
    "/api/admin/login",
    { config: { rateLimit: { max: env.NODE_ENV === "test" ? 10_000 : 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = z
        .object({ username: z.string().min(1), password: z.string().min(1) })
        .safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const res = await loginPlatformAdmin(parsed.data.username, parsed.data.password);
      if (!res.ok || !res.token) return reply.code(401).send({ error: "invalid_credentials" });
      reply.setCookie(ADMIN_COOKIE, res.token, cookieOptions(res.expiresAt));
      return reply.send({ admin: res.admin });
    },
  );

  app.post("/api/admin/logout", async (request, reply) => {
    const token = request.cookies?.[ADMIN_COOKIE];
    if (token) await destroyPlatformSession(token);
    reply.clearCookie(ADMIN_COOKIE, cookieOptions());
    return reply.send({ ok: true });
  });

  app.get("/api/admin/me", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    return reply.send({ admin: platformAuthed(request) });
  });

  /* --------------------------- tenants list ---------------------------- */
  app.get("/api/admin/tenants", { preHandler: requirePlatformAdmin }, async (_request, reply) => {
    const all = await db.select().from(tenants).orderBy(tenants.createdAt);
    const result = [];
    for (const t of all) {
      const [u, v, o] = await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(users).where(eq(users.tenantId, t.id)),
        db.select({ c: sql<number>`count(*)::int` }).from(vehicles).where(eq(vehicles.tenantId, t.id)),
        db.select({ c: sql<number>`count(*)::int` }).from(workOrders).where(eq(workOrders.tenantId, t.id)),
      ]);
      result.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        active: t.active,
        waPhoneNumberId: t.waPhoneNumberId,
        waDisplayNumber: t.waDisplayNumber,
        hasWhatsApp: Boolean(t.waPhoneNumberId && t.waAccessToken),
        createdAt: t.createdAt,
        counts: { users: u[0]?.c ?? 0, vehicles: v[0]?.c ?? 0, orders: o[0]?.c ?? 0 },
      });
    }
    return reply.send({ tenants: result });
  });

  /* --------------------------- create tenant --------------------------- */
  app.post("/api/admin/tenants", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const parsed = z
      .object({
        name: z.string().min(1).max(120),
        slug: z
          .string()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "slug: solo minúsculas, números y guiones"),
        plan: z.enum(PLANS).default("starter"),
        adminName: z.string().min(1).max(120),
        adminUsername: z.string().min(1).max(60),
        adminPassword: z.string().min(6).max(200),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const d = parsed.data;

    try {
      assertStrongPassword(d.adminPassword);
    } catch (e) {
      return reply.code(400).send({ error: "weak_password", message: (e as Error).message });
    }

    const existing = await db.select().from(tenants).where(eq(tenants.slug, d.slug)).limit(1);
    if (existing[0]) return reply.code(409).send({ error: "slug_taken" });

    try {
      const tenant = await createTenant({ name: d.name, slug: d.slug, plan: d.plan });
      await createUser({
        tenantId: tenant.id,
        name: d.adminName,
        username: d.adminUsername,
        password: d.adminPassword,
        role: "admin",
      });
      return reply.code(201).send({ tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } });
    } catch {
      return reply.code(500).send({ error: "create_failed" });
    }
  });

  /* --------------------------- tenant detail --------------------------- */
  app.get("/api/admin/tenants/:id", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await tenantById(id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    const [tUsers, tNumbers, custCount] = await Promise.all([
      db.select({ id: users.id, name: users.name, username: users.username, role: users.role, active: users.active })
        .from(users).where(eq(users.tenantId, id)),
      db.select().from(numerosAutorizados).where(eq(numerosAutorizados.tenantId, id)),
      db.select({ c: sql<number>`count(*)::int` }).from(customers).where(eq(customers.tenantId, id)),
    ]);
    const [iaUsed, iaTokens] = await Promise.all([getIaUsage(id), getIaTokens(id)]);
    return reply.send({
      tenant: {
        id: t.id, name: t.name, slug: t.slug, plan: t.plan, active: t.active,
        waPhoneNumberId: t.waPhoneNumberId, waDisplayNumber: t.waDisplayNumber,
        hasAccessToken: Boolean(t.waAccessToken), settings: t.settings, createdAt: t.createdAt,
      },
      users: tUsers,
      numbers: tNumbers,
      customers: custCount[0]?.c ?? 0,
      limits: limitsForJson(t.plan),
      usage: {
        users: tUsers.length,
        numbers: tNumbers.length,
        iaMonthly: iaUsed,
        iaInputTokens: iaTokens.input,
        iaOutputTokens: iaTokens.output,
      },
    });
  });

  /* --------------------------- update tenant --------------------------- */
  app.patch("/api/admin/tenants/:id", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ name: z.string().min(1).optional(), plan: z.enum(PLANS).optional(), active: z.boolean().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const [updated] = await db.update(tenants).set(parsed.data).where(eq(tenants.id, id)).returning();
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });

  /* ------------------- link WhatsApp number → tenant ------------------- */
  app.put("/api/admin/tenants/:id/whatsapp", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        waPhoneNumberId: z.string().max(60).optional(),
        waDisplayNumber: z.string().max(40).optional(),
        waAccessToken: z.string().max(2000).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const t = await tenantById(id);
    if (!t) return reply.code(404).send({ error: "not_found" });

    const patch: Record<string, unknown> = {};
    if (parsed.data.waPhoneNumberId !== undefined) patch.waPhoneNumberId = parsed.data.waPhoneNumberId || null;
    if (parsed.data.waDisplayNumber !== undefined) patch.waDisplayNumber = parsed.data.waDisplayNumber || null;
    if (parsed.data.waAccessToken) patch.waAccessToken = encryptSecret(parsed.data.waAccessToken);

    try {
      await db.update(tenants).set(patch).where(eq(tenants.id, id));
      return reply.send({ ok: true });
    } catch (err) {
      // wa_phone_number_id is unique across tenants
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "number_already_linked", message: "Ese número ya está ligado a otro taller" });
      }
      throw err;
    }
  });

  /* --------------------- create user for a tenant ---------------------- */
  app.post("/api/admin/tenants/:id/users", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        name: z.string().min(1).max(120),
        username: z.string().min(1).max(60),
        password: z.string().min(6).max(200),
        role: z.enum(["admin", "mecanico"]).default("mecanico"),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });

    try {
      assertStrongPassword(parsed.data.password);
    } catch (e) {
      return reply.code(400).send({ error: "weak_password", message: (e as Error).message });
    }

    const t = await tenantById(id);
    if (!t) return reply.code(404).send({ error: "not_found" });

    // Tope de usuarios del plan.
    const [{ c: userCount } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.tenantId, id));
    if (!withinLimit(userCount, limitsFor(t.plan).maxUsers)) {
      return reply.code(409).send({
        error: "plan_limit",
        message: `El plan ${t.plan} permite hasta ${limitsFor(t.plan).maxUsers} usuarios.`,
      });
    }

    const dup = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, id), eq(users.username, parsed.data.username)))
      .limit(1);
    if (dup[0]) return reply.code(409).send({ error: "username_taken" });

    const user = await createUser({ tenantId: id, ...parsed.data });
    return reply.code(201).send({ user: { id: user.id, username: user.username, role: user.role } });
  });

  /* --------------------- cambiar rol / estado de un usuario ------------ */
  app.patch("/api/admin/users/:id", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ role: z.enum(["admin", "mecanico"]).optional(), active: z.boolean().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const [updated] = await db.update(users).set(parsed.data).where(eq(users.id, id)).returning();
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return reply.send({ user: { id: updated.id, role: updated.role, active: updated.active } });
  });

  /* --------------- authorized numbers (per tenant) --------------------- */
  app.post("/api/admin/tenants/:id/numbers", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ phone: z.string().min(5).max(30), name: z.string().min(1).max(120) })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const t = await tenantById(id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    // Tope de números de WhatsApp del plan.
    const [{ c: numCount } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(numerosAutorizados)
      .where(eq(numerosAutorizados.tenantId, id));
    if (!withinLimit(numCount, limitsFor(t.plan).maxNumbers)) {
      return reply.code(409).send({
        error: "plan_limit",
        message: `El plan ${t.plan} permite hasta ${limitsFor(t.plan).maxNumbers} números.`,
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
    const [created] = await db
      .insert(numerosAutorizados)
      .values({ tenantId: id, phone: parsed.data.phone, name: parsed.data.name, active: true })
      .returning();
    return reply.code(201).send({ numero: created });
  });

  app.delete("/api/admin/numbers/:id", { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [removed] = await db.delete(numerosAutorizados).where(eq(numerosAutorizados.id, id)).returning();
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
  });
}
