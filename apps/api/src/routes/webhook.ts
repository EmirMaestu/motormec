import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { verifySignature } from "../whatsapp/signature.js";
import { processWhatsAppPayload } from "../whatsapp/webhookProcessor.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

/** Descarta mensajes viejos (> 5 min): defensa anti-replay/stale (BOT-6). */
const MAX_MESSAGE_AGE_MS = 5 * 60_000;

/**
 * ¿El mensaje es viejo (más de 5 min) según su timestamp de WhatsApp (segundos)?
 * Función pura y determinística (para testear). Si el timestamp no es un número
 * finito, NO lo descartamos (no podemos afirmar que sea viejo).
 * La dedup por wa_message_id ya existe; esto es defensa en profundidad.
 */
export function isStaleMessage(
  timestamp: string | number | undefined,
  now: number = Date.now(),
): boolean {
  const ts = Number(timestamp) * 1000;
  return Number.isFinite(ts) && now - ts > MAX_MESSAGE_AGE_MS;
}

/**
 * Single WhatsApp webhook serving ALL tenants. Encapsulated so we can keep the
 * raw request body (needed for HMAC signature verification) without affecting
 * JSON parsing on the rest of the API.
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (instance) => {
    instance.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (req, body, done) => {
        const buf = body as Buffer;
        req.rawBody = buf;
        try {
          done(null, buf.length ? JSON.parse(buf.toString("utf8")) : {});
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );

    // GET: Meta verification handshake.
    instance.get("/webhooks/whatsapp", async (request, reply) => {
      const q = request.query as Record<string, string>;
      const mode = q["hub.mode"];
      const token = q["hub.verify_token"];
      const challenge = q["hub.challenge"];
      if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
        return reply.code(200).type("text/plain").send(challenge ?? "");
      }
      return reply.code(403).send("Forbidden");
    });

    // POST: inbound messages. Verify signature, ACK 200 fast, process async.
    instance.post("/webhooks/whatsapp", async (request, reply) => {
      const raw = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
      const signature = request.headers["x-hub-signature-256"];
      if (
        !verifySignature(
          raw,
          Array.isArray(signature) ? signature[0] : signature,
          env.WHATSAPP_APP_SECRET,
        )
      ) {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      const payload = request.body as Parameters<typeof processWhatsAppPayload>[0];
      // BOT-6: descartar mensajes viejos (> 5 min) por timestamp antes de
      // procesarlos (anti-replay/stale). Igualmente ACKeamos 200 para que Meta
      // no reintente. La dedup por wa_message_id ya existe; esto es defensa en
      // profundidad.
      const now = Date.now();
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value;
          if (value?.messages) {
            value.messages = value.messages.filter(
              (msg) => !isStaleMessage(msg.timestamp, now),
            );
          }
        }
      }
      // ACK immediately; process in the background so Meta does not retry.
      reply.code(200).send({ received: true });
      setImmediate(() => {
        processWhatsAppPayload(payload).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[whatsapp] payload processing failed:", err);
        });
      });
      return reply;
    });
  });
}
