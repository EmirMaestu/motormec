import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, type Database } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "mm_session";

export interface SessionContext {
  sessionId: string;
  userId: string;
  userName: string;
  tenantId: string;
  role: "admin" | "mecanico";
}

/** Opaque token stored in the cookie; only its SHA-256 hash is persisted. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function ttlMs(): number {
  return env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  tenantId: string,
  role: "admin" | "mecanico",
  database: Database = db,
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs());
  await database.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    tenantId,
    role,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Resolve a session token to its context. Returns null if missing, expired, or
 * if the user/tenant was deactivated. Cross-checks the user is still active.
 */
export async function resolveSession(
  token: string,
  database: Database = db,
): Promise<SessionContext | null> {
  if (!token) return null;
  const rows = await database
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      userName: users.name,
      tenantId: sessions.tenantId,
      role: sessions.role,
      expiresAt: sessions.expiresAt,
      userActive: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await database.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }
  if (!row.userActive) return null;

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    userName: row.userName,
    tenantId: row.tenantId,
    role: row.role,
  };
}

export async function destroySession(
  token: string,
  database: Database = db,
): Promise<void> {
  if (!token) return;
  await database.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Housekeeping: drop expired sessions. */
export async function purgeExpiredSessions(
  database: Database = db,
): Promise<void> {
  await database.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export function cookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
