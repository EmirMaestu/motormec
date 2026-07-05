import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { tenants, type TenantSettings } from "../src/db/schema.js";
import { formatArs, formatMoney } from "../src/lib/money.js";
import { resetDb } from "./helpers.js";

describe("formatArs — moneda del taller", () => {
  it("ARS: formatea sin decimales (compat, default)", () => {
    const s = formatArs(123456, "ARS");
    // 123456 centavos → 1234.56 → redondeado sin decimales.
    expect(s).toContain("1.235");
    expect(s).not.toContain(",00");
    // El default sigue siendo ARS: misma salida sin pasar moneda.
    expect(formatArs(123456)).toBe(s);
  });

  it("CLP: formatea sin decimales (unidades menores ×100)", () => {
    const s = formatArs(500000, "CLP"); // 500000 / 100 = 5000
    expect(s).toContain("5.000");
    expect(s).not.toContain(",00");
    expect(s).not.toContain("5.000,");
  });

  it("USD: formatea con locale en-US sin decimales", () => {
    const s = formatArs(123456, "USD"); // 1234.56 → 1,235
    expect(s).toContain("1,235");
    expect(s).not.toContain(".00");
  });

  it("formatMoney es alias de formatArs", () => {
    expect(formatMoney(500000, "CLP")).toBe(formatArs(500000, "CLP"));
  });
});

describe("PATCH /api/settings — moneda por taller", () => {
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

  async function seedAndLogin(slug: string, role: "admin" | "mecanico" = "admin") {
    const tenant = await createTenant({ name: slug, slug });
    await createUser({
      tenantId: tenant.id,
      name: "User",
      username: "user",
      password: "secret123",
      role,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: slug, username: "user", password: "secret123" },
    });
    return { cookie: cookieFrom(res), tenantId: tenant.id };
  }

  beforeEach(async () => {
    await resetDb();
  });

  it("setear CLP persiste en tenants.settings.currency", async () => {
    const { cookie, tenantId } = await seedAndLogin("moneda-clp");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, "content-type": "application/json" },
      payload: { currency: "CLP" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().settings.currency).toBe("CLP");

    const [row] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    expect((row!.settings as TenantSettings).currency).toBe("CLP");
  });

  it("merge: no pisa otros settings (logoPath/quoteHeader)", async () => {
    const { cookie, tenantId } = await seedAndLogin("moneda-merge");
    // Pre-cargamos otros settings a mano.
    await db
      .update(tenants)
      .set({ settings: { logoPath: "media/x.png", quoteHeader: { phone: "123" } } })
      .where(eq(tenants.id, tenantId));

    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, "content-type": "application/json" },
      payload: { currency: "USD" },
    });
    expect(res.statusCode).toBe(200);

    const [row] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    const s = row!.settings as TenantSettings;
    expect(s.currency).toBe("USD");
    expect(s.logoPath).toBe("media/x.png");
    expect(s.quoteHeader).toEqual({ phone: "123" });
  });

  it("moneda inválida → 400", async () => {
    const { cookie } = await seedAndLogin("moneda-mala");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, "content-type": "application/json" },
      payload: { currency: "EUR" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("un mecánico no puede cambiar la moneda (requireRole admin)", async () => {
    const { cookie } = await seedAndLogin("moneda-mec", "mecanico");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie, "content-type": "application/json" },
      payload: { currency: "CLP" },
    });
    expect(res.statusCode).toBe(403);
  });
});
