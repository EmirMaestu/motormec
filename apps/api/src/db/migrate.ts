import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

/**
 * Applies versioned SQL migrations from ./drizzle. Run with `npm run db:migrate`.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  // eslint-disable-next-line no-console
  console.log("Migrations applied.");
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration failed:", err);
  process.exit(1);
});
