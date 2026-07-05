import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type Currency = "ARS" | "CLP" | "USD";

/** Locale por moneda para que el símbolo/separadores sean los correctos. */
const CURRENCY_LOCALE: Record<Currency, string> = {
  ARS: "es-AR",
  CLP: "es-CL",
  USD: "en-US",
};

/**
 * Moneda activa del taller (módulo-level). Se setea desde el auth cuando se
 * carga/actualiza el tenant, así todos los `formatCurrency` del árbol usan la
 * moneda configurada sin tener que tocar cada call-site.
 */
let activeCurrency: Currency = "ARS";

export function setActiveCurrency(currency: Currency): void {
  activeCurrency = currency;
}

/**
 * El backend habla SIEMPRE en centavos (bigint). El usuario ve/tipea PESOS.
 * `formatCurrency` recibe CENTAVOS y los muestra como la moneda activa (divide por 100).
 * Sin decimales, consistente con el backend.
 */
export function formatCurrency(cents: number | null | undefined): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[activeCurrency], {
    style: "currency",
    currency: activeCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

/** Pesos (lo que tipea el usuario) → centavos enteros (lo que espera el backend). */
export function pesosToCents(pesos: number | null | undefined): number {
  return Math.round((pesos || 0) * 100);
}

/** Centavos (backend) → pesos (para precargar un input editable). */
export function centsToPesos(cents: number | null | undefined): number {
  return (cents || 0) / 100;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Format a millisecond duration as Hh Mm. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
