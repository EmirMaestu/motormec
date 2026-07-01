import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { resetDb } from "./helpers.js";

let app: FastifyInstance;
let adminCookie: string;
let mechCookie: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

async function loginAs(slug: string, username: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { tenantSlug: slug, username, password },
  });
  const c = res.cookies.find((x) => x.name === "mm_session");
  return `mm_session=${c?.value}`;
}

beforeEach(async () => {
  await resetDb();
  const t = await createTenant({ name: "Taller A", slug: "taller-a" });
  await createUser({
    tenantId: t.id, name: "Dueño", username: "admin", password: "secret123", role: "admin",
  });
  await createUser({
    tenantId: t.id, name: "Mecánico", username: "mecanico", password: "secret123", role: "mecanico",
  });
  adminCookie = await loginAs("taller-a", "admin", "secret123");
  mechCookie = await loginAs("taller-a", "mecanico", "secret123");
});

const J = { "content-type": "application/json" };

describe("Phase 2 domain flows", () => {
  it("creating a vehicle auto-links a customer and updates metrics", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/vehicles",
      headers: { cookie: adminCookie, ...J },
      payload: {
        plate: "AB123CD",
        brand: "Ford",
        model: "Focus",
        owner: "Juan Perez",
        phone: "5491111",
        services: ["Cambio de aceite"],
        cost: 50000,
        status: "Ingresado",
        entryDate: "2026-06-01",
      },
    });
    expect(res.statusCode).toBe(201);
    const vehicle = res.json().vehicle;
    expect(vehicle.customerId).toBeTruthy();

    const customers = (
      await app.inject({ method: "GET", url: "/api/customers", headers: { cookie: adminCookie } })
    ).json().customers;
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe("Juan Perez");

    const metrics = (
      await app.inject({
        method: "GET",
        url: `/api/customers/${vehicle.customerId}/metrics`,
        headers: { cookie: adminCookie },
      })
    ).json();
    expect(metrics.totalVehicles).toBe(1);
    expect(metrics.totalSpent).toBe(50000);
  });

  it("work timer assigns responsible, sets En Reparación, and accumulates time", async () => {
    const v = (
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate: "TT111", entryDate: "2026-06-01" },
      })
    ).json().vehicle;

    const started = (
      await app.inject({
        method: "POST",
        url: `/api/vehicles/${v.id}/start`,
        headers: { cookie: mechCookie },
      })
    ).json().vehicle;
    expect(started.status).toBe("En Reparación");
    expect(started.responsibles).toHaveLength(1);
    expect(started.responsibles[0].isWorking).toBe(true);

    const paused = await app.inject({
      method: "POST",
      url: `/api/vehicles/${v.id}/pause`,
      headers: { cookie: mechCookie },
    });
    expect(paused.statusCode).toBe(200);
    expect(paused.json().workDuration).toBeGreaterThanOrEqual(0);
    expect(paused.json().vehicle.responsibles[0].isWorking).toBe(false);
    expect(paused.json().vehicle.responsibles[0].totalWorkTime).toBeGreaterThanOrEqual(0);
  });

  it("delivering a vehicle records a delivered movement; vehicle transaction posts income", async () => {
    const v = (
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate: "DEL999", entryDate: "2026-06-01", cost: 30000, services: ["Frenos"] },
      })
    ).json().vehicle;

    // Entregar el vehículo genera el ingreso en finanzas automáticamente.
    const delivered = await app.inject({
      method: "PATCH",
      url: `/api/vehicles/${v.id}`,
      headers: { cookie: adminCookie, ...J },
      payload: { status: "Entregado" },
    });
    expect(delivered.json().vehicle.inTaller).toBe(false);
    expect(delivered.json().vehicle.exitDate).toBeTruthy();

    const summary = (
      await app.inject({
        method: "GET",
        url: "/api/transactions/summary",
        headers: { cookie: adminCookie },
      })
    ).json();
    expect(summary.totalIngresos).toBe(30000);

    // El ingreso quedó categorizado por el servicio y no se duplica al re-entregar.
    const txs = (
      await app.inject({ method: "GET", url: "/api/transactions", headers: { cookie: adminCookie } })
    ).json();
    const ingresos = txs.transactions.filter(
      (t: { type: string; amount: number }) => t.type === "Ingreso" && t.amount === 30000,
    );
    expect(ingresos).toHaveLength(1);
    expect(ingresos[0].category).toBe("Frenos");
  });

  it("creating a vehicle from the web also creates a Work Order (shows in Órdenes)", async () => {
    const v = (
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate: "ORD777", brand: "VW", model: "Gol", cost: 12000, services: ["Service"] },
      })
    ).json().vehicle;

    const orders = (
      await app.inject({ method: "GET", url: "/api/orders", headers: { cookie: adminCookie } })
    ).json().orders;
    expect(orders).toHaveLength(1);
    expect(orders[0].vehicleId).toBe(v.id);
    expect(orders[0].total).toBe(12000);
    expect(orders[0].services).toEqual(["Service"]);
  });

  it("reverting a delivered vehicle to En Reparación reopens the order and reverses income", async () => {
    const v = (
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate: "BACK55", cost: 40000, services: ["Motor"] },
      })
    ).json().vehicle;

    // Entregar → ingreso 40000.
    await app.inject({
      method: "PATCH",
      url: `/api/vehicles/${v.id}`,
      headers: { cookie: adminCookie, ...J },
      payload: { status: "Entregado" },
    });
    let summary = (
      await app.inject({ method: "GET", url: "/api/transactions/summary", headers: { cookie: adminCookie } })
    ).json();
    expect(summary.totalIngresos).toBe(40000);

    // Devolver a En Reparación → orden reabierta e ingreso revertido.
    await app.inject({
      method: "PATCH",
      url: `/api/vehicles/${v.id}`,
      headers: { cookie: adminCookie, ...J },
      payload: { status: "En Reparación" },
    });

    const orders = (
      await app.inject({ method: "GET", url: "/api/orders", headers: { cookie: adminCookie } })
    ).json().orders;
    expect(orders[0].status).toBe("En reparación");
    expect(orders[0].finalizedAt).toBeFalsy();

    summary = (
      await app.inject({ method: "GET", url: "/api/transactions/summary", headers: { cookie: adminCookie } })
    ).json();
    expect(summary.totalIngresos).toBe(0);
  });

  it("uploads a photo to an order (linked to that order's moment)", async () => {
    await app.inject({
      method: "POST",
      url: "/api/vehicles",
      headers: { cookie: adminCookie, ...J },
      payload: { plate: "PIC001", brand: "VW", model: "Gol" },
    });
    const order = (
      await app.inject({ method: "GET", url: "/api/orders", headers: { cookie: adminCookie } })
    ).json().orders[0];

    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const up = await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/photos`,
      headers: { cookie: adminCookie, ...J },
      payload: { image: png },
    });
    expect(up.statusCode).toBe(201);
    expect(up.json().photos).toHaveLength(1);

    const detail = (
      await app.inject({ method: "GET", url: `/api/orders/${order.id}`, headers: { cookie: adminCookie } })
    ).json();
    expect(detail.photos).toHaveLength(1);
    expect(detail.photos[0]).toMatch(/\.png$/);
  });

  it("products: create + update log inventory movements and compute lowStock", async () => {
    const created = (
      await app.inject({
        method: "POST",
        url: "/api/products",
        headers: { cookie: adminCookie, ...J },
        payload: { name: "Aceite", quantity: 10, reorderPoint: 5, price: 2000, unit: "L", type: "Lubricante" },
      })
    ).json().product;
    expect(created.lowStock).toBe(false);

    const updated = (
      await app.inject({
        method: "PATCH",
        url: `/api/products/${created.id}`,
        headers: { cookie: adminCookie, ...J },
        payload: { quantity: 3 },
      })
    ).json().product;
    expect(updated.lowStock).toBe(true);

    const stats = (
      await app.inject({
        method: "GET",
        url: "/api/products/movement-stats",
        headers: { cookie: adminCookie },
      })
    ).json();
    expect(stats.created).toBe(1);
    expect(stats.stockDecreases).toBe(1);
  });

  it("mechanic is forbidden from finance endpoints (role enforcement)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/transactions/summary",
      headers: { cookie: mechCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("financial report aggregates by category and month", async () => {
    await app.inject({
      method: "POST",
      url: "/api/transactions",
      headers: { cookie: adminCookie, ...J },
      payload: { date: "2026-06-01", description: "venta", type: "Ingreso", category: "Motor", amount: 1000 },
    });
    await app.inject({
      method: "POST",
      url: "/api/transactions",
      headers: { cookie: adminCookie, ...J },
      payload: { date: "2026-06-02", description: "compra", type: "Egreso", category: "Repuestos", amount: 400 },
    });
    const rep = (
      await app.inject({
        method: "GET",
        url: "/api/reports/financial",
        headers: { cookie: adminCookie },
      })
    ).json();
    expect(rep.resumen.ingresos).toBe(1000);
    expect(rep.resumen.egresos).toBe(400);
    expect(rep.resumen.balance).toBe(600);
    expect(rep.tendenciaMensual.find((m: { mes: string }) => m.mes === "2026-06")).toBeTruthy();
  });
});
