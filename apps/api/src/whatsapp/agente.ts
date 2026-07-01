import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import type { TenantDb } from "../db/scope.js";
import { conversaciones, customers, historialTaller, vehicles, workOrders } from "../db/schema.js";
import { createOrder } from "../domain/orders.js";

const BOT_ACTOR = { userId: null, userName: "WhatsApp Bot" };

// Normalización de marcas comunes (abreviaturas → nombre completo).
const MARCAS: Record<string, string> = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  chevy: "Chevrolet",
  chevrolet: "Chevrolet",
  ford: "Ford",
  fiat: "Fiat",
  peugeot: "Peugeot",
  renault: "Renault",
  toyota: "Toyota",
  honda: "Honda",
  nissan: "Nissan",
  citroen: "Citroën",
  "citroën": "Citroën",
  mercedes: "Mercedes-Benz",
  bmw: "BMW",
  audi: "Audi",
  jeep: "Jeep",
  ram: "RAM",
};

function normalizarMarcaModelo(s: string): { marca: string; modelo: string } {
  const partes = (s ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { marca: "", modelo: "" };
  const primera = partes[0]!.toLowerCase();
  const marca = MARCAS[primera] ?? partes[0]!;
  return { marca, modelo: partes.slice(1).join(" ") };
}

function parseKm(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase();
  const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  return /mil/.test(s) && n < 1000 ? n * 1000 : n;
}

/**
 * Agente conversacional del bot (Haiku con herramientas). Responde CUALQUIER
 * consulta del personal del taller usando SOLO datos reales de la base, vía
 * tools. La app mantiene el control: el agente sólo LEE (no crea ni borra).
 * Ante fallo o sin API key, devuelve un texto de ayuda de respaldo.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_vehiculo",
    description:
      "Busca un vehículo por su patente y devuelve marca, modelo, estado actual, dueño y su última orden de trabajo.",
    input_schema: {
      type: "object",
      properties: { patente: { type: "string", description: "Patente del vehículo" } },
      required: ["patente"],
    },
  },
  {
    name: "vehiculos_en_taller",
    description:
      "Lista los vehículos que están ACTUALMENTE en el taller (no entregados ni suspendidos).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_cliente",
    description: "Busca un cliente por nombre (parcial) y devuelve sus datos y sus vehículos.",
    input_schema: {
      type: "object",
      properties: { nombre: { type: "string", description: "Nombre o parte del nombre" } },
      required: ["nombre"],
    },
  },
  {
    name: "estado_orden",
    description: "Devuelve el estado, total y servicios de una orden de trabajo por su número.",
    input_schema: {
      type: "object",
      properties: { numero: { type: "number", description: "Número de la orden" } },
      required: ["numero"],
    },
  },
  {
    name: "entregados",
    description:
      "Lista vehículos ENTREGADOS, del más reciente al más viejo. Para 'hoy'/'esta semana' pasá 'desde' (calculá la fecha con la fecha de hoy del sistema). Para 'los últimos N' pasá 'limite'. Se pueden combinar.",
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha mínima de entrega, formato YYYY-MM-DD (opcional)" },
        limite: { type: "number", description: "Máximo de resultados (opcional)" },
      },
    },
  },
  {
    name: "registrar_ingreso",
    description:
      "Registra el ingreso de un vehículo al taller (crea el vehículo si es nuevo o reusa el existente por patente, y crea una orden de trabajo). SOLO la patente es obligatoria; el resto es opcional. Usá esto cuando el usuario describe un auto que entró/hay que agregar.",
    input_schema: {
      type: "object",
      properties: {
        patente: { type: "string", description: "Patente (obligatorio)" },
        marca: { type: "string", description: "Marca (ej: Volkswagen). Normalizá abreviaturas (VW→Volkswagen)" },
        modelo: { type: "string", description: "Modelo (ej: Gol)" },
        kilometraje: { type: "number", description: "Kilometraje en número (ej: 10000)" },
        tarea: { type: "string", description: "Trabajo a realizar (ej: service, cambio de aceite)" },
        cliente: { type: "string", description: "Nombre del cliente/dueño" },
      },
      required: ["patente"],
    },
  },
];

const ENTREGADOS = new Set(["Entregado", "Suspendido"]);

async function ejecutarTool(
  tdb: TenantDb,
  name: string,
  input: Record<string, unknown>,
  from: string,
): Promise<string> {
  try {
    if (name === "buscar_vehiculo") {
      const patente = String(input.patente ?? "").toUpperCase().trim();
      const vs = await tdb.select(vehicles);
      const v =
        vs.find((x) => x.plate.toUpperCase() === patente) ??
        vs.find((x) => patente && x.plate.toUpperCase().includes(patente));
      if (!v) return JSON.stringify({ encontrado: false });
      const ords = (await tdb.select(workOrders, eq(workOrders.vehicleId, v.id))).sort(
        (a, b) => b.number - a.number,
      );
      const last = ords[0];
      return JSON.stringify({
        encontrado: true,
        patente: v.plate,
        marca: v.brand,
        modelo: v.model,
        estado: v.status,
        dueño: v.owner,
        costo: v.cost,
        ultimaOrden: last
          ? { numero: last.number, estado: last.status, total: last.total }
          : null,
      });
    }

    if (name === "vehiculos_en_taller") {
      const vs = await tdb.select(vehicles);
      const dentro = vs.filter((v) => !ENTREGADOS.has(v.status));
      return JSON.stringify({
        cantidad: dentro.length,
        vehiculos: dentro.map((v) => ({
          patente: v.plate,
          marca: v.brand,
          modelo: v.model,
          estado: v.status,
          dueño: v.owner,
        })),
      });
    }

    if (name === "buscar_cliente") {
      const nombre = String(input.nombre ?? "").toLowerCase().trim();
      const cs = await tdb.select(customers);
      const c = cs.find((x) => x.name.toLowerCase().includes(nombre));
      if (!c) return JSON.stringify({ encontrado: false });
      const vs = await tdb.select(vehicles, eq(vehicles.customerId, c.id));
      return JSON.stringify({
        encontrado: true,
        nombre: c.name,
        telefono: c.phone,
        vehiculos: vs.map((v) => ({ patente: v.plate, marca: v.brand, modelo: v.model, estado: v.status })),
      });
    }

    if (name === "estado_orden") {
      const numero = Number(input.numero);
      const o = await tdb.selectOne(workOrders, eq(workOrders.number, numero));
      if (!o) return JSON.stringify({ encontrado: false });
      return JSON.stringify({
        encontrado: true,
        numero: o.number,
        patente: o.vehiclePlate,
        estado: o.status,
        total: o.total,
        servicios: o.services,
      });
    }

    if (name === "entregados") {
      const desde = String(input.desde ?? "").trim();
      const limite = Number(input.limite) || 0;
      const vs = await tdb.select(vehicles);
      const fecha = (v: (typeof vs)[number]) => v.exitDate || v.entryDate || "";
      let entregados = vs.filter((v) => v.status === "Entregado");
      if (desde) entregados = entregados.filter((v) => fecha(v) >= desde);
      entregados.sort((a, b) => (fecha(a) < fecha(b) ? 1 : -1));
      if (limite > 0) entregados = entregados.slice(0, limite);
      return JSON.stringify({
        cantidad: entregados.length,
        vehiculos: entregados.map((v) => ({
          patente: v.plate,
          marca: v.brand,
          modelo: v.model,
          dueño: v.owner,
          entregado: fecha(v),
          costo: v.cost,
        })),
      });
    }

    if (name === "registrar_ingreso") {
      const patente = String(input.patente ?? "").toUpperCase().trim();
      if (!patente) return JSON.stringify({ ok: false, motivo: "falta la patente" });

      const crudo = [input.marca, input.modelo].filter(Boolean).join(" ").trim();
      const { marca, modelo } = normalizarMarcaModelo(crudo);
      const km = parseKm(input.kilometraje);
      const tarea = String(input.tarea ?? "").trim();
      const cliente = String(input.cliente ?? "").trim();

      const existente = (await tdb.select(vehicles)).find(
        (v) => v.plate.toUpperCase() === patente,
      );

      const order = await createOrder(tdb, BOT_ACTOR, {
        plate: patente,
        brand: marca || existente?.brand || "",
        model: modelo || existente?.model || "",
        customerName: cliente || existente?.owner || "",
        phone: from,
        services: tarea ? [tarea] : [],
        mileage: km,
      });

      // Historial (para el panel y para adjuntar fotos) + modo "esperando foto".
      const h = await tdb.insertOne(historialTaller, {
        waMessageId: `agent-${order.id}`,
        waFrom: from,
        waTimestamp: String(Math.floor(Date.now() / 1000)),
        rawMessage: null,
        marcaModelo: `${marca} ${modelo}`.trim() || null,
        patente,
        kilometraje: km != null ? String(km) : null,
        tarea: tarea || null,
        cliente: cliente || null,
        vehicleId: order.vehicleId,
        workOrderId: order.id,
        status: "linked",
        fotoPaths: [],
      });
      await tdb.delete(conversaciones, eq(conversaciones.phone, from));
      await tdb.insert(conversaciones, {
        phone: from,
        etapa: "esperando_foto",
        datos: { fotoPaths: [] },
        historialId: h.id,
      });

      return JSON.stringify({
        ok: true,
        patente,
        vehiculo: `${marca} ${modelo}`.trim() || "vehículo",
        cliente: cliente || existente?.owner || null,
        yaExistia: Boolean(existente),
        orden: order.number,
        nota: "Registrado. Se puede pedir al usuario que mande fotos del vehículo (opcional).",
      });
    }
  } catch {
    return JSON.stringify({ error: "no se pudo consultar" });
  }
  return JSON.stringify({ error: "herramienta desconocida" });
}

export interface AgenteResultado {
  texto: string;
  inputTokens: number;
  outputTokens: number;
}

/** Corre el agente sobre un mensaje libre. Devuelve la respuesta y los tokens. */
export async function agenteConsulta(
  tdb: TenantDb,
  texto: string,
  tallerNombre: string,
  from: string,
): Promise<AgenteResultado> {
  const c = getClient();
  const fallback =
    "Puedo ayudarte a cargar un ingreso, consultar un vehículo o cliente, o ver el estado de una orden. Contame qué necesitás. 🙂";
  if (!c) return { texto: fallback, inputTokens: 0, outputTokens: 0 };

  const hoy = new Date().toISOString().split("T")[0];
  const system = `Sos el asistente de WhatsApp del taller ${tallerNombre || "mecánico"}. Atendés al personal del taller. Hoy es ${hoy}.
- Respondé SOLO con datos reales obtenidos de las herramientas. Nunca inventes patentes, estados, montos ni nombres.
- CARGAR UN INGRESO: si el usuario describe un auto que entró o pide agregar uno (ej: "agregá un VW Gol patente ABC123 de Juan, service"), usá la herramienta "registrar_ingreso" y CARGALO DIRECTAMENTE. Sólo la patente es obligatoria; marca, modelo, km, cliente y tarea son opcionales (cargá lo que haya). Normalizá marcas (VW=Volkswagen, Chevy=Chevrolet). No pidas que repita el mensaje si ya lo entendiste. Si falta SOLO la patente, pedila. Tras registrar, confirmá con la orden creada y ofrecé mandar fotos del vehículo.
- Si al registrar el vehículo YA EXISTÍA (yaExistia=true), aclaralo con naturalidad ("ya lo teníamos, le sumé una nueva entrada").
- CONSULTAS: usá las herramientas para vehículos, clientes, órdenes, entregas o qué hay en el taller. Para "entregados hoy/esta semana" usá "entregados" con "desde" (calculado desde hoy=${hoy}); para "los últimos N" usá "limite".
- Si es un saludo o algo general, respondé breve y explicá qué podés hacer.
- Sé breve, cálido y en español rioplatense (voseo). Máximo 4 líneas. 1-2 emojis está bien.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: texto }];
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    for (let i = 0; i < 4; i++) {
      const res = await c.messages.create(
        { model: env.CLAUDE_MODEL_PARSER, max_tokens: 1024, system, tools: TOOLS, messages },
        { timeout: 30_000 },
      );
      inputTokens += res.usage?.input_tokens ?? 0;
      outputTokens += res.usage?.output_tokens ?? 0;

      if (res.stop_reason !== "tool_use") {
        const txt = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        return { texto: txt || fallback, inputTokens, outputTokens };
      }

      messages.push({ role: "assistant", content: res.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          const out = await ejecutarTool(
            tdb,
            block.name,
            block.input as Record<string, unknown>,
            from,
          );
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
    return { texto: "No pude completar la consulta, probá de nuevo.", inputTokens, outputTokens };
  } catch {
    return { texto: fallback, inputTokens, outputTokens };
  }
}
