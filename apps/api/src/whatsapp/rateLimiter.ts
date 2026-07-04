/**
 * Rate limiter en memoria por número de teléfono (ventana deslizante simple).
 * NOTA: al escalar a múltiples procesos (plan 08) hay que mover esto a Redis; con
 * un solo proceso alcanza. `now` es inyectable para testear.
 */
export class PhoneRateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = 10, private windowMs = 60_000) {}
  allow(phone: string, now: () => number = Date.now): boolean {
    const t = now();
    const arr = (this.hits.get(phone) ?? []).filter((ts) => t - ts < this.windowMs);
    if (arr.length >= this.max) {
      this.hits.set(phone, arr);
      return false;
    }
    arr.push(t);
    this.hits.set(phone, arr);
    return true;
  }
}
