import { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryWithTenant } from "../../db/pool";

export default async function serviceRoutes(app: FastifyInstance) {

  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const rows = await queryWithTenant(tenantId, `
      SELECT * FROM service_catalog
      WHERE tenant_id=$1 AND is_active=true
      ORDER BY usage_count DESC, name ASC
    `, [tenantId]);
    return reply.send({ data: rows });
  });

  app.post("/", { preHandler: [app.requireRole("admin")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { name } = z.object({ name: z.string().min(1) }).parse(request.body);

    const [svc] = await queryWithTenant(tenantId, `
      INSERT INTO service_catalog (tenant_id, name)
      VALUES ($1, $2)
      ON CONFLICT (tenant_id, name) DO UPDATE SET is_active=true
      RETURNING *
    `, [tenantId, name]);
    return reply.code(201).send(svc);
  });

  app.delete("/:id", { preHandler: [app.requireRole("admin")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };
    await queryWithTenant(tenantId,
      "UPDATE service_catalog SET is_active=false WHERE tenant_id=$1 AND id=$2",
      [tenantId, id]);
    return reply.send({ ok: true });
  });
}
