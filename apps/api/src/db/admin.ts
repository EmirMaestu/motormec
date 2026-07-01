import { db, type Database } from "./client.js";
import { platformAdmins, tenants, users } from "./schema.js";
import { hashPassword } from "../auth/password.js";

/**
 * Administrative (cross-tenant) operations. These intentionally live OUTSIDE the
 * tenant scope helper because provisioning a tenant or its first user happens
 * before any tenant context exists. Not reachable from tenant-facing routes.
 */

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: string;
  waPhoneNumberId?: string;
  waDisplayNumber?: string;
}

export async function createTenant(
  input: CreateTenantInput,
  database: Database = db,
) {
  const [tenant] = await database
    .insert(tenants)
    .values({
      name: input.name,
      slug: input.slug,
      plan: input.plan ?? "standard",
      waPhoneNumberId: input.waPhoneNumberId ?? null,
      waDisplayNumber: input.waDisplayNumber ?? null,
    })
    .returning();
  if (!tenant) throw new Error("Failed to create tenant");
  return tenant;
}

export interface CreateUserInput {
  tenantId: string;
  name: string;
  username: string;
  password: string;
  role?: "admin" | "mecanico";
  email?: string;
}

export async function createUser(
  input: CreateUserInput,
  database: Database = db,
) {
  const passwordHash = await hashPassword(input.password);
  const [user] = await database
    .insert(users)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      username: input.username,
      passwordHash,
      role: input.role ?? "mecanico",
      email: input.email ?? null,
    })
    .returning();
  if (!user) throw new Error("Failed to create user");
  return user;
}

export interface CreatePlatformAdminInput {
  username: string;
  name: string;
  password: string;
}

/** Create a platform super-admin (the owner of the SaaS). Cross-tenant. */
export async function createPlatformAdmin(
  input: CreatePlatformAdminInput,
  database: Database = db,
) {
  const passwordHash = await hashPassword(input.password);
  const [admin] = await database
    .insert(platformAdmins)
    .values({ username: input.username, name: input.name, passwordHash })
    .returning();
  if (!admin) throw new Error("Failed to create platform admin");
  return admin;
}
