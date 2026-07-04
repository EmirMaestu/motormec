import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import {
  customers,
  products,
  transactions,
  vehicles,
  workOrders,
  type OrderPart,
  type Vehicle,
  type WorkOrder,
} from "../db/schema.js";
import { categorizeService } from "./categorize.js";
import { recalcCustomerMetrics } from "./customerMetrics.js";
import { logInventoryMovement, type Actor } from "./movements.js";
import { argYmd } from "../lib/time.js";

function nowIso(): string {
  return new Date().toISOString();
}
function todayDate(): string {
  return argYmd();
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

  // Resolve customer (prefer explicit, else the vehicle's; else create by name).
  let customerId = input.customerId ?? vehicle?.customerId ?? null;
  if (!customerId && input.customerName && input.customerName.trim()) {
    const nombre = input.customerName.trim();
    const todos = await tdb.select(customers);
    const found = todos.find((c) => c.name.toLowerCase() === nombre.toLowerCase());
    const cust = found ?? (await tdb.insertOne(customers, { name: nombre, phone: input.phone ?? "" }));
    customerId = cust.id;
    // Vincular el cliente al vehículo si no tenía.
    if (vehicle && !vehicle.customerId) {
      await tdb.updateById(vehicles, vehicle.id, { customerId, updatedAt: new Date() });
    }
  }
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

  // No se puede editar el detalle financiero de una orden ya finalizada:
  // el ingreso y el stock ya se movieron. Para corregir, reabrí la orden primero.
  if (existing.finalizedAt) {
    const cambiaFinanzas =
      input.parts !== undefined ||
      input.laborCost !== undefined ||
      input.services !== undefined;
    if (cambiaFinanzas) {
      throw new Error("No se puede editar una orden finalizada. Reabrila primero.");
    }
  }

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
  if (order.finalizedAt) {
    return { order, warnings: ["La orden ya estaba finalizada"] };
  }

  return tdb.transaction(async (t) => {
    // Claim atómico: sólo un llamado gana el "finalized_at IS NULL".
    const claimed = await t.update(
      workOrders,
      {
        status: "Entregado",
        deliveryDate: todayDate(),
        finalizedAt: new Date(),
        updatedAt: new Date(),
      },
      and(eq(workOrders.id, id), isNull(workOrders.finalizedAt)),
    );
    if (claimed.length === 0) {
      const current = await t.findById(workOrders, id);
      return { order: current ?? order, warnings: ["La orden ya estaba finalizada"] };
    }
    const finalized = claimed[0] as WorkOrder;
    const warnings: string[] = [];

    // 1. Descontar stock de repuestos de inventario (rollback si falta stock).
    for (const part of order.parts) {
      if (!part.fromInventory || !part.productId) continue;
      const product = await t.findById(products, part.productId);
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
      await t.updateById(products, product.id, {
        quantity: newQty,
        lowStock: newQty <= product.reorderPoint,
        updatedAt: new Date(),
      });
      await logInventoryMovement(t, actor, {
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

    // 2. Ingreso automático (mano de obra + servicios + venta de repuestos).
    if (order.total > 0) {
      await t.insert(transactions, {
        date: todayDate(),
        description: `Orden #${order.number} - ${order.vehiclePlate} (${order.customerName})`,
        type: "Ingreso",
        category: categorizeService(order.services),
        amount: order.total,
        active: true,
        vehicleId: order.vehicleId,
        workOrderId: order.id,
        vehicleDetails: {
          plate: order.vehiclePlate,
          brand: order.vehicleInfo,
          model: "",
          customer: order.customerName,
        },
        paymentMethod: "Efectivo",
      });
    }

    // 3. Actualizar vehículo + métricas del cliente.
    if (order.vehicleId) {
      await t.updateById(vehicles, order.vehicleId, {
        status: "Entregado",
        inTaller: false,
        exitDate: todayDate(),
        cost: order.total,
        lastUpdated: nowIso(),
        updatedAt: new Date(),
      });
      if (order.customerId) await recalcCustomerMetrics(t, order.customerId);
    }

    return { order: finalized, warnings };
  });
}

/**
 * Create the initial work order for a freshly-created vehicle so it shows up in
 * Órdenes. Used by the web "Nuevo vehículo" form and by returning-plate entries.
 */
export async function createOrderForVehicle(
  tdb: TenantDb,
  vehicle: Vehicle,
  input: {
    services?: string[];
    laborCost?: number;
    mileage?: number | null;
    status?: WorkOrder["status"];
    entryDate?: string;
  },
): Promise<WorkOrder> {
  const laborCost = input.laborCost ?? 0;
  const { partsCost, total } = computeTotals([], laborCost);
  const customer = vehicle.customerId ? await tdb.findById(customers, vehicle.customerId) : null;
  return tdb.insertOne(workOrders, {
    number: await nextNumber(tdb),
    vehicleId: vehicle.id,
    customerId: vehicle.customerId ?? null,
    vehiclePlate: vehicle.plate,
    vehicleInfo: `${vehicle.brand} ${vehicle.model}`.trim(),
    customerName: customer?.name ?? vehicle.owner ?? "",
    status: input.status ?? "Pendiente",
    services: input.services ?? [],
    parts: [],
    laborCost,
    partsCost,
    total,
    mileage: input.mileage ?? null,
    entryDate: input.entryDate ?? vehicle.entryDate,
    estimatedDate: null,
  });
}

/**
 * Reopen a delivered order (correction — e.g. the vehicle was marked delivered by
 * mistake and returned to the shop). Restores any stock deducted at delivery,
 * reverses the delivery income, and clears the finalized markers.
 */
export async function reopenOrder(
  tdb: TenantDb,
  actor: Actor,
  id: string,
  targetStatus: WorkOrder["status"] = "En reparación",
): Promise<WorkOrder | null> {
  const order = await tdb.findById(workOrders, id);
  if (!order) return null;

  return tdb.transaction(async (t) => {
    // 1. Reponer stock descontado en la entrega.
    if (order.finalizedAt) {
      for (const part of order.parts) {
        if (!part.fromInventory || !part.productId) continue;
        const product = await t.findById(products, part.productId);
        if (!product) continue;
        const newQty = product.quantity + part.quantity;
        await t.updateById(products, product.id, {
          quantity: newQty,
          lowStock: newQty <= product.reorderPoint,
          updatedAt: new Date(),
        });
        await logInventoryMovement(t, actor, {
          productId: product.id,
          productName: product.name,
          productType: product.type,
          movementType: "stock_increase",
          previousQuantity: product.quantity,
          newQuantity: newQty,
          quantityChange: part.quantity,
          reason: `Reapertura orden #${order.number}`,
        });
      }
    }

    // 2. Revertir el ingreso de la entrega (ligado a ESTA orden, no al vehículo:
    //    dos órdenes del mismo vehículo tienen ingresos distintos).
    const income = await t.selectOne(
      transactions,
      and(
        eq(transactions.workOrderId, order.id),
        eq(transactions.type, "Ingreso"),
        eq(transactions.active, true),
      ),
    );
    if (income) {
      await t.updateById(transactions, income.id, { active: false, updatedAt: new Date() });
    }

    // 3. Reabrir la orden.
    const reopened = await t.updateById(workOrders, id, {
      status: targetStatus,
      finalizedAt: null,
      deliveryDate: null,
      updatedAt: new Date(),
    });
    // Devolver el vehículo al taller (sync de estado con la orden reabierta).
    if (order.vehicleId) {
      await t.updateById(vehicles, order.vehicleId, {
        status: "En Reparación",
        inTaller: true,
        exitDate: null,
        lastUpdated: nowIso(),
        updatedAt: new Date(),
      });
    }
    if (order.customerId) await recalcCustomerMetrics(t, order.customerId);
    return reopened ?? order;
  });
}

/** All orders for a vehicle, newest first (full history). */
export async function orderHistoryForVehicle(
  tdb: TenantDb,
  vehicleId: string,
): Promise<WorkOrder[]> {
  const rows = await tdb.select(workOrders, eq(workOrders.vehicleId, vehicleId));
  return rows.sort((a, b) => b.number - a.number);
}
