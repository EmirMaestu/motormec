/**
 * Comparación de números de teléfono para el ruteo del bot.
 *
 * Momec usa UN solo número de WhatsApp para todos los talleres; el ruteo se hace
 * por el REMITENTE (el número del empleado). Los números pueden estar guardados
 * en distintos formatos (con/sin código de país, con 9/15, con 0), así que
 * comparamos por los últimos dígitos significativos (área + local).
 */

/** Clave de comparación: últimos 10 dígitos (área + local en Argentina). */
export function numberKey(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-10);
}

/** true si dos números representan el mismo abonado (match tolerante de formato). */
export function sameNumber(a: string, b: string): boolean {
  const ka = numberKey(a);
  const kb = numberKey(b);
  return ka.length >= 7 && ka === kb;
}
