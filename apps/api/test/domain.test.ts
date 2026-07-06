import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { forTenant } from "../src/db/scope.js";
import { vehicles } from "../src/db/schema.js";
import { resetDb } from "./helpers.js";

let app: FastifyInstance;
let adminCookie: string;
let mechCookie: string;
let tenantId: string;

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
  tenantId = t.id;
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

  it("startWork twice does not open a second overlapping session", async () => {
    const tdb = forTenant(tenantId);
    const { startWork } = await import("../src/domain/vehicles.js");
    const v0 = await tdb.insertOne(vehicles, { plate: "TIM111", entryDate: "2026-07-01", status: "Ingresado" });
    const timer = { userId: "u1", userName: "Pepe" };
    await startWork(tdb, timer, v0.id, false);
    const v = await startWork(tdb, timer, v0.id, false);
    const resp = v?.responsibles.find((r) => r.userId === "u1");
    const abiertas = (resp?.workSessions ?? []).filter((s) => !s.endTime);
    expect(abiertas.length).toBe(1); // no dos abiertas
  });

  it("delivering a vehicle records a delivered movement (no income until paid)", async () => {
    const v = (
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate: "DEL999", entryDate: "2026-06-01", cost: 30000, services: ["Frenos"] },
      })
    ).json().vehicle;

    // Entregar el vehículo lo marca como entregado, pero NO genera ingreso:
    // el ingreso viene de cada pago (registrarPago). Fiado permitido.
    const delivered = await app.inject({
      method: "PATCH",
      url: `/api/vehicles/${v.id}`,
      headers: { cookie: adminCookie, ...J },
      payload: { status: "Entregado" },
    });
    expect(delivered.json().vehicle.inTaller).toBe(false);
    expect(delivered.json().vehicle.exitDate).toBeTruthy();

    // Sin pagos, no hay ingreso al entregar.
    const summary = (
      await app.inject({
        method: "GET",
        url: "/api/transactions/summary",
        headers: { cookie: adminCookie },
      })
    ).json();
    expect(summary.totalIngresos).toBe(0);

    const txs = (
      await app.inject({ method: "GET", url: "/api/transactions", headers: { cookie: adminCookie } })
    ).json();
    const ingresos = txs.transactions.filter(
      (t: { type: string }) => t.type === "Ingreso",
    );
    expect(ingresos).toHaveLength(0);
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

  it("reverting a delivered vehicle to En Reparación reopens the order", async () => {
    const v = (
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate: "BACK55", cost: 40000, services: ["Motor"] },
      })
    ).json().vehicle;

    // Entregar (finaliza la orden; el ingreso vendría de los pagos, aquí no hay).
    await app.inject({
      method: "PATCH",
      url: `/api/vehicles/${v.id}`,
      headers: { cookie: adminCookie, ...J },
      payload: { status: "Entregado" },
    });

    // Devolver a En Reparación → orden reabierta (los pagos, si los hubiera, quedan).
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

    // El vehículo volvió al taller.
    const vehicleAfter = (
      await app.inject({ method: "GET", url: `/api/vehicles/${v.id}`, headers: { cookie: adminCookie } })
    ).json().vehicle;
    expect(vehicleAfter.status).toBe("En Reparación");
    expect(vehicleAfter.inTaller).toBe(true);
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

  it("intake calendar groups vehicles by entry day for a month", async () => {
    for (const [plate, date] of [
      ["CAL001", "2026-06-03"],
      ["CAL002", "2026-06-03"],
      ["CAL003", "2026-06-20"],
      ["CAL004", "2026-07-01"],
    ] as const) {
      await app.inject({
        method: "POST",
        url: "/api/vehicles",
        headers: { cookie: adminCookie, ...J },
        payload: { plate, entryDate: date },
      });
    }
    const res = (
      await app.inject({
        method: "GET",
        url: "/api/reports/intake-calendar?month=2026-06",
        headers: { cookie: adminCookie },
      })
    ).json();
    expect(res.month).toBe("2026-06");
    expect(res.total).toBe(3); // los de junio (julio queda afuera)
    const june3 = res.days.find((d: { date: string }) => d.date === "2026-06-03");
    expect(june3.count).toBe(2);
  });

  it("creates a quote with sequential number and computed total", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: { cookie: adminCookie, ...J },
      payload: {
        customerName: "Juan",
        vehiclePlate: "QT100",
        items: [
          { description: "Pastillas de freno", quantity: 1, unitPrice: 15000 },
          { description: "Mano de obra", quantity: 2, unitPrice: 4000 },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const quote = created.json().quote;
    expect(quote.number).toBe(1);
    expect(quote.total).toBe(23000); // 15000 + 2×4000

    const list = (
      await app.inject({ method: "GET", url: "/api/quotes", headers: { cookie: adminCookie } })
    ).json().quotes;
    expect(list).toHaveLength(1);
    expect(list[0].customerName).toBe("Juan");

    // El PDF (misma fuente que WhatsApp) se sirve para la web.
    const pdf = await app.inject({
      method: "GET",
      url: `/api/quotes/${quote.id}/pdf`,
      headers: { cookie: adminCookie },
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("blocks cross-tenant media access (prefix + path traversal)", async () => {
    // Otro prefijo de tenant → 403.
    const other = await app.inject({
      method: "GET",
      url: "/api/media/00000000-0000-0000-0000-000000000000/hist/x.jpg",
      headers: { cookie: adminCookie },
    });
    expect(other.statusCode).toBe(403);

    // Traversal desde el propio prefijo hacia otro tenant → 403 (no 200/404).
    const traversal = await app.inject({
      method: "GET",
      url: `/api/media/${tenantId}/..%2f00000000-0000-0000-0000-000000000000/hist/x.jpg`,
      headers: { cookie: adminCookie },
    });
    expect(traversal.statusCode).toBe(403);

    // Sin sesión → 401.
    const anon = await app.inject({ method: "GET", url: `/api/media/${tenantId}/hist/x.jpg` });
    expect(anon.statusCode).toBe(401);
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
