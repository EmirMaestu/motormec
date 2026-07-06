import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { subscriptions, walletLedger } from "../db/schema.js";
import { billingService } from "../domain/billing/service.js";
import type { ProviderName } from "../domain/billing/types.js";

const startSchema = z.object({
  plan: z.string().min(1),
  basePrice: z.number().positive(),
  cycle: z.enum(["monthly", "annual"]).optional(),
  methodType: z.enum(["debin", "transferencia", "tarjeta"]),
  country: z.enum(["AR", "CL"]),
  name: z.string().min(1),
  email: z.string().email().optional(),
  taxId: z.string().max(40).optional(),
});

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------------- gestión (con auth) ------------------------ */

  // Estado de facturación del tenant: suscripción, wallet, código de referido.
  app.get("/api/billing/subscription", { preHandler: requireAuth }, async (request, reply) => {
    const { auth } = authed(request);
    const customer = await billingService.getCustomer(auth.tenantId);
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, auth.tenantId),
      orderBy: desc(subscriptions.createdAt),
    });
    const ledger = await db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.tenantId, auth.tenantId))
      .orderBy(desc(walletLedger.createdAt))
      .limit(20);
    return reply.send({
      subscription: sub ?? null,
      wallet: {
        balance: customer?.walletBalance ?? 0,
        currency: customer?.currency ?? null,
        ledger,
      },
      referralCode: customer?.referralCode ?? null,
    });
  });

  // Alta / cambio de suscripción (sólo admin del taller).
  app.post(
    "/api/billing/subscription",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { auth } = authed(request);
      const parsed = startSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      try {
        const result = await billingService.startSubscription({
          tenantId: auth.tenantId,
          ...parsed.data,
        });
        return reply.code(201).send(result);
      } catch (err) {
        request.log.error({ err }, "billing start failed");
        return reply
          .code(502)
          .send({ error: "provider_error", message: "No se pudo procesar el pago. Probá de nuevo." });
      }
    },
  );

  // Vincular un referido (por código) al tenant actual.
  app.post("/api/billing/referral", { preHandler: requireRole("admin") }, async (request, reply) => {
    const { auth } = authed(request);
    const parsed = z.object({ code: z.string().min(4) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const ok = await billingService.attachReferral(auth.tenantId, parsed.data.code.toUpperCase());
    if (!ok) return reply.code(400).send({ error: "invalid_referral" });
    return reply.send({ ok: true });
  });

  /* ---------------------- webhooks (raw body, sin auth) ---------------- */

  await app.register(async (instance) => {
    // Mantener el body crudo para verificar la firma HMAC.
    instance.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
      const buf = body as Buffer;
      (req as { rawBody?: Buffer }).rawBody = buf;
      try {
        done(null, buf.length ? JSON.parse(buf.toString("utf8")) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    const handle = (provider: ProviderName) => async (request: any, reply: any) => {
      const raw: Buffer = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
      const headers = request.headers as Record<string, string | undefined>;
      const outcome = await billingService.processWebhook(provider, raw.toString("utf8"), headers);
      if (!outcome.ok && outcome.reason === "bad_signature") {
        return reply.code(401).send({ error: "bad_signature" });
      }
      // Siempre 200 ante firma válida (aunque sea dedup/unmatched) para que el
      // proveedor no reintente infinitamente.
      return reply.code(200).send({ ok: true });
    };

    instance.post("/api/billing/webhooks/mobbex", handle("mobbex"));
    instance.post("/api/billing/webhooks/rebill", handle("rebill"));
  });
}
