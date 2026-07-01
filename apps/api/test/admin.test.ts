import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db/client.js";
import { createPlatformAdmin } from "../src/db/admin.js";
import { tenants } from "../src/db/schema.js";
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

function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }, name: string) {
  const c = res.cookies.find((x) => x.name === name);
  return c ? `${name}=${c.value}` : "";
}

async function loginAdmin() {
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/login",
    payload: { username: "owner", password: "owner123" },
  });
  return { res, cookie: cookieFrom(res, "mm_admin") };
}

describe("platform super-admin", () => {
  beforeEach(async () => {
    await resetDb();
    await createPlatformAdmin({ username: "owner", name: "Emir", password: "owner123" });
  });

  it("logs in and rejects wrong credentials", async () => {
    const { res } = await loginAdmin();
    expect(res.statusCode).toBe(200);
    expect(res.json().admin.username).toBe("owner");

    const bad = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { username: "owner", password: "nope" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("blocks admin endpoints without the admin cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/tenants" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a tenant + admin user that can then log into the dashboard", async () => {
    const { cookie } = await loginAdmin();
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: {
        name: "Taller Nuevo",
        slug: "taller-nuevo",
        plan: "pro",
        adminName: "Dueño",
        adminUsername: "admin",
        adminPassword: "secret123",
      },
    });
    expect(created.statusCode).toBe(201);

    // The created tenant admin can log into the tenant dashboard.
    const tenantLogin = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-nuevo", username: "admin", password: "secret123" },
    });
    expect(tenantLogin.statusCode).toBe(200);
    expect(tenantLogin.json().tenant.slug).toBe("taller-nuevo");

    // It appears in the admin tenant list with usage counts.
    const list = await app.inject({ method: "GET", url: "/api/admin/tenants", headers: { cookie } });
    const names = list.json().tenants.map((t: { slug: string }) => t.slug);
    expect(names).toContain("taller-nuevo");
  });

  it("links a WhatsApp number to a tenant (uniqueness enforced)", async () => {
    const { cookie } = await loginAdmin();
    await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: { name: "T1", slug: "t1", adminName: "A", adminUsername: "a", adminPassword: "secret123" },
    });
    const t1 = (await db.select().from(tenants).where(eq(tenants.slug, "t1")))[0]!;

    const link = await app.inject({
      method: "PUT",
      url: `/api/admin/tenants/${t1.id}/whatsapp`,
      headers: { cookie, "content-type": "application/json" },
      payload: { waPhoneNumberId: "PN_LINK_1", waDisplayNumber: "+54 9 11 0000", waAccessToken: "tok" },
    });
    expect(link.statusCode).toBe(200);

    // A second tenant cannot claim the same number.
    await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: { name: "T2", slug: "t2", adminName: "B", adminUsername: "b", adminPassword: "secret123" },
    });
    const t2 = (await db.select().from(tenants).where(eq(tenants.slug, "t2")))[0]!;
    const conflict = await app.inject({
      method: "PUT",
      url: `/api/admin/tenants/${t2.id}/whatsapp`,
      headers: { cookie, "content-type": "application/json" },
      payload: { waPhoneNumberId: "PN_LINK_1" },
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("toggles plan and active state", async () => {
    const { cookie } = await loginAdmin();
    await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: { name: "T3", slug: "t3", adminName: "C", adminUsername: "c", adminPassword: "secret123" },
    });
    const t3 = (await db.select().from(tenants).where(eq(tenants.slug, "t3")))[0]!;
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/tenants/${t3.id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: { plan: "cadena", active: false },
    });
    expect(res.statusCode).toBe(200);
    const after = (await db.select().from(tenants).where(eq(tenants.id, t3.id)))[0]!;
    expect(after.plan).toBe("cadena");
    expect(after.active).toBe(false);
  });
});
