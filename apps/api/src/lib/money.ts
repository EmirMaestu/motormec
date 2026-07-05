/** Convención: el dinero se guarda y se opera SIEMPRE en centavos (enteros). */
export const toCents = (pesos: number): number => Math.round(pesos * 100);
export const fromCents = (cents: number): number => cents / 100;

/** Formatea un monto en centavos como moneda argentina (ej. 123456 → "$ 1.235"). */
export function formatArs(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}
