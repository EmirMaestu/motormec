import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { transactions, vehicles } from "../db/schema.js";
import { authed, requireAuth } from "../auth/middleware.js";
import { vehicleStats, vehiclesForUser } from "../domain/vehicles.js";

/**
 * Combined dashboard KPIs, computed on the fly (no persisted metrics tables).
 * Admins see workshop-wide numbers; mechanics see their own workload.
 */
export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/dashboard", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const isAdmin = auth.role === "admin";
    const allVehicles = await tenantDb.select(vehicles);
    const stats = vehicleStats(allVehicles);

    // Monthly income/expense/balance series (current calendar year).
    const txs = isAdmin
      ? await tenantDb.select(transactions, eq(transactions.active, true))
      : [];
    const monthly = new Map<string, { ingresos: number; egresos: number }>();
    for (const t of txs) {
      const mes = t.date.substring(0, 7);
      const e = monthly.get(mes) ?? { ingresos: 0, egresos: 0 };
      if (t.type === "Ingreso") e.ingresos += t.amount;
      else e.egresos += Math.abs(t.amount);
      monthly.set(mes, e);
    }
    const totalIngresos = txs.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const totalEgresos = txs
      .filter((t) => t.type === "Egreso")
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const myVehicles = vehiclesForUser(allVehicles, auth.userId, isAdmin);
    const recentTransactions = isAdmin
      ? [...txs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
      : [];

    return reply.send({
      role: auth.role,
      vehicleStats: stats,
      myVehicles,
      workDay: {
        totalAssigned: myVehicles.filter((v) =>
          (v.responsibles ?? []).some((r) => r.userId === auth.userId),
        ).length,
        inProgress: myVehicles.filter((v) => v.status === "En Reparación").length,
        completed: myVehicles.filter((v) => v.status === "Listo").length,
      },
      finance: isAdmin
        ? {
            totalIngresos,
            totalEgresos,
            balance: totalIngresos - totalEgresos,
            monthly: [...monthly.entries()]
              .map(([mes, v]) => ({ mes, ...v, balance: v.ingresos - v.egresos }))
              .sort((a, b) => (a.mes < b.mes ? -1 : 1)),
            recentTransactions,
          }
        : null,
    });
  });
}
