import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import type { TenantDb } from "../db/scope.js";
import { customers, vehicles, workOrders } from "../db/schema.js";

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
];

const ENTREGADOS = new Set(["Entregado", "Suspendido"]);

async function ejecutarTool(
  tdb: TenantDb,
  name: string,
  input: Record<string, unknown>,
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
): Promise<AgenteResultado> {
  const c = getClient();
  const fallback =
    "Puedo ayudarte a cargar un ingreso, consultar un vehículo o cliente, o ver el estado de una orden. Contame qué necesitás. 🙂";
  if (!c) return { texto: fallback, inputTokens: 0, outputTokens: 0 };

  const hoy = new Date().toISOString().split("T")[0];
  const system = `Sos el asistente de WhatsApp del taller ${tallerNombre || "mecánico"}. Atendés al personal del taller. Hoy es ${hoy}.
- Respondé SOLO con datos reales obtenidos de las herramientas. Nunca inventes patentes, estados, montos ni nombres.
- Usá las herramientas cuando la pregunta sea sobre vehículos, clientes, órdenes, entregas o qué hay en el taller.
- Para "entregados hoy/esta semana/este mes" usá la herramienta "entregados" calculando la fecha "desde" a partir de hoy (${hoy}). Para "los últimos N entregados" usá "limite".
- Si el mensaje parece un INGRESO de un vehículo (ej: "entró un Gol patente ABC123, cliente Juan"), NO lo registres vos: pedile que lo mande claro con "entró/agregá" + patente para cargarlo (el sistema lo procesa por otro camino).
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
          const out = await ejecutarTool(tdb, block.name, block.input as Record<string, unknown>);
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
