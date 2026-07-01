import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import { forTenant, type TenantDb } from "../db/scope.js";
import { resolveSession, SESSION_COOKIE, type SessionContext } from "./session.js";
import { ADMIN_COOKIE, resolvePlatformSession, type PlatformContext } from "./platform.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: SessionContext;
    /** Tenant-scoped data accessor, present only on authenticated requests. */
    tenantDb?: TenantDb;
    /** Platform super-admin context, present only on admin requests. */
    platformAdmin?: PlatformContext;
  }
}

/**
 * Resolves the session cookie (if any) and attaches `request.auth` +
 * `request.tenantDb`. Does NOT reject unauthenticated requests — use
 * `requireAuth` / `requireRole` for that. Registered as an onRequest hook.
 */
export async function attachSession(request: FastifyRequest): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return;
  const ctx = await resolveSession(token);
  if (!ctx) return;
  request.auth = ctx;
  request.tenantDb = forTenant(ctx.tenantId);
}

/** preHandler that rejects requests without a valid session. */
export const requireAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (!request.auth || !request.tenantDb) {
    return reply.code(401).send({ error: "unauthorized" });
  }
};

/** preHandler factory enforcing a specific role. */
export function requireRole(
  ...roles: Array<"admin" | "mecanico">
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth || !request.tenantDb) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!roles.includes(request.auth.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}

/** Narrowing helper for route handlers after requireAuth. */
export function authed(request: FastifyRequest): {
  auth: SessionContext;
  tenantDb: TenantDb;
} {
  if (!request.auth || !request.tenantDb) {
    throw new Error("authed() called on an unauthenticated request");
  }
  return { auth: request.auth, tenantDb: request.tenantDb };
}

/* ----------------------- Platform (super-admin) auth ---------------------- */

/** onRequest hook: resolve the admin cookie into request.platformAdmin. */
export async function attachPlatformAdmin(request: FastifyRequest): Promise<void> {
  const token = request.cookies?.[ADMIN_COOKIE];
  if (!token) return;
  const ctx = await resolvePlatformSession(token);
  if (ctx) request.platformAdmin = ctx;
}

/** preHandler that rejects requests without a valid platform-admin session. */
export const requirePlatformAdmin: preHandlerHookHandler = async (request, reply) => {
  if (!request.platformAdmin) {
    return reply.code(401).send({ error: "unauthorized" });
  }
};

export function platformAuthed(request: FastifyRequest): PlatformContext {
  if (!request.platformAdmin) {
    throw new Error("platformAuthed() called without a platform-admin session");
  }
  return request.platformAdmin;
}
