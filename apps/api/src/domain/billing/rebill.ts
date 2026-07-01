import { env } from "../../config/env.js";
import { verifyHmac } from "./mobbex.js";
import type { PaymentProvider } from "./provider.js";
import type {
  ChargeInput,
  ChargeResult,
  NormalizedWebhook,
  SubscriberInput,
  SubscriberResult,
  SubscriptionInput,
  SubscriptionResult,
  UpdatePaymentMethodInput,
} from "./types.js";

/**
 * Rebill (Chile). Integración única: cobra en moneda local (CLP) y liquida en
 * USD (settlement configurable por cuenta — CONFIRMAR en su API). Nunca
 * retenemos CLP ni convertimos a mano. Tokenización con su checkout (Bluebox);
 * guardamos solo el token. Endpoints según la API de Rebill — CONFIRMAR en
 * sandbox antes de producción.
 */
export class RebillProvider implements PaymentProvider {
  readonly name = "rebill" as const;

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      Authorization: `Bearer ${env.REBILL_API_KEY}`,
    };
  }

  private async request(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${env.REBILL_BASE_URL}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`Rebill ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
    }
    return (json.data as Record<string, unknown>) ?? json;
  }

  async createSubscriber(input: SubscriberInput): Promise<SubscriberResult> {
    const data = await this.request("POST", "/customers", {
      firstName: input.name,
      email: input.email ?? undefined,
      // RUT chileno.
      taxId: input.taxId ?? undefined,
      metadata: { tenantId: input.tenantId },
    });
    return { providerCustomerId: String(data.id ?? "") };
  }

  async createSubscription(input: SubscriptionInput): Promise<SubscriptionResult> {
    const data = await this.request("POST", "/subscriptions", {
      customerId: input.providerCustomerId,
      // Cobro en moneda local; la liquidación en USD la define la cuenta.
      currency: input.currency,
      amount: input.amount,
      interval: input.cycle === "annual" ? "YEAR" : "MONTH",
      reference: input.reference,
      metadata: { plan: input.plan, tenantId: input.tenantId },
    });
    return {
      externalId: String(data.id ?? ""),
      status: "pending",
      checkoutUrl: (data.checkoutUrl ?? data.paymentUrl) as string | undefined,
    };
  }

  async chargeCycle(input: ChargeInput): Promise<ChargeResult> {
    const data = await this.request("POST", `/subscriptions/${input.subscriptionExternalId}/charge`, {
      amount: input.amount,
      reference: input.reference,
    });
    return { externalId: String(data.id ?? ""), status: "pending" };
  }

  async updatePaymentMethod(input: UpdatePaymentMethodInput): Promise<void> {
    await this.request("PATCH", `/customers/${input.providerCustomerId}/payment-method`, {
      token: input.token,
    });
  }

  async cancelSubscription(externalId: string): Promise<void> {
    await this.request("DELETE", `/subscriptions/${externalId}`);
  }

  handleWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): NormalizedWebhook | null {
    const sig = headers["x-rebill-signature"] ?? headers["x-signature"];
    if (!verifyHmac(rawBody, sig, env.REBILL_WEBHOOK_SECRET)) return null;
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
    const data = (body.data ?? {}) as Record<string, unknown>;
    return {
      provider: "rebill",
      eventId: String(body.id ?? data.id ?? ""),
      type: String(body.event ?? body.type ?? "payment"),
      chargeExternalId: data.id ? String(data.id) : undefined,
      subscriptionExternalId: data.subscriptionId ? String(data.subscriptionId) : undefined,
      reference: data.reference ? String(data.reference) : undefined,
      status: mapRebillStatus(String(data.status ?? body.event ?? "")),
      raw: body,
    };
  }
}

function mapRebillStatus(raw: string): NormalizedWebhook["status"] {
  const s = raw.toUpperCase();
  if (s.includes("APPROV") || s.includes("SUCCE") || s.includes("PAID")) return "approved";
  if (s.includes("REJECT") || s.includes("FAIL") || s.includes("DECLIN")) return "rejected";
  if (s.includes("EXPIR")) return "expired";
  if (s.includes("CANCEL")) return "cancelled";
  return "pending";
}
