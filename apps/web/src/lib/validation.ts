/** Field validation + input sanitizers for the workshop forms. */

/** Argentine plates: old AAA123 / AAA 123 and Mercosur AB123CD. Case-insensitive. */
const PLATE_OLD = /^[A-Z]{3}\s?\d{3}$/;
const PLATE_MERCOSUR = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

export function normalizePlate(v: string): string {
  return v.toUpperCase().replace(/\s+/g, " ").trim();
}

export function isValidPlate(v: string): boolean {
  const p = normalizePlate(v).replace(/\s/g, "");
  return PLATE_OLD.test(p) || PLATE_MERCOSUR.test(p);
}

/** Keep digits only (kilometraje, teléfono, cantidades enteras). */
export function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/** Money input: allow digits + one decimal separator. Returns a clean string. */
export function sanitizeMoney(v: string): string {
  return v.replace(/[^\d.,]/g, "").replace(",", ".");
}

export function toNumber(v: string): number {
  const n = Number(sanitizeMoney(v));
  return Number.isFinite(n) ? n : 0;
}

export function isValidPhone(v: string): boolean {
  const d = digitsOnly(v);
  return d.length >= 8 && d.length <= 15;
}

export interface FieldErrors {
  [field: string]: string | undefined;
}

/** Returns the first error message for a set of rules, or undefined. */
export function required(value: string | number | null | undefined, label = "Campo"): string | undefined {
  if (value === null || value === undefined) return `${label} es obligatorio`;
  if (typeof value === "string" && value.trim() === "") return `${label} es obligatorio`;
  return undefined;
}
