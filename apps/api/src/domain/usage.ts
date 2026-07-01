import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usageCounters } from "../db/schema.js";

/** Período actual con formato "YYYY-MM" (mes calendario). */
export function currentPeriod(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
