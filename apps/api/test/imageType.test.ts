import { describe, expect, it } from "vitest";
import { detectImageType } from "../src/lib/imageType.js";

describe("detectImageType (magic bytes)", () => {
  it("detects PNG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageType(png)).toBe("image/png");
  });
  it("detects JPEG", () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageType(jpg)).toBe("image/jpeg");
  });
  it("returns null for a text file pretending to be png", () => {
    expect(detectImageType(Buffer.from("not an image at all"))).toBeNull();
  });
});
