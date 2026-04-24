import { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryWithTenant } from "../../db/pool";

const schema = z.object({
  date:          z.string(),
  description:   z.string().min(1),
  type:          z.enum(["income", "expense"]),
  category:      z.string().min(1),
  amount:        z.number().positive(),
  vehicleId:     z.string().uuid().optional(),
  workOrderId:   z.string().uuid().optional(),
  paymentMethod: z.string().optional(),
  supplier:      z.string().optional(),
  notes:         z.string().optional(),
});

export default async function transactionRoutes(app: FastifyInstance) {

  // ── GET /transactions ────────────────────────────────────
  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { type, from, to, limit = "100", offset = "0" } = request.query as any;

    let sql = `
      SELECT t.*, v.plate AS vehicle_plate, v.brand AS vehicle_brand
      FROM transactions t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.tenant_id = $1 AND t.is_active = true
    `;
    const params: any[] = [tenantId];

    if (type)  { params.push(type);  sql += ` AND t.type = $${params.length}`; }
    if (from)  { params.push(from);  sql += ` AND t.date >= $${params.length}`; }
    if (to)    { params.push(to);    sql += ` AND t.date <= $${params.length}`; }

    sql += ` ORDER BY t.date DESC, t.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));

    const rows = await queryWithTenant(tenantId, sql, params);
    return reply.send({ data: rows });
  });

  // ── GET /transactions/summary ────────────────────────────
  app.get("/summary", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { from, to } = request.query as any;

    let sql = `
      SELECT
        SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense,
        SUM(CASE WHEN type='income'  THEN amount ELSE -amount END) AS balance,
        COUNT(*) AS total_transactions
      FROM transactions
      WHERE tenant_id = $1 AND is_active = true
    `;
    const params: any[] = [tenantId];
    if (from) { params.push(from); sql += ` AND date >= $${params.length}`; }
    if (to)   { params.push(to);   sql += ` AND date <= $${params.length}`; }

    const [summary] = await queryWithTenant(tenantId, sql, params);
    return reply.send(summary);
  });

  // ── POST /transactions ───────────────────────────────────
  app.post("/", { preHandler: [app.requireRole("mechanic")] }, async (request, reply) => {
    const { tenantId, sub: userId } = request.user;
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const [tx] = await queryWithTenant(tenantId, `
      INSERT INTO transactions
        (tenant_id, vehicle_id, work_order_id, date, description, type,
         category, amount, payment_method, supplier, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [tenantId, d.vehicleId??null, d.workOrderId??null,
        d.date, d.description, d.type, d.category, d.amount,
        d.paymentMethod??null, d.supplier??null, d.notes??null, userId]);

    return reply.code(201).send(tx);
  });

  // ── DELETE /transactions/:id (suspend) ───────────────────
  app.delete("/:id", { preHandler: [app.requireRole("admin")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };

    const [tx] = await queryWithTenant(tenantId, `
      UPDATE transactions
      SET is_active=false, suspended_at=NOW(), updated_at=NOW()
      WHERE tenant_id=$1 AND id=$2 RETURNING id
    `, [tenantId, id]);

    if (!tx) return reply.code(404).send({ error: "Transacción no encontrada" });
    return reply.send({ ok: true });
  });
}
