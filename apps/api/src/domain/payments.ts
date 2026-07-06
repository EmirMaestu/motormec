import { eq, sql } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import {
  payments,
  paymentKind,
  transactions,
  workOrders,
  type Payment,
  type WorkOrder,
} from "../db/schema.js";
import { categorizeService } from "./categorize.js";
import { argYmd } from "../lib/time.js";
import type { Actor } from "./movements.js";

export type PaymentStatus = "impaga" | "parcial" | "pagada";

export function paymentStatus(total: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return "impaga";
  if (paidAmount >= total) return "pagada";
  return "parcial";
}

/** Normaliza el método de pago al enum `paymentKind` (default "efectivo"). */
function normalizeMethod(method?: string): Payment["method"] {
  const m = (method ?? "efectivo") as Payment["method"];
  return (paymentKind as readonly string[]).includes(m) ? m : "efectivo";
}

export interface RegistrarPagoInput {
  amount: number;
  method?: string;
  note?: string;
}

export interface PagoResult {
  payment: Payment;
  order: WorkOrder;
  saldo: number;
  estado: PaymentStatus;
}

/**
 * Registra un pago de una orden: inserta el payment, incrementa paid_amount y
 * crea el ingreso en finanzas por lo cobrado. Atómico. El fiado está permitido
 * (el pago puede ser parcial); el ingreso refleja sólo lo efectivamente cobrado.
 */
export async function registrarPago(
  tdb: TenantDb,
  actor: Actor,
  orderId: string,
  input: RegistrarPagoInput,
): Promise<PagoResult | null> {
  const order = await tdb.findById(workOrders, orderId);
  if (!order) return null;
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El monto del pago debe ser mayor a 0.");
  }
  const method = normalizeMethod(input.method);
  return tdb.transaction(async (t) => {
    const payment = await t.insertOne(payments, {
      workOrderId: order.id,
      customerId: order.customerId,
      amount,
      method,
      paidAt: argYmd(),
      note: input.note ?? null,
    });
    const [updated] = await t.update(
      workOrders,
      { paidAmount: sql`${workOrders.paidAmount} + ${amount}`, updatedAt: new Date() },
      eq(workOrders.id, order.id),
    );
    await t.insert(transactions, {
      date: argYmd(),
      description: `Pago orden #${order.number} - ${order.vehiclePlate} (${order.customerName})`,
      type: "Ingreso",
      category: categorizeService(order.services),
      amount,
      active: true,
      vehicleId: order.vehicleId,
      workOrderId: order.id,
      vehicleDetails: {
        plate: order.vehiclePlate,
        brand: order.vehicleInfo,
        model: "",
        customer: order.customerName,
      },
      paymentMethod: method,
    });
    const finalOrder = (updated as WorkOrder) ?? order;
    const saldo = finalOrder.total - finalOrder.paidAmount;
    return {
      payment,
      order: finalOrder,
      saldo,
      estado: paymentStatus(finalOrder.total, finalOrder.paidAmount),
    };
  });
}
