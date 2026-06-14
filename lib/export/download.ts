"use client";

// Client-side export helpers. CSV is built inline (cheap, reuses the
// RFC-4180 field encoder shared with the server-side audit export). Excel
// uses SheetJS, dynamically imported so the ~zero-cost CSV path doesn't
// pull the heavy xlsx bundle into the initial page load — it's fetched
// only when a user actually clicks "Export to Excel".

import { csvRow } from "@/lib/text/csv";

type Cell = string | number | null | undefined;
type Rows = ReadonlyArray<ReadonlyArray<Cell>>;

function ensureExt(filename: string, ext: string): string {
  return filename.toLowerCase().endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a single table as a CSV file. A UTF-8 BOM is prepended so Excel
 *  opens non-ASCII (e.g. SAR figures, Arabic SBU names) with the right
 *  encoding instead of mojibake. */
export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: Rows,
): void {
  const head = headers.length ? csvRow(headers) : "";
  const body = rows.map((r) => csvRow(r)).join("");
  triggerDownload(
    new Blob(["﻿" + head + body], { type: "text/csv;charset=utf-8;" }),
    ensureExt(filename, "csv"),
  );
}

export type ExportSheet = {
  /** Excel sheet tab name — truncated to Excel's 31-char limit. */
  name: string;
  headers?: readonly string[];
  rows: Rows;
};

/** Download a multi-sheet Excel workbook. xlsx is imported lazily. */
export async function downloadWorkbook(filename: string, sheets: ExportSheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const sheet of sheets) {
    const aoa = sheet.headers ? [sheet.headers, ...sheet.rows] : sheet.rows;
    const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][]);
    // Sheet names must be unique and ≤31 chars; dedupe defensively.
    let name = sheet.name.slice(0, 31);
    let n = 2;
    while (usedNames.has(name)) name = `${sheet.name.slice(0, 28)} ${n++}`;
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, ensureExt(filename, "xlsx"));
}
