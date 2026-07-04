import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { env } from "./config/env.js";
import { attachPlatformAdmin, attachSession } from "./auth/middleware.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { categoryRoutes } from "./routes/categories.js";
import { customerRoutes } from "./routes/customers.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/health.js";
import { partnerRoutes } from "./routes/partners.js";
import { productRoutes } from "./routes/products.js";
import { mediaRoutes } from "./routes/media.js";
import { orderRoutes } from "./routes/orders.js";
import { quoteRoutes } from "./routes/quotes.js";
import { reportRoutes } from "./routes/reports.js";
import { serviceRoutes } from "./routes/services.js";
import { transactionRoutes } from "./routes/transactions.js";
import { vehicleRoutes } from "./routes/vehicles.js";
import { webhookRoutes } from "./routes/webhook.js";
import { whatsappAdminRoutes } from "./routes/whatsappAdmin.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: env.NODE_ENV === "production" ? "info" : "debug",
            // Never log secrets / cookies.
            redact: ["req.headers.authorization", "req.headers.cookie"],
          },
    trustProxy: true,
  });

  await app.register(cookie, { secret: env.SESSION_SECRET });

  await app.register(rateLimit, {
    // Red global: aplica a todas las rutas salvo que una la sobrescriba.
    // En test se desactiva para no romper suites que hacen muchas requests.
    global: env.NODE_ENV !== "test",
    max: env.NODE_ENV === "production" ? 300 : 100000,
    timeWindow: "1 minute",
    // No limitar el webhook de WhatsApp por IP (viene todo desde Meta).
    // Se excluye devolviendo un allowList por request:
    allowList: (req) => req.url.startsWith("/webhooks/"),
  });

  // Resolve session -> request.auth + request.tenantDb for every request.
  app.addHook("onRequest", attachSession);
  // Resolve platform admin cookie -> request.platformAdmin.
  app.addHook("onRequest", attachPlatformAdmin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(dashboardRoutes);
  await app.register(customerRoutes);
  await app.register(vehicleRoutes);
  await app.register(orderRoutes);
  await app.register(quoteRoutes);
  await app.register(transactionRoutes);
  await app.register(productRoutes);
  await app.register(partnerRoutes);
  await app.register(serviceRoutes);
  await app.register(categoryRoutes);
  await app.register(reportRoutes);
  await app.register(whatsappAdminRoutes);
  await app.register(mediaRoutes);
  await app.register(billingRoutes);
  await app.register(webhookRoutes);

  return app;
}
