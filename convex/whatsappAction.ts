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
  patente: string;          // patente normalizada (sin espacios ni guiones)
  tarea: string;
  cliente: string;
  customerId?: string;
  clienteEsNuevo?: boolean;
  vehiculoExistente?: boolean;   // true = ya existe en el sistema, crear nueva entrada
  rawMessage?: string;
  fotoIds?: string[];
}

// ─── Handler principal ─────────────────────────────────────────────────────
export const handleWhatsApp = httpAction(async (ctx, request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

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

// ─── Normalizar patente — quita espacios y guiones, mayúsculas ─────────────
// LLD 274 → LLD274 | AA-202-JP → AA202JP | aa 202 jp → AA202JP
function normalizarPatente(patente: string): string {
  return patente.replace(/[\s\-]/g, "").toUpperCase();
}

// ─── Normalizar número argentino para envío ────────────────────────────────
function normalizarNumeroEnvio(phone: string): string {
  if (!phone.startsWith("549")) return phone;
  const sinPais9 = phone.slice(3);
  const localDigits = sinPais9.startsWith("11") ? 8 : 7;
  const area = sinPais9.slice(0, sinPais9.length - localDigits);
  const local = sinPais9.slice(sinPais9.length - localDigits);
  return "54" + area + "15" + local;
}

// ─── Enviar mensaje de texto ───────────────────────────────────────────────
async function enviarMensaje(
  to: string,
  texto: string,
  phoneNumberId: string,
  accessToken: string
) {
  const toNorm = normalizarNumeroEnvio(to);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNorm,
          type: "text",
          text: { body: texto },
        }),
      }
    );
    if (!res.ok) console.error(`[WA] Error texto: ${res.status}`, await res.text());
  } catch (err) {
    console.error("[WA] Error enviarMensaje:", err);
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
  const toNorm = normalizarNumeroEnvio(to);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNorm,
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
      console.error(`[WA] Error botones: ${res.status}`, await res.text());
      // Fallback a texto
      await enviarMensaje(
        to,
        texto + "\n\n" + botones.map((b) => `▸ ${b.titulo}`).join("\n"),
        phoneNumberId,
        accessToken
      );
    }
  } catch (err) {
    console.error("[WA] Error enviarMensajeConBotones:", err);
  }
}

// ─── Detectores de respuesta ───────────────────────────────────────────────
function esAfirmativo(t: string): boolean {
  const s = t.trim().toLowerCase();
  return ["sí","si","s","yes","y","claro","ok","dale","confirmar","confirmo","correcto"].some(
    (w) => s === w || s.startsWith(w + " ")
  );
}
function esNegativo(t: string): boolean {
  const s = t.trim().toLowerCase();
  return ["no","n","nop","nope","cancelar","cancel"].some(
    (w) => s === w || s.startsWith(w + " ")
  );
}
function esListo(t: string): boolean {
  const s = t.trim().toLowerCase();
  return ["listo","ya","fin","terminar","terminé","termine","guardar","no mas","no más","ya está","ya esta"].some(
    (w) => s === w || s.startsWith(w + " ")
  );
}

// ─── Extraer texto del mensaje (texto o botón interactivo) ─────────────────
function extraerTexto(msg: WhatsAppMessage): string {
  if (msg.type === "text") return (msg.text?.body ?? "").trim();
  if (msg.type === "image") return (msg.image?.caption ?? "").trim();
  if (msg.type === "interactive") {
    return (
      msg.interactive?.button_reply?.id ||
      msg.interactive?.list_reply?.id ||
      msg.interactive?.button_reply?.title ||
      msg.interactive?.list_reply?.title ||
      ""
    );
  }
  return "";
}

// ─── Procesar mensaje entrante ─────────────────────────────────────────────
async function procesarMensaje(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  msg: WhatsAppMessage,
  phoneNumberId: string
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  const from = msg.from;

  if (!["text", "image", "interactive"].includes(msg.type)) return;

  const textoOriginal = extraerTexto(msg);

  // ── Conversación activa ────────────────────────────────────────────────
  const convActiva = await ctx.runQuery(internal.conversaciones.obtenerPorTelefono, { phone: from });
  if (convActiva) {
    const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    if (convActiva.updatedAt < hace30min) {
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
    } else {
      await manejarRespuesta(ctx, convActiva, msg, textoOriginal, from, phoneNumberId, accessToken);
      return;
    }
  }

  // ── Verificar autorización ─────────────────────────────────────────────
  const autorizado = await ctx.runQuery(internal.numerosAutorizados.verificar, { phone: from });
  if (!autorizado) {
    await enviarMensaje(from, "⛔ Este número no está autorizado para usar el bot. Contactá al taller.", phoneNumberId, accessToken);
    return;
  }

  // ── Nueva conversación ─────────────────────────────────────────────────
  if (!textoOriginal && msg.type !== "image") return;

  const historialId = await ctx.runMutation(internal.historialTaller.guardar, {
    whatsappMessageId: msg.id,
    whatsappFrom: from,
    whatsappTimestamp: msg.timestamp,
    rawMessage: textoOriginal,
    fotoIds: [],
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  if (historialId === null) return; // duplicado

  // Procesar foto si hay
  const fotoIds: string[] = [];
  if (msg.type === "image" && msg.image?.id) {
    try {
      const storageId = await descargarYGuardarFoto(ctx, msg.image.id, accessToken);
      fotoIds.push(storageId);
    } catch (err) {
      console.error(`[WA] Error foto:`, err);
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
    }
  }

  if (!datosVehiculo) {
    await ctx.runMutation(internal.historialTaller.actualizar, {
      id: historialId,
      fotoIds: fotoIds as any,
      status: "error",
      errorMessage: errorMsg ?? "No se pudo procesar el mensaje",
    });
    await enviarMensaje(from, "❌ No pude procesar tu mensaje. Enviá: marca, modelo, patente, kilometraje y trabajo.", phoneNumberId, accessToken);
    return;
  }

  // Normalizar patente
  const patenteNorm = normalizarPatente(datosVehiculo.patente);

  await ctx.runMutation(internal.historialTaller.actualizar, {
    id: historialId,
    marca_modelo: datosVehiculo.marca_modelo,
    kilometraje: datosVehiculo.kilometraje,
    patente: patenteNorm,
    tarea: datosVehiculo.tarea,
    cliente: datosVehiculo.cliente,
    fotoIds: fotoIds as any,
    status: "processed",
  });

  const datos: DatosConversacion = {
    marca_modelo: datosVehiculo.marca_modelo,
    kilometraje: datosVehiculo.kilometraje,
    patente: patenteNorm,
    tarea: datosVehiculo.tarea,
    cliente: datosVehiculo.cliente,
    rawMessage: textoOriginal,
    fotoIds,
  };

  const km = datosVehiculo.kilometraje ? `${datosVehiculo.kilometraje} km` : null;

  // ── Buscar si la patente ya existe en el sistema ───────────────────────
  if (patenteNorm) {
    const vehiculoExistente = await ctx.runQuery(
      internal.vehicles.buscarPorPatente,
      { plate: patenteNorm }
    ) as { plate: string; brand: string; model: string; owner: string; phone: string; customerId?: string; visitCount: number } | null;

    if (vehiculoExistente) {
      // Vehículo conocido — preguntar si es el mismo
      await ctx.runMutation(internal.conversaciones.guardar, {
        phone: from,
        etapa: "verificando_vehiculo",
        datos: { ...datos, vehiculoExistente: false }, // se actualiza al confirmar
        historialId,
      });

      await enviarMensajeConBotones(
        from,
        `🔍 Encontré este vehículo en el sistema:\n` +
        `🚗 *${vehiculoExistente.brand} ${vehiculoExistente.model}*\n` +
        `🔖 Patente: *${vehiculoExistente.plate}*\n` +
        `👤 Cliente: *${vehiculoExistente.owner}*\n` +
        `📋 Visitas anteriores: ${vehiculoExistente.visitCount}\n\n` +
        `¿Es este el vehículo?`,
        [
          { id: "btn_vehiculo_si", titulo: "✅ Sí, ese es" },
          { id: "btn_vehiculo_no", titulo: "❌ No, es otro" },
        ],
        phoneNumberId,
        accessToken
      );
      return;
    }
  }

  // ── Patente nueva — buscar cliente ─────────────────────────────────────
  let clienteEncontrado: { _id: string; name: string; phone: string } | null = null;
  if (datosVehiculo.cliente) {
    clienteEncontrado = await ctx.runQuery(
      internal.conversaciones.buscarClientePorNombre,
      { nombre: datosVehiculo.cliente }
    ) as { _id: string; name: string; phone: string } | null;
  }

  if (clienteEncontrado) {
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
      `✅ Recibí el ingreso:\n*${datosVehiculo.marca_modelo}* — ${patenteNorm}` +
      (km ? `\n📊 ${km}` : "") +
      `\n🔧 ${datosVehiculo.tarea || "sin especificar"}\n\n` +
      `Encontré este cliente:\n👤 *${clienteEncontrado.name}*\n📞 ${clienteEncontrado.phone}\n\n¿Es este el cliente?`,
      [
        { id: "btn_si", titulo: "✅ Sí, es él" },
        { id: "btn_no", titulo: "❌ No, es otro" },
      ],
      phoneNumberId,
      accessToken
    );
  } else {
    // Vehículo y cliente nuevos — ir directo a confirmar
    await ctx.runMutation(internal.conversaciones.guardar, {
      phone: from,
      etapa: "confirmando",
      datos: { ...datos, clienteEsNuevo: true },
      historialId,
    });

    await enviarResumenConfirmacion(from, { ...datos, clienteEsNuevo: true }, undefined, false, phoneNumberId, accessToken);
  }
}

// ─── Manejar respuestas en conversación activa ────────────────────────────
async function manejarRespuesta(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  conv: {
    _id: string; phone: string; etapa: string; datos: DatosConversacion;
    candidatoClienteId?: string; candidatoClienteNombre?: string;
    historialId?: string; [key: string]: unknown;
  },
  msg: WhatsAppMessage,
  texto: string,
  from: string,
  phoneNumberId: string,
  accessToken: string
) {
  const etapa = conv.etapa;
  const datos = conv.datos as DatosConversacion;

  const esBtnSi = ["btn_si", "btn_confirmar", "btn_vehiculo_si"].includes(texto);
  const esBtnNo = ["btn_no", "btn_cancelar", "btn_vehiculo_no", "btn_sin_fotos", "btn_listo"].includes(texto);
  const afirmativo = esBtnSi || esAfirmativo(texto);
  const negativo = !esBtnSi && (esBtnNo || esNegativo(texto));

  // Cancelación global (excepto en etapas donde "no" tiene otro significado)
  const etapasSinCancelacion = ["verificando_cliente", "verificando_vehiculo", "pidiendo_fotos"];
  if (negativo && !etapasSinCancelacion.includes(etapa)) {
    await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
    await enviarMensaje(from, `❌ Registro cancelado. Podés volver a enviar la información cuando quieras.`, phoneNumberId, accessToken);
    return;
  }

  // ── ETAPA: verificando_vehiculo ────────────────────────────────────────
  if (etapa === "verificando_vehiculo") {
    if (texto === "btn_vehiculo_si" || afirmativo) {
      // Vehículo confirmado como existente → crear nueva entrada
      const nuevosDatos = { ...datos, vehiculoExistente: true };
      await ctx.runMutation(internal.conversaciones.actualizar, {
        phone: from,
        etapa: "confirmando",
        datos: nuevosDatos,
      });
      await enviarResumenConfirmacion(from, nuevosDatos, undefined, true, phoneNumberId, accessToken);
    } else if (texto === "btn_vehiculo_no" || negativo) {
      // No es el mismo vehículo → tratar como nuevo
      const nuevosDatos = { ...datos, vehiculoExistente: false };
      // Buscar cliente
      let clienteEncontrado: { _id: string; name: string; phone: string } | null = null;
      if (datos.cliente) {
        clienteEncontrado = await ctx.runQuery(
          internal.conversaciones.buscarClientePorNombre,
          { nombre: datos.cliente }
        ) as { _id: string; name: string; phone: string } | null;
      }
      if (clienteEncontrado) {
        await ctx.runMutation(internal.conversaciones.actualizar, {
          phone: from,
          etapa: "verificando_cliente",
          datos: nuevosDatos,
          candidatoClienteId: clienteEncontrado._id as any,
          candidatoClienteNombre: clienteEncontrado.name,
        });
        await enviarMensajeConBotones(
          from,
          `Encontré este cliente:\n👤 *${clienteEncontrado.name}*\n📞 ${clienteEncontrado.phone}\n\n¿Es este el cliente?`,
          [
            { id: "btn_si", titulo: "✅ Sí, es él" },
            { id: "btn_no", titulo: "❌ No, es otro" },
          ],
          phoneNumberId,
          accessToken
        );
      } else {
        await ctx.runMutation(internal.conversaciones.actualizar, {
          phone: from,
          etapa: "confirmando",
          datos: { ...nuevosDatos, clienteEsNuevo: true },
        });
        await enviarResumenConfirmacion(from, { ...nuevosDatos, clienteEsNuevo: true }, undefined, false, phoneNumberId, accessToken);
      }
    } else {
      await enviarMensajeConBotones(
        from, `Por favor confirmá si es el vehículo correcto.`,
        [
          { id: "btn_vehiculo_si", titulo: "✅ Sí, ese es" },
          { id: "btn_vehiculo_no", titulo: "❌ No, es otro" },
        ],
        phoneNumberId, accessToken
      );
    }
    return;
  }

  // ── ETAPA: verificando_cliente ─────────────────────────────────────────
  if (etapa === "verificando_cliente") {
    if (afirmativo) {
      const nuevosDatos = { ...datos, customerId: conv.candidatoClienteId as string, clienteEsNuevo: false };
      await ctx.runMutation(internal.conversaciones.actualizar, { phone: from, etapa: "confirmando", datos: nuevosDatos });
      await enviarResumenConfirmacion(from, nuevosDatos, conv.candidatoClienteNombre, false, phoneNumberId, accessToken);
    } else if (negativo) {
      const nuevosDatos = { ...datos, clienteEsNuevo: true };
      await ctx.runMutation(internal.conversaciones.actualizar, { phone: from, etapa: "confirmando", datos: nuevosDatos });
      await enviarResumenConfirmacion(from, nuevosDatos, undefined, false, phoneNumberId, accessToken);
    } else {
      await enviarMensajeConBotones(
        from, `Por favor confirmá si el cliente es *${conv.candidatoClienteNombre}*.`,
        [{ id: "btn_si", titulo: "✅ Sí, es él" }, { id: "btn_no", titulo: "❌ No, es otro" }],
        phoneNumberId, accessToken
      );
    }
    return;
  }

  // ── ETAPA: confirmando ─────────────────────────────────────────────────
  if (etapa === "confirmando") {
    if (afirmativo) {
      await ctx.runMutation(internal.conversaciones.actualizar, { phone: from, etapa: "pidiendo_fotos", datos });
      await enviarMensajeConBotones(
        from,
        `📸 ¿Querés agregar fotos del vehículo?\nEnviá las imágenes o tocá "Sin fotos" para omitir.`,
        [{ id: "btn_sin_fotos", titulo: "📋 Sin fotos" }],
        phoneNumberId, accessToken
      );
    } else if (negativo) {
      await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
      await enviarMensaje(from, `❌ Registro cancelado.`, phoneNumberId, accessToken);
    } else {
      await enviarResumenConfirmacion(from, datos, conv.candidatoClienteNombre, datos.vehiculoExistente ?? false, phoneNumberId, accessToken);
    }
    return;
  }

  // ── ETAPA: pidiendo_fotos ──────────────────────────────────────────────
  if (etapa === "pidiendo_fotos") {
    // Imagen recibida
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
          `📸 Foto ${nuevosFotoIds.length} guardada. Enviá más o registrá el vehículo.`,
          [{ id: "btn_listo", titulo: "✅ Registrar vehículo" }],
          phoneNumberId, accessToken
        );
      } catch {
        await enviarMensaje(from, `⚠️ No pude guardar la foto, intentá de nuevo.`, phoneNumberId, accessToken);
      }
      return;
    }

    const proceder =
      ["btn_sin_fotos", "btn_listo"].includes(texto) ||
      esListo(texto) || esNegativo(texto) || esAfirmativo(texto) || texto === "";

    if (proceder) {
      try {
        const fotoIds = datos.fotoIds ?? [];
        let vehicleId: string;

        if (datos.vehiculoExistente && datos.patente) {
          // ── Nueva entrada para vehículo existente ──────────────────────
          vehicleId = await ctx.runMutation(
            internal.vehicles.crearNuevaEntrada,
            {
              plate: datos.patente,
              services: datos.tarea ? [datos.tarea] : [],
              cost: 0,
              mileage: datos.kilometraje
                ? parseInt(datos.kilometraje.replace(/\D/g, "")) || undefined
                : undefined,
              entryDate: new Date().toISOString().split("T")[0],
            }
          );
        } else {
          // ── Vehículo completamente nuevo ───────────────────────────────
          const [marcaParte, ...modeloPartes] = (datos.marca_modelo ?? "").split(" ");
          vehicleId = await ctx.runMutation(
            internal.vehicles.crearVehiculo,
            {
              plate: datos.patente,
              brand: marcaParte || "Desconocida",
              model: modeloPartes.join(" ") || "Desconocido",
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
        }

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

        const fotoMsg = fotoIds.length > 0
          ? `\n📸 ${fotoIds.length} foto${fotoIds.length > 1 ? "s" : ""} adjunta${fotoIds.length > 1 ? "s" : ""}.`
          : "";
        const tipoMsg = datos.vehiculoExistente ? "nueva entrada registrada" : "vehículo registrado";
        await enviarMensaje(
          from,
          `✅ *¡${tipoMsg.charAt(0).toUpperCase() + tipoMsg.slice(1)}!*\n\n` +
          `${datos.marca_modelo} — ${datos.patente}\n` +
          `Ya aparece en el sistema como *Ingresado*. 🔧${fotoMsg}`,
          phoneNumberId,
          accessToken
        );
      } catch (err) {
        console.error("[WA] Error al crear vehículo/entrada:", err);
        await enviarMensaje(from, `❌ Error al registrar. Intentá de nuevo o cargalo manualmente.`, phoneNumberId, accessToken);
        await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
      }
      return;
    }

    await enviarMensajeConBotones(
      from, `Enviá fotos o tocá el botón para registrar sin fotos.`,
      [{ id: "btn_sin_fotos", titulo: "📋 Sin fotos" }],
      phoneNumberId, accessToken
    );
    return;
  }

  // Etapa desconocida
  await ctx.runMutation(internal.conversaciones.eliminar, { phone: from });
}

// ─── Enviar resumen de confirmación ───────────────────────────────────────
async function enviarResumenConfirmacion(
  to: string,
  datos: DatosConversacion,
  clienteConfirmadoNombre: string | undefined,
  esEntradaExistente: boolean,
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

  const titulo = esEntradaExistente
    ? "📋 *Nueva entrada — vehículo existente:*"
    : "📋 *Resumen del ingreso:*";

  await enviarMensajeConBotones(
    to,
    `${titulo}\n\n` +
    `🚗 *Vehículo:* ${marcaModelo}\n` +
    `🔖 *Patente:* ${patente}\n` +
    `📊 *Kilometraje:* ${km}\n` +
    `🔧 *Trabajo:* ${tarea}\n` +
    `👤 *Cliente:* ${cliente}\n\n` +
    `¿Confirmar y registrar?`,
    [
      { id: "btn_confirmar", titulo: "✅ Confirmar" },
      { id: "btn_cancelar", titulo: "❌ Cancelar" },
    ],
    phoneNumberId,
    accessToken
  );
}

// ─── IA — Groq / LLaMA ────────────────────────────────────────────────────
async function procesarConIA(texto: string): Promise<DatosVehiculo> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("GROQ_API_KEY no configurada");

  const systemPrompt = `Eres un extractor de datos para un taller mecánico argentino.
El usuario te enviará un mensaje informal con información de un vehículo que ingresa al taller.
DEBES responder ÚNICAMENTE con un JSON válido, sin texto extra, sin markdown, sin explicaciones.

El JSON debe tener exactamente estos campos:
{
  "marca_modelo": "string — marca y modelo completos (ej: 'Chevrolet Aveo', 'Ford Focus')",
  "kilometraje": "string — solo el número del kilometraje sin texto (ej: '185444')",
  "patente": "string — patente/matrícula TAL COMO APARECE en el mensaje, sin normalizar (ej: 'LLD 274', 'AA-202-JP')",
  "tarea": "string — descripción COMPLETA y LITERAL del trabajo a realizar",
  "cliente": "string — nombre propio del cliente. Buscar después de 'cliente', 'de', 'para'"
}

REGLAS:
- Para "tarea": copiá COMPLETO. NUNCA abrevies.
- Para "cliente": solo el nombre, sin la palabra "cliente".
- Para "patente": copiala exactamente como la escribió el usuario, sin modificar espacios ni guiones.
- Si un campo no aparece, usá "". NO inventes datos.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
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

    if (!response.ok) throw new Error(`Groq error ${response.status}: ${await response.text()}`);

    const data = await response.json();
    const contenido: string = data.choices?.[0]?.message?.content ?? "";
    const jsonLimpio = contenido
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();

    return JSON.parse(jsonLimpio) as DatosVehiculo;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Descargar foto de WhatsApp → Convex Storage ──────────────────────────
async function descargarYGuardarFoto(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  mediaId: string,
  accessToken: string
): Promise<string> {
  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) throw new Error(`Graph API error: ${metaRes.status}`);
  const { url: mediaUrl } = await metaRes.json();

  const imgRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!imgRes.ok) throw new Error(`Error descargando imagen: ${imgRes.status}`);

  const blob = await imgRes.blob();
  return await ctx.storage.store(blob);
}
