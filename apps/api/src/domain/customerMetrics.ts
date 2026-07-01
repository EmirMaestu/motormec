import { eq } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import { customers, vehicles } from "../db/schema.js";

/**
 * Recompute and persist a customer's denormalized metrics from their vehicles.
 * Mirrors the Convex logic 1:1:
 *   totalVehicles = COUNT(vehicles)
 *   totalSpent    = SUM(vehicle.cost)
 *   lastVisit     = MAX(entryDate)
 *   visitCount    = totalVehicles
 */
export async function recalcCustomerMetrics(
  tdb: TenantDb,
  customerId: string,
): Promise<void> {
  const rows = await tdb.select(vehicles, eq(vehicles.customerId, customerId));
  const totalVehicles = rows.length;
  const totalSpent = rows.reduce((sum, v) => sum + (v.cost ?? 0), 0);
  const lastVisit =
    rows.length > 0
      ? rows
          .map((v) => v.entryDate)
          .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))[0]
      : null;

  await tdb.update(
    customers,
    {
      totalVehicles,
      totalSpent,
      lastVisit: lastVisit ?? null,
      visitCount: totalVehicles,
      updatedAt: new Date(),
    },
    eq(customers.id, customerId),
  );
}
