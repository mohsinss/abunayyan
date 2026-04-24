import "server-only";
import * as XLSX from "xlsx";
import type { ParseResult, ParsedRow } from "./types";

// Handles .xlsx, .xls, and .csv via SheetJS — one parser, three mime types.
// Returns one row per data row (keyed by header), plus one short text chunk
// per sheet summarizing its shape so the chatbot can answer "what is this
// dataset" without pulling actual row data into the prompt.
export function parseXlsx(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const rows: ParsedRow[] = [];
  const chunks: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    // `sheet_to_json` with header-default mode returns `Record<string, unknown>`
    // per row using the first row as headers. `defval: null` forces empty cells
    // to null so JSON round-trips are consistent.
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    });

    for (let i = 0; i < json.length; i++) {
      rows.push({
        sheet: sheetName,
        rowIndex: i,
        data: json[i] ?? {},
      });
    }

    const firstRow = json[0];
    const columns = firstRow ? Object.keys(firstRow) : [];
    const sample = firstRow
      ? Object.entries(firstRow)
          .slice(0, 8)
          .map(([k, v]) => `${k}=${stringifyCell(v)}`)
          .join("; ")
      : "";
    const summary =
      `Sheet "${sheetName}" has ${json.length} row${json.length === 1 ? "" : "s"} ` +
      `and ${columns.length} column${columns.length === 1 ? "" : "s"}: ` +
      (columns.join(", ") || "(no columns detected)") +
      (sample ? `. First row sample: ${sample}.` : ".");
    chunks.push(summary);
  }

  return { rows, chunks };
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (v instanceof Date) return v.toISOString();
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}
