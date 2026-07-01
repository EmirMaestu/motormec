const GRAPH = "https://graph.facebook.com/v19.0";

/**
 * Argentine number normalization for SENDING — ported verbatim from Convex.
 * Converts `549<area><local>` into `54<area>15<local>` (handles the 9/15 quirk;
 * Buenos Aires area "11" uses 8 local digits, others 7).
 */
export function normalizarNumeroEnvio(phone: string): string {
  if (!phone.startsWith("549")) return phone;
  const sinPais9 = phone.slice(3);
  const localDigits = sinPais9.startsWith("11") ? 8 : 7;
  const area = sinPais9.slice(0, sinPais9.length - localDigits);
  const local = sinPais9.slice(sinPais9.length - localDigits);
  return "54" + area + "15" + local;
}

export interface SendCtx {
  phoneNumberId: string;
  accessToken: string;
}

async function post(ctx: SendCtx, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${ctx.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function enviarMensaje(ctx: SendCtx, to: string, texto: string): Promise<boolean> {
  return post(ctx, {
    messaging_product: "whatsapp",
    to: normalizarNumeroEnvio(to),
    type: "text",
    text: { body: texto },
  });
}

export interface Boton {
  id: string;
  titulo: string;
}

/**
 * Send up to 3 interactive reply buttons; falls back to a plain-text bulleted
 * list if the interactive API call fails.
 */
export async function enviarMensajeConBotones(
  ctx: SendCtx,
  to: string,
  texto: string,
  botones: Boton[],
): Promise<boolean> {
  const ok = await post(ctx, {
    messaging_product: "whatsapp",
    to: normalizarNumeroEnvio(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: texto },
      action: {
        buttons: botones.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.titulo },
        })),
      },
    },
  });
  if (ok) return true;
  // Fallback to text.
  const fallback = texto + "\n\n" + botones.map((b) => "▸ " + b.titulo).join("\n");
  return enviarMensaje(ctx, to, fallback);
}

/**
 * Sube un archivo a Meta y devuelve el media_id (para reenviarlo como documento
 * sin exponer una URL pública). Multipart con el fetch/FormData nativos de Node.
 */
export async function subirMedia(
  ctx: SendCtx,
  bytes: Buffer,
  mime: string,
  filename: string,
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), filename);
    const res = await fetch(`${GRAPH}/${ctx.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
      body: form,
    });
    if (!res.ok) return null;
    const info = (await res.json()) as { id?: string };
    return info.id ?? null;
  } catch {
    return null;
  }
}

/** Envía un documento (PDF, etc.) ya subido, por su media_id. */
export async function enviarDocumento(
  ctx: SendCtx,
  to: string,
  mediaId: string,
  filename: string,
  caption?: string,
): Promise<boolean> {
  return post(ctx, {
    messaging_product: "whatsapp",
    to: normalizarNumeroEnvio(to),
    type: "document",
    document: { id: mediaId, filename, caption },
  });
}

/** Download a media object from Meta (two-step: get URL, then fetch bytes). */
export async function descargarMedia(
  ctx: SendCtx,
  mediaId: string,
): Promise<Buffer | null> {
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    });
    if (!metaRes.ok) return null;
    const info = (await metaRes.json()) as { url?: string };
    if (!info.url) return null;
    const imgRes = await fetch(info.url, {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    });
    if (!imgRes.ok) return null;
    const arrayBuf = await imgRes.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}
