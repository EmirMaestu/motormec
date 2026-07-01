import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema.js";
import { forTenant } from "../db/scope.js";
import { decryptSecret } from "../crypto/secrets.js";
import { storage } from "../storage/provider.js";
import { limitsFor, withinLimit } from "../domain/plans.js";
import { getIaUsage, incIaUsage } from "../domain/usage.js";
import {
  descargarMedia,
  enviarMensaje,
  enviarMensajeConBotones,
  type SendCtx,
} from "./client.js";
import { extraerDatosVehiculo } from "./parser.js";
import { procesarMensaje, type BotDeps, type WAMessage } from "./stateMachine.js";

const SUPPORTED = new Set(["text", "image", "interactive"]);

function makeDeps(ctx: SendCtx, tenantId: string, plan: string): BotDeps {
  const maxIa = limitsFor(plan).maxIaMonthly;
  return {
    send: (to, texto) => enviarMensaje(ctx, to, texto),
    sendButtons: (to, texto, botones) => enviarMensajeConBotones(ctx, to, texto, botones),
    parse: (texto) => extraerDatosVehiculo(texto),
    downloadMedia: (mediaId) => descargarMedia(ctx, mediaId),
    storage,
    iaQuota: {
      check: async () => withinLimit(await getIaUsage(tenantId), maxIa),
      tick: async () => {
        await incIaUsage(tenantId);
      },
    },
  };
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: WAMessage[];
      };
    }>;
  }>;
}

/**
 * Route a Meta webhook payload to the right tenant by phone_number_id and run
 * each supported message through the conversation state machine. A missing or
 * unknown phone_number_id is silently ignored (per spec).
 */
export async function processWhatsAppPayload(payload: MetaPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const rows = await db
        .select()
        .from(tenants)
        .where(eq(tenants.waPhoneNumberId, phoneNumberId))
        .limit(1);
      const tenant = rows[0];
      if (!tenant || !tenant.active) continue;

      const accessToken = tenant.waAccessToken
        ? safeDecrypt(tenant.waAccessToken)
        : "";
      const deps = makeDeps({ phoneNumberId, accessToken }, tenant.id, tenant.plan);
      const tdb = forTenant(tenant.id);

      for (const msg of value?.messages ?? []) {
        if (!SUPPORTED.has(msg.type)) continue;
        try {
          await procesarMensaje(tdb, msg, deps);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[whatsapp] error processing ${msg.id}:`, err);
        }
      }
    }
  }
}

function safeDecrypt(value: string): string {
  try {
    return decryptSecret(value);
  } catch {
    return "";
  }
}
