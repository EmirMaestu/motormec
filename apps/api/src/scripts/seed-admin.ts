import { eq } from "drizzle-orm";
import { createPlatformAdmin } from "../db/admin.js";
import { db, pool } from "../db/client.js";
import { platformAdmins } from "../db/schema.js";

/**
 * Create the platform super-admin (the owner of the SaaS). Idempotent on username.
 * Usage: npm run seed:admin -- <username> <password> "<Nombre>"
 */
async function main(): Promise<void> {
  const username = process.argv[2] ?? "owner";
  const password = process.argv[3] ?? "owner123";
  const name = process.argv[4] ?? "Owner";

  const existing = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.username, username))
    .limit(1);
  if (existing[0]) {
    // eslint-disable-next-line no-console
    console.log(`Platform admin '${username}' already exists (${existing[0].id}).`);
    await pool.end();
    return;
  }

  const admin = await createPlatformAdmin({ username, name, password });
  // eslint-disable-next-line no-console
  console.log(`Seeded platform admin '${username}' (${admin.id}). Login at /app/admin`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed admin failed:", err);
  process.exit(1);
});
