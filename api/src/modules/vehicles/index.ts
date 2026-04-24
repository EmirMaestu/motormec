import { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryWithTenant } from "../../db/pool";

const createSchema = z.object({
  plate:          z.string().min(1).transform(s => s.toUpperCase().replace(/[\s\-]/g, "")),
  brand:          z.string().min(1),
  model:          z.string().min(1),
  year:           z.number().int().optional(),
  ownerName:      z.string().min(1),
  ownerPhone:     z.string().default(""),
  customerId:     z.string().uuid().optional(),
  description:    z.string().optional(),
  currentMileage: z.number().int().optional(),
  status:         z.enum(["waiting","in_progress","delivered","suspended"]).default("waiting"),
});

const updateSchema = createSchema.partial();

export default async function vehicleRoutes(app: FastifyInstance) {

  // ── GET /vehicles ────────────────────────────────────────
  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { status, search, limit = "50", offset = "0" } = request.query as any;

    let sql = `
      SELECT v.*, c.name AS customer_name, c.phone AS customer_phone
      FROM vehicles v
      LEFT JOIN customers c ON c.id = v.customer_id
      WHERE v.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (status) { params.push(status); sql += ` AND v.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (v.plate ILIKE $${params.length} OR v.owner_name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY v.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const rows = await queryWithTenant(tenantId, sql, params);
    return reply.send({ data: rows, limit: parseInt(limit), offset: parseInt(offset) });
  });

  // ── GET /vehicles/:id ────────────────────────────────────
  app.get("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };

    const [vehicle] = await queryWithTenant(tenantId, `
      SELECT v.*, c.name AS customer_name, c.phone AS customer_phone,
             c.email AS customer_email
      FROM vehicles v
      LEFT JOIN customers c ON c.id = v.customer_id
      WHERE v.tenant_id = $1 AND v.id = $2
    `, [tenantId, id]);

    if (!vehicle) return reply.code(404).send({ error: "Vehículo no encontrado" });

    // Work orders del vehículo
    const workOrders = await queryWithTenant(tenantId, `
      SELECT id, order_number, status, opened_at, closed_at,
             labor_cost, parts_cost, total_cost, diagnosis
      FROM work_orders
      WHERE tenant_id = $1 AND vehicle_id = $2
      ORDER BY opened_at DESC
    `, [tenantId, id]);

    return reply.send({ ...vehicle, workOrders });
  });

  // ── GET /vehicles/search/plate ───────────────────────────
  app.get("/search/plate", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) return reply.send({ data: [] });

    const plate = q.toUpperCase().replace(/[\s\-]/g, "");
    const rows = await queryWithTenant(tenantId, `
      SELECT v.id, v.plate, v.brand, v.model, v.year, v.owner_name,
             v.status, v.current_mileage, c.name AS customer_name
      FROM vehicles v
      LEFT JOIN customers c ON c.id = v.customer_id
      WHERE v.tenant_id = $1 AND v.plate ILIKE $2
      LIMIT 10
    `, [tenantId, `%${plate}%`]);

    return reply.send({ data: rows });
  });

  // ── POST /vehicles ───────────────────────────────────────
  app.post("/", { preHandler: [app.requireRole("mechanic")] }, async (request, reply) => {
    const { tenantId, sub: userId } = request.user;
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const [vehicle] = await queryWithTenant(tenantId, `
      INSERT INTO vehicles
        (tenant_id, plate, brand, model, year, owner_name, owner_phone,
         customer_id, description, current_mileage, status, is_in_workshop)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [tenantId, d.plate, d.brand, d.model, d.year ?? null,
        d.ownerName, d.ownerPhone, d.customerId ?? null,
        d.description ?? null, d.currentMileage ?? null,
        d.status, d.status !== "delivered" && d.status !== "suspended"]);

    // Registrar en audit_log
    await queryWithTenant(tenantId, `
      INSERT INTO audit_log (tenant_id, user_id, entity_type, entity_id, action, new_data)
      VALUES ($1,$2,'vehicle',$3,'created',$4)
    `, [tenantId, userId, vehicle.id, JSON.stringify(vehicle)]);

    return reply.code(201).send(vehicle);
  });

  // ── PATCH /vehicles/:id ──────────────────────────────────
  app.patch("/:id", { preHandler: [app.requireRole("mechanic")] }, async (request, reply) => {
    const { tenantId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const fields: string[] = [];
    const values: any[]   = [tenantId, id];

    if (d.plate          !== undefined) { values.push(d.plate);          fields.push(`plate=$${values.length}`); }
    if (d.brand          !== undefined) { values.push(d.brand);          fields.push(`brand=$${values.length}`); }
    if (d.model          !== undefined) { values.push(d.model);          fields.push(`model=$${values.length}`); }
    if (d.year           !== undefined) { values.push(d.year);           fields.push(`year=$${values.length}`); }
    if (d.ownerName      !== undefined) { values.push(d.ownerName);      fields.push(`owner_name=$${values.length}`); }
    if (d.ownerPhone     !== undefined) { values.push(d.ownerPhone);     fields.push(`owner_phone=$${values.length}`); }
    if (d.status         !== undefined) { values.push(d.status);         fields.push(`status=$${values.length}`); }
    if (d.description    !== undefined) { values.push(d.description);    fields.push(`description=$${values.length}`); }
    if (d.currentMileage !== undefined) { values.push(d.currentMileage); fields.push(`current_mileage=$${values.length}`); }
    if (d.customerId     !== undefined) { values.push(d.customerId);     fields.push(`customer_id=$${values.length}`); }

    if (!fields.length) return reply.code(400).send({ error: "Sin campos para actualizar" });

    const [vehicle] = await queryWithTenant(tenantId, `
      UPDATE vehicles SET ${fields.join(",")} , updated_at=NOW()
      WHERE tenant_id=$1 AND id=$2
      RETURNING *
    `, values);

    if (!vehicle) return reply.code(404).send({ error: "Vehículo no encontrado" });

    await queryWithTenant(tenantId, `
      INSERT INTO audit_log (tenant_id, user_id, entity_type, entity_id, action, new_data)
      VALUES ($1,$2,'vehicle',$3,'updated',$4)
    `, [tenantId, userId, id, JSON.stringify(d)]);

    return reply.send(vehicle);
  });

  // ── DELETE /vehicles/:id ─────────────────────────────────
  app.delete("/:id", { preHandler: [app.requireRole("admin")] }, async (request, reply) => {
    const { tenantId, sub: userId } = request.user;
    const { id } = request.params as { id: string };

    const [vehicle] = await queryWithTenant(tenantId,
      "DELETE FROM vehicles WHERE tenant_id=$1 AND id=$2 RETURNING id, plate",
      [tenantId, id]
    );

    if (!vehicle) return reply.code(404).send({ error: "Vehículo no encontrado" });

    await queryWithTenant(tenantId, `
      INSERT INTO audit_log (tenant_id, user_id, entity_type, entity_id, action)
      VALUES ($1,$2,'vehicle',$3,'deleted')
    `, [tenantId, userId, id]);

    return reply.send({ ok: true, deleted: vehicle });
  });
}
