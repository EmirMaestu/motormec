import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Tipos de la API de WhatsApp ───────────────────────────────────────────
interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video";
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
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
  ano?: string;
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

// ─── Enviar mensaje de texto por WhatsApp ─────────────────────────────────
async function enviarMensaje(
  to: string,
  texto: string,
  phoneNumberId: string,
  accessToken: string
) {
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
          to,
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

// ─── Detectar respuesta afirmativa/negativa ────────────────────────────────
function esAfirmativo(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ["sí", "si", "s", "yes", "y", "claro", "ok", "dale", "confirmar", "confirmo", "correcto"].some((w) => t === w || t.startsWith(w + " "));
}

function esNegativo(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  return ["no", "n", "nop", "nope", "cancelar", "cancel"].some((w) => t === w || t.startsWith(w + " "));
}

// ─── Procesar un mensaje individual ───────────────────────────────────────
async function procesarMensaje(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  msg: WhatsAppMessage,
  phoneNumberId: string
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  const from = msg.from;

  // Ignorar mensajes que no sean texto ni imagen
  if (msg.type !== "text" && msg.type !== "image") {
    console.log(`[WhatsApp] Tipo ${msg.type} ignorado`);
    return;
  }

  const textoOriginal =
    msg.type === "text"
      ? (msg.text?.body ?? "").trim()
      : (msg.image?.caption ?? "").trim();

  // ── Verificar si hay una conversación activa ───────────────────────────
  const convActiva = await ctx.runQuery(
    internal.conversaciones.obtenerPorTelefono,
    { phone: from }
  );

  if (convActiva) {
    // Conversación en curso — verificar si no es muy antigua (>30 min)
    const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    if (convActiva.updatedAt < hace30min) {
      // Conversación expirada — limpiar y procesar como nueva
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
    } else {
      await manejarRespuesta(ctx, convActiva, textoOriginal, from, phoneNumberId, accessToken);
      return;
    }
  }

  // ── Nueva conversación ─────────────────────────────────────────────────
  if (!textoOriginal && msg.type !== "image") {
    return;
  }

  // Guardar registro inicial
  const historialId = await ctx.runMutation(internal.historialTaller.guardar, {
    whatsappMessageId: msg.id,
    whatsappFrom: from,
    whatsappTimestamp: msg.timestamp,
    rawMessage: textoOriginal,
    fotoIds: [],
    status: "pending",
    createdAt: new Date().toISOString(),
  });

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
    // Error de IA — actualizar historial y avisar
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

  // Datos base para la conversación
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

  // 1. Buscar por el teléfono del remitente
  const clientePorTel = await ctx.runQuery(
    internal.conversaciones.buscarClientePorTelefono,
    { phone: from }
  ) as { _id: string; name: string; phone: string } | null;

  if (clientePorTel) {
    clienteEncontrado = clientePorTel;
  } else if (datosVehiculo.cliente) {
    // 2. Buscar por nombre extraído
    const clientePorNombre = await ctx.runQuery(
      internal.conversaciones.buscarClientePorNombre,
      { nombre: datosVehiculo.cliente }
    ) as { _id: string; name: string; phone: string } | null;

    if (clientePorNombre) {
      clienteEncontrado = clientePorNombre;
    }
  }

  if (clienteEncontrado) {
    // Encontramos un candidato — preguntar confirmación
    await ctx.runMutation(internal.conversaciones.guardar, {
      phone: from,
      etapa: "verificando_cliente",
      datos,
      candidatoClienteId: clienteEncontrado._id as any,
      candidatoClienteNombre: clienteEncontrado.name,
      historialId,
    });

    const patente = datosVehiculo.patente || "sin patente";
    const trabajo = datosVehiculo.tarea || "sin especificar";
    await enviarMensaje(
      from,
      `✅ Recibí el ingreso:\n*${datosVehiculo.marca_modelo}* — ${patente}\n🔧 ${trabajo}\n\n` +
      `Encontré este cliente en la base:\n👤 *${clienteEncontrado.name}*\n📞 ${clienteEncontrado.phone}\n\n` +
      `¿Es este el cliente? Respondé *sí* o *no*`,
      phoneNumberId,
      accessToken
    );
  } else {
    // No hay cliente previo — pedir año directamente
    await ctx.runMutation(internal.conversaciones.guardar, {
      phone: from,
      etapa: "pidiendo_ano",
      datos: { ...datos, clienteEsNuevo: true },
      historialId,
    });

    const patente = datosVehiculo.patente || "sin patente";
    const trabajo = datosVehiculo.tarea || "sin especificar";
    const clienteNombre = datosVehiculo.cliente || "desconocido";
    await enviarMensaje(
      from,
      `✅ Recibí el ingreso:\n*${datosVehiculo.marca_modelo}* — ${patente}\n🔧 ${trabajo}\n👤 ${clienteNombre} _(nuevo cliente)_\n\n` +
      `¿Cuál es el *año* del vehículo?`,
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
  texto: string,
  from: string,
  phoneNumberId: string,
  accessToken: string
) {
  const etapa = conv.etapa;
  const datos = conv.datos as DatosConversacion;

  // ── ETAPA: verificando_cliente ─────────────────────────────────────────
  if (etapa === "verificando_cliente") {
    if (esAfirmativo(texto)) {
      // Cliente confirmado
      const nuevosDatos = {
        ...datos,
        customerId: conv.candidatoClienteId as string,
        clienteEsNuevo: false,
      };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "pidiendo_ano",
        datos: nuevosDatos,
      });
      await enviarMensaje(
        from,
        `👍 Perfecto. ¿Cuál es el *año* del ${datos.marca_modelo}?`,
        phoneNumberId,
        accessToken
      );
    } else if (esNegativo(texto)) {
      // Cliente no es el correcto — continuar como nuevo
      const nuevosDatos = { ...datos, clienteEsNuevo: true };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "pidiendo_ano",
        datos: nuevosDatos,
      });
      await enviarMensaje(
        from,
        `Entendido. El cliente *${datos.cliente}* se registrará como nuevo.\n\n¿Cuál es el *año* del ${datos.marca_modelo}?`,
        phoneNumberId,
        accessToken
      );
    } else {
      await enviarMensaje(
        from,
        `Por favor respondé *sí* o *no* para confirmar si el cliente es *${conv.candidatoClienteNombre}*.`,
        phoneNumberId,
        accessToken
      );
    }
    return;
  }

  // ── ETAPA: pidiendo_ano ────────────────────────────────────────────────
  if (etapa === "pidiendo_ano") {
    const anoMatch = texto.match(/\b(19|20)\d{2}\b/);
    if (anoMatch) {
      const ano = anoMatch[0];
      const nuevosDatos = { ...datos, ano };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "confirmando",
        datos: nuevosDatos,
      });

      // Mostrar resumen para confirmación final
      const marcaModelo = datos.marca_modelo || "desconocido";
      const patente = datos.patente || "sin patente";
      const km = datos.kilometraje ? `${datos.kilometraje} km` : "sin datos";
      const tarea = datos.tarea || "sin especificar";
      const cliente = datos.clienteEsNuevo
        ? `${datos.cliente} _(nuevo)_`
        : `${conv.candidatoClienteNombre ?? datos.cliente} ✓`;

      await enviarMensaje(
        from,
        `📋 *Resumen del ingreso:*\n\n` +
        `🚗 *Vehículo:* ${marcaModelo} ${ano}\n` +
        `🔖 *Patente:* ${patente}\n` +
        `📊 *Kilometraje:* ${km}\n` +
        `🔧 *Trabajo:* ${tarea}\n` +
        `👤 *Cliente:* ${cliente}\n\n` +
        `¿Confirmar y registrar el vehículo? Respondé *sí* o *no*`,
        phoneNumberId,
        accessToken
      );
    } else {
      await enviarMensaje(
        from,
        `No reconocí un año válido. Por favor enviá el año del vehículo (ej: *2018*).`,
        phoneNumberId,
        accessToken
      );
    }
    return;
  }

  // ── ETAPA: confirmando ─────────────────────────────────────────────────
  if (etapa === "confirmando") {
    if (esAfirmativo(texto)) {
      // Crear el vehículo en la base de datos
      try {
        const [marcaParte, ...modeloPartes] = (datos.marca_modelo ?? "").split(" ");
        const marca = marcaParte || "Desconocida";
        const modelo = modeloPartes.join(" ") || "Desconocido";
        const ano = parseInt(datos.ano ?? "0") || new Date().getFullYear();

        const vehicleId = await ctx.runMutation(
          internal.vehicles.crearVehiculo,
          {
            plate: (datos.patente ?? "").toUpperCase(),
            brand: marca,
            model: modelo,
            year: ano,
            owner: datos.cliente || "Sin nombre",
            phone: from,
            customerId: datos.customerId as any,
            status: "Ingresado",
            entryDate: new Date().toISOString().split("T")[0],
            services: datos.tarea ? [datos.tarea] : [],
            cost: 0,
            mileage: datos.kilometraje ? parseInt(datos.kilometraje.replace(/\D/g, "")) || undefined : undefined,
          }
        );

        // Actualizar el historial con el vehicleId y status linked
        if (conv.historialId) {
          await ctx.runMutation(internal.historialTaller.vincular, {
            id: conv.historialId as any,
            vehicleId: vehicleId as any,
            customerId: datos.customerId as any,
          });
        }

        // Limpiar conversación
        await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });

        await enviarMensaje(
          from,
          `✅ *¡Vehículo registrado!*\n\n${datos.marca_modelo} ${datos.ano} — ${datos.patente}\nYa aparece en el sistema como *Ingresado*. 🔧`,
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
    } else if (esNegativo(texto)) {
      // Cancelar
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
      await enviarMensaje(
        from,
        `❌ Registro cancelado. Podés volver a enviar la información cuando quieras.`,
        phoneNumberId,
        accessToken
      );
    } else {
      const marcaModelo = datos.marca_modelo || "desconocido";
      const ano = datos.ano || "?";
      await enviarMensaje(
        from,
        `Respondé *sí* para confirmar el registro del *${marcaModelo} ${ano}*, o *no* para cancelar.`,
        phoneNumberId,
        accessToken
      );
    }
    return;
  }

  // Etapa desconocida — limpiar
  await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
}

// ─── Llamar a la IA del VPS (Ollama) ──────────────────────────────────────
async function procesarConIA(texto: string): Promise<DatosVehiculo> {
  const vpsUrl = process.env.VPS_URL;
  const vpsApiKey = process.env.VPS_API_KEY;
  const modelo = process.env.VPS_MODEL ?? "llama3";

  if (!vpsUrl) {
    throw new Error("VPS_URL no configurada en las variables de entorno de Convex");
  }

  const systemPrompt = `Eres un extractor de datos para un taller mecánico.
El usuario te enviará un mensaje informal con información de un vehículo.
DEBES responder ÚNICAMENTE con un JSON válido, sin texto extra, sin markdown, sin explicaciones.
El JSON debe tener exactamente estos campos:
{
  "marca_modelo": "string — marca y modelo del vehículo",
  "kilometraje": "string — kilometraje numérico o vacío si no se indica",
  "patente": "string — patente/matrícula del vehículo",
  "tarea": "string — trabajo o servicio a realizar",
  "cliente": "string — nombre del cliente o vacío si no se indica"
}
Si un campo no está claro, usa cadena vacía "". NO inventes datos.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${vpsUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(vpsApiKey ? { "X-API-Key": vpsApiKey } : {}),
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: texto },
        ],
        temperature: 0.1,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`VPS respondió con status ${response.status}`);
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
