import type { TenantDb } from "../db/scope.js";
import {
  inventoryMovements,
  vehicleMovements,
  type MovementDetails,
} from "../db/schema.js";

export interface Actor {
  userId?: string | null;
  userName?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type VehicleMovementInput = {
  vehicleId?: string | null;
  vehiclePlate: string;
  vehicleInfo?: string;
  owner?: string;
  movementType: (typeof vehicleMovements.$inferInsert)["movementType"];
  previousStatus?: string | null;
  newStatus?: string | null;
  previousCost?: number | null;
  newCost?: number | null;
  costChange?: number | null;
  assignedUser?: string | null;
  assignedUserName?: string | null;
  unassignedUser?: string | null;
  unassignedUserName?: string | null;
  workDuration?: number | null;
  workSessionId?: string | null;
  previousServices?: string[] | null;
  newServices?: string[] | null;
  reason?: string | null;
  description?: string | null;
  details?: MovementDetails | null;
};

/** Append a vehicle audit movement (tenant-scoped). */
export async function logVehicleMovement(
  tdb: TenantDb,
  actor: Actor,
  input: VehicleMovementInput,
): Promise<void> {
  await tdb.insert(vehicleMovements, {
    vehicleId: input.vehicleId ?? null,
    vehiclePlate: input.vehiclePlate,
    vehicleInfo: input.vehicleInfo ?? "",
    owner: input.owner ?? "",
    movementType: input.movementType,
    previousStatus: input.previousStatus ?? null,
    newStatus: input.newStatus ?? null,
    previousCost: input.previousCost ?? null,
    newCost: input.newCost ?? null,
    costChange: input.costChange ?? null,
    assignedUser: input.assignedUser ?? null,
    assignedUserName: input.assignedUserName ?? null,
    unassignedUser: input.unassignedUser ?? null,
    unassignedUserName: input.unassignedUserName ?? null,
    workDuration: input.workDuration ?? null,
    workSessionId: input.workSessionId ?? null,
    previousServices: input.previousServices ?? null,
    newServices: input.newServices ?? null,
    reason: input.reason ?? null,
    description: input.description ?? null,
    timestamp: nowIso(),
    userId: actor.userId ?? null,
    userName: actor.userName ?? null,
    details: input.details ?? null,
  });
}

export type InventoryMovementInput = {
  productId?: string | null;
  productName: string;
  productType?: string;
  movementType: (typeof inventoryMovements.$inferInsert)["movementType"];
  previousQuantity?: number | null;
  newQuantity?: number | null;
  quantityChange?: number | null;
  previousPrice?: number | null;
  newPrice?: number | null;
  reason?: string | null;
  details?: MovementDetails | null;
};

/** Append an inventory audit movement (tenant-scoped). */
export async function logInventoryMovement(
  tdb: TenantDb,
  actor: Actor,
  input: InventoryMovementInput,
): Promise<void> {
  await tdb.insert(inventoryMovements, {
    productId: input.productId ?? null,
    productName: input.productName,
    productType: input.productType ?? "",
    movementType: input.movementType,
    previousQuantity: input.previousQuantity ?? null,
    newQuantity: input.newQuantity ?? null,
    quantityChange: input.quantityChange ?? null,
    previousPrice: input.previousPrice ?? null,
    newPrice: input.newPrice ?? null,
    reason: input.reason ?? null,
    timestamp: nowIso(),
    userId: actor.userId ?? null,
    userName: actor.userName ?? null,
    details: input.details ?? null,
  });
}
