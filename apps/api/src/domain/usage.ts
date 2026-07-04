import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usageCounters } from "../db/schema.js";
import { argMonth } from "../lib/time.js";
import { withinLimit, type PlanLimits } from "./plans.js";

/** Período actual con formato "YYYY-MM" (mes calendario, hora AR UTC-3). */
export function currentPeriod(): string {
  return argMonth();
}

/** Mensajes IA consumidos por el tenant en el período (default: mes actual). */
export async function getIaUsage(
  tenantId: string,
  period = currentPeriod(),
): Promise<number> {
  const rows = await db
    .select({ n: usageCounters.iaMessages })
    .from(usageCounters)
    .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.period, period)))
    .limit(1);
  return rows[0]?.n ?? 0;
}

/**
 * Suma 1 al contador de IA del mes (upsert atómico) y devuelve el nuevo total.
 * Usa ON CONFLICT para evitar carreras entre mensajes concurrentes del bot.
 */
export async function incIaUsage(
  tenantId: string,
  period = currentPeriod(),
): Promise<number> {
  const rows = await db
    .insert(usageCounters)
    .values({ tenantId, period, iaMessages: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.tenantId, usageCounters.period],
      set: {
        iaMessages: sql`${usageCounters.iaMessages} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ n: usageCounters.iaMessages });
  return rows[0]?.n ?? 0;
}

/** Suma tokens (input/output) consumidos por una llamada a la IA (upsert). */
export async function incIaTokens(
  tenantId: string,
  inputTokens: number,
  outputTokens: number,
  period = currentPeriod(),
): Promise<void> {
  if (!inputTokens && !outputTokens) return;
  await db
    .insert(usageCounters)
    .values({ tenantId, period, iaInputTokens: inputTokens, iaOutputTokens: outputTokens })
    .onConflictDoUpdate({
      target: [usageCounters.tenantId, usageCounters.period],
      set: {
        iaInputTokens: sql`${usageCounters.iaInputTokens} + ${inputTokens}`,
        iaOutputTokens: sql`${usageCounters.iaOutputTokens} + ${outputTokens}`,
        updatedAt: new Date(),
      },
    });
}

/** Tokens IA consumidos por el tenant en el período (input/output). */
export async function getIaTokens(
  tenantId: string,
  period = currentPeriod(),
): Promise<{ input: number; output: number }> {
  const rows = await db
    .select({ i: usageCounters.iaInputTokens, o: usageCounters.iaOutputTokens })
    .from(usageCounters)
    .where(and(eq(usageCounters.tenantId, tenantId), eq(usageCounters.period, period)))
    .limit(1);
  return { input: rows[0]?.i ?? 0, output: rows[0]?.o ?? 0 };
}

/**
 * ¿El tenant tiene cupo de TOKENS este período? Suma input+output del mes y lo
 * compara contra `maxIaTokensMonthly` del plan. `Infinity` (planes legado)
 * siempre permite. Esto acota el costo real mejor que la cuota de mensajes,
 * porque un mensaje puede disparar varias llamadas a la IA.
 */
export async function withinTokenBudget(
  tenantId: string,
  plan: Pick<PlanLimits, "maxIaTokensMonthly">,
  period = currentPeriod(),
): Promise<boolean> {
  const { input, output } = await getIaTokens(tenantId, period);
  return withinLimit(input + output, plan.maxIaTokensMonthly);
}
