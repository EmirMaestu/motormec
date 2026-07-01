import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db as defaultDb } from "../../db/client.js";
import { env } from "../../config/env.js";
import {
  billingCustomers,
  charges,
  paymentMethods,
  referrals,
  subscriptions,
  walletLedger,
  webhookEvents,
  type BillingCustomer,
  type Charge,
  type Subscription,
} from "../../db/schema.js";
import { MobbexProvider } from "./mobbex.js";
import { RebillProvider } from "./rebill.js";
import type { PaymentProvider } from "./provider.js";
import type {
  Country,
  Currency,
  NormalizedWebhook,
  PaymentMethodKind,
  ProviderName,
} from "./types.js";

type Db = typeof defaultDb;
type Providers = Record<ProviderName, PaymentProvider>;

const COUNTRY_PROVIDER: Record<Country, ProviderName> = { AR: "mobbex", CL: "rebill" };
const COUNTRY_CURRENCY: Record<Country, Currency> = { AR: "ARS", CL: "CLP" };

/** El descuento es un ATRIBUTO del método de pago, no lógica del flujo. */
export function methodHasDiscount(type: PaymentMethodKind, country: Country): boolean {
  // AR: transferencia/DEBIN tienen descuento; tarjeta paga precio pleno.
  return country === "AR" && (type === "transferencia" || type === "debin");
}

export interface StartSubscriptionInput {
  tenantId: string;
  plan: string;
  /** Precio base del plan en la moneda del cliente (antes de descuentos). */
  basePrice: number;
  cycle?: "monthly" | "annual";
  methodType: PaymentMethodKind;
  country: Country;
  name: string;
  email?: string | null;
  taxId?: string | null;
}

export interface WebhookOutcome {
  ok: boolean;
  reason?: "bad_signature" | "dedup" | "unmatched";
}

export class BillingService {
  private readonly db: Db;
  private readonly providers: Providers;

  constructor(opts?: { db?: Db; providers?: Partial<Providers> }) {
    this.db = opts?.db ?? defaultDb;
    this.providers = {
      mobbex: opts?.providers?.mobbex ?? new MobbexProvider(),
      rebill: opts?.providers?.rebill ?? new RebillProvider(),
    };
  }

  providerFor(country: Country): PaymentProvider {
    return this.providers[COUNTRY_PROVIDER[country]];
  }

  /** Neto tras aplicar el descuento del método (config por env). */
  applyDiscount(basePrice: number, hasDiscount: boolean): { net: number; discount: number } {
    const discount = hasDiscount ? round2(basePrice * env.DESCUENTO_TRANSFERENCIA) : 0;
    return { net: round2(basePrice - discount), discount };
  }

  /** Crea (o reusa) el suscriptor de billing del tenant. Genera su código de referido. */
  async ensureCustomer(input: {
    tenantId: string;
    country: Country;
    name: string;
    email?: string | null;
    taxId?: string | null;
    referredByTenantId?: string | null;
  }): Promise<BillingCustomer> {
    const existing = await this.db.query.billingCustomers?.findFirst?.({
      where: eq(billingCustomers.tenantId, input.tenantId),
    });
    if (existing) return existing;
    const [row] = await this.db
      .insert(billingCustomers)
      .values({
        tenantId: input.tenantId,
        country: input.country,
        currency: COUNTRY_CURRENCY[input.country],
        provider: COUNTRY_PROVIDER[input.country],
        taxId: input.taxId ?? null,
        name: input.name,
        email: input.email ?? null,
        referralCode: genReferralCode(),
        referredByTenantId: input.referredByTenantId ?? null,
      })
      .returning();
    return row!;
  }

  /** Vincula un referido por código (se premia cuando pague). */
  async attachReferral(referredTenantId: string, code: string): Promise<boolean> {
    const referrer = await this.getCustomerByCode(code);
    if (!referrer || referrer.tenantId === referredTenantId) return false;
    // Guardar el referidor en el customer del referido.
    await this.db
      .update(billingCustomers)
      .set({ referredByTenantId: referrer.tenantId, updatedAt: new Date() })
      .where(eq(billingCustomers.tenantId, referredTenantId));
    await this.db
      .insert(referrals)
      .values({
        referrerTenantId: referrer.tenantId,
        referredTenantId,
        code,
        status: "pending",
      })
      .onConflictDoNothing();
    return true;
  }

  /**
   * Alta de suscripción: resuelve proveedor por país, aplica el descuento del
   * método y crea la suscripción en el proveedor.
   */
  async startSubscription(
    input: StartSubscriptionInput,
  ): Promise<{ subscription: Subscription; checkoutUrl?: string }> {
    const bc = await this.ensureCustomer(input);
    const provider = this.providerFor(input.country);
    const hasDiscount = methodHasDiscount(input.methodType, input.country);
    const { net } = this.applyDiscount(input.basePrice, hasDiscount);

    // Método de pago (descuento como atributo del método).
    const [pm] = await this.db
      .insert(paymentMethods)
      .values({ tenantId: input.tenantId, type: input.methodType, hasDiscount })
      .returning();

    // Suscriptor en el proveedor (una vez).
    let providerCustomerId = bc.providerCustomerId;
    if (!providerCustomerId) {
      const sub = await provider.createSubscriber({
        tenantId: input.tenantId,
        name: input.name,
        email: input.email ?? null,
        taxId: input.taxId ?? null,
        country: input.country,
      });
      providerCustomerId = sub.providerCustomerId;
      await this.db
        .update(billingCustomers)
        .set({ providerCustomerId, updatedAt: new Date() })
        .where(eq(billingCustomers.tenantId, input.tenantId));
    }

    // Fila de suscripción (pending) — su id es la `reference` de conciliación.
    const [subRow] = await this.db
      .insert(subscriptions)
      .values({
        tenantId: input.tenantId,
        provider: provider.name,
        plan: input.plan,
        status: "pending",
        cycle: input.cycle ?? "monthly",
        amount: net,
        currency: bc.currency,
        paymentMethodId: pm!.id,
      })
      .returning();

    const created = await provider.createSubscription({
      tenantId: input.tenantId,
      providerCustomerId,
      plan: input.plan,
      amount: net,
      currency: bc.currency,
      cycle: input.cycle ?? "monthly",
      paymentMethod: input.methodType,
      reference: subRow!.id,
    });

    const [updated] = await this.db
      .update(subscriptions)
      .set({ externalId: created.externalId, updatedAt: new Date() })
      .where(eq(subscriptions.id, subRow!.id))
      .returning();

    return { subscription: updated!, checkoutUrl: created.checkoutUrl };
  }

  /** Genera el cobro de un ciclo, aplicando crédito de wallet como descuento. */
  async chargeCycle(subscriptionId: string, attempt = 1): Promise<Charge> {
    const sub = await this.db.query.subscriptions?.findFirst?.({
      where: eq(subscriptions.id, subscriptionId),
    });
    if (!sub) throw new Error("subscription_not_found");
    const bc = await this.getCustomer(sub.tenantId);

    const gross = sub.amount;
    const credit = bc ? Math.min(bc.walletBalance, gross) : 0;
    const net = round2(gross - credit);
    const period = yearMonth();

    const [charge] = await this.db
      .insert(charges)
      .values({
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        provider: sub.provider,
        period,
        status: "pending",
        grossAmount: gross,
        discountAmount: credit,
        netAmount: net,
        currency: sub.currency,
        attempt,
      })
      .returning();

    const provider = this.providers[sub.provider];
    const res = await provider.chargeCycle({
      tenantId: sub.tenantId,
      subscriptionExternalId: sub.externalId ?? "",
      amount: net,
      currency: sub.currency,
      period,
      reference: charge!.id,
    });
    const [updated] = await this.db
      .update(charges)
      .set({ externalId: res.externalId })
      .where(eq(charges.id, charge!.id))
      .returning();
    return updated!;
  }

  /**
   * Procesa un webhook: verifica firma, deduplica por (provider, eventId),
   * actualiza estado y dispara reintentos/dunning.
   */
  async processWebhook(
    providerName: ProviderName,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<WebhookOutcome> {
    const evt = this.providers[providerName].handleWebhook(rawBody, headers);
    if (!evt) return { ok: false, reason: "bad_signature" };

    // Idempotencia: si ya lo vimos, no reprocesar.
    const dedup = await this.db
      .insert(webhookEvents)
      .values({ provider: providerName, eventId: evt.eventId, type: evt.type, payload: evt.raw })
      .onConflictDoNothing()
      .returning();
    if (dedup.length === 0) return { ok: true, reason: "dedup" };

    const charge = await this.resolveCharge(evt);
    if (!charge) {
      await this.markProcessed(providerName, evt.eventId);
      return { ok: true, reason: "unmatched" };
    }

    if (evt.status === "approved") await this.onApproved(charge);
    else if (evt.status === "rejected" || evt.status === "expired") await this.onFailed(charge);
    else if (evt.status === "cancelled") await this.onCancelled(charge);

    await this.markProcessed(providerName, evt.eventId);
    return { ok: true };
  }

  /* --------------------------- transiciones ---------------------------- */

  private async onApproved(charge: Charge): Promise<void> {
    if (charge.status === "approved") return; // idempotente
    await this.db
      .update(charges)
      .set({ status: "approved", paidAt: new Date() })
      .where(eq(charges.id, charge.id));

    if (charge.subscriptionId) {
      const sub = await this.db.query.subscriptions?.findFirst?.({
        where: eq(subscriptions.id, charge.subscriptionId),
      });
      if (sub) {
        await this.db
          .update(subscriptions)
          .set({
            status: "active",
            currentPeriodEnd: nextPeriodEnd(sub.cycle),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id));
      }
    }

    // Consumir crédito de wallet usado en este cobro.
    if (charge.discountAmount > 0) {
      await this.moveWallet(charge.tenantId, -charge.discountAmount, charge.currency, "Descuento aplicado", { chargeId: charge.id });
    }

    // Premiar al referidor (una vez, al primer pago aprobado del referido).
    await this.rewardReferrer(charge);
  }

  private async onFailed(charge: Charge): Promise<void> {
    await this.db.update(charges).set({ status: "rejected" }).where(eq(charges.id, charge.id));
    if (!charge.subscriptionId) return;
    // Dunning: reintentar hasta BILLING_MAX_RETRIES; luego past_due.
    if (charge.attempt < env.BILLING_MAX_RETRIES) {
      await this.chargeCycle(charge.subscriptionId, charge.attempt + 1);
    } else {
      await this.db
        .update(subscriptions)
        .set({ status: "past_due", updatedAt: new Date() })
        .where(eq(subscriptions.id, charge.subscriptionId));
    }
  }

  private async onCancelled(charge: Charge): Promise<void> {
    if (!charge.subscriptionId) return;
    await this.db
      .update(subscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptions.id, charge.subscriptionId));
  }

  private async rewardReferrer(charge: Charge): Promise<void> {
    const ref = await this.db.query.referrals?.findFirst?.({
      where: and(eq(referrals.referredTenantId, charge.tenantId), eq(referrals.status, "pending")),
    });
    if (!ref) return;
    const referrer = await this.getCustomer(ref.referrerTenantId);
    const referred = await this.getCustomer(charge.tenantId);
    if (!referrer || !referred) return;

    // Monto del premio: % del pago del referido cuando comparten moneda; si no,
    // fallback en la moneda del referidor para no mezclar monedas.
    const sameCurrency = referrer.currency === referred.currency;
    const base = sameCurrency ? charge.netAmount : referrer.walletBalance; // fallback conservador
    const reward = round2((sameCurrency ? base : 0) * env.REFERRAL_REWARD_PCT);
    if (reward > 0) {
      await this.moveWallet(referrer.tenantId, reward, referrer.currency, "Crédito por referido", {
        referralId: ref.id,
      });
    }
    await this.db.update(referrals).set({ status: "rewarded", rewardChargeId: charge.id }).where(eq(referrals.id, ref.id));
  }

  /* ----------------------------- wallet -------------------------------- */

  /** Movimiento append-only + saldo cacheado en el customer. */
  private async moveWallet(
    tenantId: string,
    amount: number,
    currency: Currency,
    reason: string,
    refs?: { referralId?: string; chargeId?: string },
  ): Promise<void> {
    const bc = await this.getCustomer(tenantId);
    if (!bc) return;
    const balanceAfter = round2(bc.walletBalance + amount);
    await this.db.insert(walletLedger).values({
      tenantId,
      amount,
      currency,
      reason,
      referralId: refs?.referralId ?? null,
      chargeId: refs?.chargeId ?? null,
      balanceAfter,
    });
    await this.db
      .update(billingCustomers)
      .set({ walletBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(billingCustomers.tenantId, tenantId));
  }

  /* ----------------------------- helpers ------------------------------- */

  async getCustomer(tenantId: string): Promise<BillingCustomer | undefined> {
    return this.db.query.billingCustomers?.findFirst?.({
      where: eq(billingCustomers.tenantId, tenantId),
    });
  }
  async getCustomerByCode(code: string): Promise<BillingCustomer | undefined> {
    return this.db.query.billingCustomers?.findFirst?.({
      where: eq(billingCustomers.referralCode, code),
    });
  }

  private async resolveCharge(evt: NormalizedWebhook): Promise<Charge | undefined> {
    if (evt.reference) {
      const byRef = await this.db.query.charges?.findFirst?.({ where: eq(charges.id, evt.reference) });
      if (byRef) return byRef;
    }
    if (evt.chargeExternalId) {
      const byExt = await this.db.query.charges?.findFirst?.({
        where: eq(charges.externalId, evt.chargeExternalId),
      });
      if (byExt) return byExt;
    }
    if (evt.subscriptionExternalId) {
      const sub = await this.db.query.subscriptions?.findFirst?.({
        where: eq(subscriptions.externalId, evt.subscriptionExternalId),
      });
      if (sub) {
        return this.db.query.charges?.findFirst?.({
          where: eq(charges.subscriptionId, sub.id),
          orderBy: desc(charges.createdAt),
        });
      }
    }
    return undefined;
  }

  private async markProcessed(provider: ProviderName, eventId: string): Promise<void> {
    await this.db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
  }
}

/* ------------------------------ utils --------------------------------- */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function genReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
function yearMonth(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function nextPeriodEnd(cycle: "monthly" | "annual", from = new Date()): Date {
  const d = new Date(from);
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export const billingService = new BillingService();
