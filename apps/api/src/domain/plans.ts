/**
 * Planes de suscripción y sus límites. El plan se asigna por tenant desde el
 * panel super-admin; estos límites se aplican en runtime (crear usuarios, ligar
 * números, consumo mensual de IA del bot, y QUÉ MODELO de Claude usa el bot).
 *
 * `Infinity` = sin tope. Precios USD/mes (referencia comercial; la facturación
 * real se integra aparte). El modelo del bot escala con el plan: Starter → Haiku
 * (rápido/barato), Pro y Max → Sonnet 5 (más capaz).
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
  /** Máximo de mensajes procesados con IA por mes (bot). */
  maxIaMonthly: number;
  /**
   * Tope mensual de TOKENS de IA (input + output) del bot. Un mensaje puede
   * disparar varias llamadas API, así que este tope acota el costo real mejor
   * que `maxIaMonthly`. `Infinity` = sin tope (planes internos/legado).
   */
  maxIaTokensMonthly: number;
  /** Modelo de Claude que usa el AGENTE del bot para este plan. */
  model: string;
  /** Incluye migración de datos (cuaderno/planillas) hecha por el equipo. */
  dataMigration: boolean;
}

const STARTER: PlanLimits = {
  label: "Starter",
  priceUsd: 20,
  maxUsers: 3,
  maxNumbers: 2,
  maxIaMonthly: 300,
  maxIaTokensMonthly: 300_000,
  model: "claude-haiku-4-5",
  dataMigration: false,
};

const PRO: PlanLimits = {
  label: "Pro",
  priceUsd: 49,
  maxUsers: 10,
  maxNumbers: 5,
  maxIaMonthly: 1500,
  maxIaTokensMonthly: 2_000_000,
  model: "claude-sonnet-5",
  dataMigration: true,
};

const MAX: PlanLimits = {
  label: "Max",
  priceUsd: 99,
  maxUsers: Infinity,
  maxNumbers: 20,
  maxIaMonthly: 6000,
  maxIaTokensMonthly: 8_000_000,
  model: "claude-sonnet-5",
  dataMigration: true,
};

// Plan interno/legado (talleres existentes sin tope mientras migran).
const STANDARD: PlanLimits = {
  label: "Standard",
  priceUsd: 0,
  maxUsers: Infinity,
  maxNumbers: Infinity,
  maxIaMonthly: Infinity,
  maxIaTokensMonthly: Infinity,
  model: "claude-sonnet-4-6",
  dataMigration: true,
};

export const PLANS = [
  "starter",
  "pro",
  "max",
  "standard",
  // Alias legados (talleres/tests que ya usan estos nombres).
  "arranque",
  "cadena",
  "enterprise",
] as const;
export type PlanId = (typeof PLANS)[number];

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: STARTER,
  pro: PRO,
  max: MAX,
  standard: STANDARD,
  // Legados → mapean a los nuevos para no romper filas/tests existentes.
  arranque: STARTER,
  cadena: PRO,
  enterprise: MAX,
};

/** Planes que se ofrecen comercialmente (para UI/pricing). */
export const PUBLIC_PLANS: PlanId[] = ["starter", "pro", "max"];

/** Límites de un plan; cae a Starter si el plan es desconocido. */
export function limitsFor(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan ?? "") as PlanId] ?? STARTER;
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
    maxIaTokensMonthly: num(l.maxIaTokensMonthly),
    model: l.model,
    dataMigration: l.dataMigration,
  };
}
