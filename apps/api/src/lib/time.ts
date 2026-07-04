/**
 * Helpers de fecha en horario de Argentina (UTC-3, sin DST desde 2009).
 * El servidor corre en UTC; estas funciones convierten a hora local AR para que
 * "hoy", "este mes" y los calendarios diarios coincidan con el usuario.
 */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Instante desplazado -3h; leer sus componentes con getUTC* da la hora AR. */
export function argDate(d: Date = new Date()): Date {
  return new Date(d.getTime() - AR_OFFSET_MS);
}

/** "YYYY-MM-DD" en hora AR. */
export function argYmd(d: Date = new Date()): string {
  return argDate(d).toISOString().slice(0, 10);
}

/** "YYYY-MM" en hora AR (para períodos mensuales / usage). */
export function argMonth(d: Date = new Date()): string {
  return argDate(d).toISOString().slice(0, 7);
}
