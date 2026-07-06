import { describe, expect, it } from "vitest";
import { argDate, argMonth, argYmd } from "../src/lib/time.js";

describe("Argentina time helpers (UTC-3)", () => {
  it("shifts a late-UTC instant back to the previous AR day", () => {
    // 2026-02-01T01:30:00Z  →  2026-01-31 22:30 ART
    const d = new Date("2026-02-01T01:30:00Z");
    expect(argYmd(d)).toBe("2026-01-31");
    expect(argMonth(d)).toBe("2026-01");
  });
  it("argDate returns a Date offset by -3h", () => {
    const d = new Date("2026-02-01T01:30:00Z");
    expect(argDate(d).getUTCHours()).toBe(22);
  });
});
