// Low-level grid utilities shared by the workbook parser. The workbook's
// matrix sheets are "blocks": an `SBU: <code>` marker row, a header row
// whose cells contain `YYYY-MM` month labels, then one row per metric.

import * as XLSX from "xlsx";
import { isMonth } from "./metrics";

export type Grid = Array<Array<unknown>>;

export function sheetToGrid(wb: XLSX.WorkBook, name: string): Grid | null {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as Grid;
}

export function cellString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

// "  SBU: ATC" → "ATC"
export function sbuMarker(v: unknown): string | null {
  const s = cellString(v);
  if (!s || !s.startsWith("SBU:")) return null;
  const code = s.slice("SBU:".length).trim();
  return code || null;
}

// "— SALES SIDE —" style separators inside metric columns.
export function isSectionHeader(label: string): boolean {
  return /^[—–-].*[—–-]$/.test(label.trim());
}

// Month header cells are strings ("2023-01") in the source workbook, but
// guard against Excel re-typing them as Date objects.
export function monthFromCell(v: unknown): string | null {
  if (typeof v === "string" && isMonth(v.trim())) return v.trim();
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

// Map of column index → month for a header row; null when the row isn't a
// month header (fewer than 2 month-shaped cells).
export function monthColumns(row: Array<unknown>): Map<number, string> | null {
  const cols = new Map<number, string>();
  row.forEach((cell, idx) => {
    const month = monthFromCell(cell);
    if (month) cols.set(idx, month);
  });
  return cols.size >= 2 ? cols : null;
}

// Numbers come through as JS numbers; tolerate numeric strings with
// thousands separators. Everything else (text, booleans, dates) is not a
// fact value.
export function coerceNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Header cells → record keys: keep them human-readable but stable.
export function recordKey(header: string): string {
  return header.replace(/\s+/g, " ").trim();
}

export function rowToRecord(
  header: string[],
  row: Array<unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  let nonEmpty = 0;
  header.forEach((key, idx) => {
    if (!key) return;
    const v = row[idx];
    if (v === null || v === undefined || v === "") return;
    out[key] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
    nonEmpty += 1;
  });
  return nonEmpty > 0 ? out : null;
}
