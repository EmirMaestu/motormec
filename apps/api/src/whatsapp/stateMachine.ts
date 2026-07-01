import { eq } from "drizzle-orm";
import type { TenantDb } from "../db/scope.js";
import {
  conversaciones,
  customers,
  historialTaller,
  numerosAutorizados,
  vehicles,
  workOrders,
} from "../db/schema.js";
import { createVehicle } from "../domain/vehicles.js";
import { createOrder } from "../domain/orders.js";
import { detectarComando, ejecutarComando } from "./commands.js";
import { sameNumber } from "./phone.js";
import type { StorageProvider } from "../storage/provider.js";
import type { DatosVehiculo } from "./parser.js";
import {
  esAfirmativo,
  esBotonAfirmativo,
  esBotonListo,
  esBotonNegativo,
  esListo,
  esNegativo,
  BTN,
} from "./keywords.js";

const EXPIRY_MS = 30 * 60 * 1000;
const BOT_ACTOR = { userId: null, userName: "WhatsApp Bot" };

export interface WAMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
}

/** Injected side-effects, so the machine is unit-testable. */
export interface BotDeps {
  send: (to: string, texto: string) => Promise<boolean>;
  sendButtons: (
    to: string,
    texto: string,
    botones: Array<{ id: string; titulo: string }>,
  ) => Promise<boolean>;
  parse: (texto: string) => Promise<DatosVehiculo>;
  downloadMedia: (mediaId: string) => Promise<Buffer | null>;
  storage: StorageProvider;
  /**
   * Cuota mensual de IA del plan. Opcional: si no se provee, no hay límite
   * (p. ej. en tests). `check()` → ¿hay cupo? `tick()` → suma 1 al consumo.
   */
  iaQuota?: {
    check: () => Promise<boolean>;
    tick: () => Promise<void>;
  };
  /** Nombre del taller, para personalizar el saludo (opcional). */
  tallerNombre?: string;
  /**
   * Redactor natural (opcional). Reescribe un mensaje base con tono humano sin
   * cambiar los datos. Si no se provee, se usa el texto base tal cual.
   */
  redactar?: (base: string) => Promise<string>;
  /**
   * Agente conversacional con herramientas (opcional). Responde consultas libres
   * ("cómo va la patente X", "qué autos hay", etc.) con datos reales. Si no se
   * provee, se cae a las plantillas de saludo/consulta.
   */
  agente?: (texto: string) => Promise<string>;
}

/** Reescribe `base` en tono natural si hay redactor; si no, devuelve `base`. */
async function natural(deps: BotDeps, base: string): Promise<string> {
  if (!deps.redactar) return base;
  try {
    return (await deps.redactar(base)) || base;
  } catch {
    return base;
  }
}

interface ConvDatos extends Partial<DatosVehiculo> {
  customerId?: string | null;
  clienteNuevo?: boolean;
  fotoPaths?: string[];
}

function extraerTexto(msg: WAMessage): string {
  if (msg.type === "text") return (msg.text?.body ?? "").trim();
  if (msg.type === "image") return (msg.image?.caption ?? "").trim();
  if (msg.type === "interactive") {
    const i = msg.interactive;
    return (
      i?.button_reply?.id ||
      i?.list_reply?.id ||
      i?.button_reply?.title ||
      i?.list_reply?.title ||
      ""
    ).trim();
  }
  return "";
}

function resumen(d: ConvDatos): string {
  return [
    "📋 *Resumen del ingreso:*",
    `🚗 Vehículo: ${d.marca_modelo || "—"}`,
    `🔢 Patente: ${d.patente || "—"}`,
    `📏 Kilometraje: ${d.kilometraje || "—"}`,
    `🔧 Tarea: ${d.tarea || "—"}`,
    `👤 Cliente: ${d.cliente || "—"}`,
  ].join("\n");
}

/** Mensaje de bienvenida/ayuda cuando el mensaje no es un ingreso. */
function saludoAyuda(nombre?: string): string {
  const quien = nombre ? ` del taller *${nombre}*` : "";
  return [
    `¡Hola! 👋 Soy el asistente${quien}. Puedo ayudarte con:`,
    "",
    '📥 *Cargar un ingreso* — "Entró un Gol patente ABC123, cambio de aceite, cliente Juan"',
    '🔎 *Consultar* — "¿Cómo va la patente ABC123?" o "Qué autos tiene Juan"',
    '✏️ *Editar una orden* — "estado #12 listo" · "km #12 90000" · "cancelá #12"',
  ].join("\n");
}

/** Responde una consulta buscando en vehículos / clientes del taller. */
async function responderConsulta(tdb: TenantDb, datos: ConvDatos): Promise<string> {
  const patente = (datos.patente ?? "").toUpperCase().trim();
  const cliente = (datos.cliente ?? "").trim();

  if (patente) {
    const vs = await tdb.select(vehicles);
    const v =
      vs.find((x) => x.plate.toUpperCase() === patente) ??
      vs.find((x) => x.plate.toUpperCase().includes(patente));
    if (!v) return `No encontré ningún vehículo con la patente *${patente}*.`;
    const ords = (await tdb.select(workOrders, eq(workOrders.vehicleId, v.id))).sort(
      (a, b) => b.number - a.number,
    );
    const last = ords[0];
    return [
      `🚗 *${v.plate}* — ${`${v.brand} ${v.model}`.trim() || "—"}`,
      `Estado: ${v.status}`,
      `Dueño: ${v.owner || "—"}`,
      last ? `Última orden #${last.number}: ${last.status} (total $${last.total})` : "Sin órdenes cargadas.",
    ].join("\n");
  }

  if (cliente && cliente.length >= 2) {
    const cust = await buscarClientePorNombre(tdb, cliente);
    if (!cust) return `No encontré ningún cliente que coincida con *${cliente}*.`;
    const vs = await tdb.select(vehicles, eq(vehicles.customerId, cust.id));
    const lista =
      vs.map((v) => `• ${v.plate} ${`${v.brand} ${v.model}`.trim()} (${v.status})`).join("\n") ||
      "sin vehículos cargados";
    return [`👤 *${cust.name}*`, `Tel: ${cust.phone || "—"}`, "Vehículos:", lista].join("\n");
  }

  return "¿De qué vehículo o cliente querés saber? Pasame la *patente* o el *nombre del cliente*.";
}

/** Customer lookup by fuzzy name — ported from Convex buscarClientePorNombre. */
async function buscarClientePorNombre(tdb: TenantDb, nombre: string) {
  if (!nombre || nombre.trim().length < 3) return null;
  const todos = await tdb.select(customers);
  const activos = todos.filter((c) => c.active);
  const candidatos = activos.length > 0 ? activos : todos;
  const n = nombre.toLowerCase().trim();
  return (
    candidatos.find((c) => {
      const cl = c.name.toLowerCase();
      return cl.includes(n) || n.includes(cl) || cl.startsWith(n.substring(0, 4));
    }) ?? null
  );
}

/** Insert the historial record; returns null if the message was already seen. */
async function guardarHistorial(
  tdb: TenantDb,
  msg: WAMessage,
  rawMessage: string,
): Promise<string | null> {
  try {
    const row = await tdb.insertOne(historialTaller, {
      waMessageId: msg.id,
      waFrom: msg.from,
      waTimestamp: msg.timestamp,
      rawMessage,
      status: "pending",
    });
    return row.id;
  } catch (err) {
    // Unique violation on wa_message_id → duplicate delivery, ignore.
    if ((err as { code?: string }).code === "23505") return null;
    throw err;
  }
}

async function crearVehiculoDesdeConversacion(
  tdb: TenantDb,
  datos: ConvDatos,
  from: string,
  historialId: string,
): Promise<void> {
  const marcaModelo = (datos.marca_modelo ?? "").trim();
  const [brand = "", ...rest] = marcaModelo.split(" ");
  const model = rest.join(" ");
  const mileage = datos.kilometraje
    ? Number.parseInt(datos.kilometraje.replace(/\D/g, ""), 10) || null
    : null;

  const vehicle = await createVehicle(tdb, BOT_ACTOR, {
    plate: (datos.patente ?? "").toUpperCase(),
    brand,
    model,
    year: new Date().getFullYear(),
    owner: datos.cliente || "Sin nombre",
    phone: from,
    customerId: datos.customerId ?? null,
    status: "Ingresado",
    entryDate: new Date().toISOString().split("T")[0],
    services: datos.tarea ? [datos.tarea] : [],
    cost: 0,
    mileage,
  });

  // Each WhatsApp intake also generates a Work Order (reusing this vehicle).
  await createOrder(tdb, BOT_ACTOR, {
    vehicleId: vehicle.id,
    customerId: vehicle.customerId ?? null,
    customerName: datos.cliente || "Sin nombre",
    phone: from,
    services: datos.tarea ? [datos.tarea] : [],
    mileage,
  });

  await tdb.updateById(historialTaller, historialId, {
    status: "linked",
    vehicleId: vehicle.id,
    customerId: vehicle.customerId ?? null,
    fotoPaths: datos.fotoPaths ?? [],
  });
}

/**
 * Process a single inbound WhatsApp message for a tenant. Returns a short label
 * describing what happened (handy for logging/tests).
 */
export async function procesarMensaje(
  tdb: TenantDb,
  msg: WAMessage,
  deps: BotDeps,
): Promise<string> {
  const from = msg.from;
  const texto = extraerTexto(msg);

  // 1. Authorization (whitelist del taller, match tolerante de formato).
  const activos = await tdb.select(numerosAutorizados, eq(numerosAutorizados.active, true));
  const autorizado = activos.find((n) => sameNumber(n.phone, from));
  if (!autorizado) {
    await deps.send(
      from,
      "⛔ Este número no está autorizado para usar el bot. Contactá al taller para solicitar acceso.",
    );
    return "unauthorized";
  }

  // 2. Idempotency.
  const historialId = await guardarHistorial(tdb, msg, texto);
  if (!historialId) return "duplicate";

  // 3. Conversation state (with 30-min expiry).
  let conv = await tdb.selectOne(conversaciones, eq(conversaciones.phone, from));
  if (conv && Date.now() - conv.updatedAt.getTime() > EXPIRY_MS) {
    await tdb.deleteById(conversaciones, conv.id);
    conv = null;
  }

  // 4. New message, no active conversation.
  if (!conv) {
    // 4a. ¿Es un comando de edición/borrado? (cancelar/estado/km/mano de obra)
    const cmd = detectarComando(texto);
    if (cmd) {
      const reply = await ejecutarComando(tdb, cmd);
      await tdb.updateById(historialTaller, historialId, { status: "processed" });
      await deps.send(from, reply);
      return "comando";
    }

    // 4b. Si no, es un ingreso nuevo → extracción con IA.
    // Antes de gastar IA, verificar la cuota mensual del plan del taller.
    if (deps.iaQuota && !(await deps.iaQuota.check())) {
      await tdb.updateById(historialTaller, historialId, {
        status: "error",
        errorMessage: "ia_quota_exceeded",
      });
      await deps.send(
        from,
        "⚠️ El taller alcanzó el límite de mensajes con IA de este mes. Pedile al administrador que actualice el plan para seguir cargando ingresos automáticamente.",
      );
      return "ia_quota";
    }
    const datos = await deps.parse(texto);
    if (deps.iaQuota) await deps.iaQuota.tick();
    await tdb.updateById(historialTaller, historialId, {
      marcaModelo: datos.marca_modelo || null,
      kilometraje: datos.kilometraje || null,
      patente: datos.patente || null,
      tarea: datos.tarea || null,
      cliente: datos.cliente || null,
      status: "processed",
    });

    // Ruteo: es un INGRESO si trae datos de vehículo y NO es una consulta.
    // (Evita registrar ante un "Hola" y evita que un ingreso caiga en el agente
    // de solo-lectura.)
    const hayDatos = Boolean(datos.patente || datos.marca_modelo || datos.tarea);
    const esConsulta = datos.intencion === "consulta";
    if (!hayDatos || esConsulta) {
      // Conversación libre → agente con herramientas (consulta datos reales).
      if (deps.agente) {
        await deps.send(from, await deps.agente(texto));
        return esConsulta ? "consulta" : "saludo";
      }
      // Respaldo sin agente (tests): plantillas.
      if (esConsulta) {
        await deps.send(from, await natural(deps, await responderConsulta(tdb, datos)));
        return "consulta";
      }
      await deps.send(from, await natural(deps, saludoAyuda(deps.tallerNombre)));
      return "saludo";
    }

    const candidato = datos.cliente ? await buscarClientePorNombre(tdb, datos.cliente) : null;

    if (candidato) {
      const convDatos: ConvDatos = { ...datos, customerId: candidato.id, fotoPaths: [] };
      await tdb.insert(conversaciones, {
        phone: from,
        etapa: "verificando_cliente",
        datos: convDatos,
        candidatoClienteId: candidato.id,
        candidatoClienteNombre: candidato.name,
        historialId,
      });
      await deps.sendButtons(
        from,
        `Encontré este cliente: *${candidato.name}*.\n\n${resumen(convDatos)}\n\n¿Es este cliente?`,
        [
          { id: BTN.SI, titulo: "✅ Sí, es él" },
          { id: BTN.NO, titulo: "❌ No, es otro" },
        ],
      );
      return "verificando_cliente";
    }

    const convDatos: ConvDatos = { ...datos, customerId: null, clienteNuevo: true, fotoPaths: [] };
    await tdb.insert(conversaciones, {
      phone: from,
      etapa: "confirmando",
      datos: convDatos,
      historialId,
    });
    await deps.sendButtons(
      from,
      `${resumen(convDatos)}\n\n¿Confirmás el ingreso? (cliente nuevo)`,
      [
        { id: BTN.CONFIRMAR, titulo: "✅ Confirmar" },
        { id: BTN.CANCELAR, titulo: "❌ Cancelar" },
      ],
    );
    return "confirmando";
  }

  // 5. Existing conversation.
  const btnId = msg.type === "interactive" ? texto : "";
  const afirmativo = esBotonAfirmativo(btnId) || esAfirmativo(texto);
  const negativo = esBotonNegativo(btnId) || esNegativo(texto);
  const listo = esBotonListo(btnId) || esListo(texto);
  const datos = (conv.datos ?? {}) as ConvDatos;

  if (conv.etapa === "verificando_cliente") {
    if (afirmativo) {
      const next: ConvDatos = { ...datos, customerId: conv.candidatoClienteId ?? null };
      await tdb.updateById(conversaciones, conv.id, {
        etapa: "confirmando",
        datos: next,
        updatedAt: new Date(),
      });
      await deps.sendButtons(from, `${resumen(next)}\n\n¿Confirmás el ingreso?`, [
        { id: BTN.CONFIRMAR, titulo: "✅ Confirmar" },
        { id: BTN.CANCELAR, titulo: "❌ Cancelar" },
      ]);
      return "confirmando";
    }
    if (negativo) {
      const next: ConvDatos = { ...datos, customerId: null, clienteNuevo: true };
      await tdb.updateById(conversaciones, conv.id, {
        etapa: "confirmando",
        datos: next,
        updatedAt: new Date(),
      });
      await deps.sendButtons(
        from,
        `Se registrará como cliente nuevo.\n\n${resumen(next)}\n\n¿Confirmás el ingreso?`,
        [
          { id: BTN.CONFIRMAR, titulo: "✅ Confirmar" },
          { id: BTN.CANCELAR, titulo: "❌ Cancelar" },
        ],
      );
      return "confirmando";
    }
    await deps.sendButtons(from, "Respondé con los botones, por favor. ¿Es este cliente?", [
      { id: BTN.SI, titulo: "✅ Sí, es él" },
      { id: BTN.NO, titulo: "❌ No, es otro" },
    ]);
    return "verificando_cliente";
  }

  if (conv.etapa === "confirmando") {
    if (afirmativo) {
      await tdb.updateById(conversaciones, conv.id, {
        etapa: "pidiendo_fotos",
        updatedAt: new Date(),
      });
      await deps.sendButtons(
        from,
        "✅ Confirmado. Mandá fotos del vehículo, o tocá *Sin fotos* para registrar sin fotos.",
        [{ id: BTN.SIN_FOTOS, titulo: "📋 Sin fotos" }],
      );
      return "pidiendo_fotos";
    }
    if (negativo) {
      await tdb.deleteById(conversaciones, conv.id);
      await deps.send(from, "❌ Ingreso cancelado. Mandá un nuevo mensaje para empezar de nuevo.");
      return "cancelled";
    }
    await deps.sendButtons(from, `${resumen(datos)}\n\n¿Confirmás el ingreso?`, [
      { id: BTN.CONFIRMAR, titulo: "✅ Confirmar" },
      { id: BTN.CANCELAR, titulo: "❌ Cancelar" },
    ]);
    return "confirmando";
  }

  if (conv.etapa === "pidiendo_fotos") {
    if (msg.type === "image" && msg.image?.id) {
      const bytes = await deps.downloadMedia(msg.image.id);
      const fotoPaths = [...(datos.fotoPaths ?? [])];
      if (bytes && conv.historialId) {
        const path = await deps.storage.save(tdb.tenantId, conv.historialId, bytes, "jpg");
        fotoPaths.push(path);
      }
      await tdb.updateById(conversaciones, conv.id, {
        datos: { ...datos, fotoPaths },
        updatedAt: new Date(),
      });
      await deps.sendButtons(
        from,
        `📸 Foto recibida (${fotoPaths.length}). Mandá más, o tocá *Registrar vehículo*.`,
        [{ id: BTN.LISTO, titulo: "✅ Registrar vehículo" }],
      );
      return "pidiendo_fotos";
    }
    if (listo) {
      if (conv.historialId) {
        await crearVehiculoDesdeConversacion(tdb, datos, from, conv.historialId);
      }
      await tdb.deleteById(conversaciones, conv.id);
      await deps.send(
        from,
        await natural(
          deps,
          `✅ ¡Vehículo registrado! Patente ${(datos.patente ?? "").toUpperCase() || "—"}. Gracias.`,
        ),
      );
      return "registered";
    }
    await deps.sendButtons(
      from,
      "Mandá una foto, o tocá *Registrar vehículo* para finalizar.",
      [{ id: BTN.LISTO, titulo: "✅ Registrar vehículo" }],
    );
    return "pidiendo_fotos";
  }

  return "noop";
}
