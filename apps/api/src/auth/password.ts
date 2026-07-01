import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

/**
 * PBKDF2-HMAC-SHA256 password hashing.
 *
 * Stored format: `pbkdf2$<iterations>$<salt-base64>$<hash-base64>`
 * Verification uses timingSafeEqual to avoid timing leaks.
 */
const DEFAULT_ITERATIONS = 210_000; // OWASP 2023 guidance for PBKDF2-SHA256
const KEYLEN = 32;
const DIGEST = "sha256";
const SALT_BYTES = 16;

export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await pbkdf2Async(password, salt, iterations, KEYLEN, DIGEST);
  return [
    "pbkdf2",
    iterations,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export interface VerifyResult {
  valid: boolean;
  /** True when the stored hash uses params weaker than current defaults. */
  needsRehash: boolean;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<VerifyResult> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return { valid: false, needsRehash: false };
  }
  const iterations = Number.parseInt(parts[1] as string, 10);
  const salt = Buffer.from(parts[2] as string, "base64");
  const expected = Buffer.from(parts[3] as string, "base64");
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return { valid: false, needsRehash: false };
  }

  const derived = await pbkdf2Async(
    password,
    salt,
    iterations,
    expected.length,
    DIGEST,
  );

  const valid =
    derived.length === expected.length && timingSafeEqual(derived, expected);

  return {
    valid,
    needsRehash: valid && iterations < DEFAULT_ITERATIONS,
  };
}
