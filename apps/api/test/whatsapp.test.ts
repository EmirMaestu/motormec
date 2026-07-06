import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { createTenant } from "../src/db/admin.js";
import { forTenant, type TenantDb } from "../src/db/scope.js";
import {
  conversaciones,
  customers,
  historialTaller,
  numerosAutorizados,
  vehicles,
  workOrders,
} from "../src/db/schema.js";
import { createOrder } from "../src/domain/orders.js";
import { ejecutarTool } from "../src/whatsapp/agente.js";
import { procesarMensaje, type BotDeps, type WAMessage } from "../src/whatsapp/stateMachine.js";
import type { DatosVehiculo } from "../src/whatsapp/parser.js";
import { verifySignature } from "../src/whatsapp/signature.js";
import { resetDb } from "./helpers.js";

let tenantId: string;
let tdb: TenantDb;
const AUTH_PHONE = "5491111";

function fakeDeps(datos: DatosVehiculo): { deps: BotDeps; sent: string[] } {
  const sent: string[] = [];
  const deps: BotDeps = {
    send: async (_to, texto) => {
      sent.push(texto);
      return true;
    },
    sendButtons: async (_to, texto) => {
      sent.push(texto);
      return true;
    },
    parse: async () => datos,
    downloadMedia: async () => Buffer.from("fakeimage"),
    storage: {
      save: async (t, h) => `${t}/${h}/fake.jpg`,
      read: async () => Buffer.from(""),
      remove: async () => {},
    },
  };
  return { deps, sent };
}

const EMPTY: DatosVehiculo = { marca_modelo: "", kilometraje: "", patente: "", tarea: "", cliente: "" };

function textMsg(id: string, body: string): WAMessage {
  return { id, from: AUTH_PHONE, timestamp: "1700000000", type: "text", text: { body } };
}
function buttonMsg(id: string, btnId: string): WAMessage {
  return {
    id,
    from: AUTH_PHONE,
    timestamp: "1700000000",
    type: "interactive",
    interactive: { button_reply: { id: btnId } },
  };
}

beforeEach(async () => {
  await resetDb();
  const t = await createTenant({ name: "Taller A", slug: "taller-a", waPhoneNumberId: "PN_A" });
  tenantId = t.id;
  tdb = forTenant(tenantId);
  await tdb.insert(numerosAutorizados, { phone: AUTH_PHONE, name: "Mecánico", active: true });
});

afterAll(async () => {
  await pool.end();
});

describe("WhatsApp bot — state machine", () => {
  it("rejects unauthorized numbers", async () => {
    const { deps, sent } = fakeDeps(EMPTY);
    const msg: WAMessage = { ...textMsg("m1", "hola"), from: "549999" };
    const result = await procesarMensaje(tdb, msg, deps);
    expect(result).toBe("unauthorized");
    expect(sent[0]).toContain("no está autorizado");
    expect(await tdb.count(historialTaller)).toBe(0);
  });

  it("authorizes by normalized number (stored without country code)", async () => {
    // Empleado cargado como "2612494123"; WhatsApp entrega "5492612494123".
    await tdb.insert(numerosAutorizados, { phone: "2612494123", name: "Empleado", active: true });
    const { deps } = fakeDeps({ ...EMPTY, marca_modelo: "Fiat", patente: "AA1" });
    const msg: WAMessage = {
      id: "norm1",
      from: "5492612494123",
      timestamp: "1700000000",
      type: "text",
      text: { body: "ingreso" },
    };
    const r = await procesarMensaje(tdb, msg, deps);
    expect(r).not.toBe("unauthorized");
    expect(r).toBe("confirmando");
  });

  it("routes a vehicle message to intake even if the model mislabels the intent", async () => {
    // Trae datos de vehículo pero el modelo lo etiquetó "otro" → igual es ingreso.
    const { deps } = fakeDeps({
      intencion: "otro",
      marca_modelo: "VW Gol",
      patente: "ABC123",
      kilometraje: "",
      tarea: "service",
      cliente: "Cristián",
    });
    const r = await procesarMensaje(tdb, textMsg("mis1", "Agregá un VW Gol patente ABC123"), deps);
    expect(r).toBe("confirmando");
  });

  it("routes fresh messages to the agent when present (prod path)", async () => {
    const { deps, sent } = fakeDeps(EMPTY);
    // Firma nueva (memoria multi-turno): el agente devuelve { texto, historial }.
    deps.agente = async (_from, texto) => ({
      texto: "respuesta del agente",
      historial: [
        { role: "user", content: texto },
        { role: "assistant", content: "respuesta del agente" },
      ],
    });
    const r = await procesarMensaje(tdb, textMsg("ag1", "cómo va todo"), deps);
    expect(r).toBe("agente");
    expect(sent.join(" ")).toContain("respuesta del agente");
  });

  it("saves a photo while in esperando_foto (post agent registration)", async () => {
    const h = await tdb.insertOne(historialTaller, {
      waMessageId: "reg-1",
      waFrom: AUTH_PHONE,
      waTimestamp: "1700000000",
      patente: "ZZ999",
      status: "linked",
      fotoPaths: [],
    });
    await tdb.insert(conversaciones, {
      phone: AUTH_PHONE,
      etapa: "esperando_foto",
      datos: { fotoPaths: [] },
      historialId: h.id,
    });
    const { deps, sent } = fakeDeps(EMPTY);
    const img: WAMessage = {
      id: "pf1",
      from: AUTH_PHONE,
      timestamp: "1700000000",
      type: "image",
      image: { id: "media1" },
    };
    const r = await procesarMensaje(tdb, img, deps);
    expect(r).toBe("foto");
    expect(sent.join(" ")).toMatch(/foto guardada/i);
    const after = await tdb.findById(historialTaller, h.id);
    expect(after?.fotoPaths.length).toBe(1);
  });

  it("is idempotent by wa_message_id", async () => {
    const { deps } = fakeDeps({ ...EMPTY, intencion: "ingreso", marca_modelo: "Ford Focus" });
    const r1 = await procesarMensaje(tdb, textMsg("dup1", "Ford Focus"), deps);
    expect(r1).toBe("confirmando");
    const r2 = await procesarMensaje(tdb, textMsg("dup1", "Ford Focus"), deps);
    expect(r2).toBe("duplicate");
    expect(await tdb.count(historialTaller)).toBe(1);
  });

  it("greets and does NOT register a vehicle on a plain 'Hola'", async () => {
    const { deps, sent } = fakeDeps({ ...EMPTY, intencion: "saludo" });
    const r = await procesarMensaje(tdb, textMsg("g1", "Hola"), deps);
    expect(r).toBe("saludo");
    expect(sent.join(" ")).toMatch(/asistente/i);
    expect(await tdb.count(vehicles)).toBe(0); // nada registrado
    expect(await tdb.count(conversaciones)).toBe(0);
  });

  it("answers a query about an existing vehicle without registering", async () => {
    await tdb.insert(vehicles, {
      plate: "ABC123",
      brand: "Ford",
      model: "Gol",
      owner: "Juan",
      status: "En Reparación",
      entryDate: "2026-01-01",
      services: [],
      cost: 0,
    });
    const { deps, sent } = fakeDeps({ ...EMPTY, intencion: "consulta", patente: "ABC123" });
    const r = await procesarMensaje(tdb, textMsg("q1", "cómo va la ABC123"), deps);
    expect(r).toBe("consulta");
    expect(sent.join(" ")).toContain("ABC123");
    expect(sent.join(" ")).toMatch(/En Reparación/);
    expect(await tdb.count(vehicles)).toBe(1); // no creó otro
  });

  it("full happy path (new customer): text → confirm → register vehicle", async () => {
    const datos: DatosVehiculo = {
      marca_modelo: "Ford Focus",
      kilometraje: "50000",
      patente: "ab123cd",
      tarea: "cambio de aceite",
      cliente: "Pedro",
    };
    const { deps, sent } = fakeDeps(datos);

    const r1 = await procesarMensaje(tdb, textMsg("m1", "ingreso"), deps);
    expect(r1).toBe("confirmando");
    expect(sent.join(" ")).toContain("Ford Focus");

    const r2 = await procesarMensaje(tdb, buttonMsg("m2", "btn_confirmar"), deps);
    expect(r2).toBe("pidiendo_fotos");

    const r3 = await procesarMensaje(tdb, textMsg("m3", "listo"), deps);
    expect(r3).toBe("registered");

    const vs = await tdb.select(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0]?.plate).toBe("AB123CD"); // uppercased
    expect(vs[0]?.brand).toBe("Ford");
    expect(vs[0]?.model).toBe("Focus");
    expect(vs[0]?.status).toBe("Ingresado");
    expect(vs[0]?.services).toEqual(["cambio de aceite"]);
    expect(vs[0]?.mileage).toBe(50000);

    // historial linked, conversation cleared. (Each inbound message creates its
    // own historial row for idempotency; the conversation links the first one.)
    const linked = await tdb.selectOne(historialTaller, eq(historialTaller.status, "linked"));
    expect(linked?.vehicleId).toBe(vs[0]?.id);
    expect(await tdb.count(conversaciones)).toBe(0);

    // The intake also generated a Work Order for the reused vehicle.
    const orders = await tdb.select(workOrders);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.vehicleId).toBe(vs[0]?.id);
    expect(orders[0]?.services).toEqual(["cambio de aceite"]);
    // The historial (and thus its photos) is tied to that order — the "moment".
    expect(linked?.workOrderId).toBe(orders[0]?.id);
  });

  it("customer-found path: verificando_cliente → sí → confirmando", async () => {
    await tdb.insert(customers, { name: "Pedro Gomez", phone: "5490000", active: true });
    const datos: DatosVehiculo = { ...EMPTY, marca_modelo: "Fiat", patente: "XX1", cliente: "Pedro" };
    const { deps } = fakeDeps(datos);

    const r1 = await procesarMensaje(tdb, textMsg("c1", "ingreso"), deps);
    expect(r1).toBe("verificando_cliente");
    const conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect(conv?.candidatoClienteNombre).toBe("Pedro Gomez");

    const r2 = await procesarMensaje(tdb, textMsg("c2", "sí"), deps);
    expect(r2).toBe("confirmando");
    const conv2 = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect((conv2?.datos as { customerId?: string }).customerId).toBeTruthy();
  });

  it("cancel during confirmando deletes the conversation", async () => {
    const { deps } = fakeDeps({ ...EMPTY, marca_modelo: "VW" });
    await procesarMensaje(tdb, textMsg("x1", "ingreso"), deps);
    const r = await procesarMensaje(tdb, buttonMsg("x2", "btn_cancelar"), deps);
    expect(r).toBe("cancelled");
    expect(await tdb.count(conversaciones)).toBe(0);
  });

  it("photo collection accumulates then registers", async () => {
    const { deps } = fakeDeps({ ...EMPTY, marca_modelo: "Peugeot", patente: "PP1" });
    await procesarMensaje(tdb, textMsg("p1", "ingreso"), deps);
    await procesarMensaje(tdb, buttonMsg("p2", "btn_confirmar"), deps);
    const img: WAMessage = {
      id: "p3",
      from: AUTH_PHONE,
      timestamp: "1700000000",
      type: "image",
      image: { id: "media123" },
    };
    const r = await procesarMensaje(tdb, img, deps);
    expect(r).toBe("pidiendo_fotos");
    const reg = await procesarMensaje(tdb, buttonMsg("p4", "btn_listo"), deps);
    expect(reg).toBe("registered");
    const h = await tdb.select(historialTaller, eq(historialTaller.status, "linked"));
    expect(h[0]?.fotoPaths.length).toBe(1);
  });
});

describe("WhatsApp bot — confirmación de ingreso del agente (BOT-3)", () => {
  it("registrar_ingreso NO crea la orden: deja propuesta pendiente para confirmar", async () => {
    // El agente llama a la tool con un auto que "entró". No debe escribir todavía.
    const out = await ejecutarTool(
      tdb,
      "registrar_ingreso",
      { patente: "ABC123", marca: "vw", modelo: "Gol", cliente: "Juan", tarea: "service" },
      AUTH_PHONE,
      "Taller A",
    );
    const parsed = JSON.parse(out) as { pendiente_confirmacion?: boolean; resumen?: string };
    expect(parsed.pendiente_confirmacion).toBe(true);
    expect(parsed.resumen).toContain("ABC123");

    // No se creó ninguna orden ni vehículo: sólo quedó una conversación pendiente.
    expect(await tdb.count(workOrders)).toBe(0);
    expect(await tdb.count(vehicles)).toBe(0);
    const conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect(conv?.etapa).toBe("confirmar_ingreso_agente");
  });

  it('un "sí" en confirmar_ingreso_agente SÍ crea la orden real', async () => {
    // 1) El agente stage-a la propuesta (sin escribir).
    await ejecutarTool(
      tdb,
      "registrar_ingreso",
      { patente: "ABC123", marca: "vw", modelo: "Gol", cliente: "Juan", tarea: "service" },
      AUTH_PHONE,
      "Taller A",
    );
    expect(await tdb.count(workOrders)).toBe(0);

    // 2) El usuario responde "sí" → la máquina de estados ejecuta createOrder.
    const { deps, sent } = fakeDeps(EMPTY);
    const r = await procesarMensaje(tdb, textMsg("si1", "sí"), deps);
    expect(r).toBe("ingreso_confirmado");

    const orders = await tdb.select(workOrders);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.vehiclePlate).toBe("ABC123");
    const vs = await tdb.select(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0]?.brand).toBe("Volkswagen"); // marca normalizada
    expect(sent.join(" ")).toMatch(/ABC123/);

    // La etapa pasa a esperando_foto (para adjuntar fotos), no queda pendiente.
    const conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect(conv?.etapa).toBe("esperando_foto");
  });

  it('un "no" en confirmar_ingreso_agente descarta sin crear nada', async () => {
    // BOT-4: la patente debe ser válida para que se arme la propuesta pendiente;
    // "ZZ9" (formato inválido) ahora hace repreguntar y no deja propuesta.
    await ejecutarTool(
      tdb,
      "registrar_ingreso",
      { patente: "ZZ999AA", marca: "Ford", modelo: "Focus" },
      AUTH_PHONE,
      "Taller A",
    );
    const { deps } = fakeDeps(EMPTY);
    const r = await procesarMensaje(tdb, textMsg("no1", "no"), deps);
    expect(r).toBe("ingreso_descartado");
    expect(await tdb.count(workOrders)).toBe(0);
    expect(await tdb.count(vehicles)).toBe(0);
    expect(await tdb.count(conversaciones)).toBe(0);
  });

  it("BOT-4: registrar_ingreso con patente inválida NO deja propuesta (repregunta)", async () => {
    const out = await ejecutarTool(
      tdb,
      "registrar_ingreso",
      { patente: "XXX", marca: "Ford", modelo: "Focus", cliente: "Juan" },
      AUTH_PHONE,
      "Taller A",
    );
    const parsed = JSON.parse(out) as { ok?: boolean; patente_invalida?: boolean };
    expect(parsed.patente_invalida).toBe(true);
    expect(parsed.ok).toBe(false);
    // No quedó ninguna propuesta pendiente ni se creó nada.
    expect(await tdb.count(conversaciones)).toBe(0);
    expect(await tdb.count(workOrders)).toBe(0);
    expect(await tdb.count(vehicles)).toBe(0);
  });
});

describe("WhatsApp bot — memoria de conversación multi-turno del agente", () => {
  type Turno = { role: "user" | "assistant"; content: string };

  it("tras un mensaje libre queda una conversación agente_libre con historial guardado", async () => {
    const { deps, sent } = fakeDeps(EMPTY);
    // El agente responde sin disparar registro: NO crea conversación por su cuenta.
    deps.agente = async (_from, texto) => ({
      texto: "Contame la patente 🙂",
      historial: [
        { role: "user", content: texto },
        { role: "assistant", content: "Contame la patente 🙂" },
      ],
    });
    const r = await procesarMensaje(tdb, textMsg("mt1", "entró un auto"), deps);
    expect(r).toBe("agente");
    expect(sent.join(" ")).toContain("Contame la patente");

    const conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect(conv?.etapa).toBe("agente_libre");
    const historial = (conv?.datos as { historial?: Turno[] }).historial ?? [];
    expect(historial.length).toBeGreaterThan(0);
    expect(historial.some((h) => h.content.includes("entró un auto"))).toBe(true);
  });

  it("un segundo mensaje en agente_libre pasa el historialPrevio y lo actualiza", async () => {
    // Turno 1: deja la conversación agente_libre con historial.
    const { deps, sent } = fakeDeps(EMPTY);
    let historialRecibido: Turno[] | undefined;
    deps.agente = async (_from, texto, historialPrevio) => {
      historialRecibido = historialPrevio;
      const historial: Turno[] = [
        ...(historialPrevio ?? []),
        { role: "user", content: texto },
        { role: "assistant", content: `eco: ${texto}` },
      ];
      return { texto: `eco: ${texto}`, historial };
    };

    await procesarMensaje(tdb, textMsg("mt2a", "entró un auto"), deps);
    // Primer turno: el agente recibe historial vacío/undefined.
    expect(historialRecibido ?? []).toHaveLength(0);

    // Turno 2: mismo remitente, ya en etapa agente_libre.
    const r2 = await procesarMensaje(tdb, textMsg("mt2b", "la patente es ABC123"), deps);
    expect(r2).toBe("agente");
    // El agente recibió el historial acumulado del turno anterior.
    expect(historialRecibido).toBeDefined();
    expect(historialRecibido!.some((h) => h.content.includes("entró un auto"))).toBe(true);
    expect(sent.join(" ")).toContain("eco: la patente es ABC123");

    // El historial guardado se actualizó con el segundo turno.
    const conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect(conv?.etapa).toBe("agente_libre");
    const historial = (conv?.datos as { historial?: Turno[] }).historial ?? [];
    expect(historial.some((h) => h.content.includes("la patente es ABC123"))).toBe(true);
  });

  it("si el agente disparó registrar_ingreso, el branch NO pisa la conversación con agente_libre", async () => {
    const { deps } = fakeDeps(EMPTY);
    // El agente fake simula que su tool registrar_ingreso creó una conversación
    // confirmar_ingreso_agente (como lo hace el agente real).
    deps.agente = async (from, texto) => {
      await tdb.delete(conversaciones, eq(conversaciones.phone, from));
      await tdb.insert(conversaciones, {
        phone: from,
        etapa: "confirmar_ingreso_agente",
        datos: {
          patente: "ABC123",
          marca: "Volkswagen",
          modelo: "Gol",
          cliente: "Juan",
          tarea: "service",
          kilometraje: null,
        },
      });
      return {
        texto: "¿Confirmo el ingreso de ABC123?",
        historial: [
          { role: "user", content: texto },
          { role: "assistant", content: "¿Confirmo el ingreso de ABC123?" },
        ],
      };
    };
    const r = await procesarMensaje(tdb, textMsg("mt3", "agregá un VW Gol ABC123 de Juan"), deps);
    expect(r).toBe("agente");

    // El branch NO debe haber reemplazado la conversación del agente.
    const conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, AUTH_PHONE));
    expect(conv?.etapa).toBe("confirmar_ingreso_agente");
    expect(await tdb.count(conversaciones)).toBe(1);
  });
});

describe("WhatsApp bot — comandos (editar/borrar)", () => {
  const actor = { userId: null, userName: "Bot" };

  it("cancela una orden por chat (no se pierde historial)", async () => {
    const order = await createOrder(tdb, actor, { plate: "CMD111", services: ["Frenos"], laborCost: 5000 });
    const { deps, sent } = fakeDeps(EMPTY);
    const r = await procesarMensaje(tdb, textMsg("k1", `cancelá la #${order.number}`), deps);
    expect(r).toBe("comando");
    expect((await tdb.findById(workOrders, order.id))?.status).toBe("Cancelado");
    expect(sent.join(" ")).toMatch(/cancelada/i);
  });

  it("crea el cliente a partir del nombre al cargar (createOrder)", async () => {
    await createOrder(tdb, actor, { plate: "CUST111", customerName: "Cristián Test" });
    const cs = await tdb.select(customers);
    expect(cs.some((c) => c.name === "Cristián Test")).toBe(true);
  });

  it("cambia el estado por chat", async () => {
    const order = await createOrder(tdb, actor, { plate: "CMD222" });
    const { deps } = fakeDeps(EMPTY);
    await procesarMensaje(tdb, textMsg("k2", `marcá #${order.number} entregada`), deps);
    expect((await tdb.findById(workOrders, order.id))?.status).toBe("Entregado");
  });

  it("edita km y mano de obra por chat (recalcula total)", async () => {
    const order = await createOrder(tdb, actor, { plate: "CMD333", laborCost: 10000 });
    const { deps } = fakeDeps(EMPTY);
    await procesarMensaje(tdb, textMsg("k3", `km #${order.number} 50000`), deps);
    expect((await tdb.findById(workOrders, order.id))?.mileage).toBe(50000);
    // "25000" es en PESOS; el dinero se guarda en CENTAVOS (×100) → $25.000.
    await procesarMensaje(tdb, textMsg("k4", `mano de obra #${order.number} 25000`), deps);
    const o = await tdb.findById(workOrders, order.id);
    expect(o?.laborCost).toBe(2500000);
    expect(o?.total).toBe(2500000);
  });

  it("un ingreso normal NO se interpreta como comando", async () => {
    const datos: DatosVehiculo = { ...EMPTY, marca_modelo: "Ford Focus", patente: "ZZ9", tarea: "frenos" };
    const { deps } = fakeDeps(datos);
    const r = await procesarMensaje(tdb, textMsg("k5", "Entró un Ford Focus, hay que ver los frenos"), deps);
    expect(r).toBe("confirmando");
  });
});

describe("WhatsApp presupuesto formatting", () => {
  it("formats a quote verbatim (exact numbers + Momec footer)", async () => {
    const { formatPresupuesto } = await import("../src/whatsapp/agente.js");
    const doc = formatPresupuesto("Taller Sur", {
      number: 7,
      customerName: "Juan",
      vehiclePlate: "AB123CD",
      vehicleInfo: "Ford Focus",
      // Montos en CENTAVOS (el dinero se guarda ×100); fmtMoney los muestra en pesos.
      items: [
        { description: "Pastillas", quantity: 1, unitPrice: 1500000 },
        { description: "Mano de obra", quantity: 2, unitPrice: 400000 },
      ],
      total: 2300000,
      validUntil: null,
      notes: null,
    });
    expect(doc).toContain("*Presupuesto #7*");
    expect(doc).toContain("Taller Sur");
    expect(doc).toContain("Pastillas x1");
    expect(doc).toContain("Mano de obra x2");
    expect(doc).toContain("Total: $ 23.000");
    expect(doc).toContain("momec.pro");
  });
});

describe("WhatsApp signature", () => {
  it("verifies a correct HMAC and rejects a wrong one", () => {
    const body = Buffer.from('{"a":1}');
    const secret = "s3cr3t";
    const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(verifySignature(body, sig, secret)).toBe(true);
    expect(verifySignature(body, "sha256=deadbeef", secret)).toBe(false);
    expect(verifySignature(body, undefined, secret)).toBe(false);
  });
});

describe("WhatsApp webhook route + tenant routing", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("GET returns the hub.challenge when the verify token matches", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=42",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("42");
  });

  it("POST rejects a missing/invalid signature", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: { "content-type": "application/json" },
      payload: { object: "whatsapp_business_account" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST with valid signature ACKs 200", async () => {
    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const sig =
      "sha256=" + createHmac("sha256", "test-app-secret").update(payload).digest("hex");
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: { "content-type": "application/json", "x-hub-signature-256": sig },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().received).toBe(true);
  });
});
