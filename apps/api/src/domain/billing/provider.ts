import type {
  ChargeInput,
  ChargeResult,
  NormalizedWebhook,
  ProviderName,
  SubscriberInput,
  SubscriberResult,
  SubscriptionInput,
  SubscriptionResult,
  UpdatePaymentMethodInput,
} from "./types.js";

/**
 * Capa de abstracción. El BillingService y las rutas dependen SOLO de esta
 * interfaz; nunca de detalles de Mobbex o Rebill. Cada proveedor la implementa.
 */
export interface PaymentProvider {
  readonly name: ProviderName;

  /** Alta del suscriptor (tokenización a nivel cliente). */
  createSubscriber(input: SubscriberInput): Promise<SubscriberResult>;

  /** Crea la suscripción recurrente. Puede devolver un checkout hosted. */
  createSubscription(input: SubscriptionInput): Promise<SubscriptionResult>;

  /** Dispara el cobro de un ciclo (para reintentos/dunning o cobro manual). */
  chargeCycle(input: ChargeInput): Promise<ChargeResult>;

  /** Actualiza el medio de pago del suscriptor. */
  updatePaymentMethod(input: UpdatePaymentMethodInput): Promise<void>;

  /** Cancela la suscripción en el proveedor. */
  cancelSubscription(externalId: string): Promise<void>;

  /**
   * Verifica firma/origen y normaliza el webhook. Devuelve `null` si la firma
   * es inválida (el endpoint responde 401 y NO procesa).
   */
  handleWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): NormalizedWebhook | null;
}
