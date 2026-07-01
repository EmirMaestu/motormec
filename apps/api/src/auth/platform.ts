import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db, type Database } from "../db/client.js";
import { platformAdmins, platformSessions } from "../db/schema.js";
import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "./password.js";

/**
 * Platform (super-admin) auth — completely separate from tenant auth. The owner
 * of the platform manages tenants/subscriptions across the whole system, so this
 * session is NOT bound to any tenant. Uses a distinct cookie (mm_admin).
 */
export const ADMIN_COOKIE = "mm_admin";

export interface PlatformContext {
  adminId: string;
  name: string;
  username: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function ttlMs(): number {
  return env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export interface AdminLoginResult {
  ok: boolean;
  token?: string;
  expiresAt?: Date;
  admin?: PlatformContext;
}

export async function loginPlatformAdmin(
  username: string,
  password: string,
  database: Database = db,
): Promise<AdminLoginResult> {
  const rows = await database
    .select()
    .from(platformAdmins)
    .where(and(eq(platformAdmins.username, username), eq(platformAdmins.active, true)))
    .limit(1);
  const admin = rows[0];
  const storedHash =
    admin?.passwordHash ??
    "pbkdf2$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  const { valid, needsRehash } = await verifyPassword(password, storedHash);
  if (!admin || !valid) return { ok: false };

  if (needsRehash) {
    const fresh = await hashPassword(password);
    await database.update(platformAdmins).set({ passwordHash: fresh }).where(eq(platformAdmins.id, admin.id));
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs());
  await database.insert(platformSessions).values({
    tokenHash: hashToken(token),
    adminId: admin.id,
    expiresAt,
  });

  return {
    ok: true,
    token,
    expiresAt,
    admin: { adminId: admin.id, name: admin.name, username: admin.username },
  };
}

export async function resolvePlatformSession(
  token: string,
  database: Database = db,
): Promise<PlatformContext | null> {
  if (!token) return null;
  const rows = await database
    .select({
      sessionId: platformSessions.id,
      adminId: platformSessions.adminId,
      expiresAt: platformSessions.expiresAt,
      name: platformAdmins.name,
      username: platformAdmins.username,
      active: platformAdmins.active,
    })
    .from(platformSessions)
    .innerJoin(platformAdmins, eq(platformAdmins.id, platformSessions.adminId))
    .where(eq(platformSessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await database.delete(platformSessions).where(eq(platformSessions.id, row.sessionId));
    return null;
  }
  if (!row.active) return null;
  return { adminId: row.adminId, name: row.name, username: row.username };
}

export async function destroyPlatformSession(token: string, database: Database = db): Promise<void> {
  if (!token) return;
  await database.delete(platformSessions).where(eq(platformSessions.tokenHash, hashToken(token)));
}

export async function purgeExpiredPlatformSessions(database: Database = db): Promise<void> {
  await database.delete(platformSessions).where(lt(platformSessions.expiresAt, new Date()));
}
