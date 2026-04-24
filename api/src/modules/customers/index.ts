import { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryWithTenant } from "../../db/pool";

const schema = z.object({
  name:           z.string().min(1),
  email:          z.string().email().optional(),
  phone:          z.string().min(1),
  address:        z.string().optional(),
  documentType:   z.string().optional(),
  documentNumber: z.string().optional(),
  notes:          z.string().optional(),
});

export default async function customerRoutes(app: FastifyInstance) {

  // ── GET /customers ───────────────────────────────────────
  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { search, limit = "50", offset = "0" } = request.query as any;

    let sql = `
      SELECT id, name, email, phone, address, document_type, document_number,
             total_vehicles, total_spent, last_visit_at, visit_count, is_active, created_at
      FROM customers
      WHERE tenant_id = $1 AND is_active = true
    `;
    const params: any[] = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY last_visit_at DESC NULLS LAST LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));

    const rows = await queryWithTenant(tenantId, sql, params);
    return reply.send({ data: rows });
  });

  // ── GET /customers/:id ───────────────────────────────────
  app.get("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };

    const [customer] = await queryWithTenant(tenantId,
      "SELECT * FROM customers WHERE tenant_id=$1 AND id=$2", [tenantId, id]);
    if (!customer) return reply.code(404).send({ error: "Cliente no encontrado" });

    const vehicles = await queryWithTenant(tenantId, `
      SELECT id, plate, brand, model, year, status, current_mileage, created_at
      FROM vehicles WHERE tenant_id=$1 AND customer_id=$2
      ORDER BY created_at DESC
    `, [tenantId, id]);

    return reply.send({ ...customer, vehicles });
  });

  // ── POST /customers ──────────────────────────────────────
  app.post("/", { preHandler: [app.requireRole("mechanic")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const [customer] = await queryWithTenant(tenantId, `
      INSERT INTO customers
        (tenant_id, name, email, phone, address, document_type, document_number, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [tenantId, d.name, d.email??null, d.phone, d.address??null,
        d.documentType??null, d.documentNumber??null, d.notes??null]);

    return reply.code(201).send(customer);
  });

  // ── PATCH /customers/:id ─────────────────────────────────
  app.patch("/:id", { preHandler: [app.requireRole("mechanic")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };
    const body = schema.partial().safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const fields: string[] = [];
    const values: any[] = [tenantId, id];
    const add = (col: string, val: any) => { values.push(val); fields.push(`${col}=$${values.length}`); };

    if (d.name           !== undefined) add("name", d.name);
    if (d.email          !== undefined) add("email", d.email);
    if (d.phone          !== undefined) add("phone", d.phone);
    if (d.address        !== undefined) add("address", d.address);
    if (d.documentType   !== undefined) add("document_type", d.documentType);
    if (d.documentNumber !== undefined) add("document_number", d.documentNumber);
    if (d.notes          !== undefined) add("notes", d.notes);

    if (!fields.length) return reply.code(400).send({ error: "Sin campos para actualizar" });

    const [customer] = await queryWithTenant(tenantId, `
      UPDATE customers SET ${fields.join(",")}, updated_at=NOW()
      WHERE tenant_id=$1 AND id=$2 RETURNING *
    `, values);

    if (!customer) return reply.code(404).send({ error: "Cliente no encontrado" });
    return reply.send(customer);
  });
}
