import { createTenant, createUser } from "../db/admin.js";
import { db, pool } from "../db/client.js";
import { tenants } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Development seed: provisions one demo workshop (tenant) with an admin and a
 * mechanic user. Idempotent on the slug. Run with `npm run seed:dev`.
 */
async function main(): Promise<void> {
  const slug = "taller-demo";

  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (existing[0]) {
    // eslint-disable-next-line no-console
    console.log(`Tenant '${slug}' already exists (${existing[0].id}).`);
    await pool.end();
    return;
  }

  const tenant = await createTenant({ name: "Taller Demo", slug });
  await createUser({
    tenantId: tenant.id,
    name: "Dueño Demo",
    username: "admin",
    password: "admin123",
    role: "admin",
    email: "admin@taller-demo.test",
  });
  await createUser({
    tenantId: tenant.id,
    name: "Mecánico Demo",
    username: "mecanico",
    password: "mecanico123",
    role: "mecanico",
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seeded tenant '${slug}' (${tenant.id})\n` +
      `  admin    / admin123    (role: admin)\n` +
      `  mecanico / mecanico123 (role: mecanico)`,
  );
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
