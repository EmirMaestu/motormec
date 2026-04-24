import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max:              20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err);
});

// ── Ejecutar query con tenant isolation via RLS ───────────────
// Setea app.current_tenant_id en la conexión antes de cada query
// para que las políticas de Row Level Security se apliquen.
export async function queryWithTenant<T = any>(
  tenantId: string,
  text: string,
  values?: any[]
): Promise<T[]> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    const result = await client.query(text, values);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// ── Query simple sin tenant (para auth y operaciones admin) ───
export async function query<T = any>(text: string, values?: any[]): Promise<T[]> {
  const result = await pool.query(text, values);
  return result.rows as T[];
}
