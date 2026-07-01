import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Load .env (best-effort) before validating. We avoid a runtime dotenv dependency
 * by using Node's built-in process.loadEnvFile. Real env vars (CI, systemd) take
 * precedence because loadEnvFile does not overwrite already-set variables.
 */
function loadDotEnv(): void {
  const candidates = [
    process.env.ENV_FILE,
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "apps/api/.env"),
  ].filter((p): p is string => Boolean(p));

  for (const file of candidates) {
    if (file && existsSync(file)) {
      try {
        // Available in Node 20.12+ / 21+.
        process.loadEnvFile(file);
      } catch {
        /* ignore — fall back to process.env */
      }
      break;
    }
  }
}

loadDotEnv();

const boolish = z
  .string()
  .transform((v) => v === "true" || v === "1")
  .pipe(z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  COOKIE_SECURE: boolish.default("true"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  WHATSAPP_APP_SECRET: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default(""),
  // Número ÚNICO de Momec (plataforma). Todos los talleres reciben por acá; el
  // ruteo al taller se hace por el remitente (número del empleado autorizado).
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),

  // 64 hex chars = 32 bytes for AES-256-GCM.
  SECRETS_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "SECRETS_KEY must be 64 hex chars (32 bytes)"),

  // IA (parser del bot). Groq queda como fallback legacy opcional.
  GROQ_API_KEY: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  // Modelo para EXTRAER datos (mensajes cortos del bot): rápido y barato.
  CLAUDE_MODEL_PARSER: z.string().default("claude-haiku-4-5"),
  // Modelo para el AGENTE (interpretar comandos editar/borrar, razonar): más capaz.
  CLAUDE_MODEL_AGENT: z.string().default("claude-opus-4-8"),

  MEDIA_ROOT: z.string().default("./media"),

  /* ----------------------------- Billing ------------------------------- */
  // Mobbex (Argentina — DEBIN/transferencia/tarjeta). Sandbox: mobbex.dev.
  MOBBEX_API_KEY: z.string().default(""),
  MOBBEX_ACCESS_TOKEN: z.string().default(""),
  MOBBEX_WEBHOOK_SECRET: z.string().default(""),
  MOBBEX_BASE_URL: z.string().default("https://api.mobbex.com"),
  // Rebill (Chile — cobra CLP, liquida USD).
  REBILL_API_KEY: z.string().default(""),
  REBILL_WEBHOOK_SECRET: z.string().default(""),
  REBILL_BASE_URL: z.string().default("https://api.rebill.com"),
  // Descuento por pagar con transferencia/DEBIN (0.10 = 10%). Atributo del método.
  DESCUENTO_TRANSFERENCIA: z.coerce.number().min(0).max(1).default(0.1),
  // Crédito de referido: % del pago del referido acreditado al que lo trajo.
  REFERRAL_REWARD_PCT: z.coerce.number().min(0).max(1).default(0.2),
  // Reintentos (dunning) antes de marcar la suscripción como past_due.
  BILLING_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  // Sandbox de proveedores (no golpea producción). Default true por seguridad.
  BILLING_SANDBOX: boolish.default("true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
