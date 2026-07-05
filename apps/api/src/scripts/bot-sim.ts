/**
 * Simulador de conversación del bot de WhatsApp — verificación manual del flujo
 * conversacional (carga de auto "por partes", desambiguación de cliente,
 * confirmación, memoria multi-turno de 5 min).
 *
 * Corre la MÁQUINA DE ESTADOS real (`procesarMensaje`) con el agente real
 * (`agenteConsulta`), así que reproduce exactamente lo que pasa en producción.
 *
 * REQUISITO: una API key real de Anthropic en apps/api/.env:
 *   ANTHROPIC_API_KEY=sk-ant-...
 * (sin key, el agente cae al mensaje de fallback y NO verás el flujo real.)
 *
 * Uso:  cd apps/api && npx tsx src/scripts/bot-sim.ts
 *
 * Podés editar el array `GUION` para probar otras conversaciones.
 */
import { env } from "../config/env.js";
import { db, pool } from "../db/client.js";
import { createTenant } from "../db/admin.js";
import { forTenant } from "../db/scope.js";
import { customers, numerosAutorizados, tenants } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { storage } from "../storage/provider.js";
import { agenteConsulta, type TurnoHistorial } from "../whatsapp/agente.js";
import { procesarMensaje, type BotDeps, type WAMessage } from "../whatsapp/stateMachine.js";

// La conversación a simular (tu ejemplo). Cada string es un mensaje del usuario.
const GUION = [
  "hola!",
  "agrega un auto",
  "patente qwe123",   // patente vieja AAA000 → normaliza a QWE123
  "el cliente se llama Juan",
  "Juan Pérez",        // desambiguación / no existe → ¿lo creo?
  "sí, crealo",
  "es un Volkswagen Gol",
  "vino por un service",
  "sí",                // confirmar el ingreso
];

async function main() {
  if (!env.ANTHROPIC_API_KEY) {
    console.error(
      "\n⛔ No hay ANTHROPIC_API_KEY en apps/api/.env — el agente caería al fallback.\n" +
        "   Poné una key real y volvé a correr para ver el flujo conversacional real.\n",
    );
    process.exit(1);
  }

  // Tenant de simulación efímero (no toca datos reales; se borra al final).
  const slug = `sim-bot-${Date.now()}`;
  const tenant = await createTenant({ name: "Taller Simulación", slug });
  const tdb = forTenant(tenant.id);
  // Un cliente "Juan Morales" para forzar la desambiguación con "Juan Pérez".
  await tdb.insert(customers, { name: "Juan Morales", phone: "" });

  const from = "5491100000000";
  // Autorizar el número en la whitelist del taller (si no, procesarMensaje rebota).
  await tdb.insert(numerosAutorizados, { phone: from, name: "Sim", active: true });
  const model = env.CLAUDE_MODEL_AGENT;
  let historial: TurnoHistorial[] = [];

  // deps mínimas, con el agente REAL y un send que imprime.
  const deps: BotDeps = {
    send: async (_to, texto) => {
      console.log(`\n🤖 Bot:\n${texto}\n`);
      return true;
    },
    sendButtons: async (_to, texto) => {
      console.log(`\n🤖 Bot (botones):\n${texto}\n`);
      return true;
    },
    parse: async () => ({}) as never, // no se usa en el path del agente
    downloadMedia: async () => null,
    storage,
    tallerNombre: tenant.name,
    redactar: async (base) => base,
    agente: async (f, texto, historialPrevio) => {
      const r = await agenteConsulta(tdb, texto.slice(0, 1000), tenant.name, f, { model }, historialPrevio);
      historial = r.historial;
      return { texto: r.texto, historial: r.historial };
    },
    iaQuota: { check: async () => true, tick: async () => {} },
  };

  console.log(`\n=== SIMULACIÓN BOT · modelo ${model} · taller "${tenant.name}" ===`);
  let n = 0;
  for (const texto of GUION) {
    n++;
    console.log(`\n👤 Usuario: ${texto}`);
    const msg: WAMessage = {
      type: "text",
      from,
      id: `sim-${n}-${Date.now()}`,
      text: { body: texto },
      timestamp: String(Math.floor(Date.now() / 1000)),
    } as WAMessage;
    try {
      const res = await procesarMensaje(tdb, msg, deps);
      console.log(`   (ruta: ${res})`);
    } catch (e) {
      console.error("   ⚠️ error procesando:", (e as Error).message);
    }
  }

  // Resumen: ¿se creó el vehículo/orden?
  const vehs = await tdb.select((await import("../db/schema.js")).vehicles);
  const ords = await tdb.select((await import("../db/schema.js")).workOrders);
  const custs = await tdb.select(customers);
  console.log(`\n=== RESULTADO ===`);
  console.log(`Clientes: ${custs.map((c) => c.name).join(", ")}`);
  console.log(`Vehículos creados: ${vehs.map((v) => `${v.plate} ${v.brand} ${v.model} (${v.owner})`).join(" | ") || "—"}`);
  console.log(`Órdenes creadas: ${ords.length}`);

  // Limpieza del tenant efímero.
  await db.delete(tenants).where(eq(tenants.id, tenant.id));
  await pool.end();
  console.log(`\n✅ Simulación terminada (tenant de prueba borrado).\n`);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
