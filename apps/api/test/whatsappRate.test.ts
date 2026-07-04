import { describe, expect, it } from "vitest";
import { PhoneRateLimiter } from "../src/whatsapp/rateLimiter.js";

describe("PhoneRateLimiter", () => {
  it("allows N then blocks within the window", () => {
    const rl = new PhoneRateLimiter(3, 60_000);
    let t = 1_000_000;
    const now = () => t;
    expect(rl.allow("549111", now)).toBe(true);
    expect(rl.allow("549111", now)).toBe(true);
    expect(rl.allow("549111", now)).toBe(true);
    expect(rl.allow("549111", now)).toBe(false); // 4º bloqueado
    t += 61_000;
    expect(rl.allow("549111", now)).toBe(true); // ventana pasó
  });
});
