import "server-only";
// Deterministic query engine behind the WC Intelligence chat tools and
// dashboard. Every number returned here is either a stored workbook cell
// or computed in code from stored cells — the LLM only relays results.

import type { WcxSbu, WcxUpload } from "@/db";
import {
  getActiveUpload,
  getFacts,
  listSbusForUpload,
} from "@/lib/db/queries/wc-intelligence";
import {
  buildIndex,
  derivedAt,
  derivedForPeriod,
  aggregateMetric,
  valueAt,
  type FactsIndex,
} from "./derive";
import {
  fiscalYearMonths,
  isMonth,
  metricByKey,
  monthRange,
  WCX_GROUP_CODE,
  type WcxMetricDef,
} from "./metrics";

export const GROUP_AGG = "__GROUP__";

export type WcxContext = {
  upload: WcxUpload;
  sbus: WcxSbu[];
};

export async function wcxContext(): Promise<WcxContext | null> {
  const upload = await getActiveUpload();
  if (!upload) return null;
  const sbus = await listSbusForUpload(upload.id);
  return { upload, sbus };
}

export function provenanceOf(upload: WcxUpload, def: WcxMetricDef | null) {
  return {
    source: `${upload.filename} (uploaded ${upload.createdAt.toISOString().slice(0, 10)})`,
    coverage: `${upload.periodStart} → ${upload.periodEnd}`,
    sheet: def?.sheet ?? null,
    metricLabel: def?.label ?? null,
  };
}

// SBU resolution: exact code, exact name, or case-insensitive prefix.
export function resolveSbu(
  sbus: WcxSbu[],
  query: string,
): { code: string | null; alternatives: string[] } {
  const q = query.trim().toLowerCase();
  if (q === "group" || q === "all" || q === "total" || q === WCX_GROUP_CODE.toLowerCase()) {
    return { code: GROUP_AGG, alternatives: [] };
  }
  // Exact CODE match always wins — codes are the canonical identity. Name
  // matching is a fallback only (workbooks can carry stale/duplicated
  // display names in Sheet 1).
  const exactCode = sbus.find((s) => s.code.toLowerCase() === q);
  if (exactCode) return { code: exactCode.code, alternatives: [] };
  const exactName = sbus.find((s) => s.name.toLowerCase() === q);
  if (exactName) return { code: exactName.code, alternatives: [] };
  const partial = sbus.filter(
    (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );
  if (partial.length === 1) return { code: partial[0]!.code, alternatives: [] };
  return { code: null, alternatives: partial.map((s) => s.code) };
}

// "2025-12" → single month · "FY-2025" / "2025" → calendar year.
export function parsePeriod(
  raw: string,
): { months: string[]; label: string } | null {
  const s = raw.trim();
  if (isMonth(s)) return { months: [s], label: s };
  const fy = fiscalYearMonths(s);
  if (fy) return { months: fy, label: `FY-${fy[0]!.slice(0, 4)}` };
  const range = /^(\d{4}-\d{2})\s*(?:\.\.|to|→|-)\s*(\d{4}-\d{2})$/i.exec(s);
  if (range && isMonth(range[1]!) && isMonth(range[2]!)) {
    const months = monthRange(range[1]!, range[2]!);
    if (months.length > 0) return { months, label: `${range[1]} → ${range[2]}` };
  }
  return null;
}

// Base metrics needed to compute each derived metric, used to keep DB
// fetches narrow.
const DERIVED_DEPS: Record<string, string[]> = {
  "derived.nwc": ["bs.inventory_net", "bs.trade_receivables", "bs.contract_assets", "bs.trade_payables"],
  "derived.dio": ["bs.inventory_net", "pl.cogs_total", "pl.cogs_materials", "pl.cogs_labor", "pl.cogs_overhead", "pl.cogs_subcontracted"],
  "derived.dso": ["bs.trade_receivables", "bs.contract_assets", "pl.revenue_invoiced"],
  "derived.dpo": ["bs.trade_payables", "pl.cogs_total", "pl.cogs_materials", "pl.cogs_labor", "pl.cogs_overhead", "pl.cogs_subcontracted"],
  "derived.gross_margin_pct": ["pl.revenue_invoiced", "pl.cogs_total", "pl.cogs_materials", "pl.cogs_labor", "pl.cogs_overhead", "pl.cogs_subcontracted"],
};
DERIVED_DEPS["derived.ccc"] = [
  ...new Set([...DERIVED_DEPS["derived.dio"]!, ...DERIVED_DEPS["derived.dso"]!, ...DERIVED_DEPS["derived.dpo"]!]),
];
DERIVED_DEPS["derived.ocf"] = [
  "cf.collections", "cf.supplier_payments", "cf.payroll", "cf.opex",
  "cf.tax_zakat", "cf.interest", "cf.other_operating",
];

export function metricDeps(metricKey: string): string[] {
  return DERIVED_DEPS[metricKey] ?? [metricKey];
}

export async function loadIndex(
  uploadId: string,
  metricKeys: string[],
  sbuCodes?: string[],
): Promise<FactsIndex> {
  const keys = [...new Set(metricKeys.flatMap(metricDeps))];
  const facts = await getFacts(uploadId, {
    metricKeys: keys,
    sbuCodes: sbuCodes?.includes(GROUP_AGG) ? undefined : sbuCodes,
  });
  return buildIndex(facts);
}

// Collapse all SBUs into a synthetic GROUP_AGG entity whose per-month value
// for each metric is the cross-SBU sum. Derived formulas then run on the
// summed components — group CCC comes from group balances over group flows,
// not an average of per-SBU CCCs.
export function withGroupAggregate(
  idx: FactsIndex,
  sbuCodes: string[],
  metricKeys: string[],
): FactsIndex {
  const keys = [...new Set(metricKeys.flatMap(metricDeps))];
  const groupMetrics = new Map<string, Map<string, number>>();
  for (const key of keys) {
    const byMonth = new Map<string, number>();
    for (const sbu of sbuCodes) {
      const metric = idx.get(sbu)?.get(key);
      if (!metric) continue;
      for (const [month, value] of metric) {
        byMonth.set(month, (byMonth.get(month) ?? 0) + value);
      }
    }
    if (byMonth.size > 0) groupMetrics.set(key, byMonth);
  }
  idx.set(GROUP_AGG, groupMetrics);
  return idx;
}

export type WcxValue = {
  value: number;
  basis: string;
};

// Single resolved value for (entity, metric, period). Entity may be a SBU
// code, GROUP_AGG, or the literal GROUP (sheet-12 macro rows).
export function computeValue(
  idx: FactsIndex,
  entity: string,
  metricKey: string,
  months: string[],
): WcxValue | null {
  const def = metricByKey(metricKey);
  if (!def) return null;

  if (metricKey.startsWith("derived.")) {
    const res =
      months.length === 1
        ? derivedAt(idx, entity, metricKey, months[0]!)
        : derivedForPeriod(idx, entity, metricKey, months);
    return res ? { value: res.value, basis: res.basis } : null;
  }

  if (months.length === 1) {
    const v = valueAt(idx, entity, metricKey, months[0]!);
    return v === null
      ? null
      : { value: v, basis: `exact workbook cell · ${def.sheet} · ${months[0]}` };
  }

  const agg = aggregateMetric(idx, entity, metricKey, months);
  if (!agg) return null;
  const ruleText =
    agg.agg === "sum"
      ? `sum of ${agg.monthsUsed} monthly values (flow metric)`
      : agg.agg === "avg"
        ? `average of ${agg.monthsUsed} monthly values (rate metric)`
        : agg.agg === "sop"
          ? "start-of-period value (opening balance)"
          : "end-of-period value (balance metric — balances are not summed across months)";
  return { value: agg.value, basis: `${ruleText} · ${def.sheet}` };
}

// True when a stored metric can be meaningfully summed across SBUs.
export function isGroupable(metricKey: string): boolean {
  if (metricKey.startsWith("derived.")) return true;
  if (metricKey.startsWith("macro.")) return false; // group-level already
  const def = metricByKey(metricKey);
  return def ? def.agg === "sum" || def.agg === "eop" || def.agg === "sop" : false;
}

export function isMacroMetric(metricKey: string): boolean {
  return metricKey.startsWith("macro.");
}
