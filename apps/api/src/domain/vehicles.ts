import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { TenantDb } from "../db/scope.js";
import {
  customers,
  transactions,
  vehicles,
  workOrders,
  type VehicleCosts,
  type VehiclePart,
  type VehicleResponsible,
  type Vehicle,
  type WorkOrder,
} from "../db/schema.js";
import { categorizeService } from "./categorize.js";
import { recalcCustomerMetrics } from "./customerMetrics.js";
import { logVehicleMovement, type Actor } from "./movements.js";
import { createOrderForVehicle, finalizeOrder, reopenOrder } from "./orders.js";

const DELIVERED = "Entregado";
const SUSPENDED = "Suspendido";
const IN_REPAIR = "En Reparación";

// Estado del vehículo (5) → estado de la orden (7). Mantiene ambos en sync.
const VEH_TO_ORDER: Record<string, WorkOrder["status"]> = {
  Ingresado: "Pendiente",
  "En Reparación": "En reparación",
  Listo: "Listo para entregar",
  Entregado: "Entregado",
  Suspendido: "Cancelado",
};

/**
 * Al cambiar el estado del vehículo, sincroniza su última orden y, si se entrega,
 * genera el ingreso en finanzas (finaliza la orden, o crea el movimiento con el
 * costo del vehículo si no hay orden). Evita ingresos duplicados.
 */
async function syncOrderAndFinance(
  tdb: TenantDb,
  actor: Actor,
  vehicle: Vehicle,
): Promise<void> {
  const orders = (await tdb.select(workOrders, eq(workOrders.vehicleId, vehicle.id))).sort(
    (a, b) => b.number - a.number,
  );
  const latest = orders[0];

  // El vehículo volvió a un estado de trabajo pero su orden estaba entregada:
  // corrección → reabrir la orden y revertir el ingreso de la entrega.
  if (
    vehicle.status !== DELIVERED &&
    latest &&
    (latest.status === "Entregado" || latest.finalizedAt)
  ) {
    await reopenOrder(tdb, actor, latest.id, VEH_TO_ORDER[vehicle.status] ?? "En reparación");
    return;
  }

  if (vehicle.status === DELIVERED) {
    if (latest && !latest.finalizedAt) {
      // Si falta stock, finalizeOrder lanza y la operación se revierte entera.
      // Propagamos el error: el caller (updateVehicle) revierte el cambio de estado
      // del vehículo para no dejarlo "Entregado" a medias, y la ruta lo muestra.
      await finalizeOrder(tdb, actor, latest.id);
      return;
    }
    if (!latest && (vehicle.cost ?? 0) > 0) {
      // Vehículo entregado sin orden → generar ingreso con el costo del vehículo,
      // salvo que ya exista un ingreso activo para este vehículo.
      const yaHay = await tdb.selectOne(
        transactions,
        and(
          eq(transactions.vehicleId, vehicle.id),
          eq(transactions.type, "Ingreso"),
          eq(transactions.active, true),
        ),
      );
      if (!yaHay) {
        await tdb.insert(transactions, {
          date: todayDate(),
          description: `${vehicle.plate} - ${`${vehicle.brand} ${vehicle.model}`.trim()} (${vehicle.owner})`,
          type: "Ingreso",
          category: categorizeService(vehicle.services ?? []),
          amount: vehicle.cost,
          active: true,
          vehicleId: vehicle.id,
          vehicleDetails: {
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            customer: vehicle.owner,
          },
          paymentMethod: "Efectivo",
        });
      }
    }
    return;
  }

  // Estados de trabajo: reflejar en la última orden (sin re-tocar el vehículo).
  if (latest && latest.status !== "Entregado" && latest.status !== "Cancelado") {
    const target = VEH_TO_ORDER[vehicle.status];
    if (target && latest.status !== target) {
      await tdb.updateById(workOrders, latest.id, { status: target, updatedAt: new Date() });
    }
  }
}

function nowIso(): string {
  return new Date().toISOString();
}
function todayDate(): string {
  return new Date().toISOString().split("T")[0] as string;
}
function computeInTaller(status: string): boolean {
  return status !== DELIVERED && status !== SUSPENDED;
}
function vehicleInfo(v: { brand: string; model: string; year: number | null }): string {
  return [v.brand, v.model, v.year].filter(Boolean).join(" ").trim();
}
function partsCostOf(parts: VehiclePart[]): number {
  return parts.reduce((s, p) => s + (p.price ?? 0) * (p.quantity ?? 0), 0);
}

export interface CreateVehicleInput {
  plate: string;
  brand?: string;
  model?: string;
  year?: number | null;
  owner?: string;
  phone?: string;
  customerId?: string | null;
  status?: string;
  entryDate?: string;
  services?: string[];
  cost?: number;
  description?: string | null;
  mileage?: number | null;
  responsibles?: VehicleResponsible[];
  /** Also create a linked Work Order so the vehicle appears in Órdenes. */
  withOrder?: boolean;
}

/**
 * Create a vehicle. If no customerId is given but a phone is, link/create the
 * customer by phone. Logs a `created` movement and recomputes customer metrics.
 * When `withOrder` is set, also creates the linked Work Order (Órdenes).
 */
export async function createVehicle(
  tdb: TenantDb,
  actor: Actor,
  input: CreateVehicleInput,
): Promise<Vehicle> {
  let customerId = input.customerId ?? null;
  const owner = input.owner ?? "";
  const phone = input.phone ?? "";

  if (!customerId && phone) {
    const existing = await tdb.selectOne(
      customers,
      and(eq(customers.phone, phone), eq(customers.active, true)),
    );
    if (existing) {
      customerId = existing.id;
    } else if (owner) {
      const created = await tdb.insertOne(customers, { name: owner, phone });
      customerId = created.id;
    }
  }

  const status = input.status ?? "Ingresado";
  const inTaller = computeInTaller(status);
  const entryDate = input.entryDate ?? todayDate();

  const vehicle = await tdb.insertOne(vehicles, {
    plate: input.plate,
    brand: input.brand ?? "",
    model: input.model ?? "",
    year: input.year ?? null,
    owner,
    phone,
    customerId,
    status,
    entryDate,
    exitDate: inTaller ? null : todayDate(),
    services: input.services ?? [],
    cost: input.cost ?? 0,
    description: input.description ?? null,
    mileage: input.mileage ?? null,
    inTaller,
    responsibles: input.responsibles ?? [],
    lastUpdated: nowIso(),
  });

  await logVehicleMovement(tdb, actor, {
    vehicleId: vehicle.id,
    vehiclePlate: vehicle.plate,
    vehicleInfo: vehicleInfo(vehicle),
    owner: vehicle.owner,
    movementType: "created",
    newStatus: status,
    description: "Vehículo ingresado",
    details: { newData: vehicle },
  });

  // Cada ingreso genera su Orden de trabajo (para que aparezca en Órdenes).
  if (input.withOrder) {
    await createOrderForVehicle(tdb, vehicle, {
      services: input.services ?? [],
      laborCost: input.cost ?? 0,
      mileage: input.mileage ?? null,
      status: VEH_TO_ORDER[status] ?? "Pendiente",
    });
  }

  if (customerId) await recalcCustomerMetrics(tdb, customerId);
  return vehicle;
}

export interface UpdateVehicleInput {
  plate?: string;
  brand?: string;
  model?: string;
  year?: number | null;
  owner?: string;
  phone?: string;
  customerId?: string | null;
  status?: string;
  entryDate?: string;
  exitDate?: string | null;
  services?: string[];
  cost?: number;
  description?: string | null;
  mileage?: number | null;
  responsibles?: VehicleResponsible[];
  parts?: VehiclePart[];
  costs?: VehicleCosts;
}

export async function updateVehicle(
  tdb: TenantDb,
  actor: Actor,
  id: string,
  input: UpdateVehicleInput,
): Promise<Vehicle | null> {
  const existing = await tdb.findById(vehicles, id);
  if (!existing) return null;

  const patch: Record<string, unknown> = { ...input, lastUpdated: nowIso() };

  // Status → inTaller / exitDate transitions.
  if (input.status && input.status !== existing.status) {
    if (input.status === DELIVERED || input.status === SUSPENDED) {
      patch.inTaller = false;
      patch.exitDate = todayDate();
    } else {
      patch.inTaller = true;
      patch.exitDate = null;
    }
  }

  // Recompute costs when parts/costs change.
  if (input.parts || input.costs) {
    const parts = input.parts ?? existing.parts ?? [];
    const laborCost = input.costs?.laborCost ?? existing.costs?.laborCost ?? 0;
    const pCost = partsCostOf(parts);
    patch.costs = { laborCost, partsCost: pCost, totalCost: laborCost + pCost };
    if (input.cost === undefined) patch.cost = laborCost + pCost;
  }

  patch.updatedAt = new Date();

  // Todo en una transacción: si la finalización de la orden falla (p.ej. falta
  // stock), se revierte también el cambio de estado del vehículo — así NO queda
  // "Entregado" a medias. El error se propaga para que la ruta lo muestre.
  return tdb.transaction(async (t) => {
    const updated = await t.updateById(vehicles, id, patch);
    if (!updated) return null;

    // Customer metrics on customer reassignment.
    if (input.customerId !== undefined && input.customerId !== existing.customerId) {
      if (existing.customerId) await recalcCustomerMetrics(t, existing.customerId);
      if (input.customerId) await recalcCustomerMetrics(t, input.customerId);
    } else if (existing.customerId && input.cost !== undefined) {
      await recalcCustomerMetrics(t, existing.customerId);
    }

    // Movement log.
    if (input.status && input.status !== existing.status) {
      const movementType =
        input.status === DELIVERED
          ? "delivered"
          : input.status === SUSPENDED
            ? "suspended"
            : "status_changed";
      await logVehicleMovement(t, actor, {
        vehicleId: id,
        vehiclePlate: updated.plate,
        vehicleInfo: vehicleInfo(updated),
        owner: updated.owner,
        movementType,
        previousStatus: existing.status,
        newStatus: input.status,
      });
    } else {
      await logVehicleMovement(t, actor, {
        vehicleId: id,
        vehiclePlate: updated.plate,
        vehicleInfo: vehicleInfo(updated),
        owner: updated.owner,
        movementType: "updated",
        previousCost: existing.cost,
        newCost: updated.cost,
        costChange: updated.cost - existing.cost,
        previousServices: existing.services,
        newServices: updated.services,
      });
    }

    // Sincronizar la orden y finanzas cuando cambió el estado del vehículo.
    if (input.status && input.status !== existing.status) {
      await syncOrderAndFinance(t, actor, updated);
    }

    return updated;
  });
}

export async function deleteVehicle(
  tdb: TenantDb,
  actor: Actor,
  id: string,
): Promise<Vehicle | null> {
  const existing = await tdb.findById(vehicles, id);
  if (!existing) return null;
  return tdb.transaction(async (t) => {
    // Desactivar los ingresos ligados a este vehículo (no borrarlos: preservar auditoría).
    const ingresos = await t.select(
      transactions,
      and(eq(transactions.vehicleId, id), eq(transactions.type, "Ingreso"), eq(transactions.active, true)),
    );
    for (const inc of ingresos) {
      await t.updateById(transactions, inc.id, { active: false, updatedAt: new Date() });
    }
    // Borrar también las órdenes de este vehículo (si no, quedan en Órdenes).
    await t.delete(workOrders, eq(workOrders.vehicleId, id));
    const removed = await t.deleteById(vehicles, id);
    if (!removed) return null;
    await logVehicleMovement(t, actor, {
      vehicleId: null,
      vehiclePlate: existing.plate,
      vehicleInfo: vehicleInfo(existing),
      owner: existing.owner,
      movementType: "deleted",
    });
    if (existing.customerId) await recalcCustomerMetrics(t, existing.customerId);
    return removed;
  });
}

/* ----------------------------- work timer ------------------------------- */

export interface TimerActor {
  userId: string;
  userName: string;
}

export async function startWork(
  tdb: TenantDb,
  actor: TimerActor,
  vehicleId: string,
  isAdmin: boolean,
): Promise<Vehicle | null> {
  const vehicle = await tdb.findById(vehicles, vehicleId);
  if (!vehicle) return null;
  const responsibles = [...(vehicle.responsibles ?? [])];
  const existing = responsibles.find((r) => r.userId === actor.userId);
  const isNew = !existing;
  const resp: VehicleResponsible = existing ?? {
    name: actor.userName,
    assignedAt: nowIso(),
    role: isAdmin ? "Admin" : "Miembro",
    userId: actor.userId,
    isAdmin,
    isWorking: false,
    totalWorkTime: 0,
    workSessions: [],
  };
  if (isNew) responsibles.push(resp);
  const startedAt = nowIso();
  // Cerrar cualquier sesión abierta previa de este responsable (evita solapadas).
  resp.workSessions = (resp.workSessions ?? []).map((s) =>
    s.endTime ? s : { ...s, endTime: startedAt, duration: Date.parse(startedAt) - Date.parse(s.startTime) },
  );
  resp.isWorking = true;
  resp.workStartedAt = startedAt;
  resp.workSessions = [...resp.workSessions, { startTime: startedAt }];

  const status = vehicle.status !== IN_REPAIR ? IN_REPAIR : vehicle.status;
  const updated = await tdb.updateById(vehicles, vehicleId, {
    responsibles,
    status,
    inTaller: true,
    lastUpdated: nowIso(),
    updatedAt: new Date(),
  });

  if (isNew) {
    await logVehicleMovement(tdb, actor, {
      vehicleId,
      vehiclePlate: vehicle.plate,
      vehicleInfo: vehicleInfo(vehicle),
      owner: vehicle.owner,
      movementType: "assigned",
      assignedUser: actor.userId,
      assignedUserName: actor.userName,
    });
  }
  await logVehicleMovement(tdb, actor, {
    vehicleId,
    vehiclePlate: vehicle.plate,
    vehicleInfo: vehicleInfo(vehicle),
    owner: vehicle.owner,
    movementType: "work_started",
    assignedUser: actor.userId,
    assignedUserName: actor.userName,
    workDuration: 0,
    details: { workSession: { startTime: startedAt } },
  });
  return updated;
}

async function stopWork(
  tdb: TenantDb,
  actor: TimerActor,
  vehicleId: string,
  movementType: "work_paused" | "work_completed",
): Promise<{ vehicle: Vehicle; workDuration: number } | null | "not_working"> {
  const vehicle = await tdb.findById(vehicles, vehicleId);
  if (!vehicle) return null;
  const responsibles = [...(vehicle.responsibles ?? [])];
  const resp = responsibles.find((r) => r.userId === actor.userId);
  if (!resp || !resp.isWorking || !resp.workStartedAt) return "not_working";

  const endTime = nowIso();
  const duration = new Date(endTime).getTime() - new Date(resp.workStartedAt).getTime();
  const sessions = [...(resp.workSessions ?? [])];
  const last = sessions[sessions.length - 1];
  if (last && !last.endTime) {
    last.endTime = endTime;
    last.duration = duration;
  }
  resp.workSessions = sessions;
  resp.totalWorkTime = (resp.totalWorkTime ?? 0) + duration;
  resp.isWorking = false;
  resp.workStartedAt = undefined;

  const updated = await tdb.updateById(vehicles, vehicleId, {
    responsibles,
    lastUpdated: nowIso(),
    updatedAt: new Date(),
  });
  if (!updated) return null;

  await logVehicleMovement(tdb, actor, {
    vehicleId,
    vehiclePlate: vehicle.plate,
    vehicleInfo: vehicleInfo(vehicle),
    owner: vehicle.owner,
    movementType,
    assignedUser: actor.userId,
    assignedUserName: actor.userName,
    workDuration: duration,
    details: { workSession: { startTime: last?.startTime ?? endTime, endTime, duration } },
  });
  return { vehicle: updated, workDuration: duration };
}

export const pauseWork = (tdb: TenantDb, actor: TimerActor, vehicleId: string) =>
  stopWork(tdb, actor, vehicleId, "work_paused");

export const completeWork = (tdb: TenantDb, actor: TimerActor, vehicleId: string) =>
  stopWork(tdb, actor, vehicleId, "work_completed");

export async function closeWorkDay(
  tdb: TenantDb,
  userId: string,
): Promise<number> {
  const all = await tdb.select(vehicles, eq(vehicles.status, IN_REPAIR));
  const mine = all.filter((v) =>
    (v.responsibles ?? []).some((r) => r.userId === userId),
  );
  for (const v of mine) {
    await tdb.updateById(vehicles, v.id, {
      status: "Listo",
      lastUpdated: nowIso(),
      updatedAt: new Date(),
    });
  }
  return mine.length;
}

/* ------------------------- customer association -------------------------- */

export async function assignCustomer(
  tdb: TenantDb,
  vehicleId: string,
  customerId: string,
): Promise<Vehicle | null> {
  const vehicle = await tdb.findById(vehicles, vehicleId);
  const customer = await tdb.findById(customers, customerId);
  if (!vehicle || !customer) return null;
  const oldCustomerId = vehicle.customerId;
  const updated = await tdb.updateById(vehicles, vehicleId, {
    customerId,
    owner: customer.name,
    phone: customer.phone,
    updatedAt: new Date(),
  });
  if (oldCustomerId && oldCustomerId !== customerId) {
    await recalcCustomerMetrics(tdb, oldCustomerId);
  }
  await recalcCustomerMetrics(tdb, customerId);
  return updated;
}

export async function removeCustomer(
  tdb: TenantDb,
  vehicleId: string,
): Promise<Vehicle | null> {
  const vehicle = await tdb.findById(vehicles, vehicleId);
  if (!vehicle || !vehicle.customerId) return null;
  const oldCustomerId = vehicle.customerId;
  const updated = await tdb.updateById(vehicles, vehicleId, {
    customerId: null,
    updatedAt: new Date(),
  });
  await recalcCustomerMetrics(tdb, oldCustomerId);
  return updated;
}

export async function createNewEntryForPlate(
  tdb: TenantDb,
  actor: Actor,
  input: {
    plate: string;
    services?: string[];
    cost?: number;
    description?: string | null;
    mileage?: number | null;
    entryDate?: string;
    responsibles?: VehicleResponsible[];
  },
): Promise<Vehicle | null> {
  const matches = await tdb.select(vehicles, eq(vehicles.plate, input.plate));
  if (matches.length === 0) return null;
  const latest = matches.sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1))[0]!;
  return createVehicle(tdb, actor, {
    plate: latest.plate,
    brand: latest.brand,
    model: latest.model,
    year: latest.year,
    owner: latest.owner,
    phone: latest.phone,
    customerId: latest.customerId,
    status: "Ingresado",
    entryDate: input.entryDate ?? todayDate(),
    services: input.services ?? [],
    cost: input.cost ?? 0,
    description: input.description ?? null,
    mileage: input.mileage ?? null,
    responsibles: input.responsibles ?? [],
    withOrder: true,
  });
}

/* ------------------------------ queries --------------------------------- */

export function vehiclesForUser(
  all: Vehicle[],
  userId: string,
  isAdmin: boolean,
): Vehicle[] {
  const inTaller = all.filter((v) => v.inTaller ?? computeInTaller(v.status));
  if (isAdmin) return inTaller;
  return inTaller.filter(
    (v) =>
      (v.responsibles ?? []).length === 0 ||
      (v.responsibles ?? []).some((r) => r.userId === userId),
  );
}

export function vehicleStats(all: Vehicle[]) {
  const inTaller = all.filter((v) => v.inTaller ?? computeInTaller(v.status));
  const byStatus = (s: string) => all.filter((v) => v.status === s).length;
  return {
    total: all.length,
    inTaller: inTaller.length,
    outOfTaller: all.length - inTaller.length,
    byStatus: {
      ingresados: byStatus("Ingresado"),
      enReparacion: byStatus(IN_REPAIR),
      listos: byStatus("Listo"),
      entregados: byStatus(DELIVERED),
      suspendidos: byStatus(SUSPENDED),
    },
    totalEarnings: all
      .filter((v) => v.status === DELIVERED)
      .reduce((s, v) => s + (v.cost ?? 0), 0),
  };
}
