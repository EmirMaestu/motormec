/**
 * Preflight de producción: valida que el entorno esté listo ANTES de servir.
 * Falla (exit 1) ante problemas graves; advierte (warn) ante cosas mejorables.
 *
 *   npm run preflight
 */
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, pool } from "../db/client.js";

const problems: string[] = [];
const warnings: string[] = [];
const ok: string[] = [];

const prod = env.NODE_ENV === "production";

// 1. Secretos.
const DEFAULT_KEY = "0".repeat(64);
if (env.SECRETS_KEY === DEFAULT_KEY) {
  problems.push("SECRETS_KEY es el valor de ejemplo (todo ceros). Generá uno: openssl rand -hex 32");
} else ok.push("SECRETS_KEY presente");

if (env.SESSION_SECRET.includes("change-me")) {
  problems.push("SESSION_SECRET sigue siendo el de ejemplo. Generá uno: openssl rand -base64 48");
} else ok.push("SESSION_SECRET presente");

// 2. Cookies seguras en prod.
if (prod && !env.COOKIE_SECURE) {
  problems.push("COOKIE_SECURE=false en producción: las cookies viajarían sin HTTPS. Poné true.");
} else ok.push(`COOKIE_SECURE=${env.COOKIE_SECURE}`);

// 3. WhatsApp.
if (!env.WHATSAPP_APP_SECRET) warnings.push("WHATSAPP_APP_SECRET vacío: el webhook rechazará todos los POST firmados.");
else ok.push("WHATSAPP_APP_SECRET presente");
if (!env.WHATSAPP_VERIFY_TOKEN) warnings.push("WHATSAPP_VERIFY_TOKEN vacío: la verificación GET del webhook fallará.");
else ok.push("WHATSAPP_VERIFY_TOKEN presente");

// 4. IA (Claude).
if (!env.ANTHROPIC_API_KEY) {
  warnings.push("ANTHROPIC_API_KEY vacío: el bot recibirá mensajes pero NO podrá extraer datos con IA.");
} else ok.push("ANTHROPIC_API_KEY presente");

// 5. Base de datos.
async function main(): Promise<void> {
  try {
    await db.execute(sql`select 1`);
    ok.push("Base de datos accesible");
  } catch (err) {
    problems.push(`No se pudo conectar a la base de datos (DATABASE_URL): ${(err as Error).message}`);
  } finally {
    await pool.end().catch(() => {});
  }

  // Reporte.
  const line = (s: string) => `  ${s}`;
  // eslint-disable-next-line no-console
  console.log("\nPreflight de producción (Momec)\n──────────────────────────────");
  if (ok.length) console.log("OK:\n" + ok.map((s) => line("✓ " + s)).join("\n"));
  if (warnings.length) console.log("\nAdvertencias:\n" + warnings.map((s) => line("⚠ " + s)).join("\n"));
  if (problems.length) console.log("\nProblemas (bloquean el deploy):\n" + problems.map((s) => line("✗ " + s)).join("\n"));

  if (problems.length) {
    console.log("\n✗ Preflight FALLÓ. Corregí los problemas de arriba.\n");
    process.exit(1);
  }
  console.log("\n✓ Preflight OK. Listo para servir.\n");
}

main();
