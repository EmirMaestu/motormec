import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool, db } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import { charges, subscriptions } from "../src/db/schema.js";
import { BillingService } from "../src/domain/billing/service.js";
import type { PaymentProvider } from "../src/domain/billing/provider.js";
import type { NormalizedWebhook, ProviderName } from "../src/domain/billing/types.js";
import { resetDb } from "./helpers.js";

/**
 * Mock provider: no toca la red. `handleWebhook` NO valida firma (sólo parsea el
 * body simulado). El body de test lleva { eventId, reference, status }.
 */
function mockProvider(name: ProviderName): PaymentProvider {
  return {
    name,
    async createSubscriber() {
      return { providerCustomerId: `cust-${name}` };
    },
    async createSubscription(input) {
      return { externalId: `sub-${input.reference}`, status: "pending" };
    },
    async chargeCycle(input) {
      return { externalId: `chg-${input.reference}`, status: "pending" };
    },
    async updatePaymentMethod() {},
    async cancelSubscription() {},
    handleWebhook(rawBody): NormalizedWebhook | null {
      const b = JSON.parse(rawBody) as {
        eventId: string;
        reference?: string;
        status: NormalizedWebhook["status"];
      };
      return {
        provider: name,
        eventId: b.eventId,
        type: "test",
        reference: b.reference,
        status: b.status,
        raw: b as unknown as Record<string, unknown>,
      };
    },
  };
}

const svc = new BillingService({
  providers: { mobbex: mockProvider("mobbex"), rebill: mockProvider("rebill") },
});

const webhook = (provider: ProviderName, body: unknown) =>
  svc.processWebhook(provider, JSON.stringify(body), {});

let tenantId: string;
beforeEach(async () => {
  await resetDb();
  const t = await createTenant({ name: "Taller AR", slug: "ar" });
  tenantId = t.id;
});
afterAll(async () => {
  await pool.end();
});

describe("billing", () => {
  it("routes AR → mobbex and applies the transfer discount (10%)", async () => {
    const { subscription } = await svc.startSubscription({
      tenantId,
      plan: "pro",
      basePrice: 10000,
      methodType: "transferencia",
      country: "AR",
      name: "Taller AR",
      taxId: "20304050607",
    });
    expect(subscription.provider).toBe("mobbex");
    expect(subscription.currency).toBe("ARS");
    expect(subscription.amount).toBe(9000); // 10000 - 10%
  });

  it("AR card pays full price; CL routes to rebill", async () => {
    const ar = await svc.startSubscription({
      tenantId,
      plan: "pro",
      basePrice: 10000,
      methodType: "tarjeta",
      country: "AR",
      name: "Taller AR",
    });
    expect(ar.subscription.amount).toBe(10000);

    const t2 = await createTenant({ name: "Taller CL", slug: "cl" });
    const cl = await svc.startSubscription({
      tenantId: t2.id,
      plan: "pro",
      basePrice: 20000,
      methodType: "tarjeta",
      country: "CL",
      name: "Taller CL",
    });
    expect(cl.subscription.provider).toBe("rebill");
    expect(cl.subscription.currency).toBe("CLP");
  });

  it("alta → cobro → webhook aprobado activa la suscripción (idempotente)", async () => {
    const { subscription } = await svc.startSubscription({
      tenantId,
      plan: "pro",
      basePrice: 10000,
      methodType: "tarjeta",
      country: "AR",
      name: "Taller AR",
    });
    const charge = await svc.chargeCycle(subscription.id);
    expect(charge.status).toBe("pending");

    const evt = { eventId: "evt-1", reference: charge.id, status: "approved" };
    expect((await webhook("mobbex", evt)).ok).toBe(true);

    let paid = await db.query.charges.findFirst({ where: eq(charges.id, charge.id) });
    expect(paid?.status).toBe("approved");
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscription.id),
    });
    expect(sub?.status).toBe("active");
    expect(sub?.currentPeriodEnd).toBeTruthy();

    // Reenviar el MISMO evento no cambia nada (dedup).
    const again = await webhook("mobbex", evt);
    expect(again.reason).toBe("dedup");
    paid = await db.query.charges.findFirst({ where: eq(charges.id, charge.id) });
    expect(paid?.status).toBe("approved");
  });

  it("webhook rechazado dispara reintento (dunning) y luego past_due", async () => {
    const { subscription } = await svc.startSubscription({
      tenantId,
      plan: "pro",
      basePrice: 10000,
      methodType: "tarjeta",
      country: "AR",
      name: "Taller AR",
    });
    const first = await svc.chargeCycle(subscription.id, 1);
    await webhook("mobbex", { eventId: "r1", reference: first.id, status: "rejected" });
    // Se creó un reintento (attempt 2).
    const all = await db.select().from(charges).where(eq(charges.subscriptionId, subscription.id));
    expect(all.length).toBe(2);
    expect(Math.max(...all.map((c) => c.attempt))).toBe(2);

    // Un rechazo en el último intento marca la suscripción past_due.
    const last = await svc.chargeCycle(subscription.id, 3);
    await webhook("mobbex", { eventId: "r2", reference: last.id, status: "rejected" });
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscription.id),
    });
    expect(sub?.status).toBe("past_due");
  });

  it("referido: cuando el referido paga, acredita wallet al que lo trajo", async () => {
    // Referidor (AR) con su código.
    const refCustomer = await svc.ensureCustomer({
      tenantId,
      country: "AR",
      name: "Referidor",
    });

    // Referido (AR) se vincula por código y arranca suscripción.
    const t2 = await createTenant({ name: "Referido", slug: "ref2" });
    await svc.ensureCustomer({ tenantId: t2.id, country: "AR", name: "Referido" });
    const ok = await svc.attachReferral(t2.id, refCustomer.referralCode);
    expect(ok).toBe(true);

    const { subscription } = await svc.startSubscription({
      tenantId: t2.id,
      plan: "pro",
      basePrice: 10000,
      methodType: "tarjeta",
      country: "AR",
      name: "Referido",
    });
    const charge = await svc.chargeCycle(subscription.id);
    await webhook("mobbex", { eventId: "p1", reference: charge.id, status: "approved" });

    // Wallet del referidor = 20% de 10000 (REFERRAL_REWARD_PCT default).
    const referrer = await svc.getCustomer(tenantId);
    expect(referrer?.walletBalance).toBe(2000);
  });
});
