/**
 * Password strength policy. Enforced wherever a user password is set or changed
 * (tenant admin/user creation). Keep the rule minimal but non-trivial: a length
 * floor blocks the worst passwords without frustrating legitimate users.
 */
export function assertStrongPassword(pw: string): void {
  if (typeof pw !== "string" || pw.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
}
