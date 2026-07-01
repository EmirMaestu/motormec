import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return reply.send({ status: "ok", db: "up" });
    } catch {
      return reply.code(503).send({ status: "degraded", db: "down" });
    }
  });
}
