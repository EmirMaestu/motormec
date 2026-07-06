import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { resetDb } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }) {
  const c = res.cookies.find((x) => x.name === "mm_session");
  return c ? `mm_session=${c.value}` : "";
}

async function seedAndLogin(slug: string) {
  const tenant = await createTenant({ name: slug, slug });
  await createUser({
    tenantId: tenant.id,
    name: "Admin",
    username: "admin",
    password: "secret123",
    role: "admin",
  });
  const res = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { tenantSlug: slug, username: "admin", password: "secret123" },
  });
  return cookieFrom(res);
}

/** Crea una orden vía HTTP y devuelve el objeto orden (con total y customerId). */
async function createOrder(
  cookie: string,
  body: Record<string, unknown>,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/orders",
    headers: { cookie },
    payload: body,
  });
  expect(res.statusCode).toBe(201);
  return res.json().order as {
    id: string;
    number: number;
    total: number;
    customerId: string;
  };
}

describe("payment routes (cobro)", () => {
  let cookie: string;

  beforeEach(async () => {
    await resetDb();
    cookie = await seedAndLogin("taller-pagos");
  });

  it("un pago parcial deja saldo = total - amount, estado 'parcial' y crea 1 ingreso", async () => {
    const order = await createOrder(cookie, {
      plate: "PAG100",
      customerName: "Cliente Pago",
      laborCost: 10000,
    });
    expect(order.total).toBe(10000);

    const res = await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: 4000 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.order.total).toBe(10000);
    expect(body.order.paidAmount).toBe(4000);
    expect(body.order.saldo).toBe(6000);
    expect(body.order.estado).toBe("parcial");

    // Un solo ingreso (pago) registrado en la orden.
    const list = await app.inject({
      method: "GET",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().payments).toHaveLength(1);
    expect(list.json().payments[0].amount).toBe(4000);
  });

  it("dos pagos que suman el total dejan saldo = 0 y estado 'pagada'", async () => {
    const order = await createOrder(cookie, {
      plate: "PAG200",
      customerName: "Cliente Total",
      laborCost: 15000,
    });

    const p1 = await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: 5000, method: "efectivo" },
    });
    expect(p1.statusCode).toBe(201);
    expect(p1.json().order.saldo).toBe(10000);
    expect(p1.json().order.estado).toBe("parcial");

    const p2 = await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: 10000, method: "transferencia" },
    });
    expect(p2.statusCode).toBe(201);
    expect(p2.json().order.saldo).toBe(0);
    expect(p2.json().order.estado).toBe("pagada");

    const list = await app.inject({
      method: "GET",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
    });
    expect(list.json().payments).toHaveLength(2);
  });

  it("GET /api/customers/:id/balance refleja la deuda tras un pago parcial", async () => {
    const order = await createOrder(cookie, {
      plate: "PAG300",
      customerName: "Cliente Deudor",
      laborCost: 20000,
    });
    const customerId = order.customerId;
    expect(customerId).toBeTruthy();

    await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: 8000 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/customers/${customerId}/balance`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Deuda = 20000 - 8000 = 12000.
    expect(body.deudaTotal).toBe(12000);
    expect(body.ordenes).toHaveLength(1);
    expect(body.ordenes[0].id).toBe(order.id);
    expect(body.ordenes[0].saldo).toBe(12000);
    expect(body.ordenes[0].estado).toBe("parcial");
  });

  it("una orden totalmente pagada no aparece en la cuenta corriente", async () => {
    const order = await createOrder(cookie, {
      plate: "PAG400",
      customerName: "Cliente Saldado",
      laborCost: 5000,
    });
    await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: 5000 },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/customers/${order.customerId}/balance`,
      headers: { cookie },
    });
    expect(res.json().deudaTotal).toBe(0);
    expect(res.json().ordenes).toHaveLength(0);
  });

  it("POST con amount inválido → 400, orden inexistente → 404", async () => {
    const order = await createOrder(cookie, {
      plate: "PAG500",
      customerName: "Cliente Val",
      laborCost: 1000,
    });

    // amount = 0 no pasa el zod (positive) → 400.
    const zero = await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: 0 },
    });
    expect(zero.statusCode).toBe(400);

    // amount negativo → 400.
    const neg = await app.inject({
      method: "POST",
      url: `/api/orders/${order.id}/payments`,
      headers: { cookie },
      payload: { amount: -50 },
    });
    expect(neg.statusCode).toBe(400);

    // Orden inexistente (uuid válido pero sin fila) → 404.
    const missing = await app.inject({
      method: "POST",
      url: `/api/orders/00000000-0000-0000-0000-000000000000/payments`,
      headers: { cookie },
      payload: { amount: 100 },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("requiere autenticación", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/orders/00000000-0000-0000-0000-000000000000/payments`,
      payload: { amount: 100 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/orders con taxRate 2100 aplica IVA 21% sobre el subtotal", async () => {
    const order = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { cookie },
      payload: { plate: "IVA100", customerName: "Cliente IVA", laborCost: 10000, taxRate: 2100 },
    });
    expect(order.statusCode).toBe(201);
    const o = order.json().order;
    expect(o.subtotal).toBe(10000);
    expect(o.taxRate).toBe(2100);
    expect(o.taxAmount).toBe(2100); // 10000 * 21%
    expect(o.total).toBe(12100); // subtotal * 1.21
  });

  it("POST /api/orders con descuento + IVA: IVA se calcula sobre (subtotal - descuento)", async () => {
    const order = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { cookie },
      payload: {
        plate: "IVA200",
        customerName: "Cliente Desc",
        laborCost: 10000,
        discountAmount: 2000,
        taxRate: 2100,
      },
    });
    expect(order.statusCode).toBe(201);
    const o = order.json().order;
    expect(o.subtotal).toBe(10000);
    expect(o.discountAmount).toBe(2000);
    expect(o.taxAmount).toBe(1680); // (10000 - 2000) * 21%
    expect(o.total).toBe(9680); // 8000 + 1680
  });

  it("POST /api/quotes con descuento + IVA persiste el desglose", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: { cookie },
      payload: {
        customerName: "Presupuesto IVA",
        items: [{ description: "Service", quantity: 1, unitPrice: 10000 }],
        discountAmount: 2000,
        taxRate: 2100,
      },
    });
    expect(res.statusCode).toBe(201);
    const q = res.json().quote;
    expect(q.subtotal).toBe(10000);
    expect(q.discountAmount).toBe(2000);
    expect(q.taxRate).toBe(2100);
    expect(q.taxAmount).toBe(1680); // (10000 - 2000) * 21%
    expect(q.total).toBe(9680);
  });
});
