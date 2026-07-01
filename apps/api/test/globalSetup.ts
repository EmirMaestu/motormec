import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

/**
 * Global test setup:
 *  1. Ensure a dedicated `motormec_test` database exists (isolated from dev).
 *  2. Apply Drizzle migrations to it.
 *
 * The test DATABASE_URL is injected via vitest.config.ts (test.env).
 */
const { Pool, Client } = pg;

function adminUrl(testUrl: string): { admin: string; dbName: string } {
  const u = new URL(testUrl);
  const dbName = u.pathname.replace(/^\//, "");
  u.pathname = "/postgres";
  return { admin: u.toString(), dbName };
}

export default async function setup(): Promise<void> {
  // globalSetup runs in vitest's main process, before `test.env` is applied to
  // workers, so we derive the test URL the same way vitest.config.ts does.
  const testUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgres://motormec:motormec@localhost:5433/motormec_test";

  const { admin, dbName } = adminUrl(testUrl);

  const adminClient = new Client({ connectionString: admin });
  await adminClient.connect();
  try {
    const exists = await adminClient.query(
      "select 1 from pg_database where datname = $1",
      [dbName],
    );
    if (exists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await adminClient.end();
  }

  const pool = new Pool({ connectionString: testUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}
