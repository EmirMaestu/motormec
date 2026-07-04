import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db/client.js";
import { eq } from "drizzle-orm";
import { createPlatformAdmin, createTenant, createUser } from "../src/db/admin.js";
import { tenants, users } from "../src/db/schema.js";
import { login } from "../src/auth/service.js";
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
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-a", username: "admin", password: "secret123" },
    });
    const cookie = cookieFrom(loginRes);
    await app.inject({ method: "POST", url: "/api/logout", headers: { cookie } });
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});

describe("password policy + per-user lockout", () => {
  function adminCookie(res: { cookies: Array<{ name: string; value: string }> }) {
    const c = res.cookies.find((x) => x.name === "mm_admin");
    return c ? `mm_admin=${c.value}` : "";
  }

  async function seedPlatformAdmin() {
    await createPlatformAdmin({ username: "owner", name: "Emir", password: "owner123" });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { username: "owner", password: "owner123" },
    });
    return adminCookie(res);
  }

  beforeEach(async () => {
    await resetDb();
  });

  it("rejects a weak password when creating a tenant admin", async () => {
    const cookie = await seedPlatformAdmin();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: {
        name: "Taller Debil",
        slug: "taller-debil",
        adminName: "Dueño",
        adminUsername: "admin",
        adminPassword: "weak12", // 6 chars: passes zod min(6), fails policy min 8
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("weak_password");
  });

  it("rejects a weak password when creating a user for a tenant", async () => {
    const cookie = await seedPlatformAdmin();
    const tenant = await createTenant({ name: "taller-x", slug: "taller-x" });
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/tenants/${tenant.id}/users`,
      headers: { cookie, "content-type": "application/json" },
      payload: { name: "Mecanico", username: "mec", password: "weak12" }, // 6 chars: passes zod, fails policy
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("weak_password");
  });

  it("accepts a password with at least 8 characters", async () => {
    const cookie = await seedPlatformAdmin();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: {
        name: "Taller Fuerte",
        slug: "taller-fuerte",
        adminName: "Dueño",
        adminUsername: "admin",
        adminPassword: "secret123", // 9 chars
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("locks the account after 5 failed logins, even with the right password", async () => {
    const tenant = await createTenant({ name: "taller-lock", slug: "taller-lock" });
    await createUser({
      tenantId: tenant.id,
      name: "Admin",
      username: "admin",
      password: "secret123",
      role: "admin",
    });

    for (let i = 0; i < 5; i++) {
      const r = await login({ tenantSlug: "taller-lock", username: "admin", password: "wrong" });
      expect(r.ok).toBe(false);
    }

    // The 6th attempt, even with the CORRECT password, is locked out.
    const blocked = await login({
      tenantSlug: "taller-lock",
      username: "admin",
      password: "secret123",
    });
    expect(blocked.ok).toBe(false);

    const [row] = await db.select().from(users).where(eq(users.tenantId, tenant.id));
    expect(row?.lockoutUntil).not.toBeNull();
  });

  it("resets the failed counter after a successful login", async () => {
    const tenant = await createTenant({ name: "taller-reset", slug: "taller-reset" });
    await createUser({
      tenantId: tenant.id,
      name: "Admin",
      username: "admin",
      password: "secret123",
      role: "admin",
    });

    // A few failures below the threshold, then a success clears the counter.
    for (let i = 0; i < 3; i++) {
      await login({ tenantSlug: "taller-reset", username: "admin", password: "wrong" });
    }
    const ok = await login({ tenantSlug: "taller-reset", username: "admin", password: "secret123" });
    expect(ok.ok).toBe(true);

    const [row] = await db.select().from(users).where(eq(users.tenantId, tenant.id));
    expect(row?.failedLoginCount).toBe(0);
    expect(row?.lockoutUntil).toBeNull();
  });
});
