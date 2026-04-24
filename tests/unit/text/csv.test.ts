import { describe, expect, it } from "vitest";
import { csvField, csvRow } from "@/lib/text/csv";

describe("csvField", () => {
  it("returns empty string for null and undefined", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("passes through plain strings unquoted", () => {
    expect(csvField("hello")).toBe("hello");
  });

  it("quotes fields containing a comma", () => {
    expect(csvField("a,b")).toBe('"a,b"');
  });

  it("quotes fields containing a quote and escapes it", () => {
    expect(csvField('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes fields containing a newline", () => {
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes fields containing a carriage return", () => {
    expect(csvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("serializes numbers, booleans, and dates", () => {
    expect(csvField(42)).toBe("42");
    expect(csvField(true)).toBe("true");
    expect(csvField(new Date("2026-04-24T10:00:00Z"))).toBe(
      "2026-04-24T10:00:00.000Z",
    );
  });

  it("serializes objects as JSON and quotes them", () => {
    expect(csvField({ a: 1, b: "x,y" })).toMatch(/^".*"$/);
  });
});

describe("csvRow", () => {
  it("joins fields with a comma and terminates with CRLF", () => {
    expect(csvRow(["a", "b", 3])).toBe("a,b,3\r\n");
  });

  it("quotes individually when a field needs escaping", () => {
    expect(csvRow(["plain", "with,comma", 'q"q'])).toBe(
      'plain,"with,comma","q""q"\r\n',
    );
  });
});
