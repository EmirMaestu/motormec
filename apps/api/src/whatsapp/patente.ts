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

/**
 * Patente extranjera (Uruguay ABC1234, Chile BBBB12, Brasil ABC1D23, Paraguay,
 * Bolivia…). Cada país tiene su formato, así que la regla es laxa pero no acepta
 * basura: 4 a 10 caracteres alfanuméricos, con al menos una letra y un número.
 */
export function esPatenteExtranjeraValida(raw: string): boolean {
  const p = normalizarPatente(raw);
  return p.length >= 4 && p.length <= 10 && /[A-Z]/.test(p) && /\d/.test(p);
}

/** Formato argentino, o el laxo si el usuario dijo que es una patente extranjera. */
export function esPatenteAceptable(raw: string, extranjera: boolean): boolean {
  return extranjera ? esPatenteExtranjeraValida(raw) : esPatenteValida(raw);
}
