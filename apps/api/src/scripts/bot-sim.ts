/**
 * Simulador multi-escenario del bot de WhatsApp — verificación manual del
 * comportamiento conversacional contra el MODELO REAL (corre `procesarMensaje`
 * + `agenteConsulta`, idéntico a producción).
 *
 * REQUISITO: ANTHROPIC_API_KEY real en el entorno (o en apps/api/.env).
 *   Uso:  cd apps/api && npx tsx src/scripts/bot-sim.ts
 *   Filtrar escenarios:  npx tsx src/scripts/bot-sim.ts existe-auto presupuesto
 *
 * Cada escenario usa un tenant efímero (se borra al final). Editá `ESCENARIOS`
 * para agregar flujos.
 */
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, pool } from "../db/client.js";
import { createTenant } from "../db/admin.js";
import { forTenant, type TenantDb } from "../db/scope.js";
import {
  conversaciones,
  customers,
  numerosAutorizados,
  presupuestos,
  tenants,
  vehicles,
  workOrders,
} from "../db/schema.js";
import { storage } from "../storage/provider.js";
import { createOrder } from "../domain/orders.js";
import { agenteConsulta, type TurnoHistorial } from "../whatsapp/agente.js";
import { procesarMensaje, type BotDeps, type WAMessage } from "../whatsapp/stateMachine.js";

const SEED_ACTOR = { userId: null, userName: "Seed" };
const FROM = "5491100000000";

/** Un turno del usuario. Si `gapAntes` es true, se simula que pasaron 6 min de inactividad. */
interface Turno {
  texto: string;
  gapAntes?: boolean;
}
interface Escenario {
  id: string;
  titulo: string;
  seed?: (tdb: TenantDb) => Promise<void>;
  turnos: Turno[];
}

const t = (texto: string, gapAntes = false): Turno => ({ texto, gapAntes });

const ESCENARIOS: Escenario[] = [
  {
    id: "nuevo-por-partes",
    titulo: "Auto NUEVO cargado por partes (con desambiguación de cliente)",
    seed: async (tdb) => {
      await tdb.insert(customers, { name: "Juan Morales", phone: "" });
    },
    turnos: [
      t("hola!"),
      t("agrega un auto"),
      t("patente qwe123"),
      t("el cliente se llama Juan"),
      t("Juan Pérez"),
      t("sí, crealo"),
      t("es un Volkswagen Gol"),
      t("vino por un service"),
      t("sí"),
    ],
  },
  {
    id: "existe-auto",
    titulo: "Auto que YA EXISTE → reingreso (no debe duplicar el vehículo)",
    seed: async (tdb) => {
      await createOrder(tdb, SEED_ACTOR, {
        plate: "AB123CD",
        brand: "Ford",
        model: "Focus",
        customerName: "Carlos Ruiz",
        services: ["Frenos"],
        laborCost: 5000000,
      });
    },
    turnos: [
      t("volvió el Ford AB123CD, hay que hacerle un cambio de aceite"),
      t("sí, dale"),
    ],
  },
  {
    id: "existe-cliente",
    titulo: "Cliente que YA EXISTE (nombre exacto) → usa el existente, no lo re-crea",
    seed: async (tdb) => {
      await tdb.insert(customers, { name: "Pedro Gómez", phone: "1122334455" });
    },
    turnos: [
      t("agregá un auto"),
      t("patente lm890no"),
      t("es de Pedro Gómez"),
      t("una VW Saveiro"),
      t("cambio de correa"),
      t("sí"),
    ],
  },
  {
    id: "todo-junto",
    titulo: "Carga TODO JUNTO en un mensaje (camino rápido)",
    turnos: [
      t("agregá un VW Gol patente ABC123 de Juan, service"),
      t("sí"),
    ],
  },
  {
    id: "consulta-vehiculo",
    titulo: "Consulta: estado de un vehículo",
    seed: async (tdb) => {
      await createOrder(tdb, SEED_ACTOR, {
        plate: "MN456OP",
        brand: "Chevrolet",
        model: "Corsa",
        customerName: "Ana Díaz",
        services: ["Motor"],
        laborCost: 12000000,
      });
    },
    turnos: [t("cómo viene el corsa MN456OP?")],
  },
  {
    id: "que-hay-en-taller",
    titulo: "Consulta: qué autos hay en el taller ahora",
    seed: async (tdb) => {
      await createOrder(tdb, SEED_ACTOR, { plate: "AA111BB", brand: "Fiat", model: "Cronos", customerName: "Luis" });
      await createOrder(tdb, SEED_ACTOR, { plate: "CC222DD", brand: "Renault", model: "Kangoo", customerName: "Marta" });
    },
    turnos: [t("qué autos tengo en el taller?")],
  },
  {
    id: "presupuesto",
    titulo: "Armar un presupuesto por chat (manda PDF)",
    seed: async (tdb) => {
      await tdb.insert(customers, { name: "Laura Sosa", phone: "" });
    },
    turnos: [t("presupuestá a Laura Sosa: pastillas 15000, mano de obra 8000")],
  },
  {
    id: "comando-entregar",
    titulo: "Comando: marcar una orden como entregada",
    seed: async (tdb) => {
      await createOrder(tdb, SEED_ACTOR, { plate: "EE333FF", brand: "Peugeot", model: "208", customerName: "Sofía", laborCost: 3000000 });
    },
    turnos: [t("marcá la orden 1 como entregada")],
  },
  {
    id: "cancelar-mitad",
    titulo: "Cancelar la carga a mitad de camino",
    turnos: [
      t("agrega un auto"),
      t("patente gg444hh"),
      t("uf, me equivoqué, dejá, no lo cargues"),
    ],
  },
  {
    id: "reset-5min",
    titulo: "Reinicio de contexto tras 5 min de inactividad",
    turnos: [
      t("agrega un auto"),
      t("patente jj555kk"),
      t("mmm dame un segundo", true), // ← simula 6 min de silencio antes de este mensaje
    ],
  },
];

async function correrEscenario(esc: Escenario): Promise<void> {
  const slug = `sim-${esc.id}-${Date.now()}`;
  const tenant = await createTenant({ name: "Taller Simulación", slug });
  const tdb = forTenant(tenant.id);
  await tdb.insert(numerosAutorizados, { phone: FROM, name: "Sim", active: true });
  if (esc.seed) await esc.seed(tdb);

  const deps: BotDeps = {
    send: async (_to, texto) => { console.log(`🤖 ${texto}\n`); return true; },
    sendButtons: async (_to, texto) => { console.log(`🤖 (botones) ${texto}\n`); return true; },
    parse: async () => ({}) as never,
    downloadMedia: async () => null,
    storage,
    tallerNombre: tenant.name,
    redactar: async (base) => base,
    agente: async (f, texto, historialPrevio: TurnoHistorial[] = []) => {
      const r = await agenteConsulta(tdb, texto.slice(0, 1000), tenant.name, f, {
        model: env.CLAUDE_MODEL_AGENT,
        enviarPresupuestoPdf: async (q) => { console.log(`   📄 (PDF del presupuesto #${q.number} enviado)`); return true; },
      }, historialPrevio);
      return { texto: r.texto, historial: r.historial };
    },
    iaQuota: { check: async () => true, tick: async () => {} },
  };

  console.log(`\n\n════════════════════════════════════════════════════════════`);
  console.log(`▶ ${esc.id} — ${esc.titulo}`);
  console.log(`════════════════════════════════════════════════════════════`);

  let n = 0;
  for (const turno of esc.turnos) {
    n++;
    if (turno.gapAntes) {
      // Envejecer la conversación 6 min para gatillar el reinicio por expiración.
      await tdb.update(conversaciones, { updatedAt: new Date(Date.now() - 6 * 60_000) }, eq(conversaciones.phone, FROM));
      console.log(`   ⏱️  (pasan 6 minutos de silencio…)`);
    }
    console.log(`👤 ${turno.texto}`);
    const msg = {
      type: "text", from: FROM, id: `sim-${n}-${Date.now()}`,
      text: { body: turno.texto }, timestamp: String(Math.floor(Date.now() / 1000)),
    } as WAMessage;
    try {
      await procesarMensaje(tdb, msg, deps);
    } catch (e) {
      console.error(`   ⚠️ error: ${(e as Error).message}`);
    }
  }

  const vehs = await tdb.select(vehicles);
  const custs = await tdb.select(customers);
  const ords = await tdb.select(workOrders);
  const quos = await tdb.select(presupuestos);
  console.log(`── resultado: clientes=[${custs.map((c) => c.name).join(", ")}] · vehículos=${vehs.length} [${vehs.map((v) => v.plate).join(", ")}] · órdenes=${ords.length} · presupuestos=${quos.length}`);

  await db.delete(tenants).where(eq(tenants.id, tenant.id));
}

async function main() {
  if (!env.ANTHROPIC_API_KEY) {
    console.error("\n⛔ No hay ANTHROPIC_API_KEY — el agente caería al fallback. Poné una key y reintentá.\n");
    process.exit(1);
  }
  const filtro = process.argv.slice(2);
  const lista = filtro.length ? ESCENARIOS.filter((e) => filtro.includes(e.id)) : ESCENARIOS;
  console.log(`\n=== SIMULADOR BOT · modelo ${env.CLAUDE_MODEL_AGENT} · ${lista.length} escenario(s) ===`);
  for (const esc of lista) {
    try { await correrEscenario(esc); } catch (e) { console.error(`Escenario ${esc.id} falló:`, e); }
  }
  await pool.end();
  console.log(`\n\n✅ Listo (tenants de prueba borrados).\n`);
}

main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
