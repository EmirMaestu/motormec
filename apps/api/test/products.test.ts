import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import { products } from "../src/db/schema.js";
import { resetDb } from "./helpers.js";

let tdb: TenantDb;
beforeEach(async () => {
  await resetDb();
  const t = await createTenant({ name: "A", slug: "a" });
  tdb = forTenant(t.id);
});
afterAll(async () => {
  await pool.end();
});

describe("products stock guard", () => {
  it("rejects a manual update that would set stock below zero", async () => {
    const p = await tdb.insertOne(products, {
      name: "Aceite", quantity: 5, reorderPoint: 1, price: 3000, unit: "L", type: "Lubricante",
    });
    await expect(
      tdb.updateById(products, p.id, { quantity: -3 }),
    ).rejects.toThrow();
    const still = await tdb.findById(products, p.id);
    expect(still?.quantity).toBe(5);
  });
});

describe("products atomic stock adjust (BL-7)", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // resetDb already ran (top-level beforeEach); re-seed a tenant + user we can log in as.
    const t = await createTenant({ name: "Adjust", slug: "adjust" });
    tdb = forTenant(t.id);
    await createUser({
      tenantId: t.id,
      name: "Admin",
      username: "admin",
      password: "secret123",
      role: "admin",
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "adjust", username: "admin", password: "secret123" },
    });
    const c = login.cookies.find((x) => x.name === "mm_session");
    cookie = c ? `mm_session=${c.value}` : "";
  });

  it("a valid negative delta lowers the stock", async () => {
    const p = await tdb.insertOne(products, {
      name: "Filtro", quantity: 10, reorderPoint: 2, price: 1000, unit: "unidad", type: "Filtro",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/products/${p.id}/adjust`,
      headers: { cookie, "content-type": "application/json" },
      payload: { delta: -4, reason: "consumo taller" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().product.quantity).toBe(6);
    const after = await tdb.findById(products, p.id);
    expect(after?.quantity).toBe(6);
  });

  it("an adjust that would leave stock negative returns 400 and does not change the stock", async () => {
    const p = await tdb.insertOne(products, {
      name: "Bujía", quantity: 3, reorderPoint: 1, price: 500, unit: "unidad", type: "Encendido",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/products/${p.id}/adjust`,
      headers: { cookie, "content-type": "application/json" },
      payload: { delta: -5 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("stock_insuficiente");
    const after = await tdb.findById(products, p.id);
    expect(after?.quantity).toBe(3);
  });
});
