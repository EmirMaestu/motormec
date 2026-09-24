import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { resetDb } from "./helpers.js";

/**
 * Presupuestos privados: los montos de los presupuestos son información de
 * gestión. Solo un admin del taller los ve/maneja; un mecánico recibe 403 en
 * TODAS las rutas. (El bot de WhatsApp no usa estas rutas.)
 */
describe("presupuestos: solo admin", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let mecCookie: string;
  let quoteId: string;

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
  async function login(username: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { tenantSlug: "taller-q", username, password: "secret123" },
    });
    return cookieFrom(res);
  }

  beforeEach(async () => {
    await resetDb();
    const t = await createTenant({ name: "Taller Q", slug: "taller-q" });
    await createUser({ tenantId: t.id, name: "Dueño", username: "admin", password: "secret123", role: "admin" });
    await createUser({ tenantId: t.id, name: "Ariel", username: "ariel", password: "secret123", role: "mecanico" });
    adminCookie = await login("admin");
    mecCookie = await login("ariel");
    const created = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: { cookie: adminCookie },
      payload: { customerName: "Bomberos", items: [{ description: "Kit embrague", quantity: 1, unitPrice: 33500000 }] },
    });
    expect(created.statusCode).toBe(201);
    quoteId = (created.json() as { quote: { id: string } }).quote.id;
  });

  it("el admin ve la lista, el detalle y el PDF", async () => {
    for (const url of ["/api/quotes", `/api/quotes/${quoteId}`, `/api/quotes/${quoteId}/pdf`]) {
      const res = await app.inject({ method: "GET", url, headers: { cookie: adminCookie } });
      expect(res.statusCode, url).toBe(200);
    }
  });

  it("un mecánico recibe 403 en TODAS las rutas de presupuestos", async () => {
    const calls: Array<{ method: "GET" | "POST" | "DELETE"; url: string; payload?: Record<string, unknown> }> = [
      { method: "GET", url: "/api/quotes" },
      { method: "GET", url: `/api/quotes/${quoteId}` },
      { method: "GET", url: `/api/quotes/${quoteId}/pdf` },
      { method: "POST", url: "/api/quotes", payload: { customerName: "X", items: [{ description: "a", quantity: 1, unitPrice: 1 }] } },
      { method: "POST", url: `/api/quotes/${quoteId}/convert` },
      { method: "DELETE", url: `/api/quotes/${quoteId}` },
    ];
    for (const c of calls) {
      const res = await app.inject({ ...c, headers: { cookie: mecCookie } });
      expect(res.statusCode, `${c.method} ${c.url}`).toBe(403);
    }
    // Y el presupuesto sigue intacto (el DELETE del mecánico no borró nada).
    const still = await app.inject({ method: "GET", url: `/api/quotes/${quoteId}`, headers: { cookie: adminCookie } });
    expect(still.statusCode).toBe(200);
  });
});
