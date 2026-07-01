/**
 * Planes de suscripción y sus límites. El plan se asigna por tenant desde el
 * panel super-admin; estos límites se aplican en runtime (crear usuarios,
 * ligar números, y consumo mensual de IA del bot).
 *
 * `Infinity` significa sin tope. Los precios son USD/mes (referencia comercial;
 * la facturación real se integra aparte).
 */

export interface PlanLimits {
  /** Nombre comercial mostrado en UI. */
  label: string;
  /** Precio de referencia USD/mes. 0 = plan interno / a convenir. */
  priceUsd: number;
  /** Máximo de usuarios (mecánicos + admins) del taller. */
  maxUsers: number;
  /** Máximo de números de WhatsApp autorizados (whitelist del bot). */
  maxNumbers: number;
  /** Máximo de mensajes procesados con IA por mes (parser del bot). */
  maxIaMonthly: number;
}

export const PLANS = [
  "arranque",
  "pro",
  "cadena",
  "enterprise",
  "standard",
] as const;
export type PlanId = (typeof PLANS)[number];

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // Plan de entrada (mínimo comercial: USD 20).
  arranque: {
    label: "Arranque",
    priceUsd: 20,
    maxUsers: 3,
    maxNumbers: 2,
    maxIaMonthly: 300,
  },
  pro: {
    label: "Pro",
    priceUsd: 49,
    maxUsers: 10,
    maxNumbers: 5,
    maxIaMonthly: 1500,
  },
  cadena: {
    label: "Cadena",
    priceUsd: 99,
    maxUsers: 40,
    maxNumbers: 20,
    maxIaMonthly: 6000,
  },
  enterprise: {
    label: "Enterprise",
    priceUsd: 0, // a convenir
    maxUsers: Infinity,
    maxNumbers: Infinity,
    maxIaMonthly: Infinity,
  },
  // Plan interno/legado (talleres existentes sin tope mientras migran).
  standard: {
    label: "Standard",
    priceUsd: 0,
    maxUsers: Infinity,
    maxNumbers: Infinity,
    maxIaMonthly: Infinity,
  },
};

/** Límites de un plan; cae a "arranque" si el plan es desconocido. */
export function limitsFor(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan ?? "") as PlanId] ?? PLAN_LIMITS.arranque;
}

/** true si `current` es menor que el tope (∞ siempre permite). */
export function withinLimit(current: number, max: number): boolean {
  return max === Infinity || current < max;
}

/** Representación segura para JSON (∞ → null = "ilimitado"). */
export function limitsForJson(plan: string | null | undefined) {
  const l = limitsFor(plan);
  const num = (n: number) => (n === Infinity ? null : n);
  return {
    label: l.label,
    priceUsd: l.priceUsd,
    maxUsers: num(l.maxUsers),
    maxNumbers: num(l.maxNumbers),
    maxIaMonthly: num(l.maxIaMonthly),
  };
}
