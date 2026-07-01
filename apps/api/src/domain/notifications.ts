import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { customers, tenants, vehicles, type WorkOrder } from "../db/schema.js";
import { decryptSecret } from "../crypto/secrets.js";
import { enviarMensaje } from "../whatsapp/client.js";

/**
 * Avisos automáticos al cliente por WhatsApp cuando una orden cambia de estado.
 *
 * - Sólo se envía si el taller tiene WhatsApp configurado y `notifyCustomers`
 *   no está desactivado en settings.
 * - Sólo ciertos estados generan aviso (los irrelevantes se ignoran).
 * - Es best-effort: nunca lanza ni bloquea la respuesta de la API.
 */

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Plantilla por estado. `null` = no se notifica ese estado. */
function plantilla(
  status: WorkOrder["status"],
  ctx: { taller: string; cliente: string; vehiculo: string; patente: string; total: number },
): string | null {
  const { taller, cliente, vehiculo, patente, total } = ctx;
  const saludo = cliente ? `Hola ${cliente},` : "Hola,";
  const auto = vehiculo || `tu vehículo${patente ? ` (${patente})` : ""}`;
  switch (status) {
    case "En reparación":
      return `🔧 ${saludo} ya comenzamos a trabajar en ${auto}. Te avisamos cuando esté listo.\n— ${taller}`;
    case "Esperando repuestos":
      return `⏳ ${saludo} ${auto} está a la espera de repuestos. Te avisamos en cuanto lleguen.\n— ${taller}`;
    case "Listo para entregar":
      return `✅ ${saludo} ${auto} ya está *listo para retirar*${
        total > 0 ? `. Total: ${ARS.format(total)}` : ""
      }. ¡Te esperamos!\n— ${taller}`;
    case "Entregado":
      return `🙌 ${saludo} registramos la entrega de ${auto}. ¡Gracias por confiar en nosotros!\n— ${taller}`;
    default:
      // Pendiente / Diagnosticando / Cancelado → sin aviso automático.
      return null;
  }
}

/** Normaliza un teléfono a formato WhatsApp AR (`549<area><local>`), best-effort. */
export function toWaNumber(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) {
    // 54<area><local> sin el 9 → insertarlo.
    return "549" + digits.slice(2);
  }
  // Número local (con o sin 0/15) → asumir AR y prefijar 549.
  let local = digits;
  if (local.startsWith("0")) local = local.slice(1);
  if (local.length >= 13 && local.startsWith("15")) local = local.slice(2);
  return "549" + local;
}

function safeDecrypt(value: string): string {
  try {
    return decryptSecret(value);
  } catch {
    return "";
  }
}

/**
 * Envía (si corresponde) el aviso al cliente por el cambio de estado de la orden.
 * Devuelve true si se envió, false en cualquier otro caso (sin throw).
 */
export async function notifyOrderStatusChange(order: WorkOrder): Promise<boolean> {
  try {
    const status = order.status;
    // ¿Estado notificable? (cortocircuito antes de tocar la DB)
    const tRows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, order.tenantId))
      .limit(1);
    const tenant = tRows[0];
    if (!tenant || !tenant.active) return false;
    if (!tenant.waPhoneNumberId || !tenant.waAccessToken) return false;

    // Toggle (default ON si no está seteado).
    const notify = (tenant.settings as Record<string, unknown> | null)?.notifyCustomers;
    if (notify === false) return false;

    // Resolver teléfono del cliente (cliente → vehículo).
    let phoneRaw = "";
    let nombre = order.customerName ?? "";
    if (order.customerId) {
      const cRows = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, order.customerId), eq(customers.tenantId, order.tenantId)))
        .limit(1);
      if (cRows[0]) {
        phoneRaw = cRows[0].phone || "";
        nombre = nombre || cRows[0].name;
      }
    }
    if (!phoneRaw && order.vehicleId) {
      const vRows = await db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, order.vehicleId), eq(vehicles.tenantId, order.tenantId)))
        .limit(1);
      if (vRows[0]) phoneRaw = vRows[0].phone || "";
    }
    const to = toWaNumber(phoneRaw);
    if (!to) return false;

    const texto = plantilla(status, {
      taller: tenant.name,
      cliente: (nombre || "").split(" ")[0] ?? "",
      vehiculo: order.vehicleInfo || "",
      patente: order.vehiclePlate || "",
      total: order.total ?? 0,
    });
    if (!texto) return false;

    return await enviarMensaje(
      { phoneNumberId: tenant.waPhoneNumberId, accessToken: safeDecrypt(tenant.waAccessToken) },
      to,
      texto,
    );
  } catch {
    return false;
  }
}
