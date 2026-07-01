import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db/client.js";
import { createPlatformAdmin } from "../src/db/admin.js";
import { createTenant } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import {
  historialTaller,
  numerosAutorizados,
  tenants,
  workOrders,
} from "../src/db/schema.js";
import { createOrder } from "../src/domain/orders.js";
import { limitsFor, withinLimit } from "../src/domain/plans.js";
import { currentPeriod, getIaTokens, getIaUsage, incIaTokens, incIaUsage } from "../src/domain/usage.js";
import { notifyOrderStatusChange, toWaNumber } from "../src/domain/notifications.js";
import { numberKey, sameNumber } from "../src/whatsapp/phone.js";
import { procesarMensaje, type BotDeps, type WAMessage } from "../src/whatsapp/stateMachine.js";
import { resetDb } from "./helpers.js";

// El pool es compartido por todo el archivo: se cierra una sola vez al final.
afterAll(async () => {
  await pool.end();
});

describe("phone matching (ruteo por remitente)", () => {
  it("matches AR numbers across formats", () => {
    expect(sameNumber("2612494123", "5492612494123")).toBe(true);
    expect(sameNumber("+54 9 261 249-4123", "5492612494123")).toBe(true);
    expect(sameNumber("02612494123", "5492612494123")).toBe(true);
    expect(sameNumber("2612494123", "2614351765")).toBe(false);
    expect(numberKey("5492612494123")).toBe("2612494123");
  });
});

describe("plan limits — pure helpers", () => {
  it("withinLimit respects caps and treats Infinity as unlimited", () => {
    expect(withinLimit(2, 3)).toBe(true);
    expect(withinLimit(3, 3)).toBe(false);
    expect(withinLimit(99999, Infinity)).toBe(true);
  });

  it("limitsFor falls back to Starter for unknown plans", () => {
    expect(limitsFor("no-existe").maxUsers).toBe(limitsFor("starter").maxUsers);
    expect(limitsFor("max").maxUsers).toBe(Infinity);
  });

  it("el modelo del bot escala con el plan (Starter→Haiku, Pro→Sonnet 5, Max→Opus)", () => {
    expect(limitsFor("starter").model).toBe("claude-haiku-4-5");
    expect(limitsFor("pro").model).toBe("claude-sonnet-5");
    expect(limitsFor("max").model).toBe("claude-opus-4-8");
    expect(limitsFor("starter").dataMigration).toBe(false);
    expect(limitsFor("pro").dataMigration).toBe(true);
  });

  it("toWaNumber normalizes AR numbers to 549<area><local>", () => {
    expect(toWaNumber("5491122334455")).toBe("5491122334455");
    expect(toWaNumber("541122334455")).toBe("5491122334455");
    expect(toWaNumber("+54 9 11 2233-4455")).toBe("5491122334455");
    expect(toWaNumber("11")).toBeNull();
  });
});

describe("usage counter (monthly IA)", () => {
  let tenantId: string;
  beforeEach(async () => {
    await resetDb();
    const t = await createTenant({ name: "Uso", slug: "uso" });
    tenantId = t.id;
  });

  it("increments and reads the current period", async () => {
    expect(await getIaUsage(tenantId)).toBe(0);
    expect(await incIaUsage(tenantId)).toBe(1);
    expect(await incIaUsage(tenantId)).toBe(2);
    expect(await getIaUsage(tenantId, currentPeriod())).toBe(2);
  });

  it("accumulates IA input/output tokens", async () => {
    await incIaTokens(tenantId, 100, 20);
    await incIaTokens(tenantId, 50, 10);
    const t = await getIaTokens(tenantId);
    expect(t.input).toBe(150);
    expect(t.output).toBe(30);
  });
});



describe("bot respects the IA monthly quota", () => {
  let tdb: TenantDb;
  const PHONE = "5491100";
  beforeEach(async () => {
    await resetDb();
    const t = await createTenant({ name: "Cuota", slug: "cuota", waPhoneNumberId: "PN_Q" });
    tdb = forTenant(t.id);
    await tdb.insert(numerosAutorizados, { phone: PHONE, name: "Mec", active: true });
  });

  it("stops AI extraction and warns when quota is exhausted", async () => {
    const sent: string[] = [];
    let parsed = false;
    const deps: BotDeps = {
      send: async (_t, txt) => {
        sent.push(txt);
        return true;
      },
      sendButtons: async (_t, txt) => {
        sent.push(txt);
        return true;
      },
      parse: async () => {
        parsed = true;
        return { marca_modelo: "", kilometraje: "", patente: "", tarea: "", cliente: "" };
      },
      downloadMedia: async () => null,
      storage: { save: async () => "x", read: async () => Buffer.from(""), remove: async () => {} },
      iaQuota: { check: async () => false, tick: async () => {} },
    };
    const msg: WAMessage = {
      id: "q1",
      from: PHONE,
      timestamp: "1700000000",
      type: "text",
      text: { body: "Entró un Gol patente AA111" },
    };
    const r = await procesarMensaje(tdb, msg, deps);
    expect(r).toBe("ia_quota");
    expect(parsed).toBe(false); // nunca llamó a la IA
    expect(sent.join(" ")).toMatch(/l[íi]mite/i);
    const h = await tdb.selectOne(historialTaller, eq(historialTaller.status, "error"));
    expect(h?.errorMessage).toBe("ia_quota_exceeded");
  });
});

describe("customer notifications", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("skips silently when the tenant has no WhatsApp configured", async () => {
    const t = await createTenant({ name: "SinWA", slug: "sinwa" });
    const tdb = forTenant(t.id);
    const order = await createOrder(tdb, { userId: null, userName: "T" }, {
      plate: "NOT111",
      customerName: "Juan",
      phone: "5491122334455",
    });
    const updated = await tdb.updateById(workOrders, order.id, { status: "Listo para entregar" });
    // No revienta y devuelve false (no hay credenciales WA).
    expect(await notifyOrderStatusChange(updated!)).toBe(false);
  });
});

describe("admin enforces the plan user cap", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
    await createPlatformAdmin({ username: "owner", name: "Emir", password: "owner123" });
  });

  it("rejects creating users beyond the plan limit", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { username: "owner", password: "owner123" },
    });
    const cookie = `mm_admin=${login.cookies.find((c) => c.name === "mm_admin")!.value}`;

    // Plan "arranque" → maxUsers 3. createTenant ya crea 1 admin.
    await app.inject({
      method: "POST",
      url: "/api/admin/tenants",
      headers: { cookie, "content-type": "application/json" },
      payload: {
        name: "Cap", slug: "cap", plan: "arranque",
        adminName: "A", adminUsername: "a", adminPassword: "secret123",
      },
    });
    const t = (await db.select().from(tenants).where(eq(tenants.slug, "cap")))[0]!;

    const addUser = (u: string) =>
      app.inject({
        method: "POST",
        url: `/api/admin/tenants/${t.id}/users`,
        headers: { cookie, "content-type": "application/json" },
        payload: { name: u, username: u, password: "secret123", role: "mecanico" },
      });

    expect((await addUser("u2")).statusCode).toBe(201); // total 2
    expect((await addUser("u3")).statusCode).toBe(201); // total 3 (tope)
    const over = await addUser("u4"); // 4º → rechazado
    expect(over.statusCode).toBe(409);
    expect(over.json().error).toBe("plan_limit");
  });
});
