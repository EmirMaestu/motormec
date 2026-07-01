import type { FastifyInstance } from "fastify";
import { and, eq, gte, lte, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { customers, historialTaller, vehicles, workOrders } from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import * as V from "../domain/vehicles.js";

const partSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  price: z.number(),
  quantity: z.number(),
  source: z.enum(["client", "purchased"]),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

const responsibleSchema = z.object({
  name: z.string(),
  assignedAt: z.string().optional(),
  role: z.string().optional(),
  userId: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

const createSchema = z.object({
  plate: z.string().min(1).max(20),
  brand: z.string().max(60).optional(),
  model: z.string().max(80).optional(),
  year: z.number().int().optional().nullable(),
  owner: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  customerId: z.string().uuid().optional().nullable(),
  status: z.string().max(40).optional(),
  entryDate: z.string().max(40).optional(),
  services: z.array(z.string()).optional(),
  cost: z.number().optional(),
  description: z.string().max(4000).optional().nullable(),
  mileage: z.number().int().optional().nullable(),
  responsibles: z.array(responsibleSchema).optional(),
});

const updateSchema = z.object({
  plate: z.string().max(20).optional(),
  brand: z.string().max(60).optional(),
  model: z.string().max(80).optional(),
  year: z.number().int().optional().nullable(),
  owner: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  customerId: z.string().uuid().optional().nullable(),
  status: z.string().max(40).optional(),
  entryDate: z.string().max(40).optional(),
  exitDate: z.string().max(40).optional().nullable(),
  services: z.array(z.string()).optional(),
  cost: z.number().optional(),
  description: z.string().max(4000).optional().nullable(),
  mileage: z.number().int().optional().nullable(),
  parts: z.array(partSchema).optional(),
  costs: z
    .object({ laborCost: z.number(), partsCost: z.number(), totalCost: z.number() })
    .optional(),
});

export async function vehicleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/vehicles", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const q = request.query as {
      status?: string;
      q?: string;
      startDate?: string;
      endDate?: string;
      scope?: string;
    };
    const conds = [];
    if (q.status) conds.push(eq(vehicles.status, q.status));
    if (q.startDate) conds.push(gte(vehicles.entryDate, q.startDate));
    if (q.endDate) conds.push(lte(vehicles.entryDate, q.endDate));
    if (q.q)
      conds.push(
        or(
          ilike(vehicles.plate, `%${q.q}%`),
          ilike(vehicles.brand, `%${q.q}%`),
          ilike(vehicles.model, `%${q.q}%`),
          ilike(vehicles.owner, `%${q.q}%`),
        )!,
      );
    let rows = await tenantDb.select(
      vehicles,
      conds.length ? (and(...conds) as ReturnType<typeof and>) : undefined,
    );
    if (q.scope === "mine") {
      rows = V.vehiclesForUser(rows, auth.userId, auth.role === "admin");
    }
    rows.sort((a, b) => ((a.lastUpdated ?? a.entryDate) < (b.lastUpdated ?? b.entryDate) ? 1 : -1));
    return reply.send({ vehicles: rows });
  });

  app.get("/api/vehicles/stats", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const all = await tenantDb.select(vehicles);
    return reply.send(V.vehicleStats(all));
  });

  // Distinct plates with visit count, total spent, last visit, currently in taller.
  app.get("/api/vehicles/plates", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const all = await tenantDb.select(vehicles);
    const map = new Map<
      string,
      { plate: string; visitCount: number; totalSpent: number; lastVisit: string; isInTaller: boolean }
    >();
    for (const v of all) {
      const e = map.get(v.plate) ?? {
        plate: v.plate,
        visitCount: 0,
        totalSpent: 0,
        lastVisit: v.entryDate,
        isInTaller: false,
      };
      e.visitCount += 1;
      e.totalSpent += v.cost ?? 0;
      if (v.entryDate > e.lastVisit) e.lastVisit = v.entryDate;
      if (v.inTaller) e.isInTaller = true;
      map.set(v.plate, e);
    }
    return reply.send({ plates: [...map.values()].sort((a, b) => (a.lastVisit < b.lastVisit ? 1 : -1)) });
  });

  app.get("/api/vehicles/search", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const plate = (request.query as { plate?: string }).plate?.trim();
    if (!plate || plate.length < 2) return reply.send({ vehicle: null });
    const matches = await tenantDb.select(vehicles, ilike(vehicles.plate, `%${plate}%`));
    if (matches.length === 0) return reply.send({ vehicle: null });
    const latest = matches.sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1))[0]!;
    const customer = latest.customerId
      ? await tenantDb.findById(customers, latest.customerId)
      : null;
    return reply.send({
      vehicle: latest,
      customer,
      visitCount: matches.filter((m) => m.plate === latest.plate).length,
    });
  });

  // Full history for a plate (all visits + aggregate stats).
  app.get("/api/vehicles/history", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const plate = (request.query as { plate?: string }).plate?.trim();
    if (!plate) return reply.code(400).send({ error: "plate_required" });
    const visits = await tenantDb.select(vehicles, eq(vehicles.plate, plate));
    if (visits.length === 0) return reply.send({ history: null });
    visits.sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
    const totalSpent = visits.reduce((s, v) => s + (v.cost ?? 0), 0);
    const deliveredVisits = visits.filter((v) => v.status === "Entregado").length;
    return reply.send({
      history: {
        plate,
        visits,
        visitCount: visits.length,
        totalSpent,
        deliveredVisits,
      },
    });
  });

  app.get("/api/vehicles/work-summary", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const all = await tenantDb.select(vehicles);
    const mine = all.filter((v) =>
      (v.responsibles ?? []).some((r) => r.userId === auth.userId),
    );
    return reply.send({
      totalAssigned: mine.length,
      inProgress: mine.filter((v) => v.status === "En Reparación").length,
      completed: mine.filter((v) => v.status === "Listo" || v.status === "Entregado").length,
      vehicles: mine,
    });
  });

  app.get("/api/vehicles/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const vehicle = await tenantDb.findById(vehicles, id);
    if (!vehicle) return reply.code(404).send({ error: "not_found" });
    const customer = vehicle.customerId
      ? await tenantDb.findById(customers, vehicle.customerId)
      : null;
    return reply.send({ vehicle, customer });
  });

  // Detalle del vehículo: info + cliente + órdenes (historial) + fotos.
  app.get("/api/vehicles/:id/detail", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const { id } = request.params as { id: string };
    const vehicle = await tenantDb.findById(vehicles, id);
    if (!vehicle) return reply.code(404).send({ error: "not_found" });
    const customer = vehicle.customerId
      ? await tenantDb.findById(customers, vehicle.customerId)
      : null;
    const orderRows = (await tenantDb.select(workOrders, eq(workOrders.vehicleId, id))).sort(
      (a, b) => b.number - a.number,
    );
    const hist = await tenantDb.select(historialTaller, eq(historialTaller.vehicleId, id));
    // Fotos agrupadas por orden (el "momento" del ingreso). Las que no tienen
    // orden vinculada (historial viejo) van a un bucket general.
    const photosByOrder = new Map<string, string[]>();
    const loosePhotos: string[] = [];
    for (const h of hist) {
      const fotos = h.fotoPaths ?? [];
      if (!fotos.length) continue;
      if (h.workOrderId) {
        photosByOrder.set(h.workOrderId, [...(photosByOrder.get(h.workOrderId) ?? []), ...fotos]);
      } else {
        loosePhotos.push(...fotos);
      }
    }
    const orders = orderRows.map((o) => ({ ...o, photos: photosByOrder.get(o.id) ?? [] }));
    const photos = hist.flatMap((h) => h.fotoPaths ?? []); // compat: todas las fotos
    return reply.send({ vehicle, customer, orders, photos, loosePhotos });
  });

  app.post("/api/vehicles", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const vehicle = await V.createVehicle(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      { ...parsed.data, responsibles: parsed.data.responsibles as never, withOrder: true },
    );
    return reply.code(201).send({ vehicle });
  });

  app.post("/api/vehicles/new-entry", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const schema = z.object({
      plate: z.string().min(1),
      services: z.array(z.string()).optional(),
      cost: z.number().optional(),
      description: z.string().optional().nullable(),
      mileage: z.number().int().optional().nullable(),
      entryDate: z.string().optional(),
      responsibles: z.array(responsibleSchema).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const vehicle = await V.createNewEntryForPlate(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      { ...parsed.data, responsibles: parsed.data.responsibles as never },
    );
    if (!vehicle) return reply.code(404).send({ error: "plate_not_found" });
    return reply.code(201).send({ vehicle });
  });

  app.patch("/api/vehicles/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
    const vehicle = await V.updateVehicle(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      id,
      parsed.data as never,
    );
    if (!vehicle) return reply.code(404).send({ error: "not_found" });
    return reply.send({ vehicle });
  });

  app.delete(
    "/api/vehicles/:id",
    { preHandler: requireRole("admin") },
    async (request, reply) => {
      const { tenantDb, auth } = authed(request);
      const { id } = request.params as { id: string };
      const removed = await V.deleteVehicle(
        tenantDb,
        { userId: auth.userId, userName: auth.userName },
        id,
      );
      if (!removed) return reply.code(404).send({ error: "not_found" });
      return reply.send({ ok: true });
    },
  );

  app.post("/api/vehicles/:id/start", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const vehicle = await V.startWork(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      id,
      auth.role === "admin",
    );
    if (!vehicle) return reply.code(404).send({ error: "not_found" });
    return reply.send({ vehicle });
  });

  app.post("/api/vehicles/:id/pause", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const result = await V.pauseWork(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      id,
    );
    if (result === null) return reply.code(404).send({ error: "not_found" });
    if (result === "not_working") return reply.code(409).send({ error: "not_working" });
    return reply.send({ vehicle: result.vehicle, workDuration: result.workDuration });
  });

  app.post("/api/vehicles/:id/complete", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const { id } = request.params as { id: string };
    const result = await V.completeWork(
      tenantDb,
      { userId: auth.userId, userName: auth.userName },
      id,
    );
    if (result === null) return reply.code(404).send({ error: "not_found" });
    if (result === "not_working") return reply.code(409).send({ error: "not_working" });
    return reply.send({ vehicle: result.vehicle, workDuration: result.workDuration });
  });

  app.post("/api/vehicles/close-workday", { preHandler: requireAuth }, async (request, reply) => {
    const { tenantDb, auth } = authed(request);
    const updatedCount = await V.closeWorkDay(tenantDb, auth.userId);
    return reply.send({ updatedCount });
  });

  app.post(
    "/api/vehicles/:id/assign-customer",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const parsed = z.object({ customerId: z.string().uuid() }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_input" });
      const vehicle = await V.assignCustomer(tenantDb, id, parsed.data.customerId);
      if (!vehicle) return reply.code(404).send({ error: "not_found" });
      return reply.send({ vehicle });
    },
  );

  app.post(
    "/api/vehicles/:id/remove-customer",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tenantDb } = authed(request);
      const { id } = request.params as { id: string };
      const vehicle = await V.removeCustomer(tenantDb, id);
      if (!vehicle) return reply.code(404).send({ error: "not_found" });
      return reply.send({ vehicle });
    },
  );
}
