import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
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
 * Mobbex (Argentina). Medio principal DEBIN/transferencia (CBU/CVU), fallback
 * tarjeta. DEBIN exige `customer.identification` con CUIT/CUIL — con solo DNI no
 * funciona. Tokenización a nivel suscriptor (Mobbex Wallet); guardamos solo el
 * token. Endpoints según la API de Suscripciones — CONFIRMAR contra sandbox
 * (mobbex.dev) antes de producción.
 */
export class MobbexProvider implements PaymentProvider {
  readonly name = "mobbex" as const;

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-api-key": env.MOBBEX_API_KEY,
      "x-access-token": env.MOBBEX_ACCESS_TOKEN,
    };
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${env.MOBBEX_BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`Mobbex ${path} → ${res.status}: ${JSON.stringify(json)}`);
    }
    return (json.data as Record<string, unknown>) ?? json;
  }

  async createSubscriber(input: SubscriberInput): Promise<SubscriberResult> {
    // La identificación fiscal es obligatoria para DEBIN.
    const data = await this.post("/p/subscriber", {
      customer: {
        name: input.name,
        email: input.email ?? undefined,
        identification: input.taxId ?? undefined,
      },
      reference: input.tenantId,
    });
    return { providerCustomerId: String(data.uid ?? data.id ?? "") };
  }

  async createSubscription(input: SubscriptionInput): Promise<SubscriptionResult> {
    const data = await this.post("/p/subscriptions", {
      total: input.amount,
      currency: input.currency,
      name: input.plan,
      interval: input.cycle === "annual" ? "12m" : "1m",
      reference: input.reference,
      subscriber: input.providerCustomerId,
      webhook: `${webhookBase()}/api/billing/webhooks/mobbex`,
    });
    return {
      externalId: String(data.uid ?? data.id ?? ""),
      status: "pending",
      checkoutUrl: (data.sourceUrl ?? data.url) as string | undefined,
    };
  }

  async chargeCycle(input: ChargeInput): Promise<ChargeResult> {
    const data = await this.post(
      `/p/subscriptions/${input.subscriptionExternalId}/execution`,
      { total: input.amount, reference: input.reference },
    );
    return { externalId: String(data.uid ?? data.id ?? ""), status: "pending" };
  }

  async updatePaymentMethod(input: UpdatePaymentMethodInput): Promise<void> {
    await this.post(`/p/subscriber/${input.providerCustomerId}/source`, {
      token: input.token,
    });
  }

  async cancelSubscription(externalId: string): Promise<void> {
    await this.post(`/p/subscriptions/${externalId}/action`, { action: "cancel" });
  }

  handleWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): NormalizedWebhook | null {
    if (!verifyHmac(rawBody, headers["x-signature"], env.MOBBEX_WEBHOOK_SECRET)) {
      return null;
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
    const data = (body.data ?? {}) as Record<string, unknown>;
    const payment = (data.payment ?? {}) as Record<string, unknown>;
    const statusObj = (payment.status ?? {}) as Record<string, unknown>;
    const code = Number(statusObj.code ?? 0);
    return {
      provider: "mobbex",
      eventId: String(payment.id ?? body.id ?? `${data.reference ?? ""}-${code}`),
      type: String(body.type ?? "payment"),
      chargeExternalId: payment.id ? String(payment.id) : undefined,
      subscriptionExternalId: data.subscription ? String(data.subscription) : undefined,
      reference: data.reference ? String(data.reference) : undefined,
      status: mapMobbexStatus(code),
      raw: body,
    };
  }
}

/** Códigos Mobbex: 200–399 aprobado; 400–499 rechazado; 100 pendiente. */
function mapMobbexStatus(code: number): NormalizedWebhook["status"] {
  if (code >= 200 && code < 400) return "approved";
  if (code >= 400) return "rejected";
  return "pending";
}

function webhookBase(): string {
  return process.env.PUBLIC_BASE_URL ?? "https://momec.pro";
}

/** HMAC-SHA256 del body crudo, comparación en tiempo constante. */
export function verifyHmac(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!secret) return false; // sin secreto configurado, no aceptamos nada
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
