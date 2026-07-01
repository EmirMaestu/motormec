import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { numerosAutorizados, tenants } from "../db/schema.js";
import { forTenant } from "../db/scope.js";
import { env } from "../config/env.js";
import { storage } from "../storage/provider.js";
import { limitsFor, withinLimit } from "../domain/plans.js";
import { getIaUsage, incIaTokens, incIaUsage } from "../domain/usage.js";
import {
  descargarMedia,
  enviarMensaje,
  enviarMensajeConBotones,
  type SendCtx,
} from "./client.js";
import { extraerDatosVehiculo } from "./parser.js";
import { redactarNatural } from "./responder.js";
import { agenteConsulta } from "./agente.js";
import { sameNumber } from "./phone.js";
import { procesarMensaje, type BotDeps, type WAMessage } from "./stateMachine.js";
import type { TenantDb } from "../db/scope.js";

const SUPPORTED = new Set(["text", "image", "interactive"]);

function makeDeps(
  ctx: SendCtx,
  tdb: TenantDb,
  tenantId: string,
  plan: string,
  tallerNombre: string,
): BotDeps {
  const maxIa = limitsFor(plan).maxIaMonthly;
  return {
    send: (to, texto) => enviarMensaje(ctx, to, texto),
    sendButtons: (to, texto, botones) => enviarMensajeConBotones(ctx, to, texto, botones),
    parse: async (texto) => {
      const r = await extraerDatosVehiculo(texto);
      await incIaTokens(tenantId, r.inputTokens, r.outputTokens);
      return r.datos;
    },
    downloadMedia: (mediaId) => descargarMedia(ctx, mediaId),
    storage,
    tallerNombre,
    redactar: async (base) => {
      const r = await redactarNatural(base);
      await incIaTokens(tenantId, r.inputTokens, r.outputTokens);
      return r.texto;
    },
    agente: async (from, texto) => {
      const r = await agenteConsulta(tdb, texto, tallerNombre, from);
      await incIaTokens(tenantId, r.inputTokens, r.outputTokens);
      return r.texto;
    },
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
 * Resolvé a qué taller pertenece un remitente, buscando su número entre TODOS
 * los números autorizados (activos) de todos los talleres. Devuelve el tenantId
 * o null si el número no está habilitado en ningún taller.
 */
async function tenantForSender(from: string): Promise<string | null> {
  const rows = await db
    .select({ tenantId: numerosAutorizados.tenantId, phone: numerosAutorizados.phone })
    .from(numerosAutorizados)
    .where(eq(numerosAutorizados.active, true));
  const match = rows.find((r) => sameNumber(r.phone, from));
  return match?.tenantId ?? null;
}

/**
 * Momec usa UN solo número de WhatsApp (config de plataforma en env). Cada
 * mensaje entrante se rutea al taller del REMITENTE (su número de empleado
 * autorizado). Un remitente no habilitado recibe un aviso y no se procesa.
 */
export async function processWhatsAppPayload(payload: MetaPayload): Promise<void> {
  const ctx: SendCtx = {
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
  };
  if (!ctx.phoneNumberId || !ctx.accessToken) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp] WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN sin configurar");
    return;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const msg of value?.messages ?? []) {
        if (!SUPPORTED.has(msg.type)) continue;
        const from = msg.from;

        const tenantId = await tenantForSender(from);
        if (!tenantId) {
          await enviarMensaje(
            ctx,
            from,
            "⛔ Tu número no está habilitado para usar el bot. Pedile al taller que te dé acceso.",
          );
          continue;
        }

        const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
        const tenant = rows[0];
        if (!tenant || !tenant.active) continue;

        const tdb = forTenant(tenant.id);
        const deps = makeDeps(ctx, tdb, tenant.id, tenant.plan, tenant.name);
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
