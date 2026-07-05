/** Convención: el dinero se guarda y se opera SIEMPRE en centavos (enteros). */
export const toCents = (pesos: number): number => Math.round(pesos * 100);
export const fromCents = (cents: number): number => cents / 100;

/** Monedas soportadas por el taller. Todas se almacenan en unidades menores (×100). */
export type Currency = "ARS" | "CLP" | "USD";

const CURRENCY_LOCALE: Record<Currency, string> = {
  ARS: "es-AR",
  CLP: "es-CL",
  USD: "en-US",
};

/**
 * Formatea un monto en centavos (unidades menores) como moneda del taller.
 * Default "ARS" para compat con las llamadas existentes. Sin decimales (CLP
 * no los usa; ARS/USD se muestran redondeados como el resto de la app).
 * Ej.: formatArs(123456, "ARS") → "$ 1.235"; formatArs(500000, "CLP") → "$5.000".
 */
export function formatArs(cents: number, currency: Currency = "ARS"): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

/** Alias legible: mismo comportamiento que formatArs, nombre neutral de moneda. */
export const formatMoney = formatArs;
