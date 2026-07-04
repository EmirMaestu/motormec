import { describe, expect, it } from "vitest";
import { isStaleMessage } from "../src/routes/webhook.js";

// BOT-6: anti-replay. `isStaleMessage` es pura y determinística (now inyectable).
describe("isStaleMessage (anti-replay por timestamp)", () => {
  // now fijo: 2026-07-04T00:00:00Z en ms.
  const now = Date.parse("2026-07-04T00:00:00Z");
  // El timestamp de WhatsApp viene en SEGUNDOS Unix.
  const nowSec = Math.floor(now / 1000);

  it("descarta un mensaje viejo (más de 5 min)", () => {
    const seisMinAtras = String(nowSec - 6 * 60);
    expect(isStaleMessage(seisMinAtras, now)).toBe(true);
  });

  it("NO descarta un mensaje reciente (dentro de los 5 min)", () => {
    const cuatroMinAtras = String(nowSec - 4 * 60);
    expect(isStaleMessage(cuatroMinAtras, now)).toBe(false);
  });

  it("NO descarta un mensaje del instante actual", () => {
    expect(isStaleMessage(String(nowSec), now)).toBe(false);
  });

  it("NO descarta si el timestamp no es un número finito (no podemos afirmar que sea viejo)", () => {
    expect(isStaleMessage(undefined, now)).toBe(false);
    expect(isStaleMessage("no-es-numero", now)).toBe(false);
  });
});
