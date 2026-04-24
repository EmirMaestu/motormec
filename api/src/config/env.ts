import { z } from "zod";

const schema = z.object({
  NODE_ENV:           z.enum(["development", "beta", "production"]).default("development"),
  PORT:               z.coerce.number().default(3001),
  DATABASE_URL:       z.string().min(1, "DATABASE_URL requerida"),
  JWT_SECRET:         z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN:     z.string().default("15m"),
  CORS_ORIGIN:        z.string().default("*"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
