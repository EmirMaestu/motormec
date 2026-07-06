import { eq } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import { orderStatus, workOrders } from "../db/schema.js";
import { updateOrder } from "../domain/orders.js";
import { notifyOrderStatusChange } from "../domain/notifications.js";

/**
 * Comandos de edición/borrado de órdenes por chat (WhatsApp/Telegram).
 * Detección determinística (regex) — barata y predecible. Ejemplos:
 *   "cancelá la #128"            → Cancelado (no se pierde historial)
 *   "marcá #128 entregada"       → estado Entregado
 *   "estado #128 en reparación"  → estado En reparación
 *   "km #128 50000"              → kilometraje
 *   "mano de obra #128 25000"    → mano de obra (recalcula total)
 */

export interface BotCommand {
  type: "cancelar" | "estado" | "km" | "mano_obra";
  number: number;
  estado?: (typeof orderStatus)[number];
  amount?: number;
}

// Trailing \b is omitted on purpose: Spanish verbs end in accents ("marcá",
// "cancelá") and de-accenting them ("marca") still needs to match by prefix.
const VERB = /\b(borr|elimin|cancel|estado|marc|pas|pon|cambi|actualiz|km|kilometr|mano de obra)/;

// Patterns run on de-accented text; the returned value is the canonical status.
const STATE_SYNONYMS: Array<[RegExp, (typeof orderStatus)[number]]> = [
  [/cancel/, "Cancelado"],
  [/entreg/, "Entregado"],
  [/list[oa]|termin/, "Listo para entregar"],
  [/esperando.*repuesto|falt[ao].*repuesto/, "Esperando repuestos"],
  [/diagnostic/, "Diagnosticando"],
  [/reparacion|reparando/, "En reparación"],
  [/pendiente/, "Pendiente"],
];

/** Lowercase + strip diacritics so accents don't break word matching. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function parseNumber(t: string): number | null {
  const m =
    t.match(/#\s*(\d{1,6})/) ||
    t.match(/\borden(?:\s+(?:n[°º]?|nro\.?|n[uú]mero))?\s*#?\s*(\d{1,6})/i) ||
    t.match(/\bla\s+#?\s*(\d{1,6})\b/i);
  return m && m[1] ? Number.parseInt(m[1], 10) : null;
}

function valueNumber(t: string, exclude: number): number | null {
  const nums = (t.match(/\d[\d.]*/g) ?? [])
    .map((s) => Number.parseInt(s.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n !== exclude);
  return nums.length ? (nums[nums.length - 1] ?? null) : null;
}

/** Returns a structured command, or null if the message is not a command. */
export function detectarComando(texto: string): BotCommand | null {
  const t = norm(texto.trim());
  if (!VERB.test(t)) return null;
  const number = parseNumber(t);
  if (number === null) return null;

  if (/\b(borr|elimin|cancel)/.test(t)) return { type: "cancelar", number };

  if (/\b(km|kilometr)/.test(t)) {
    const amount = valueNumber(t, number);
    if (amount !== null) return { type: "km", number, amount };
  }
  if (/mano de obra/.test(t)) {
    const amount = valueNumber(t, number);
    if (amount !== null) return { type: "mano_obra", number, amount };
  }
  for (const [re, estado] of STATE_SYNONYMS) {
    if (re.test(t)) return { type: "estado", number, estado };
  }
  return null;
}

/** Execute a command and return a human reply to send back to the user. */
export async function ejecutarComando(tdb: TenantDb, cmd: BotCommand): Promise<string> {
  const order = await tdb.selectOne(workOrders, eq(workOrders.number, cmd.number));
  if (!order) return `No encontré la orden #${cmd.number}.`;

  switch (cmd.type) {
    case "cancelar":
      await updateOrder(tdb, order.id, { status: "Cancelado" });
      return `🗑️ Orden #${cmd.number} cancelada (queda en el historial).`;
    case "estado": {
      const updated = await updateOrder(tdb, order.id, { status: cmd.estado });
      // Mismo aviso al cliente que cuando el cambio viene del dashboard.
      if (updated && order.status !== updated.status) {
        void notifyOrderStatusChange(updated).catch(() => {});
      }
      return `✏️ Orden #${cmd.number} → estado "${cmd.estado}".`;
    }
    case "km":
      await updateOrder(tdb, order.id, { mileage: cmd.amount });
      return `✏️ Orden #${cmd.number} → ${cmd.amount} km.`;
    case "mano_obra": {
      // El usuario dicta PESOS; el dinero se guarda en CENTAVOS (×100).
      const pesos = cmd.amount ?? 0;
      const updated = await updateOrder(tdb, order.id, { laborCost: Math.round(pesos * 100) });
      const money = (c: number) => Math.round((c ?? 0) / 100).toLocaleString("es-AR");
      return `✏️ Orden #${cmd.number} → mano de obra $${pesos.toLocaleString("es-AR")}. Total: $${money(updated?.total ?? 0)}.`;
    }
  }
}
