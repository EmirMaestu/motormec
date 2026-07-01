import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { tenants, users } from "../db/schema.js";
import { login } from "../auth/service.js";
import {
  cookieOptions,
  destroySession,
  SESSION_COOKIE,
} from "../auth/session.js";
import { authed, requireAuth } from "../auth/middleware.js";
import { env } from "../config/env.js";

const loginSchema = z.object({
  tenantSlug: z.string().min(1).max(80),
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/login",
    {
      config: {
        rateLimit: {
          // Relaxed under tests (many logins per minute); strict otherwise.
          max: env.NODE_ENV === "test" ? 10_000 : 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_input" });
      }

      const result = await login(parsed.data);
      if (!result.ok) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      reply.setCookie(
        SESSION_COOKIE,
        result.session.token,
        cookieOptions(result.session.expiresAt),
      );

      return reply.send({
        user: result.user,
        tenant: result.tenant,
      });
    },
  );

  app.post("/api/logout", async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, cookieOptions());
    return reply.send({ ok: true });
  });

  app.get(
    "/api/me",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { auth } = authed(request);
      const userRows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          username: users.username,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1);
      const tenantRows = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          settings: tenants.settings,
        })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .limit(1);

      const user = userRows[0];
      const tenant = tenantRows[0];
      if (!user || !tenant) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      return reply.send({ user, tenant });
    },
  );
}
