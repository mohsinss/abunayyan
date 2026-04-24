import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsx } from "@/lib/datasets/parsers/xlsx";
import { parseFile, UnsupportedFileError } from "@/lib/datasets/parsers";

function buildXlsx(rows: Array<Record<string, unknown>>, sheetName = "Data"): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return buf;
}

describe("parseXlsx", () => {
  it("returns one row per data row with sheet + rowIndex + data", () => {
    const buf = buildXlsx([
      { name: "Alice", age: 30, active: true },
      { name: "Bob", age: 45, active: false },
    ]);

    const result = parseXlsx(buf);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      sheet: "Data",
      rowIndex: 0,
      data: { name: "Alice", age: 30, active: true },
    });
    expect(result.rows[1]?.data).toMatchObject({ name: "Bob", age: 45 });
  });

  it("emits one summary chunk per sheet with row + column counts", () => {
    const buf = buildXlsx([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, b: 6 },
    ]);
    const result = parseXlsx(buf);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toMatch(/3 rows/);
    expect(result.chunks[0]).toMatch(/2 columns/);
    expect(result.chunks[0]).toMatch(/a, b/);
  });

  it("handles empty sheets without blowing up", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "Empty");
    const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = parseXlsx(buf);
    expect(result.rows).toHaveLength(0);
    expect(result.chunks[0]).toMatch(/0 rows/);
  });

  it("parses CSV content via the same pipeline", () => {
    const csv = "name,age\nAlice,30\nBob,45\n";
    const buf = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    const result = parseXlsx(buf);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.data).toMatchObject({ name: "Alice", age: 30 });
  });
});

describe("parseFile dispatch", () => {
  it("rejects unknown mimes with UnsupportedFileError", async () => {
    await expect(parseFile(new ArrayBuffer(0), "image/png", "logo.png")).rejects.toBeInstanceOf(
      UnsupportedFileError,
    );
  });

  it("dispatches to xlsx parser by extension when mime is generic", async () => {
    const buf = buildXlsx([{ x: 1 }]);
    const result = await parseFile(buf, "application/octet-stream", "data.xlsx");
    expect(result.rows).toHaveLength(1);
  });
});
