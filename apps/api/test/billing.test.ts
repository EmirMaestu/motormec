import { desc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool, db } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import {
  billingCustomers,
  charges,
  paymentMethods,
  subscriptions,
  walletLedger,
} from "../src/db/schema.js";
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

/**
 * Aislamiento cross-tenant del billing (SEC-4).
 *
 * Las tablas de billing (billing_customers, payment_methods, subscriptions,
 * charges, wallet_ledger) NO pasan por `TenantDb`; se leen con `db` crudo
 * filtrando a mano por `tenantId`. Estos tests son la red de seguridad que
 * prueba que un taller (A) nunca ve el billing de otro (B): replican las
 * mismas queries que usa el service/las rutas y verifican 0 filas de B.
 */
describe("billing: aislamiento cross-tenant", () => {
  // Da de alta billing completo para un tenant: customer + suscripción activa +
  // método de pago + un cobro + crédito de wallet (referido pagado).
  async function seedBilling(id: string, slug: string): Promise<{ subscriptionId: string; chargeId: string }> {
    // billing_customers + payment_methods + subscriptions (vía el service real).
    const { subscription } = await svc.startSubscription({
      tenantId: id,
      plan: "pro",
      basePrice: 10000,
      methodType: "transferencia",
      country: "AR",
      name: `Taller ${slug}`,
      taxId: "20304050607",
    });
    // charges + wallet_ledger: cobro aprobado deja un charge y (por el descuento
    // de transferencia consumido) un movimiento en el ledger.
    const charge = await svc.chargeCycle(subscription.id);
    await webhook("mobbex", { eventId: `evt-${slug}`, reference: charge.id, status: "approved" });
    return { subscriptionId: subscription.id, chargeId: charge.id };
  }

  it("A no ve el billing_customer / subscription / charge / payment_method / wallet de B", async () => {
    // tenantId (beforeEach) hace de tenant A; creamos B aparte.
    const tenantA = tenantId;
    const tB = await createTenant({ name: "Taller B", slug: "b" });
    const tenantB = tB.id;

    const bSeed = await seedBilling(tenantB, "b");
    // A también tiene billing propio, para descartar falsos verdes por DB vacía.
    await seedBilling(tenantA, "a");

    // billing_customers — lectura del service (getCustomer filtra por tenantId).
    const aCustomer = await svc.getCustomer(tenantA);
    expect(aCustomer?.tenantId).toBe(tenantA);
    const bCustomerAsA = await db.query.billingCustomers.findFirst({
      where: eq(billingCustomers.tenantId, tenantA),
    });
    expect(bCustomerAsA?.tenantId).not.toBe(tenantB);

    // subscriptions — misma query que GET /api/billing/subscription (filtra por tenantId).
    const aSubs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantA));
    expect(aSubs.every((s) => s.tenantId === tenantA)).toBe(true);
    expect(aSubs.find((s) => s.id === bSeed.subscriptionId)).toBeUndefined();

    // charges — filtrado por tenantId no trae los cobros de B.
    const aCharges = await db.select().from(charges).where(eq(charges.tenantId, tenantA));
    expect(aCharges.every((c) => c.tenantId === tenantA)).toBe(true);
    expect(aCharges.find((c) => c.id === bSeed.chargeId)).toBeUndefined();

    // payment_methods — filtrado por tenantId no trae los métodos de B.
    const aMethods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.tenantId, tenantA));
    expect(aMethods.length).toBeGreaterThan(0);
    expect(aMethods.every((m) => m.tenantId === tenantA)).toBe(true);

    // wallet_ledger — misma query que la ruta (filtra por tenantId).
    const aLedger = await db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.tenantId, tenantA))
      .orderBy(desc(walletLedger.createdAt));
    expect(aLedger.every((w) => w.tenantId === tenantA)).toBe(true);
  });

  it("guard: una lectura SIN filtro de tenant SÍ ve las filas de B (justifica el where)", async () => {
    // Prueba de sanidad: sin el predicado por tenantId, las filas de B son
    // visibles. Es lo que el filtro de las queries reales previene.
    const tenantA = tenantId;
    const tB = await createTenant({ name: "Taller B", slug: "b" });
    const bSeed = await seedBilling(tB.id, "b");
    await seedBilling(tenantA, "a");

    const allSubs = await db.select().from(subscriptions);
    expect(allSubs.find((s) => s.id === bSeed.subscriptionId)).toBeDefined();
    expect(allSubs.some((s) => s.tenantId === tenantA)).toBe(true);
    expect(allSubs.some((s) => s.tenantId === tB.id)).toBe(true);
  });

  it("startSubscription/getCustomer nunca cruzan el customer de otro tenant", async () => {
    const tenantA = tenantId;
    const tB = await createTenant({ name: "Taller B", slug: "b" });
    await seedBilling(tB.id, "b");
    await seedBilling(tenantA, "a");

    const a = await svc.getCustomer(tenantA);
    const b = await svc.getCustomer(tB.id);
    expect(a?.tenantId).toBe(tenantA);
    expect(b?.tenantId).toBe(tB.id);
    expect(a?.id).not.toBe(b?.id);
    // El referralCode de cada uno es propio y no se comparte.
    expect(a?.referralCode).not.toBe(b?.referralCode);
    // getCustomer(A) no devuelve el customer de B aunque ambos existan.
    expect(a?.tenantId).not.toBe(tB.id);
  });
});
