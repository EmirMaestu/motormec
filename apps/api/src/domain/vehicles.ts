import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { TenantDb } from "../db/scope.js";
import {
  customers,
  vehicles,
  type VehicleCosts,
  type VehiclePart,
  type VehicleResponsible,
  type Vehicle,
} from "../db/schema.js";
import { recalcCustomerMetrics } from "./customerMetrics.js";
import { logVehicleMovement, type Actor } from "./movements.js";

const DELIVERED = "Entregado";
const SUSPENDED = "Suspendido";
const IN_REPAIR = "En Reparación";

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
}

/**
 * Create a vehicle. If no customerId is given but a phone is, link/create the
 * customer by phone. Logs a `created` movement and recomputes customer metrics.
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
  const updated = await tdb.updateById(vehicles, id, patch);
  if (!updated) return null;

  // Customer metrics on customer reassignment.
  if (input.customerId !== undefined && input.customerId !== existing.customerId) {
    if (existing.customerId) await recalcCustomerMetrics(tdb, existing.customerId);
    if (input.customerId) await recalcCustomerMetrics(tdb, input.customerId);
  } else if (existing.customerId && input.cost !== undefined) {
    await recalcCustomerMetrics(tdb, existing.customerId);
  }

  // Movement log.
  if (input.status && input.status !== existing.status) {
    const movementType =
      input.status === DELIVERED
        ? "delivered"
        : input.status === SUSPENDED
          ? "suspended"
          : "status_changed";
    await logVehicleMovement(tdb, actor, {
      vehicleId: id,
      vehiclePlate: updated.plate,
      vehicleInfo: vehicleInfo(updated),
      owner: updated.owner,
      movementType,
      previousStatus: existing.status,
      newStatus: input.status,
    });
  } else {
    await logVehicleMovement(tdb, actor, {
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

  return updated;
}

export async function deleteVehicle(
  tdb: TenantDb,
  actor: Actor,
  id: string,
): Promise<Vehicle | null> {
  const existing = await tdb.findById(vehicles, id);
  if (!existing) return null;
  const removed = await tdb.deleteById(vehicles, id);
  if (!removed) return null;
  await logVehicleMovement(tdb, actor, {
    vehicleId: null,
    vehiclePlate: existing.plate,
    vehicleInfo: vehicleInfo(existing),
    owner: existing.owner,
    movementType: "deleted",
  });
  if (existing.customerId) await recalcCustomerMetrics(tdb, existing.customerId);
  return removed;
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
  resp.isWorking = true;
  resp.workStartedAt = startedAt;
  resp.workSessions = [...(resp.workSessions ?? []), { startTime: startedAt }];

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
