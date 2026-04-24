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

// ─── Etapas del flujo ──────────────────────────────────────────────────────
// pidiendo_marca_modelo → pidiendo_patente → pidiendo_kilometraje →
// pidiendo_tarea → pidiendo_cliente → (verificando_cliente → decidiendo_cliente_nuevo?)
// → confirmando → pidiendo_fotos → [vehículo creado]

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

// ─── Helpers de parsing ────────────────────────────────────────────────────
function esCancelar(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ["cancelar", "cancel", "/cancelar", "salir", "parar"].includes(t);
}

function esSinDatos(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ["sin datos", "no se", "no sé", "nose", "no tengo", "-", "n/a", "na", "no"].includes(t);
}

function parsearKilometraje(texto: string): { valor: string; ok: boolean } {
  const soloDigitos = texto.replace(/\D/g, "");
  if (soloDigitos.length === 0) return { valor: "", ok: false };
  const num = parseInt(soloDigitos, 10);
  if (isNaN(num) || num < 0 || num > 9999999) return { valor: "", ok: false };
  return { valor: String(num), ok: true };
}

function limpiarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, " ");
}

// ─── Normalizar patente argentina: siempre con guiones ────────────────────
// Mercosur:  AA123AA → AA-123-AA
// Antigua:   AAA123  → AAA-123
// Cualquier input (con espacios, guiones, minúsculas) se normaliza al formato canónico.
function normalizarPatente(texto: string): { valor: string; ok: boolean } {
  const limpio = texto.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(limpio)) {
    return { valor: `${limpio.slice(0, 2)}-${limpio.slice(2, 5)}-${limpio.slice(5, 7)}`, ok: true };
  }
  if (/^[A-Z]{3}\d{3}$/.test(limpio)) {
    return { valor: `${limpio.slice(0, 3)}-${limpio.slice(3, 6)}`, ok: true };
  }
  return { valor: limpio, ok: false };
}

// ─── Extraer texto o id de botón de un mensaje ────────────────────────────
function extraerTexto(msg: WhatsAppMessage): string {
  if (msg.type === "text") return (msg.text?.body ?? "").trim();
  if (msg.type === "image") return (msg.image?.caption ?? "").trim();
  if (msg.type === "interactive") {
    const btnId = msg.interactive?.button_reply?.id ?? "";
    const btnTitle = msg.interactive?.button_reply?.title ?? "";
    const listId = msg.interactive?.list_reply?.id ?? "";
    const listTitle = msg.interactive?.list_reply?.title ?? "";
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

  if (!["text", "image", "interactive"].includes(msg.type)) {
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

  // Guardar historial inicial (idempotente por messageId)
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
    return;
  }

  // Si llega una foto al inicio, la guardamos para adjuntarla después
  const fotoIds: string[] = [];
  if (msg.type === "image" && msg.image?.id) {
    try {
      const storageId = await descargarYGuardarFoto(ctx, msg.image.id, accessToken);
      fotoIds.push(storageId);
    } catch (err) {
      console.error(`[WhatsApp] Error al guardar foto inicial:`, err);
    }
  }

  const datos: DatosConversacion = {
    marca_modelo: "",
    kilometraje: "",
    patente: "",
    tarea: "",
    cliente: "",
    rawMessage: textoOriginal,
    fotoIds,
  };

  await ctx.runMutation(internal.conversaciones.guardar, {
    phone: from,
    etapa: "pidiendo_marca_modelo",
    datos,
    historialId,
  });

  const saludoFoto = fotoIds.length > 0 ? "📸 Foto recibida.\n\n" : "";
  await enviarMensaje(
    from,
    `${saludoFoto}🔧 *¡Hola! Vamos a registrar un vehículo.*\n\n` +
    `🚗 ¿Cuál es la *marca y modelo* del vehículo?\n` +
    `_(ej: Ford Ranger, Chevrolet Aveo)_\n\n` +
    `Podés escribir *cancelar* en cualquier momento para salir.`,
    phoneNumberId,
    accessToken
  );
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

  // ── Cancelación global vía texto ───────────────────────────────────────
  if (msg.type === "text" && esCancelar(texto)) {
    await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
    await enviarMensaje(
      from,
      `❌ Registro cancelado. Podés volver a enviar un mensaje cuando quieras empezar de nuevo.`,
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── ETAPA: pidiendo_marca_modelo ───────────────────────────────────────
  if (etapa === "pidiendo_marca_modelo") {
    if (msg.type === "interactive" || !texto) {
      await enviarMensaje(
        from,
        `🚗 Escribí la *marca y modelo* del vehículo (ej: Ford Ranger).`,
        phoneNumberId,
        accessToken
      );
      return;
    }
    const valor = limpiarTexto(texto);
    if (valor.length < 2) {
      await enviarMensaje(
        from,
        `⚠️ La marca y modelo es muy corta. Escribí algo como *Ford Ranger* o *Chevrolet Aveo*.`,
        phoneNumberId,
        accessToken
      );
      return;
    }
    await ctx.runMutation(internal.conversaciones.actualizar, {
      phone: from,
      etapa: "pidiendo_patente",
      datos: { ...datos, marca_modelo: valor },
    });
    await enviarMensaje(
      from,
      `✅ Marca y modelo: *${valor}*\n\n🔖 ¿Cuál es la *patente*?\n_(ej: NMO162, AB123CD)_`,
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── ETAPA: pidiendo_patente ────────────────────────────────────────────
  if (etapa === "pidiendo_patente") {
    if (msg.type === "interactive" || !texto) {
      await enviarMensaje(
        from,
        `🔖 Escribí la *patente* del vehículo.\n_(ej: AAA-123 o AB-123-CD)_`,
        phoneNumberId,
        accessToken
      );
      return;
    }
    const patente = normalizarPatente(texto);
    if (!patente.ok) {
      await enviarMensaje(
        from,
        `⚠️ La patente no parece válida. Escribila en formato argentino:\n` +
        `• Antigua: *AAA123* (3 letras + 3 números)\n` +
        `• Mercosur: *AB123CD* (2 letras + 3 números + 2 letras)\n\n` +
        `No importa si la escribís con espacios, guiones o minúsculas.`,
        phoneNumberId,
        accessToken
      );
      return;
    }
    await ctx.runMutation(internal.conversaciones.actualizar, {
      phone: from,
      etapa: "pidiendo_kilometraje",
      datos: { ...datos, patente: patente.valor },
    });
    await enviarMensajeConBotones(
      from,
      `✅ Patente: *${patente.valor}*\n\n📊 ¿Cuál es el *kilometraje* actual?\n_(solo el número, ej: 150000)_`,
      [{ id: "btn_sin_km", titulo: "📋 Sin kilometraje" }],
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── ETAPA: pidiendo_kilometraje ────────────────────────────────────────
  if (etapa === "pidiendo_kilometraje") {
    // Botón "sin kilometraje" o texto equivalente
    if (texto === "btn_sin_km" || (msg.type === "text" && esSinDatos(texto))) {
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "pidiendo_tarea",
        datos: { ...datos, kilometraje: "" },
      });
      await enviarMensaje(
        from,
        `✅ Kilometraje: _sin datos_\n\n🔧 ¿Qué *trabajo* se va a realizar en el vehículo?\n_(ej: cambio de aceite, reparación de frenos)_`,
        phoneNumberId,
        accessToken
      );
      return;
    }
    if (msg.type === "interactive" || !texto) {
      await enviarMensajeConBotones(
        from,
        `📊 Escribí el *kilometraje* en números o tocá el botón.`,
        [{ id: "btn_sin_km", titulo: "📋 Sin kilometraje" }],
        phoneNumberId,
        accessToken
      );
      return;
    }
    const km = parsearKilometraje(texto);
    if (!km.ok) {
      await enviarMensajeConBotones(
        from,
        `⚠️ No entendí el kilometraje. Escribí solo el número (ej: *150000*) o tocá "Sin kilometraje".`,
        [{ id: "btn_sin_km", titulo: "📋 Sin kilometraje" }],
        phoneNumberId,
        accessToken
      );
      return;
    }
    await ctx.runMutation(internal.conversaciones.actualizar, {
      phone: from,
      etapa: "pidiendo_tarea",
      datos: { ...datos, kilometraje: km.valor },
    });
    await enviarMensaje(
      from,
      `✅ Kilometraje: *${km.valor} km*\n\n🔧 ¿Qué *trabajo* se va a realizar en el vehículo?\n_(ej: cambio de aceite, reparación de frenos)_`,
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── ETAPA: pidiendo_tarea ──────────────────────────────────────────────
  if (etapa === "pidiendo_tarea") {
    if (msg.type === "interactive" || !texto) {
      await enviarMensaje(from, `🔧 Escribí el *trabajo a realizar*.`, phoneNumberId, accessToken);
      return;
    }
    const valor = limpiarTexto(texto);
    if (valor.length < 2) {
      await enviarMensaje(
        from,
        `⚠️ La descripción del trabajo es muy corta. Describí qué hay que hacer.`,
        phoneNumberId,
        accessToken
      );
      return;
    }
    await ctx.runMutation(internal.conversaciones.actualizar, {
      phone: from,
      etapa: "pidiendo_cliente",
      datos: { ...datos, tarea: valor },
    });
    await enviarMensaje(
      from,
      `✅ Trabajo: *${valor}*\n\n👤 ¿Cuál es el *nombre del cliente*?\n_(ej: Marcelo Rondoletto)_`,
      phoneNumberId,
      accessToken
    );
    return;
  }

  // ── ETAPA: pidiendo_cliente ────────────────────────────────────────────
  if (etapa === "pidiendo_cliente") {
    if (msg.type === "interactive" || !texto) {
      await enviarMensaje(from, `👤 Escribí el *nombre del cliente*.`, phoneNumberId, accessToken);
      return;
    }
    const nombreCliente = limpiarTexto(texto);
    if (nombreCliente.length < 2) {
      await enviarMensaje(
        from,
        `⚠️ El nombre es muy corto. Escribí el nombre completo del cliente.`,
        phoneNumberId,
        accessToken
      );
      return;
    }

    const nuevosDatos = { ...datos, cliente: nombreCliente };

    // Buscar cliente candidato por nombre
    const candidato = await ctx.runQuery(
      internal.conversaciones.buscarClientePorNombre,
      { nombre: nombreCliente }
    ) as { _id: string; name: string; phone: string } | null;

    if (candidato) {
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "verificando_cliente",
        datos: nuevosDatos,
        candidatoClienteId: candidato._id as any,
        candidatoClienteNombre: candidato.name,
      });
      await enviarMensajeConBotones(
        from,
        `🔎 Encontré este cliente en la base:\n👤 *${candidato.name}*\n📞 ${candidato.phone}\n\n¿Es este el cliente?`,
        [
          { id: "btn_si", titulo: "✅ Sí, es él" },
          { id: "btn_no", titulo: "❌ No, es otro" },
        ],
        phoneNumberId,
        accessToken
      );
    } else {
      // No hay candidato → crear nuevo, ir a confirmación
      const conNuevo = { ...nuevosDatos, clienteEsNuevo: true };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "confirmando",
        datos: conNuevo,
      });
      await enviarResumenConfirmacion(from, conNuevo, undefined, phoneNumberId, accessToken);
    }
    return;
  }

  // ── ETAPA: verificando_cliente ─────────────────────────────────────────
  if (etapa === "verificando_cliente") {
    if (texto === "btn_si") {
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
    } else if (texto === "btn_no") {
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "decidiendo_cliente_nuevo",
        datos,
      });
      await enviarMensajeConBotones(
        from,
        `Entendido. ¿Qué querés hacer?\n\n` +
        `• *Cambiar nombre*: lo buscamos con otro nombre.\n` +
        `• *Crear nuevo*: registramos un cliente nuevo con el nombre *${datos.cliente}*.`,
        [
          { id: "btn_cambiar_nombre", titulo: "✍️ Otro nombre" },
          { id: "btn_crear_nuevo", titulo: "➕ Crear nuevo" },
        ],
        phoneNumberId,
        accessToken
      );
    } else {
      await enviarMensajeConBotones(
        from,
        `Por favor tocá un botón para confirmar si el cliente es *${conv.candidatoClienteNombre}*.`,
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

  // ── ETAPA: decidiendo_cliente_nuevo ────────────────────────────────────
  if (etapa === "decidiendo_cliente_nuevo") {
    if (texto === "btn_cambiar_nombre") {
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "pidiendo_cliente",
        datos: { ...datos, cliente: "", clienteEsNuevo: undefined, customerId: undefined },
      });
      await enviarMensaje(
        from,
        `👤 ¿Cuál es el *nombre correcto* del cliente?`,
        phoneNumberId,
        accessToken
      );
    } else if (texto === "btn_crear_nuevo") {
      const nuevosDatos = { ...datos, clienteEsNuevo: true, customerId: undefined };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "confirmando",
        datos: nuevosDatos,
      });
      await enviarResumenConfirmacion(from, nuevosDatos, undefined, phoneNumberId, accessToken);
    } else {
      await enviarMensajeConBotones(
        from,
        `Por favor elegí una opción:`,
        [
          { id: "btn_cambiar_nombre", titulo: "✍️ Otro nombre" },
          { id: "btn_crear_nuevo", titulo: "➕ Crear nuevo" },
        ],
        phoneNumberId,
        accessToken
      );
    }
    return;
  }

  // ── ETAPA: confirmando ─────────────────────────────────────────────────
  if (etapa === "confirmando") {
    if (texto === "btn_confirmar") {
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "pidiendo_fotos",
        datos,
      });
      const tieneFotos = (datos.fotoIds ?? []).length > 0;
      await enviarMensajeConBotones(
        from,
        tieneFotos
          ? `📸 Ya tenés ${datos.fotoIds!.length} foto adjunta. Podés enviar más o finalizar.`
          : `📸 ¿Querés agregar fotos del vehículo?\nEnviá las imágenes o tocá "Sin fotos" para omitir.`,
        [
          { id: "btn_sin_fotos", titulo: tieneFotos ? "✅ Registrar vehículo" : "📋 Sin fotos" },
        ],
        phoneNumberId,
        accessToken
      );
    } else if (texto === "btn_cancelar") {
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
      await enviarMensaje(
        from,
        `❌ Registro cancelado. Podés volver a empezar cuando quieras.`,
        phoneNumberId,
        accessToken
      );
    } else {
      await enviarResumenConfirmacion(
        from, datos,
        datos.clienteEsNuevo ? undefined : conv.candidatoClienteNombre,
        phoneNumberId, accessToken
      );
    }
    return;
  }

  // ── ETAPA: pidiendo_fotos ──────────────────────────────────────────────
  if (etapa === "pidiendo_fotos") {
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
          [{ id: "btn_listo", titulo: "✅ Registrar" }],
          phoneNumberId,
          accessToken
        );
      } catch (err) {
        console.error("[WhatsApp] Error al guardar foto:", err);
        await enviarMensaje(from, `⚠️ No pude guardar la foto, intentá de nuevo.`, phoneNumberId, accessToken);
      }
      return;
    }

    const proceder = texto === "btn_sin_fotos" || texto === "btn_listo";

    if (proceder) {
      await crearVehiculoYFinalizar(ctx, conv, datos, from, phoneNumberId, accessToken);
      return;
    }

    await enviarMensajeConBotones(
      from,
      `Enviá fotos del vehículo o tocá el botón para registrar.`,
      [{ id: "btn_sin_fotos", titulo: "✅ Sin fotos" }],
      phoneNumberId,
      accessToken
    );
    return;
  }

  // Etapa desconocida — limpiar para no bloquear al usuario
  await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
  await enviarMensaje(
    from,
    `⚠️ Hubo un problema con el flujo. Enviá un mensaje para empezar de nuevo.`,
    phoneNumberId,
    accessToken
  );
}

// ─── Crear el vehículo y cerrar el flujo ──────────────────────────────────
async function crearVehiculoYFinalizar(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  conv: { historialId?: string; [key: string]: unknown },
  datos: DatosConversacion,
  from: string,
  phoneNumberId: string,
  accessToken: string
) {
  try {
    // Si es cliente nuevo y aún no tenemos customerId → crearlo
    let customerId = datos.customerId;
    if (!customerId && datos.clienteEsNuevo && datos.cliente) {
      customerId = await ctx.runMutation(
        internal.conversaciones.crearClienteNuevo,
        { name: datos.cliente }
      ) as string;
    }

    const [marcaParte, ...modeloPartes] = (datos.marca_modelo ?? "").split(" ");
    const marca = marcaParte || "Desconocida";
    const modelo = modeloPartes.join(" ") || "Desconocido";
    const fotoIds = datos.fotoIds ?? [];

    const vehicleId = await ctx.runMutation(
      internal.vehicles.crearVehiculo,
      {
        plate: datos.patente ?? "",
        brand: marca,
        model: modelo,
        year: new Date().getFullYear(),
        owner: datos.cliente || "Sin nombre",
        phone: from,
        customerId: customerId as any,
        status: "Ingresado",
        entryDate: new Date().toISOString().split("T")[0],
        services: datos.tarea ? [datos.tarea] : [],
        cost: 0,
        mileage: datos.kilometraje
          ? parseInt(datos.kilometraje, 10) || undefined
          : undefined,
      }
    );

    // Actualizar historial con los datos finales y vincular
    if (conv.historialId) {
      await ctx.runMutation(internal.historialTaller.actualizar, {
        id: conv.historialId as any,
        marca_modelo: datos.marca_modelo,
        kilometraje: datos.kilometraje,
        patente: datos.patente,
        tarea: datos.tarea,
        cliente: datos.cliente,
        fotoIds: fotoIds as any,
        status: "processed",
      });
      await ctx.runMutation(internal.historialTaller.vincular, {
        id: conv.historialId as any,
        vehicleId: vehicleId as any,
        customerId: customerId as any,
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
