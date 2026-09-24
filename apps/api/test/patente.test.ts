import { describe, expect, it } from "vitest";
import {
  esPatenteAceptable,
  esPatenteExtranjeraValida,
  esPatenteValida,
  normalizarPatente,
} from "../src/whatsapp/patente.js";

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

describe("patente extranjera", () => {
  it("acepta formatos de países vecinos (Uruguay, Chile, Brasil, Paraguay)", () => {
    expect(esPatenteExtranjeraValida("JY0 9670")).toBe(true); // caso real de producción
    expect(esPatenteExtranjeraValida("SBA 1234")).toBe(true); // Uruguay
    expect(esPatenteExtranjeraValida("BBBB12")).toBe(true); // Chile
    expect(esPatenteExtranjeraValida("ABC1D23")).toBe(true); // Brasil Mercosur
  });
  it("sigue rechazando basura aunque sea extranjera", () => {
    expect(esPatenteExtranjeraValida("XXX")).toBe(false); // sin números
    expect(esPatenteExtranjeraValida("1234")).toBe(false); // sin letras
    expect(esPatenteExtranjeraValida("A1")).toBe(false); // muy corta
    expect(esPatenteExtranjeraValida("ABCDEFG123456")).toBe(false); // muy larga
  });
  it("esPatenteAceptable: sin marca de extranjera exige formato argentino", () => {
    expect(esPatenteAceptable("JY09670", false)).toBe(false);
    expect(esPatenteAceptable("JY09670", true)).toBe(true);
    expect(esPatenteAceptable("AB123CD", false)).toBe(true);
  });
});
