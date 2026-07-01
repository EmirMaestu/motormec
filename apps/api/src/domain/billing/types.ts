/**
 * Tipos comunes de billing — provider-agnósticos. El resto de la app y las dos
 * implementaciones (Mobbex/Rebill) hablan SOLO en estos términos.
 */

export type ProviderName = "mobbex" | "rebill";
export type Country = "AR" | "CL";
export type Currency = "ARS" | "CLP" | "USD";
export type PaymentMethodKind = "debin" | "transferencia" | "tarjeta";
export type Cycle = "monthly" | "annual";

export interface SubscriberInput {
  tenantId: string;
  name: string;
  email?: string | null;
  /** CUIT/CUIL (AR, obligatorio para DEBIN) o RUT (CL). */
  taxId?: string | null;
  country: Country;
}
export interface SubscriberResult {
  providerCustomerId: string;
}

export interface SubscriptionInput {
  tenantId: string;
  providerCustomerId: string;
  plan: string;
  /** Monto neto (ya con el descuento aplicado por el BillingService). */
  amount: number;
  currency: Currency;
  cycle: Cycle;
  paymentMethod: PaymentMethodKind;
  /** Nuestro id interno de suscripción (para conciliar en el webhook). */
  reference: string;
}
export interface SubscriptionResult {
  externalId: string;
  status: "pending" | "active";
  /** Checkout hosted / tokenización del proveedor (nunca tocamos la tarjeta). */
  checkoutUrl?: string;
}

export interface ChargeInput {
  tenantId: string;
  subscriptionExternalId: string;
  amount: number;
  currency: Currency;
  period: string;
  /** Nuestro id interno de charge. */
  reference: string;
}
export interface ChargeResult {
  externalId: string;
  status: "pending" | "approved" | "rejected";
}

export interface UpdatePaymentMethodInput {
  tenantId: string;
  providerCustomerId: string;
  token: string;
}

/** Evento de webhook ya verificado y normalizado a nuestro vocabulario. */
export interface NormalizedWebhook {
  provider: ProviderName;
  /** Id del evento del proveedor — clave de idempotencia. */
  eventId: string;
  type: string;
  subscriptionExternalId?: string;
  chargeExternalId?: string;
  /** Nuestro id interno, si el proveedor lo devuelve (reference). */
  reference?: string;
  status: "approved" | "rejected" | "expired" | "pending" | "cancelled";
  raw: Record<string, unknown>;
}
