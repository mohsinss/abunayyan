// Parser for the Abunayyan WC Data Collection workbook (fixed format,
// 18 sheets). Strict by design: metric labels must match the registry in
// lib/wcx/metric-defs.ts exactly (after normalization); anything else is
// reported in `unknownLabels` and never guessed.

import * as XLSX from "xlsx";
import { z } from "zod";
import { metricBySheetLabel, isMonth, WCX_GROUP_CODE, WCX_SHEETS } from "./metrics";
import {
  cellString,
  coerceNumber,
  isSectionHeader,
  monthColumns,
  recordKey,
  rowToRecord,
  sbuMarker,
  sheetToGrid,
  type Grid,
} from "./parse-helpers";

export class WorkbookFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookFormatError";
  }
}

export type ParsedFact = { sbuCode: string; metricKey: string; month: string; value: number };
export type ParsedRecord = {
  sbuCode: string;
  sheet: string;
  recordIndex: number;
  data: Record<string, unknown>;
};
export type ParsedSbu = { code: string; name: string; pillar: string | null; displayOrder: number };
export type ParsedTarget = {
  sbuCode: string;
  targetInventory: number | null;
  targetAr: number | null;
  targetContractAssets: number | null;
  targetAp: number | null;
  targetDio: number | null;
  targetDso: number | null;
  targetDpo: number | null;
  targetCashReleased: number | null;
  notes: string | null;
};

export type ParsedWorkbook = {
  sbus: ParsedSbu[];
  facts: ParsedFact[];
  records: ParsedRecord[];
  targets: ParsedTarget[];
  months: string[];
  unknownLabels: Array<{ sheet: string; label: string }>;
};

const FactSchema = z.object({
  sbuCode: z.string().min(1).max(32),
  metricKey: z.string().min(1).max(64),
  month: z.string().refine(isMonth, "month must be YYYY-MM"),
  value: z.number().finite(),
});

const MATRIX_SHEETS = [
  WCX_SHEETS.pl,
  WCX_SHEETS.bs,
  WCX_SHEETS.ar,
  WCX_SHEETS.ap,
  WCX_SHEETS.inv,
  WCX_SHEETS.drv,
  WCX_SHEETS.cf,
] as const;

const RECORD_SHEETS = [
  "7_Top_Customers",
  "8_Top_Vendors",
  "9_Project_Register",
  "13_Benchmarks",
  "15_Data_Quality",
  "16_Org_Structure",
] as const;

export function parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
  const unknownLabels: Array<{ sheet: string; label: string }> = [];
  const seenUnknown = new Set<string>();
  const reportUnknown = (sheet: string, label: string) => {
    const k = `${sheet}::${label}`;
    if (seenUnknown.has(k)) return;
    seenUnknown.add(k);
    unknownLabels.push({ sheet, label });
  };

  const sbus = parseIdentity(wb);
  if (sbus.length === 0) {
    throw new WorkbookFormatError("Sheet 1_SBU_Identity is missing or has no SBU columns");
  }

  const facts: ParsedFact[] = [];
  const records: ParsedRecord[] = [];

  // Per-SBU matrix sheets (each block has its own month header row).
  for (const sheet of MATRIX_SHEETS) {
    const grid = sheetToGrid(wb, sheet);
    if (!grid) throw new WorkbookFormatError(`Missing sheet ${sheet}`);
    facts.push(...scanMatrix(grid, sheet, null, reportUnknown));
  }

  // Sheet 12 is group-level: no SBU markers, single header.
  const macroGrid = sheetToGrid(wb, WCX_SHEETS.macro);
  if (!macroGrid) throw new WorkbookFormatError(`Missing sheet ${WCX_SHEETS.macro}`);
  facts.push(...scanMatrix(macroGrid, WCX_SHEETS.macro, WCX_GROUP_CODE, reportUnknown));

  // Identity fields kept verbatim as records for provenance queries.
  records.push(...identityRecords(wb));

  for (const sheet of RECORD_SHEETS) {
    const grid = sheetToGrid(wb, sheet);
    if (!grid) continue;
    records.push(...scanRecords(grid, sheet));
  }

  const submission = sheetToGrid(wb, "17_Submission_Log");
  if (submission) records.push(...scanFlatRecords(submission, "17_Submission_Log"));

  const plan = parseTargetsPlan(wb, reportUnknown);
  facts.push(...plan.budgetFacts);
  records.push(...plan.forecastRecords);

  for (const f of facts) FactSchema.parse(f);

  const months = [...new Set(facts.filter((f) => !f.metricKey.startsWith("budget.")).map((f) => f.month))].sort();

  return { sbus, facts, records, targets: plan.targets, months, unknownLabels };
}

// ── Sheet 1: identity (fields as rows, SBUs as columns) ─────────────────
function identityHeader(grid: Grid): { row: number; codes: string[] } | null {
  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    if (cellString(grid[i]?.[0]) === "Field") {
      const codes = (grid[i] ?? []).slice(1).map((c) => cellString(c) ?? "").filter(Boolean);
      return { row: i, codes };
    }
  }
  return null;
}

function parseIdentity(wb: XLSX.WorkBook): ParsedSbu[] {
  const grid = sheetToGrid(wb, "1_SBU_Identity");
  if (!grid) return [];
  const header = identityHeader(grid);
  if (!header) return [];

  const fields = new Map<string, Array<unknown>>();
  for (let i = header.row + 1; i < grid.length; i++) {
    const label = cellString(grid[i]?.[0]);
    if (label) fields.set(label, (grid[i] ?? []).slice(1));
  }

  const names = fields.get("SBU Name") ?? [];
  const pillarRow = [...fields.entries()].find(([k]) => k.startsWith("Pillar"))?.[1] ?? [];

  return header.codes.map((code, idx) => ({
    code,
    name: cellString(names[idx]) ?? code,
    pillar: cellString(pillarRow[idx]),
    displayOrder: idx,
  }));
}

function identityRecords(wb: XLSX.WorkBook): ParsedRecord[] {
  const grid = sheetToGrid(wb, "1_SBU_Identity");
  if (!grid) return [];
  const header = identityHeader(grid);
  if (!header) return [];
  return header.codes.map((code, idx) => {
    const data: Record<string, unknown> = {};
    for (let i = header.row + 1; i < grid.length; i++) {
      const label = cellString(grid[i]?.[0]);
      const v = grid[i]?.[idx + 1];
      if (label && v !== null && v !== undefined && v !== "") data[recordKey(label)] = v;
    }
    return { sbuCode: code, sheet: "1_SBU_Identity", recordIndex: idx, data };
  });
}

// ── Matrix scanner ───────────────────────────────────────────────────────
// Walks rows top→bottom: SBU markers switch the current block, month-header
// rows switch the column map, every other labelled row is a metric row.
function scanMatrix(
  grid: Grid,
  sheet: string,
  fixedSbu: string | null,
  reportUnknown: (_sheet: string, _label: string) => void,
  rowFrom = 0,
  rowTo = grid.length,
): ParsedFact[] {
  const out: ParsedFact[] = [];
  let sbu = fixedSbu;
  let cols: Map<number, string> | null = null;

  for (let i = rowFrom; i < rowTo; i++) {
    const row = grid[i] ?? [];
    const marker = sbuMarker(row[0]);
    if (marker) {
      sbu = marker;
      continue;
    }
    const header = monthColumns(row);
    if (header) {
      cols = header;
      continue;
    }
    const label = cellString(row[0]);
    if (!label || !cols || !sbu) continue;
    if (isSectionHeader(label)) continue;
    // Skip the sheet banner / instructions rows above the first header.
    if (/^(SHEET |OWNER|INSTRUCTIONS)/i.test(label)) continue;

    const metric = metricBySheetLabel(sheet, label);
    if (!metric) {
      reportUnknown(sheet, label);
      continue;
    }
    for (const [colIdx, month] of cols) {
      const value = coerceNumber(row[colIdx]);
      if (value === null) continue;
      out.push({ sbuCode: sbu, metricKey: metric.key, month, value });
    }
  }
  return out;
}

// ── Record sheets (blocks of header + data rows per SBU) ────────────────
function scanRecords(grid: Grid, sheet: string): ParsedRecord[] {
  const out: ParsedRecord[] = [];
  let sbu: string | null = null;
  let header: string[] | null = null;
  let index = 0;

  for (const row of grid) {
    const marker = sbuMarker(row[0]);
    if (marker) {
      sbu = marker;
      header = null;
      index = 0;
      continue;
    }
    if (!sbu) continue;
    if (!header) {
      // First non-empty row after the marker is the column header.
      const cells = row.map((c) => cellString(c) ?? "");
      if (cells.filter(Boolean).length >= 3) header = cells.map(recordKey);
      continue;
    }
    const data = rowToRecord(header, row);
    if (!data) continue;
    out.push({ sbuCode: sbu, sheet, recordIndex: index++, data });
  }
  return out;
}

// Flat sheets with an "SBU" first column (17_Submission_Log).
function scanFlatRecords(grid: Grid, sheet: string): ParsedRecord[] {
  const out: ParsedRecord[] = [];
  const headerRow = grid.findIndex((r) => cellString(r[0]) === "SBU");
  if (headerRow < 0) return out;
  const header = (grid[headerRow] ?? []).map((c) => recordKey(cellString(c) ?? ""));
  let index = 0;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const sbu = cellString(grid[i]?.[0]);
    if (!sbu) continue;
    const data = rowToRecord(header, grid[i] ?? []);
    if (!data) continue;
    out.push({ sbuCode: sbu, sheet, recordIndex: index++, data });
  }
  return out;
}

// ── Sheet 14: targets table + FY-26 budget matrix + 13-week forecast ────
function parseTargetsPlan(
  wb: XLSX.WorkBook,
  reportUnknown: (_sheet: string, _label: string) => void,
): { targets: ParsedTarget[]; budgetFacts: ParsedFact[]; forecastRecords: ParsedRecord[] } {
  const sheet = "14_Targets_Plan";
  const grid = sheetToGrid(wb, sheet);
  if (!grid) throw new WorkbookFormatError(`Missing sheet ${sheet}`);

  const sectionRow = (needle: string) =>
    grid.findIndex((r) => (cellString(r[0]) ?? "").toUpperCase().startsWith(needle));

  const targetsStart = sectionRow("OPERATIONAL TARGETS");
  const budgetStart = sectionRow("FY-26 BUDGET");
  const forecastStart = sectionRow("13-WEEK");

  const targets: ParsedTarget[] = [];
  if (targetsStart >= 0) {
    const headerRow = grid.findIndex(
      (r, i) => i > targetsStart && cellString(r[0]) === "SBU",
    );
    for (let i = headerRow + 1; i >= 1 && i < grid.length; i++) {
      const code = cellString(grid[i]?.[0]);
      if (!code || code.toUpperCase() === "TOTAL") break;
      const row = grid[i] ?? [];
      targets.push({
        sbuCode: code,
        targetInventory: coerceNumber(row[1]),
        targetAr: coerceNumber(row[2]),
        targetContractAssets: coerceNumber(row[3]),
        targetAp: coerceNumber(row[4]),
        targetDio: coerceNumber(row[5]),
        targetDso: coerceNumber(row[6]),
        targetDpo: coerceNumber(row[7]),
        // row[8] is "Target CCC (calc)" — recomputed in code, not stored.
        targetCashReleased: coerceNumber(row[9]),
        notes: typeof row[10] === "string" ? row[10] : null,
      });
    }
  }

  const budgetFacts =
    budgetStart >= 0
      ? scanMatrix(
          grid,
          sheet,
          null,
          reportUnknown,
          budgetStart,
          forecastStart > budgetStart ? forecastStart : grid.length,
        )
      : [];

  // 13-week forecast: shared header (W+1 … W+13), SBU blocks of line items.
  const forecastRecords: ParsedRecord[] = [];
  if (forecastStart >= 0) {
    const headerRowIdx = grid.findIndex(
      (r, i) => i > forecastStart && (cellString(r[0]) ?? "").startsWith("SBU / Line Item"),
    );
    if (headerRowIdx > 0) {
      const weekKeys = (grid[headerRowIdx] ?? [])
        .map((c, idx) => ({ key: cellString(c), idx }))
        .filter((c) => c.key?.startsWith("W+"));
      let sbu: string | null = null;
      let index = 0;
      for (let i = headerRowIdx + 1; i < grid.length; i++) {
        const row = grid[i] ?? [];
        const marker = sbuMarker(row[0]);
        if (marker) {
          sbu = marker;
          index = 0;
          continue;
        }
        const label = cellString(row[0]);
        if (!label || !sbu) continue;
        const weeks: Record<string, number> = {};
        for (const { key, idx } of weekKeys) {
          const v = coerceNumber(row[idx]);
          if (key && v !== null) weeks[key] = v;
        }
        if (Object.keys(weeks).length === 0) continue;
        forecastRecords.push({
          sbuCode: sbu,
          sheet: "14_Cash_Forecast",
          recordIndex: index++,
          data: { lineItem: label, ...weeks },
        });
      }
    }
  }

  return { targets, budgetFacts, forecastRecords };
}
