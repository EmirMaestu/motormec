import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Tipos de la API de WhatsApp ───────────────────────────────────────────
interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | "interactive";
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface WhatsAppPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

interface DatosVehiculo {
  marca_modelo: string;
  kilometraje: string;
  patente: string;
  tarea: string;
  cliente: string;
}

interface DatosConversacion {
  marca_modelo: string;
  kilometraje: string;
  patente: string;
  tarea: string;
  cliente: string;
  customerId?: string;
  clienteEsNuevo?: boolean;
  rawMessage?: string;
  fotoIds?: string[];
}

// ─── Handler principal ─────────────────────────────────────────────────────
export const handleWhatsApp = httpAction(async (ctx, request) => {
  // ── GET: Verificación del webhook con Meta ──────────────────────────────
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ Webhook verificado correctamente por Meta");
      return new Response(challenge, { status: 200 });
    }

    console.error("❌ Verificación fallida — token no coincide");
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Mensajes entrantes ────────────────────────────────────────────
  if (request.method === "POST") {
    let body: WhatsAppPayload;

    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    if (body.object !== "whatsapp_business_account") {
      return new Response("OK", { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        const phoneNumberId = change.value?.metadata?.phone_number_id ?? "";

        for (const msg of messages) {
          await procesarMensaje(ctx, msg, phoneNumberId);
        }
      }
    }

    // Meta requiere respuesta 200 rápida
    return new Response("OK", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});

// ─── Normalizar número argentino para envío ────────────────────────────────
function normalizarNumeroEnvio(phone: string): string {
  if (!phone.startsWith("549")) return phone;
  const sinPais9 = phone.slice(3);
  const localDigits = sinPais9.startsWith("11") ? 8 : 7;
  const area = sinPais9.slice(0, sinPais9.length - localDigits);
  const local = sinPais9.slice(sinPais9.length - localDigits);
  return "54" + area + "15" + local;
}

// ─── Enviar mensaje de texto por WhatsApp ─────────────────────────────────
async function enviarMensaje(
  to: string,
  texto: string,
  phoneNumberId: string,
  accessToken: string
) {
  const toNormalizado = normalizarNumeroEnvio(to);
  console.log(`[WhatsApp] Enviando a ${to} → normalizado: ${toNormalizado}`);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNormalizado,
          type: "text",
          text: { body: texto },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[WhatsApp] Error al enviar mensaje: ${res.status}`, err);
    }
  } catch (err) {
    console.error("[WhatsApp] Error en enviarMensaje:", err);
  }
}

// ─── Enviar mensaje con botones interactivos ───────────────────────────────
async function enviarMensajeConBotones(
  to: string,
  texto: string,
  botones: Array<{ id: string; titulo: string }>,
  phoneNumberId: string,
  accessToken: string
) {
  const toNormalizado = normalizarNumeroEnvio(to);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNormalizado,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: texto },
            action: {
              buttons: botones.map((b) => ({
                type: "reply",
                reply: { id: b.id, title: b.titulo },
              })),
            },
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[WhatsApp] Error al enviar botones: ${res.status}`, err);
      // Fallback a mensaje de texto si los botones fallan
      await enviarMensaje(
        to,
        texto + "\n\n" + botones.map((b) => `▸ ${b.titulo}`).join("\n"),
        phoneNumberId,
        accessToken
      );
    }
  } catch (err) {
    console.error("[WhatsApp] Error en enviarMensajeConBotones:", err);
  }
}

// ─── Detectar respuesta afirmativa/negativa ────────────────────────────────
function esAfirmativo(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ["sí", "si", "s", "yes", "y", "claro", "ok", "dale", "confirmar", "confirmo", "correcto"].some(
    (w) => t === w || t.startsWith(w + " ")
  );
}

function esNegativo(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ["no", "n", "nop", "nope", "cancelar", "cancel"].some(
    (w) => t === w || t.startsWith(w + " ")
  );
}

function esListo(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return [
    "listo", "ya", "fin", "terminar", "terminé", "termine",
    "guardar", "no mas", "no más", "ya está", "ya esta",
  ].some((w) => t === w || t.startsWith(w + " "));
}

// ─── Extraer texto de un mensaje (texto o respuesta a botón) ──────────────
function extraerTexto(msg: WhatsAppMessage): string {
  if (msg.type === "text") return (msg.text?.body ?? "").trim();
  if (msg.type === "image") return (msg.image?.caption ?? "").trim();
  if (msg.type === "interactive") {
    const btnId = msg.interactive?.button_reply?.id ?? "";
    const btnTitle = msg.interactive?.button_reply?.title ?? "";
    const listId = msg.interactive?.list_reply?.id ?? "";
    const listTitle = msg.interactive?.list_reply?.title ?? "";
    // Retornar el ID del botón (para manejo preciso) o el título como fallback
    return btnId || listId || btnTitle || listTitle;
  }
  return "";
}

// ─── Procesar un mensaje individual ───────────────────────────────────────
async function procesarMensaje(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  msg: WhatsAppMessage,
  phoneNumberId: string
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  const from = msg.from;

  // Ignorar tipos no soportados
  if (!["text", "image", "interactive"].includes(msg.type)) {
    console.log(`[WhatsApp] Tipo ${msg.type} ignorado`);
    return;
  }

  const textoOriginal = extraerTexto(msg);

  // ── Verificar si hay una conversación activa ───────────────────────────
  const convActiva = await ctx.runQuery(
    internal.conversaciones.obtenerPorTelefono,
    { phone: from }
  );

  if (convActiva) {
    const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    if (convActiva.updatedAt < hace30min) {
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
    } else {
      await manejarRespuesta(ctx, convActiva, msg, textoOriginal, from, phoneNumberId, accessToken);
      return;
    }
  }

  // ── Verificar autorización del número ──────────────────────────────────
  const autorizado = await ctx.runQuery(internal.numerosAutorizados.verificar, { phone: from });
  if (!autorizado) {
    console.log(`[WhatsApp] Número no autorizado: ${from}`);
    await enviarMensaje(
      from,
      "⛔ Este número no está autorizado para usar el bot. Contactá al taller para solicitar acceso.",
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── Nueva conversación ─────────────────────────────────────────────────
  if (!textoOriginal && msg.type !== "image") {
    return;
  }

  // Guardar registro inicial (idempotente)
  const historialId = await ctx.runMutation(internal.historialTaller.guardar, {
    whatsappMessageId: msg.id,
    whatsappFrom: from,
    whatsappTimestamp: msg.timestamp,
    rawMessage: textoOriginal,
    fotoIds: [],
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  if (historialId === null) {
    console.log(`[WhatsApp] Mensaje ${msg.id} ya procesado, ignorando duplicado`);
    return;
  }

  // Procesar foto si hay
  const fotoIds: string[] = [];
  if (msg.type === "image" && msg.image?.id) {
    try {
      const storageId = await descargarYGuardarFoto(ctx, msg.image.id, accessToken);
      fotoIds.push(storageId);
    } catch (err) {
      console.error(`[WhatsApp] Error al guardar foto:`, err);
    }
  }

  // Extraer datos con IA
  let datosVehiculo: DatosVehiculo | null = null;
  let errorMsg: string | undefined;

  if (textoOriginal) {
    try {
      datosVehiculo = await procesarConIA(textoOriginal);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[WhatsApp] Error en IA:", err);
    }
  }

  if (!datosVehiculo) {
    await ctx.runMutation(internal.historialTaller.actualizar, {
      id: historialId,
      fotoIds: fotoIds as any,
      status: "error",
      errorMessage: errorMsg ?? "No se pudo procesar el mensaje",
    });
    await enviarMensaje(
      from,
      "❌ No pude procesar tu mensaje. Por favor enviá la información del vehículo con: marca, modelo, patente, kilometraje y trabajo a realizar.",
      phoneNumberId,
      accessToken
    );
    return;
  }

  // Actualizar historial con datos extraídos
  await ctx.runMutation(internal.historialTaller.actualizar, {
    id: historialId,
    marca_modelo: datosVehiculo.marca_modelo,
    kilometraje: datosVehiculo.kilometraje,
    patente: datosVehiculo.patente,
    tarea: datosVehiculo.tarea,
    cliente: datosVehiculo.cliente,
    fotoIds: fotoIds as any,
    status: "processed",
  });

  const datos: DatosConversacion = {
    marca_modelo: datosVehiculo.marca_modelo,
    kilometraje: datosVehiculo.kilometraje,
    patente: datosVehiculo.patente,
    tarea: datosVehiculo.tarea,
    cliente: datosVehiculo.cliente,
    rawMessage: textoOriginal,
    fotoIds,
  };

  // ── Buscar cliente en la base de datos ────────────────────────────────
  let clienteEncontrado: { _id: string; name: string; phone: string } | null = null;

  if (datosVehiculo.cliente) {
    const clientePorNombre = await ctx.runQuery(
      internal.conversaciones.buscarClientePorNombre,
      { nombre: datosVehiculo.cliente }
    ) as { _id: string; name: string; phone: string } | null;

    if (clientePorNombre) {
      clienteEncontrado = clientePorNombre;
    }
  }

  const patente = datosVehiculo.patente || "sin patente";
  const trabajo = datosVehiculo.tarea || "sin especificar";
  const km = datosVehiculo.kilometraje ? `${datosVehiculo.kilometraje} km` : null;

  if (clienteEncontrado) {
    // Encontramos un candidato — preguntar confirmación con botones
    await ctx.runMutation(internal.conversaciones.guardar, {
      phone: from,
      etapa: "verificando_cliente",
      datos,
      candidatoClienteId: clienteEncontrado._id as any,
      candidatoClienteNombre: clienteEncontrado.name,
      historialId,
    });

    await enviarMensajeConBotones(
      from,
      `✅ Recibí el ingreso:\n*${datosVehiculo.marca_modelo}* — ${patente}` +
      (km ? `\n📊 ${km}` : "") +
      `\n🔧 ${trabajo}\n\n` +
      `Encontré este cliente en la base:\n👤 *${clienteEncontrado.name}*\n📞 ${clienteEncontrado.phone}\n\n¿Es este el cliente?`,
      [
        { id: "btn_si", titulo: "✅ Sí, es él" },
        { id: "btn_no", titulo: "❌ No, es otro" },
      ],
      phoneNumberId,
      accessToken
    );
  } else {
    // No hay cliente previo — ir directo a confirmación
    await ctx.runMutation(internal.conversaciones.guardar, {
      phone: from,
      etapa: "confirmando",
      datos: { ...datos, clienteEsNuevo: true },
      historialId,
    });

    const clienteNombre = datosVehiculo.cliente || "desconocido";
    await enviarMensajeConBotones(
      from,
      `📋 *Resumen del ingreso:*\n\n` +
      `🚗 *Vehículo:* ${datosVehiculo.marca_modelo}\n` +
      `🔖 *Patente:* ${patente}\n` +
      (km ? `📊 *Kilometraje:* ${km}\n` : "") +
      `🔧 *Trabajo:* ${trabajo}\n` +
      `👤 *Cliente:* ${clienteNombre} _(nuevo)_\n\n` +
      `¿Confirmar y registrar el vehículo?`,
      [
        { id: "btn_confirmar", titulo: "✅ Confirmar" },
        { id: "btn_cancelar", titulo: "❌ Cancelar" },
      ],
      phoneNumberId,
      accessToken
    );
  }
}

// ─── Manejar respuestas dentro de una conversación activa ─────────────────
async function manejarRespuesta(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  conv: {
    _id: string;
    phone: string;
    etapa: string;
    datos: DatosConversacion;
    candidatoClienteId?: string;
    candidatoClienteNombre?: string;
    historialId?: string;
    [key: string]: unknown;
  },
  msg: WhatsAppMessage,
  texto: string,
  from: string,
  phoneNumberId: string,
  accessToken: string
) {
  const etapa = conv.etapa;
  const datos = conv.datos as DatosConversacion;

  // Normalizar texto: si es ID de botón, tratarlo como afirmativo/negativo
  const esBtnSi = texto === "btn_si" || texto === "btn_confirmar";
  const esBtnNo = texto === "btn_no" || texto === "btn_cancelar";
  const afirmativo = esBtnSi || esAfirmativo(texto);
  const negativo = esBtnNo || esNegativo(texto);

  // ── Cancelación global en cualquier etapa ──────────────────────────────
  if (negativo && etapa !== "verificando_cliente" && etapa !== "pidiendo_fotos") {
    await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
    await enviarMensaje(
      from,
      `❌ Registro cancelado. Podés volver a enviar la información cuando quieras.`,
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── ETAPA: verificando_cliente ─────────────────────────────────────────
  if (etapa === "verificando_cliente") {
    if (afirmativo) {
      // Cliente confirmado → ir a confirmando con resumen
      const nuevosDatos = {
        ...datos,
        customerId: conv.candidatoClienteId as string,
        clienteEsNuevo: false,
      };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "confirmando",
        datos: nuevosDatos,
      });

      await enviarResumenConfirmacion(
        from, nuevosDatos, conv.candidatoClienteNombre, phoneNumberId, accessToken
      );
    } else if (negativo) {
      // Cliente no es el correcto → continuar como nuevo, ir a confirmando
      const nuevosDatos = { ...datos, clienteEsNuevo: true };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "confirmando",
        datos: nuevosDatos,
      });

      await enviarResumenConfirmacion(
        from, nuevosDatos, undefined, phoneNumberId, accessToken
      );
    } else {
      await enviarMensajeConBotones(
        from,
        `Por favor confirmá si el cliente es *${conv.candidatoClienteNombre}*.`,
        [
          { id: "btn_si", titulo: "✅ Sí, es él" },
          { id: "btn_no", titulo: "❌ No, es otro" },
        ],
        phoneNumberId,
        accessToken
      );
    }
    return;
  }

  // ── ETAPA: confirmando ─────────────────────────────────────────────────
  if (etapa === "confirmando") {
    if (afirmativo) {
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "pidiendo_fotos",
        datos,
      });
      await enviarMensajeConBotones(
        from,
        `📸 ¿Querés agregar fotos del vehículo?\nEnviá las imágenes directamente o tocá "Sin fotos" para omitir.`,
        [{ id: "btn_sin_fotos", titulo: "📋 Sin fotos" }],
        phoneNumberId,
        accessToken
      );
    } else if (negativo) {
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
      await enviarMensaje(
        from,
        `❌ Registro cancelado. Podés volver a enviar la información cuando quieras.`,
        phoneNumberId,
        accessToken
      );
    } else {
      await enviarResumenConfirmacion(
        from, datos, datos.clienteEsNuevo ? undefined : conv.candidatoClienteNombre,
        phoneNumberId, accessToken
      );
    }
    return;
  }

  // ── ETAPA: pidiendo_fotos ──────────────────────────────────────────────
  if (etapa === "pidiendo_fotos") {
    // Si llega una imagen, guardarla
    if (msg.type === "image" && msg.image?.id) {
      try {
        const storageId = await descargarYGuardarFoto(ctx, msg.image.id, accessToken);
        const nuevosFotoIds = [...(datos.fotoIds ?? []), storageId];
        await ctx.runMutation(internal.conversaciones.actualizar, {
          phone: from,
          datos: { ...datos, fotoIds: nuevosFotoIds },
        });
        await enviarMensajeConBotones(
          from,
          `📸 Foto ${nuevosFotoIds.length} guardada. Enviá más o finalizá el registro.`,
          [{ id: "btn_listo", titulo: "✅ Registrar vehículo" }],
          phoneNumberId,
          accessToken
        );
      } catch (err) {
        console.error("[WhatsApp] Error al guardar foto:", err);
        await enviarMensaje(from, `⚠️ No pude guardar la foto, intentá de nuevo.`, phoneNumberId, accessToken);
      }
      return;
    }

    // Si dice "listo", "sin fotos", "no" o similar → crear el vehículo
    const proceder =
      texto === "btn_sin_fotos" ||
      texto === "btn_listo" ||
      esListo(texto) ||
      esNegativo(texto) ||
      esAfirmativo(texto) ||
      texto === "";

    if (proceder) {
      try {
        const [marcaParte, ...modeloPartes] = (datos.marca_modelo ?? "").split(" ");
        const marca = marcaParte || "Desconocida";
        const modelo = modeloPartes.join(" ") || "Desconocido";
        const fotoIds = datos.fotoIds ?? [];

        const vehicleId = await ctx.runMutation(
          internal.vehicles.crearVehiculo,
          {
            plate: (datos.patente ?? "").toUpperCase(),
            brand: marca,
            model: modelo,
            year: new Date().getFullYear(),
            owner: datos.cliente || "Sin nombre",
            phone: from,
            customerId: datos.customerId as any,
            status: "Ingresado",
            entryDate: new Date().toISOString().split("T")[0],
            services: datos.tarea ? [datos.tarea] : [],
            cost: 0,
            mileage: datos.kilometraje
              ? parseInt(datos.kilometraje.replace(/\D/g, "")) || undefined
              : undefined,
          }
        );

        if (conv.historialId) {
          await ctx.runMutation(internal.historialTaller.vincular, {
            id: conv.historialId as any,
            vehicleId: vehicleId as any,
            customerId: datos.customerId as any,
          });
          if (fotoIds.length > 0) {
            await ctx.runMutation(internal.historialTaller.actualizar, {
              id: conv.historialId as any,
              fotoIds: fotoIds as any,
              status: "linked",
            });
          }
        }

        await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });

        const fotoMsg =
          fotoIds.length > 0
            ? `\n📸 ${fotoIds.length} foto${fotoIds.length > 1 ? "s" : ""} adjunta${fotoIds.length > 1 ? "s" : ""}.`
            : "";
        await enviarMensaje(
          from,
          `✅ *¡Vehículo registrado!*\n\n${datos.marca_modelo} — ${datos.patente || "sin patente"}\nYa aparece en el sistema como *Ingresado*. 🔧${fotoMsg}`,
          phoneNumberId,
          accessToken
        );
      } catch (err) {
        console.error("[WhatsApp] Error al crear vehículo:", err);
        await enviarMensaje(
          from,
          `❌ Hubo un error al registrar el vehículo. Por favor intentá nuevamente o cargalo de forma manual.`,
          phoneNumberId,
          accessToken
        );
        await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
      }
      return;
    }

    await enviarMensajeConBotones(
      from,
      `Enviá fotos del vehículo o tocá el botón para registrar sin fotos.`,
      [{ id: "btn_sin_fotos", titulo: "📋 Sin fotos" }],
      phoneNumberId,
      accessToken
    );
    return;
  }

  // Etapa desconocida — limpiar
  await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
}

// ─── Enviar resumen para confirmación ─────────────────────────────────────
async function enviarResumenConfirmacion(
  to: string,
  datos: DatosConversacion,
  clienteConfirmadoNombre: string | undefined,
  phoneNumberId: string,
  accessToken: string
) {
  const marcaModelo = datos.marca_modelo || "desconocido";
  const patente = datos.patente || "sin patente";
  const km = datos.kilometraje ? `${datos.kilometraje} km` : "sin datos";
  const tarea = datos.tarea || "sin especificar";
  const cliente = datos.clienteEsNuevo
    ? `${datos.cliente} _(nuevo)_`
    : `${clienteConfirmadoNombre ?? datos.cliente} ✓`;

  await enviarMensajeConBotones(
    to,
    `📋 *Resumen del ingreso:*\n\n` +
    `🚗 *Vehículo:* ${marcaModelo}\n` +
    `🔖 *Patente:* ${patente}\n` +
    `📊 *Kilometraje:* ${km}\n` +
    `🔧 *Trabajo:* ${tarea}\n` +
    `👤 *Cliente:* ${cliente}\n\n` +
    `¿Confirmar y registrar el vehículo?`,
    [
      { id: "btn_confirmar", titulo: "✅ Confirmar" },
      { id: "btn_cancelar", titulo: "❌ Cancelar" },
    ],
    phoneNumberId,
    accessToken
  );
}

// ─── Llamar a Groq con LLaMA ───────────────────────────────────────────────
async function procesarConIA(texto: string): Promise<DatosVehiculo> {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY no configurada en las variables de entorno de Convex");
  }

  const systemPrompt = `Eres un extractor de datos para un taller mecánico argentino.
El usuario te enviará un mensaje informal con información de un vehículo que ingresa al taller.
DEBES responder ÚNICAMENTE con un JSON válido, sin texto extra, sin markdown, sin explicaciones.

El JSON debe tener exactamente estos campos:
{
  "marca_modelo": "string — marca y modelo completos del vehículo (ej: 'Chevrolet Aveo', 'Ford Focus')",
  "kilometraje": "string — solo el número del kilometraje, sin texto (ej: '185444')",
  "patente": "string — patente/matrícula en mayúsculas (ej: 'LWE366', 'AB123CD')",
  "tarea": "string — descripción COMPLETA y LITERAL del trabajo a realizar, copiando todas las palabras del mensaje original (ej: 'cambio sonda lambda 1', 'reparación falla cilindro n2', 'service 10000 km')",
  "cliente": "string — nombre propio del cliente (ej: 'Pedro', 'Juan García'). Buscar después de palabras como 'cliente', 'de', 'para'"
}

REGLAS IMPORTANTES:
- Para "tarea": copiá la descripción del trabajo de forma COMPLETA. NUNCA abrevies ni resumas.
- Para "cliente": extraé solo el nombre propio, sin la palabra "cliente".
- Si un campo no aparece en el mensaje, usá cadena vacía "". NO inventes datos.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: texto },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq respondió con status ${response.status}: ${err}`);
    }

    const data = await response.json();
    const contenido: string = data.choices?.[0]?.message?.content ?? "";

    const jsonLimpio = contenido
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    return JSON.parse(jsonLimpio) as DatosVehiculo;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Descargar foto de WhatsApp y subir a Convex Storage ──────────────────
async function descargarYGuardarFoto(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  mediaId: string,
  accessToken: string
): Promise<string> {
  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    throw new Error(`Graph API error al obtener media: ${metaRes.status}`);
  }

  const mediaInfo = await metaRes.json();
  const mediaUrl: string = mediaInfo.url;

  const imgRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!imgRes.ok) {
    throw new Error(`Error descargando imagen: ${imgRes.status}`);
  }

  const blob = await imgRes.blob();
  const storageId = await ctx.storage.store(blob);
  return storageId;
}
