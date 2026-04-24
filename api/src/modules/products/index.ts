import { FastifyInstance } from "fastify";
import { z } from "zod";
import { queryWithTenant } from "../../db/pool";

const schema = z.object({
  name:         z.string().min(1),
  quantity:     z.number().default(0),
  unit:         z.string().optional(),
  type:         z.string().optional(),
  price:        z.number().default(0),
  reorderPoint: z.number().optional(),
});

export default async function productRoutes(app: FastifyInstance) {

  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { lowStock } = request.query as any;

    let sql = "SELECT * FROM products WHERE tenant_id=$1 AND is_active=true";
    if (lowStock === "true") sql += " AND quantity <= COALESCE(reorder_point, 0)";
    sql += " ORDER BY name ASC";

    const rows = await queryWithTenant(tenantId, sql, [tenantId]);
    return reply.send({ data: rows });
  });

  app.post("/", { preHandler: [app.requireRole("admin")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const [product] = await queryWithTenant(tenantId, `
      INSERT INTO products (tenant_id, name, quantity, unit, type, price, reorder_point)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [tenantId, d.name, d.quantity, d.unit??null, d.type??null, d.price, d.reorderPoint??null]);

    return reply.code(201).send(product);
  });

  app.patch("/:id", { preHandler: [app.requireRole("mechanic")] }, async (request, reply) => {
    const { tenantId } = request.user;
    const { id } = request.params as { id: string };
    const body = schema.partial().safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const d = body.data;

    const fields: string[] = [];
    const values: any[] = [tenantId, id];
    const add = (col: string, val: any) => { values.push(val); fields.push(`${col}=$${values.length}`); };

    if (d.name         !== undefined) add("name", d.name);
    if (d.quantity     !== undefined) add("quantity", d.quantity);
    if (d.unit         !== undefined) add("unit", d.unit);
    if (d.type         !== undefined) add("type", d.type);
    if (d.price        !== undefined) add("price", d.price);
    if (d.reorderPoint !== undefined) add("reorder_point", d.reorderPoint);

    if (!fields.length) return reply.code(400).send({ error: "Sin campos" });

    const [product] = await queryWithTenant(tenantId, `
      UPDATE products SET ${fields.join(",")}, updated_at=NOW()
      WHERE tenant_id=$1 AND id=$2 RETURNING *
    `, values);

    if (!product) return reply.code(404).send({ error: "Producto no encontrado" });
    return reply.send(product);
  });
}
