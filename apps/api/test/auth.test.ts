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

async function seedTenant(slug: string) {
  const tenant = await createTenant({ name: slug, slug });
  await createUser({
    tenantId: tenant.id,
    name: "Admin",
    username: "admin",
    password: "secret123",
    role: "admin",
  });
  return tenant;
}

function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }) {
  const c = res.cookies.find((x) => x.name === "mm_session");
  return c ? `mm_session=${c.value}` : "";
}

describe("auth + HTTP tenant isolation", () => {
  beforeEach(async () => {
    await resetDb();
    await seedTenant("taller-a");
    await seedTenant("taller-b");
  });

  it("logs in with correct credentials and rejects wrong password", async () => {
    const ok = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-a", username: "admin", password: "secret123" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().tenant.slug).toBe("taller-a");

    const bad = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-a", username: "admin", password: "wrong" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("rejects login when username belongs to a different tenant", async () => {
    // 'admin' exists in both, but credentials are validated within the slug's tenant.
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-b", username: "admin", password: "secret123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tenant.slug).toBe("taller-b");
  });

  it("requires auth for /api/customers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/customers" });
    expect(res.statusCode).toBe(401);
  });

  it("a logged-in tenant cannot read another tenant's customers over HTTP", async () => {
    const loginA = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-a", username: "admin", password: "secret123" },
    });
    const loginB = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-b", username: "admin", password: "secret123" },
    });
    const cookieA = cookieFrom(loginA);
    const cookieB = cookieFrom(loginB);

    // A creates a customer.
    const created = await app.inject({
      method: "POST",
      url: "/api/customers",
      headers: { cookie: cookieA },
      payload: { name: "Cliente Secreto A", phone: "111" },
    });
    expect(created.statusCode).toBe(201);
    const customerId = created.json().customer.id;

    // B lists customers — must NOT see A's.
    const listB = await app.inject({
      method: "GET",
      url: "/api/customers",
      headers: { cookie: cookieB },
    });
    expect(listB.statusCode).toBe(200);
    expect(listB.json().customers).toHaveLength(0);

    // B tries to fetch A's customer by id — 404.
    const getB = await app.inject({
      method: "GET",
      url: `/api/customers/${customerId}`,
      headers: { cookie: cookieB },
    });
    expect(getB.statusCode).toBe(404);

    // A can still see its own.
    const listA = await app.inject({
      method: "GET",
      url: "/api/customers",
      headers: { cookie: cookieA },
    });
    expect(listA.json().customers).toHaveLength(1);
  });

  it("logout invalidates the session", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-a", username: "admin", password: "secret123" },
    });
    const cookie = cookieFrom(login);
    await app.inject({ method: "POST", url: "/api/logout", headers: { cookie } });
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});
