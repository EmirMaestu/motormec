import { and, desc, eq, sql } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import {
  customers,
  products,
  transactions,
  vehicles,
  workOrders,
  type OrderPart,
  type WorkOrder,
} from "../db/schema.js";
import { categorizeService } from "./categorize.js";
import { recalcCustomerMetrics } from "./customerMetrics.js";
import { logInventoryMovement, type Actor } from "./movements.js";

function nowIso(): string {
  return new Date().toISOString();
}
function todayDate(): string {
  return new Date().toISOString().split("T")[0] as string;
}

function computeTotals(parts: OrderPart[], laborCost: number) {
  const partsCost = parts.reduce((s, p) => s + (p.unitPrice ?? 0) * (p.quantity ?? 0), 0);
  return { partsCost, total: partsCost + laborCost };
}

/** Next per-tenant order number (sequential, gap-tolerant). */
async function nextNumber(tdb: TenantDb): Promise<number> {
  const rows = await tdb.select(workOrders);
  return rows.reduce((max, o) => Math.max(max, o.number), 0) + 1;
}

export interface CreateOrderInput {
  vehicleId?: string | null;
  // For creating/reusing a vehicle when no vehicleId is supplied:
  plate?: string;
  brand?: string;
  model?: string;
  customerId?: string | null;
  customerName?: string;
  phone?: string;
  services?: string[];
  parts?: OrderPart[];
  laborCost?: number;
  mileage?: number | null;
  notes?: string;
  estimatedDate?: string | null;
  entryDate?: string;
}

/**
 * Create a work order. The vehicle is reused when it already exists (by id, or
 * by plate within the tenant) — a vehicle exists once; each intake is an order.
 */
export async function createOrder(
  tdb: TenantDb,
  actor: Actor,
  input: CreateOrderInput,
): Promise<WorkOrder> {
  // Resolve the vehicle (reuse by id or plate; create if new).
  let vehicle =
    input.vehicleId != null ? await tdb.findById(vehicles, input.vehicleId) : null;
  if (!vehicle && input.plate) {
    const plate = input.plate.toUpperCase().trim();
    vehicle = await tdb.selectOne(vehicles, eq(vehicles.plate, plate));
    if (!vehicle) {
      vehicle = await tdb.insertOne(vehicles, {
        plate,
        brand: input.brand ?? "",
        model: input.model ?? "",
        owner: input.customerName ?? "",
        phone: input.phone ?? "",
        customerId: input.customerId ?? null,
        status: "Ingresado",
        entryDate: input.entryDate ?? todayDate(),
        services: [],
        cost: 0,
      });
    }
  }

  // Resolve customer (prefer explicit, else the vehicle's).
  const customerId = input.customerId ?? vehicle?.customerId ?? null;
  const customer = customerId ? await tdb.findById(customers, customerId) : null;

  const parts = input.parts ?? [];
  const laborCost = input.laborCost ?? 0;
  const { partsCost, total } = computeTotals(parts, laborCost);

  const order = await tdb.insertOne(workOrders, {
    number: await nextNumber(tdb),
    vehicleId: vehicle?.id ?? null,
    customerId,
    vehiclePlate: vehicle?.plate ?? input.plate?.toUpperCase() ?? "",
    vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : "",
    customerName: customer?.name ?? input.customerName ?? vehicle?.owner ?? "",
    status: "Pendiente",
    services: input.services ?? [],
    parts,
    laborCost,
    partsCost,
    total,
    mileage: input.mileage ?? null,
    notes: input.notes ?? null,
    entryDate: input.entryDate ?? todayDate(),
    estimatedDate: input.estimatedDate ?? null,
  });

  // Keep the vehicle's snapshot status in sync for the dashboard.
  if (vehicle) {
    await tdb.updateById(vehicles, vehicle.id, {
      status: "Ingresado",
      inTaller: true,
      lastUpdated: nowIso(),
      updatedAt: new Date(),
    });
  }
  return order;
}

export interface UpdateOrderInput {
  status?: WorkOrder["status"];
  services?: string[];
  parts?: OrderPart[];
  laborCost?: number;
  notes?: string;
  estimatedDate?: string | null;
  mileage?: number | null;
}

/** Update an order; recomputes totals. Does NOT finalize (use finalizeOrder). */
export async function updateOrder(
  tdb: TenantDb,
  id: string,
  input: UpdateOrderInput,
): Promise<WorkOrder | null> {
  const existing = await tdb.findById(workOrders, id);
  if (!existing) return null;

  const parts = input.parts ?? existing.parts;
  const laborCost = input.laborCost ?? existing.laborCost;
  const { partsCost, total } = computeTotals(parts, laborCost);

  const patch: Record<string, unknown> = {
    ...input,
    parts,
    laborCost,
    partsCost,
    total,
    updatedAt: new Date(),
  };

  // Mirror status onto the vehicle snapshot.
  const updated = await tdb.updateById(workOrders, id, patch);
  if (updated && input.status && updated.vehicleId) {
    const vehicleStatus =
      input.status === "Entregado"
        ? "Entregado"
        : input.status === "Cancelado"
          ? "Suspendido"
          : input.status === "Listo para entregar"
            ? "Listo"
            : "En Reparación";
    await tdb.updateById(vehicles, updated.vehicleId, {
      status: vehicleStatus,
      inTaller: input.status !== "Entregado" && input.status !== "Cancelado",
      lastUpdated: nowIso(),
      updatedAt: new Date(),
    });
  }
  return updated;
}

export interface FinalizeResult {
  order: WorkOrder;
  warnings: string[];
}

/**
 * Finalize an order (deliver): deduct inventory for parts taken from stock,
 * log inventory movements, and create the automatic finance income. Idempotent
 * via finalizedAt. Throws if a stock part has insufficient quantity.
 */
export async function finalizeOrder(
  tdb: TenantDb,
  actor: Actor,
  id: string,
): Promise<FinalizeResult | null> {
  const order = await tdb.findById(workOrders, id);
  if (!order) return null;
  const warnings: string[] = [];

  if (order.finalizedAt) {
    return { order, warnings: ["La orden ya estaba finalizada"] };
  }

  // 1. Deduct stock for inventory-sourced parts.
  for (const part of order.parts) {
    if (!part.fromInventory || !part.productId) continue;
    const product = await tdb.findById(products, part.productId);
    if (!product) {
      warnings.push(`Producto no encontrado: ${part.name}`);
      continue;
    }
    if (product.quantity < part.quantity) {
      throw new Error(
        `Stock insuficiente de "${product.name}" (hay ${product.quantity}, se necesitan ${part.quantity})`,
      );
    }
    const newQty = product.quantity - part.quantity;
    await tdb.updateById(products, product.id, {
      quantity: newQty,
      lowStock: newQty <= product.reorderPoint,
      updatedAt: new Date(),
    });
    await logInventoryMovement(tdb, actor, {
      productId: product.id,
      productName: product.name,
      productType: product.type,
      movementType: "stock_decrease",
      previousQuantity: product.quantity,
      newQuantity: newQty,
      quantityChange: -part.quantity,
      reason: `Orden #${order.number}`,
    });
  }

  // 2. Automatic income (mano de obra + servicios + venta de repuestos).
  if (order.total > 0) {
    await tdb.insert(transactions, {
      date: todayDate(),
      description: `Orden #${order.number} - ${order.vehiclePlate} (${order.customerName})`,
      type: "Ingreso",
      category: categorizeService(order.services),
      amount: order.total,
      active: true,
      vehicleId: order.vehicleId,
      vehicleDetails: {
        plate: order.vehiclePlate,
        brand: order.vehicleInfo,
        model: "",
        customer: order.customerName,
      },
      paymentMethod: "Efectivo",
    });
  }

  // 3. Mark finalized + update vehicle + customer metrics.
  const finalized = await tdb.updateById(workOrders, id, {
    status: "Entregado",
    deliveryDate: todayDate(),
    finalizedAt: new Date(),
    updatedAt: new Date(),
  });

  if (order.vehicleId) {
    await tdb.updateById(vehicles, order.vehicleId, {
      status: "Entregado",
      inTaller: false,
      exitDate: todayDate(),
      cost: order.total,
      lastUpdated: nowIso(),
      updatedAt: new Date(),
    });
    if (order.customerId) await recalcCustomerMetrics(tdb, order.customerId);
  }

  return { order: finalized ?? order, warnings };
}

/** All orders for a vehicle, newest first (full history). */
export async function orderHistoryForVehicle(
  tdb: TenantDb,
  vehicleId: string,
): Promise<WorkOrder[]> {
  const rows = await tdb.select(workOrders, eq(workOrders.vehicleId, vehicleId));
  return rows.sort((a, b) => b.number - a.number);
}
