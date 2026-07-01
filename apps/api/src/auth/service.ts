import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, type CreatedSession } from "./session.js";

export interface LoginInput {
  tenantSlug: string;
  username: string;
  password: string;
}

export interface LoginSuccess {
  ok: true;
  session: CreatedSession;
  user: { id: string; name: string; role: "admin" | "mecanico" };
  tenant: { id: string; slug: string; name: string };
}

export interface LoginFailure {
  ok: false;
}

/**
 * Authenticate a user within a tenant.
 *
 * The tenant is resolved by slug (the dashboard is accessed per-workshop, e.g.
 * /app with a tenant slug), because usernames are unique only per tenant.
 * tenant_id is therefore never supplied directly by the client as an id.
 *
 * Runs the password hash even when the user/tenant is missing to keep timing
 * roughly constant and avoid leaking which slugs/usernames exist.
 */
export async function login(input: LoginInput): Promise<LoginSuccess | LoginFailure> {
  const tenantRows = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, input.tenantSlug), eq(tenants.active, true)))
    .limit(1);
  const tenant = tenantRows[0];

  const userRows = tenant
    ? await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenant.id),
            eq(users.username, input.username),
            eq(users.active, true),
          ),
        )
        .limit(1)
    : [];
  const user = userRows[0];

  // Dummy hash to equalize timing when the user does not exist.
  const storedHash =
    user?.passwordHash ??
    "pbkdf2$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  const { valid, needsRehash } = await verifyPassword(input.password, storedHash);

  if (!tenant || !user || !valid) {
    return { ok: false };
  }

  if (needsRehash) {
    const fresh = await hashPassword(input.password);
    await db.update(users).set({ passwordHash: fresh }).where(eq(users.id, user.id));
  }

  const session = await createSession(user.id, tenant.id, user.role);

  return {
    ok: true,
    session,
    user: { id: user.id, name: user.name, role: user.role },
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
  };
}
