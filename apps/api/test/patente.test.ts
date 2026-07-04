import { describe, expect, it } from "vitest";
import { esPatenteValida, normalizarPatente } from "../src/whatsapp/patente.js";

describe("patente AR", () => {
  it("acepta formato viejo AAA000 y Mercosur AA000AA", () => {
    expect(esPatenteValida("ABC123")).toBe(true);
    expect(esPatenteValida("AB123CD")).toBe(true);
    expect(esPatenteValida("ab 123 cd")).toBe(true); // normaliza espacios/case
  });
  it("rechaza basura", () => {
    expect(esPatenteValida("XXX")).toBe(false);
    expect(esPatenteValida("1")).toBe(false);
  });
  it("normaliza a mayúsculas sin espacios", () => {
    expect(normalizarPatente(" ab123cd ")).toBe("AB123CD");
  });
});
