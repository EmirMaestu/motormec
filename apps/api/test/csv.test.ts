import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "../src/lib/csv.js";

describe("csv sanitization", () => {
  it("prefixes formula-triggering cells with a quote", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("\"'=SUM(A1:A9)\"");
    expect(csvCell("+1")).toBe("\"'+1\"");
    expect(csvCell("@cmd")).toBe("\"'@cmd\"");
    expect(csvCell("-2")).toBe("\"'-2\"");
  });
  it("quotes cells with commas/quotes/newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });
  it("leaves plain cells and numbers alone", () => {
    expect(csvCell("Juan")).toBe("Juan");
    expect(csvCell(1500)).toBe("1500");
  });
  it("joins a row", () => {
    expect(csvRow(["Juan", "=1", 10])).toBe("Juan,\"'=1\",10");
  });
});
