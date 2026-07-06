import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import type { TenantDb } from "../db/scope.js";
import {
  conversaciones,
  customers,
  presupuestos,
  vehicles,
  workOrders,
  type Presupuesto,
} from "../db/schema.js";
import { createQuote } from "../domain/quotes.js";
import { esPatenteValida, normalizarPatente } from "./patente.js";
import { sanitizePromptField, sanitizeToolText } from "./sanitize.js";

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

/** Modelo barato y disponible para reintentar si el modelo del plan cae (BOT-6). */
const MODELO_FALLBACK = "claude-haiku-4-5";

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
  {
    name: "crear_presupuesto",
    description:
      "Crea un presupuesto/cotización para un cliente con uno o más ítems (servicios o repuestos). Usá esto cuando el usuario pide 'hacé un presupuesto', 'cotizá', 'presupuestá' algo. Devolvé el número y el link a la web para verlo/imprimirlo con el logo del taller.",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string", description: "Nombre del cliente" },
        telefono: { type: "string", description: "Teléfono del cliente (opcional)" },
        patente: { type: "string", description: "Patente del vehículo (opcional)" },
        vehiculo: { type: "string", description: "Vehículo, ej: Ford Focus (opcional)" },
        items: {
          type: "array",
          description: "Ítems del presupuesto",
          items: {
            type: "object",
            properties: {
              descripcion: { type: "string", description: "Servicio o repuesto" },
              cantidad: { type: "number", description: "Cantidad (default 1)" },
              precio: { type: "number", description: "Precio unitario" },
            },
            required: ["descripcion", "precio"],
          },
        },
        notas: { type: "string", description: "Observaciones (opcional)" },
      },
      required: ["cliente", "items"],
    },
  },
];

const ENTREGADOS = new Set(["Entregado", "Suspendido"]);

function fmtMoney(n: number): string {
  // `n` viene en CENTAVOS (el dinero se guarda como entero de centavos); se
  // muestra en pesos dividiendo por 100.
  return `$ ${Math.round((n ?? 0) / 100).toLocaleString("es-AR")}`;
}

/** Presupuesto formateado para WhatsApp (negritas *…*, itálicas _…_). Verbatim. */
export function formatPresupuesto(
  tallerNombre: string,
  q: { number: number; customerName: string; vehiclePlate?: string | null; vehicleInfo?: string | null; items: { description: string; quantity: number; unitPrice: number }[]; total: number; validUntil?: string | null; notes?: string | null },
): string {
  const lineas: string[] = [];
  lineas.push(`📋 *Presupuesto #${q.number}*${tallerNombre ? ` — ${tallerNombre}` : ""}`);
  if (q.customerName) lineas.push(`Cliente: ${q.customerName}`);
  const veh = [q.vehicleInfo, q.vehiclePlate].filter(Boolean).join(" · ");
  if (veh) lineas.push(`Vehículo: ${veh}`);
  lineas.push("");
  for (const it of q.items) {
    lineas.push(`• ${it.description} x${it.quantity} — ${fmtMoney(it.quantity * it.unitPrice)}`);
  }
  lineas.push("");
  lineas.push(`*Total: ${fmtMoney(q.total)}*`);
  if (q.validUntil) lineas.push(`Válido hasta ${q.validUntil}`);
  if (q.notes) lineas.push(`Obs: ${q.notes}`);
  lineas.push("");
  lineas.push("_Presupuesto hecho con Momec_ · momec.pro");
  return lineas.join("\n");
}

/** Propuesta de ingreso pendiente de confirmar, guardada en `conversaciones.datos`. */
export interface PropuestaIngreso {
  patente: string;
  marca: string;
  modelo: string;
  cliente: string;
  tarea: string;
  kilometraje: number | null;
}

export async function ejecutarTool(
  tdb: TenantDb,
  name: string,
  input: Record<string, unknown>,
  from: string,
  tallerNombre: string,
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
        patente: sanitizeToolText(v.plate, 10),
        marca: sanitizeToolText(v.brand, 40),
        modelo: sanitizeToolText(v.model, 40),
        estado: v.status,
        dueño: sanitizeToolText(v.owner, 80),
        costo: fmtMoney(v.cost),
        ultimaOrden: last
          ? { numero: last.number, estado: last.status, total: fmtMoney(last.total) }
          : null,
      });
    }

    if (name === "vehiculos_en_taller") {
      const vs = await tdb.select(vehicles);
      const dentro = vs.filter((v) => !ENTREGADOS.has(v.status));
      return JSON.stringify({
        cantidad: dentro.length,
        vehiculos: dentro.map((v) => ({
          patente: sanitizeToolText(v.plate, 10),
          marca: sanitizeToolText(v.brand, 40),
          modelo: sanitizeToolText(v.model, 40),
          estado: v.status,
          dueño: sanitizeToolText(v.owner, 80),
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
        nombre: sanitizeToolText(c.name, 80),
        telefono: c.phone,
        vehiculos: vs.map((v) => ({
          patente: sanitizeToolText(v.plate, 10),
          marca: sanitizeToolText(v.brand, 40),
          modelo: sanitizeToolText(v.model, 40),
          estado: v.status,
        })),
      });
    }

    if (name === "estado_orden") {
      const numero = Number(input.numero);
      const o = await tdb.selectOne(workOrders, eq(workOrders.number, numero));
      if (!o) return JSON.stringify({ encontrado: false });
      return JSON.stringify({
        encontrado: true,
        numero: o.number,
        patente: sanitizeToolText(o.vehiclePlate, 10),
        estado: o.status,
        total: fmtMoney(o.total),
        servicios: Array.isArray(o.services)
          ? o.services.map((s) => sanitizeToolText(String(s), 120))
          : o.services,
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
          patente: sanitizeToolText(v.plate, 10),
          marca: sanitizeToolText(v.brand, 40),
          modelo: sanitizeToolText(v.model, 40),
          dueño: sanitizeToolText(v.owner, 80),
          entregado: fecha(v),
          costo: v.cost,
        })),
      });
    }

    if (name === "registrar_ingreso") {
      const patente = normalizarPatente(String(input.patente ?? ""));
      if (!patente) return JSON.stringify({ ok: false, motivo: "falta la patente" });

      // BOT-4: validar el formato de patente (viejo AAA000 / Mercosur AA000AA).
      // Si no es válida, NO dejar la propuesta pendiente: pedir que la repitan.
      if (!esPatenteValida(patente)) {
        return JSON.stringify({
          ok: false,
          patente_invalida: true,
          nota: "La patente no tiene un formato válido (esperado AAA000 o AA000AA). NO registres nada; pedile al usuario que te repita la patente (ej: 'Esa patente no parece válida, ¿me la repetís?').",
        });
      }

      const crudo = [input.marca, input.modelo].filter(Boolean).join(" ").trim();
      const { marca, modelo } = normalizarMarcaModelo(crudo);
      const km = parseKm(input.kilometraje);
      const tarea = String(input.tarea ?? "").trim();
      const cliente = String(input.cliente ?? "").trim();

      const existente = (await tdb.select(vehicles)).find(
        (v) => v.plate.toUpperCase() === patente,
      );

      // BOT-3: NO escribir todavía. Dejar la propuesta pendiente en la conversación
      // (etapa `confirmar_ingreso_agente`) y pedir confirmación. La máquina de estados
      // ejecuta el createOrder real recién cuando el usuario responde afirmativamente.
      // Esto evita creaciones masivas/accidentales desde un teléfono comprometido.
      const propuesta: PropuestaIngreso = {
        patente,
        marca: marca || existente?.brand || "",
        modelo: modelo || existente?.model || "",
        cliente: cliente || existente?.owner || "",
        tarea,
        kilometraje: km,
      };
      await tdb.delete(conversaciones, eq(conversaciones.phone, from));
      await tdb.insert(conversaciones, {
        phone: from,
        etapa: "confirmar_ingreso_agente",
        datos: propuesta as unknown as Record<string, unknown>,
      });

      const vehiculo = `${propuesta.marca} ${propuesta.modelo}`.trim() || "vehículo";
      return JSON.stringify({
        pendiente_confirmacion: true,
        resumen: `Ingreso de ${sanitizeToolText(patente, 10)} ${sanitizeToolText(vehiculo, 80)}${
          propuesta.cliente ? ` de ${sanitizeToolText(propuesta.cliente, 80)}` : ""
        }`,
        yaExistia: Boolean(existente),
        nota: "NO se registró todavía. Pedí confirmación al usuario en UNA línea (ej: '¿Confirmo el ingreso de ABC123 de Juan? Respondé Sí para cargarlo'). Al responder Sí, se carga solo.",
      });
    }

    if (name === "crear_presupuesto") {
      const cliente = String(input.cliente ?? "").trim();
      const rawItems = Array.isArray(input.items) ? input.items : [];
      const items = rawItems
        .map((it) => {
          const o = it as Record<string, unknown>;
          return {
            description: String(o.descripcion ?? "").trim(),
            quantity: Number(o.cantidad) || 1,
            // El usuario dicta PESOS ("pastillas 15000"); el dinero se guarda en
            // CENTAVOS, así que convertimos ×100.
            unitPrice: Math.round((Number(o.precio) || 0) * 100),
          };
        })
        .filter((i) => i.description);
      if (!cliente || items.length === 0) {
        return JSON.stringify({ ok: false, motivo: "faltan cliente o ítems" });
      }
      const crudo = String(input.vehiculo ?? "").trim();
      const { marca, modelo } = normalizarMarcaModelo(crudo);
      const quote = await createQuote(tdb, BOT_ACTOR.userName, {
        customerName: cliente,
        customerPhone: input.telefono ? String(input.telefono) : from,
        vehiclePlate: input.patente ? String(input.patente).toUpperCase().trim() : undefined,
        vehicleInfo: `${marca} ${modelo}`.trim() || undefined,
        items,
        notes: input.notas ? String(input.notas) : undefined,
      });
      const documento = formatPresupuesto(tallerNombre, quote);
      return JSON.stringify({
        ok: true,
        id: quote.id,
        presupuesto: quote.number,
        total: fmtMoney(quote.total),
        documento,
        nota: "El presupuesto YA se le envía al usuario en un mensaje aparte. Confirmá en UNA línea (ej: 'Listo, te paso el presupuesto 👇') SIN repetir los ítems ni el total.",
      });
    }
  } catch {
    return JSON.stringify({ error: "no se pudo consultar" });
  }
  return JSON.stringify({ error: "herramienta desconocida" });
}

/** Un turno de la memoria liviana de conversación (solo texto plano). */
export interface TurnoHistorial {
  role: "user" | "assistant";
  content: string;
}

/** Cantidad máxima de turnos que se conservan (acota costo/tokens). */
const MAX_HISTORIAL = 12;

export interface AgenteResultado {
  texto: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * Historial actualizado (memoria multi-turno): el historial previo + el
   * mensaje del usuario + la respuesta final del asistente, capado a los
   * últimos MAX_HISTORIAL turnos. Solo texto plano (sin tool_use/tool_result).
   */
  historial: TurnoHistorial[];
}

export interface AgenteHooks {
  /** Modelo de Claude a usar (según el plan del taller). Default: env. */
  model?: string;
  /** Envía el presupuesto en PDF. Devuelve true si se envió (para no duplicar en texto). */
  enviarPresupuestoPdf?: (quote: Presupuesto) => Promise<boolean>;
}

/** Corre el agente sobre un mensaje libre. Devuelve la respuesta y los tokens. */
export async function agenteConsulta(
  tdb: TenantDb,
  texto: string,
  tallerNombre: string,
  from: string,
  hooks?: AgenteHooks,
  historialPrevio: TurnoHistorial[] = [],
): Promise<AgenteResultado> {
  const c = getClient();
  const fallback =
    "Puedo ayudarte a cargar un ingreso, consultar un vehículo o cliente, o ver el estado de una orden. Contame qué necesitás. 🙂";

  // Construye el historial actualizado a partir de la respuesta final del
  // asistente, capado a los últimos MAX_HISTORIAL turnos. Solo texto plano.
  const construirHistorial = (respuesta: string): TurnoHistorial[] =>
    [
      ...historialPrevio,
      { role: "user", content: texto },
      { role: "assistant", content: respuesta },
    ].slice(-MAX_HISTORIAL) as TurnoHistorial[];

  if (!c)
    return {
      texto: fallback,
      inputTokens: 0,
      outputTokens: 0,
      historial: construirHistorial(fallback),
    };

  const hoy = new Date().toISOString().split("T")[0];
  const nombreTaller = sanitizePromptField(tallerNombre, 60);
  const system = `Sos el asistente de WhatsApp del taller ${nombreTaller || "mecánico"}. Atendés al personal del taller. Hoy es ${hoy}.
- Respondé SOLO con datos reales obtenidos de las herramientas. Nunca inventes patentes, estados, montos ni nombres.
- HACER UN PRESUPUESTO: si el usuario pide "hacé/armá un presupuesto", "cotizá", "presupuestá" (ej: "presupuestá a Juan: pastillas 15000, mano de obra 8000" o "presupuesto de 10000 para Juan de cambio de correa, repuestos 30mil"), llamá a "crear_presupuesto" DE UNA con lo que tengas. SOLO hacen falta el cliente y al menos un ítem. NUNCA pidas patente, número de orden, marca ni modelo para un presupuesto — no hacen falta y NO existe "orden" en el presupuesto. Interpretá montos naturales: "10000 de mano de obra" → ítem "Mano de obra" 10000; "repuestos 30mil" → ítem "Repuestos" 30000; "3mil"=3000, "30mil"=30000, "1.5 palo"=1500000. El PDF se envía solo; vos confirmá en UNA línea (ej: "Listo, te paso el presupuesto 👇") SIN repetir ítems ni total.
- CARGAR UN INGRESO: si el usuario quiere agregar/cargar un auto. Normalizá marcas (VW=Volkswagen, Chevy=Chevrolet). Si "registrar_ingreso" devuelve "patente_invalida", NO digas que quedó registrado: pedí la patente de nuevo en UNA línea. Hay DOS caminos:
  (a) TODO JUNTO (ej: "agregá un VW Gol patente ABC123 de Juan, service"): llamá a "registrar_ingreso" de una con lo que haya (sólo la patente es obligatoria).
  (b) POR PARTES (ej: "agregá un auto", o le faltan datos): GUIALO pidiendo UN dato por vez, breve y natural, RECORDANDO lo que ya te dijo antes en la charla. Orden: 1) patente; 2) nombre del cliente → cuando te lo diga usá "buscar_cliente": si hay una coincidencia parecida confirmá ("¿Es Juan Morales?"), si no existe avisá y ofrecé crearlo ("No tengo a Juan Pérez, ¿lo creo?"); 3) marca y modelo; 4) tarea/servicio (opcional). Preguntá una cosa a la vez, sin abrumar. Cuando tengas al menos la patente, llamá a "registrar_ingreso" con TODO lo que juntaste en la conversación.
- CONFIRMAR EL INGRESO: el ingreso NO se carga solo. La herramienta devuelve "pendiente_confirmacion": en ese caso NO digas que quedó registrado; pedí confirmación en UNA línea con los datos del "resumen" (ej: "¿Confirmo el ingreso de ABC123 Gol de Juan? Respondé *Sí* para cargarlo"). Al responder Sí, la app lo carga sola. Si el vehículo YA EXISTÍA (yaExistia=true), aclaralo con naturalidad ("ya lo teníamos, le sumaría una nueva entrada").
- CONSULTAS: usá las herramientas para vehículos, clientes, órdenes, entregas o qué hay en el taller. Para "entregados hoy/esta semana" usá "entregados" con "desde" (calculado desde hoy=${hoy}); para "los últimos N" usá "limite".
- Si es un saludo o algo general, respondé breve y explicá qué podés hacer.
- Sé breve, cálido y en español rioplatense (voseo). Máximo 4 líneas. 1-2 emojis está bien.`;

  // Tokens consumidos por TODOS los intentos (para no perder el conteo si el
  // primer modelo falla y reintentamos con otro).
  let inputTokens = 0;
  let outputTokens = 0;

  /**
   * Corre el loop del agente con un modelo dado, partiendo de un estado limpio
   * (el mensaje del usuario). Puede lanzar si la API del modelo falla/limita.
   */
  const runLoop = async (model: string): Promise<AgenteResultado> => {
    // Memoria multi-turno: prependemos el historial previo (texto plano) para
    // dar contexto de la conversación antes del mensaje actual del usuario.
    const messages: Anthropic.MessageParam[] = [
      ...historialPrevio.map(
        (t): Anthropic.MessageParam => ({ role: t.role, content: t.content }),
      ),
      { role: "user", content: texto },
    ];
    let presupuestoDoc = "";
    let presupuestoId = "";

    for (let i = 0; i < 4; i++) {
      const res = await c.messages.create(
        {
          model,
          max_tokens: 1024,
          system,
          tools: TOOLS,
          messages,
        },
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
        // Presupuesto: intentar mandar el PDF; si no se pudo, adjuntar el texto
        // VERBATIM (números exactos, sin parafrasear) como respaldo.
        let finalText = txt || (presupuestoId ? "Listo, te paso el presupuesto 👇" : fallback);
        if (presupuestoId) {
          let enviadoPdf = false;
          if (hooks?.enviarPresupuestoPdf) {
            const q = await tdb.findById(presupuestos, presupuestoId);
            if (q) enviadoPdf = await hooks.enviarPresupuestoPdf(q);
          }
          if (!enviadoPdf && presupuestoDoc) finalText = `${finalText}\n\n${presupuestoDoc}`;
        }
        // El historial guarda solo el texto final del asistente (no el doc del
        // presupuesto ni bloques de tool), para mantener la memoria simple/barata.
        return {
          texto: finalText,
          inputTokens,
          outputTokens,
          historial: construirHistorial(txt || finalText),
        };
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
            tallerNombre,
          );
          if (block.name === "crear_presupuesto") {
            try {
              const parsed = JSON.parse(out) as { documento?: string; id?: string };
              if (parsed.documento) presupuestoDoc = parsed.documento;
              if (parsed.id) presupuestoId = parsed.id;
            } catch {
              /* ignore */
            }
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
    const incompleto = "No pude completar la consulta, probá de nuevo.";
    return {
      texto: incompleto,
      inputTokens,
      outputTokens,
      historial: construirHistorial(incompleto),
    };
  };

  const primaryModel = hooks?.model || env.CLAUDE_MODEL_AGENT;
  try {
    return await runLoop(primaryModel);
  } catch {
    // BOT-6: fallback de modelo. Si el modelo primario cayó/limitó, reintentar
    // UNA vez con Haiku (barato y disponible) antes de rendirnos — solo si el
    // modelo usado era otro. Había cliente (c != null); un fallo real de API,
    // no falta de config.
    if (primaryModel !== MODELO_FALLBACK) {
      try {
        return await runLoop(MODELO_FALLBACK);
      } catch {
        /* el reintento también falló: caemos al texto de respaldo */
      }
    }
    return {
      texto: fallback,
      inputTokens,
      outputTokens,
      historial: construirHistorial(fallback),
    };
  }
}
