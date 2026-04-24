import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import { env } from "./config/env";
import { pool } from "./db/pool";
import authPlugin from "./plugins/auth";
import authRoutes from "./modules/auth";
import vehicleRoutes from "./modules/vehicles";
import customerRoutes from "./modules/customers";
import transactionRoutes from "./modules/transactions";
import serviceRoutes from "./modules/services";
import productRoutes from "./modules/products";

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "warn" : "info",
    transport: env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  },
});

// ── Plugins globales ──────────────────────────────────────────
app.register(fastifyCors, { origin: env.CORS_ORIGIN });

app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  sign:   { algorithm: "HS256" },
});

app.register(authPlugin);

// ── Health check ──────────────────────────────────────────────
app.get("/health", async () => ({
  status:  "ok",
  env:     env.NODE_ENV,
  version: "1.0.0",
}));

// ── Rutas ─────────────────────────────────────────────────────
app.register(authRoutes,        { prefix: "/api/auth" });
app.register(vehicleRoutes,     { prefix: "/api/vehicles" });
app.register(customerRoutes,    { prefix: "/api/customers" });
app.register(transactionRoutes, { prefix: "/api/transactions" });
app.register(serviceRoutes,     { prefix: "/api/services" });
app.register(productRoutes,     { prefix: "/api/products" });

// ── 404 handler ───────────────────────────────────────────────
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ error: `Ruta no encontrada: ${request.method} ${request.url}` });
});

// ── Error handler ─────────────────────────────────────────────
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(error.statusCode ?? 500).send({
    error: env.NODE_ENV === "production" ? "Error interno" : error.message,
  });
});

// ── Arranque ──────────────────────────────────────────────────
async function start() {
  try {
    // Verificar conexión a DB
    await pool.query("SELECT 1");
    app.log.info("✅ PostgreSQL conectado");

    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`🚀 API corriendo en http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
