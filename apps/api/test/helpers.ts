import { sql } from "drizzle-orm";
import { db } from "../src/db/client.js";

/** Truncate all data tables between tests for a clean slate. */
export async function resetDb(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      wallet_ledger,
      referrals,
      webhook_events,
      charges,
      subscriptions,
      payment_methods,
      billing_customers,
      usage_counters,
      work_orders,
      historial_taller,
      conversaciones,
      categories,
      services,
      partners,
      transactions,
      inventory_movements,
      products,
      vehicle_movements,
      vehicles,
      customers,
      numeros_autorizados,
      platform_sessions,
      platform_admins,
      sessions,
      users,
      tenants
    RESTART IDENTITY CASCADE
  `);
}
