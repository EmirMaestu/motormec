import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant, createUser } from "../src/db/admin.js";
import { forTenant } from "../src/db/scope.js";
import { presupuestos } from "../src/db/schema.js";
import { ejecutarTool } from "../src/whatsapp/agente.js";
import { resetDb } from "./helpers.js";

/**
 * Presupuestos privados por autor: el admin ve TODOS; un mecánico ve SOLO los
 * suyos — los que creó en la web (por su usuario) y los que pidió por WhatsApp
 * (por su número, comparado con tolerancia de formato). Uno ajeno responde 404
 * (ni siquiera se revela que existe) en ver, PDF, convertir y borrar.
 */
describe("presupuestos: cada mecánico ve solo los suyos, el admin todos", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let adminCookie: string;
  let arielCookie: string;
  let davidCookie: string;
  const ids: Record<"admin" | "arielWeb" | "arielBot" | "davidBot", string> = {
    admin: "",
    arielWeb: "",
    arielBot: "",
    davidBot: "",
  };

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
  async function crearPorWeb(cookie: string, cliente: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/quotes",
      headers: { cookie },
      payload: { customerName: cliente, items: [{ description: "Kit embrague", quantity: 1, unitPrice: 33500000 }] },
    });
    expect(res.statusCode, `crear ${cliente}`).toBe(201);
    return (res.json() as { quote: { id: string } }).quote.id;
  }
  async function crearPorBot(from: string, cliente: string) {
    const out = await ejecutarTool(
      forTenant(tenantId),
      "crear_presupuesto",
      { cliente, items: [{ descripcion: "Bomba de agua", precio: 80150 }] },
      from,
      "Taller Q",
    );
    return (JSON.parse(out) as { id: string }).id;
  }
  async function listar(cookie: string) {
    const res = await app.inject({ method: "GET", url: "/api/quotes", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    return (res.json() as { quotes: Array<{ id: string }> }).quotes.map((q) => q.id).sort();
  }

  beforeEach(async () => {
    await resetDb();
    const t = await createTenant({ name: "Taller Q", slug: "taller-q" });
    tenantId = t.id;
    await createUser({ tenantId, name: "Dueño", username: "admin", password: "secret123", role: "admin" });
    await createUser({
      tenantId, name: "Ariel", username: "ariel", password: "secret123", role: "mecanico", phone: "5492616817149",
    });
    await createUser({
      tenantId, name: "David", username: "david", password: "secret123", role: "mecanico", phone: "5492613632012",
    });
    adminCookie = await login("admin");
    arielCookie = await login("ariel");
    davidCookie = await login("david");

    ids.admin = await crearPorWeb(adminCookie, "Cliente del admin");
    ids.arielWeb = await crearPorWeb(arielCookie, "Cliente de Ariel (web)");
    // Por WhatsApp, con el número escrito SIN 549: igual es de Ariel.
    ids.arielBot = await crearPorBot("2616817149", "Cliente de Ariel (bot)");
    ids.davidBot = await crearPorBot("5492613632012", "Bomberos Tunuyán");
  });

  it("el admin ve TODOS los presupuestos", async () => {
    expect(await listar(adminCookie)).toEqual(Object.values(ids).sort());
  });

  it("cada mecánico ve SOLO los suyos (web + WhatsApp)", async () => {
    expect(await listar(arielCookie)).toEqual([ids.arielWeb, ids.arielBot].sort());
    expect(await listar(davidCookie)).toEqual([ids.davidBot]);
  });

  it("el mecánico abre y baja el PDF de los suyos", async () => {
    for (const url of [`/api/quotes/${ids.davidBot}`, `/api/quotes/${ids.davidBot}/pdf`]) {
      const res = await app.inject({ method: "GET", url, headers: { cookie: davidCookie } });
      expect(res.statusCode, url).toBe(200);
    }
  });

  it("uno AJENO da 404 en ver, PDF, convertir y borrar (y no se borra)", async () => {
    const ajeno = ids.admin;
    const calls: Array<{ method: "GET" | "POST" | "DELETE"; url: string }> = [
      { method: "GET", url: `/api/quotes/${ajeno}` },
      { method: "GET", url: `/api/quotes/${ajeno}/pdf` },
      { method: "POST", url: `/api/quotes/${ajeno}/convert` },
      { method: "DELETE", url: `/api/quotes/${ajeno}` },
    ];
    for (const c of calls) {
      const res = await app.inject({ ...c, headers: { cookie: davidCookie } });
      expect(res.statusCode, `${c.method} ${c.url}`).toBe(404);
    }
    expect(await forTenant(tenantId).findById(presupuestos, ajeno)).toBeTruthy();
  });

  it("el bot registra de qué número salió el presupuesto", async () => {
    const q = await forTenant(tenantId).findById(presupuestos, ids.davidBot);
    expect(q?.createdByPhone).toBe("5492613632012");
  });
});
