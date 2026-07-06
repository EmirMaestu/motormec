/** Patentes argentinas: viejo AAA000 (3 letras + 3 números) y Mercosur AA000AA. */
const VIEJO = /^[A-Z]{3}\d{3}$/;
const MERCOSUR = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

export function normalizarPatente(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function esPatenteValida(raw: string): boolean {
  const p = normalizarPatente(raw);
  return VIEJO.test(p) || MERCOSUR.test(p);
}
