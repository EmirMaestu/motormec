import type { FastifyInstance } from "fastify";
import { extname } from "node:path";
import { authed, requireAuth } from "../auth/middleware.js";
import { localDisk } from "../storage/provider.js";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Authenticated photo serving. The requested path MUST live under the session
 * tenant's media folder — never expose raw /media to avoid cross-tenant leaks.
 */
export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/media/*", { preHandler: requireAuth }, async (request, reply) => {
    const { auth } = authed(request);
    const relative = (request.params as Record<string, string>)["*"] ?? "";

    // Enforce tenant ownership: path must start with "<tenantId>/".
    if (!relative.startsWith(`${auth.tenantId}/`)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    try {
      const bytes = await localDisk.read(relative);
      const type = CONTENT_TYPES[extname(relative).toLowerCase()] ?? "application/octet-stream";
      return reply.type(type).send(bytes);
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });
}
