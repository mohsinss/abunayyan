// Semantic layer over the WC workbook: metric lookup by exact key, exact
// Excel label (sheet-scoped — labels repeat across sheets), or fuzzy
// synonym match for the chatbot. Also registers the derived metrics that
// are recomputed in code (never trusted from "(calc)" cells).

import {
  WCX_METRIC_DEFS,
  WCX_SHEETS,
  type WcxAgg,
  type WcxMetricDef,
} from "./metric-defs";

export { WCX_METRIC_DEFS, WCX_SHEETS };
export type { WcxAgg, WcxMetricDef };

export const WCX_GROUP_CODE = "GROUP";

// Derived metrics, computed by lib/wcx/derive.ts from stored facts. Marked
// with agg "none" because they must be recomputed at the requested grain,
// never summed/averaged from per-month values.
export type WcxDerivedDef = WcxMetricDef & { formula: string };

export const WCX_DERIVED_DEFS: WcxDerivedDef[] = [
  {
    key: "derived.nwc",
    sheet: "derived",
    label: "Net Working Capital (derived)",
    unit: "SAR",
    agg: "eop",
    formula: "Inventory net + Trade receivables + Contract assets − Trade payables",
    synonyms: ["nwc", "net working capital", "working capital"],
  },
  {
    key: "derived.dio",
    sheet: "derived",
    label: "DIO (derived, days)",
    unit: "days",
    agg: "none",
    formula: "Inventory net ÷ trailing-12-month COGS × 365",
    synonyms: ["dio", "days inventory outstanding", "inventory days"],
  },
  {
    key: "derived.dso",
    sheet: "derived",
    label: "DSO (derived, days)",
    unit: "days",
    agg: "none",
    formula: "(Trade receivables + Contract assets) ÷ trailing-12-month invoiced revenue × 365",
    synonyms: ["dso", "days sales outstanding", "collection days"],
  },
  {
    key: "derived.dpo",
    sheet: "derived",
    label: "DPO (derived, days)",
    unit: "days",
    agg: "none",
    formula: "Trade payables ÷ trailing-12-month COGS × 365",
    synonyms: ["dpo", "days payable outstanding", "payment days"],
  },
  {
    key: "derived.ccc",
    sheet: "derived",
    label: "Cash Conversion Cycle (derived, days)",
    unit: "days",
    agg: "none",
    formula: "DIO + DSO − DPO",
    synonyms: ["ccc", "cash conversion cycle", "cash cycle"],
  },
  {
    key: "derived.gross_margin_pct",
    sheet: "derived",
    label: "Gross Margin % (derived)",
    unit: "%",
    agg: "none",
    formula: "(Invoiced revenue − Total COGS) ÷ Invoiced revenue × 100",
    synonyms: ["gross margin", "gm", "margin"],
  },
  {
    key: "derived.ocf",
    sheet: "derived",
    label: "Operating Cash Flow (derived)",
    unit: "SAR",
    agg: "none",
    formula:
      "Collections − supplier payments − payroll − OPEX − tax − interest + other operating CF, recomputed per month",
    synonyms: ["computed ocf", "derived operating cash flow", "cash generation"],
  },
];

export const WCX_ALL_METRICS: WcxMetricDef[] = [...WCX_METRIC_DEFS, ...WCX_DERIVED_DEFS];

// "Revenue — Invoiced (SAR)" → "revenue invoiced sar". Em-dashes, slashes,
// parens, and ASCII punctuation all collapse to spaces so the same label
// typed slightly differently still resolves.
export function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[—–\-/()?,.&×%+']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byKey = new Map<string, WcxMetricDef>();
const bySheetLabel = new Map<string, WcxMetricDef>();
for (const def of WCX_ALL_METRICS) {
  byKey.set(def.key, def);
}
for (const def of WCX_METRIC_DEFS) {
  bySheetLabel.set(`${def.sheet}::${normalizeLabel(def.label)}`, def);
}

export function metricByKey(key: string): WcxMetricDef | null {
  return byKey.get(key) ?? null;
}

// Parser-side lookup: exact (sheet, label) match only — no fuzziness during
// ingestion. Unknown labels are reported, never guessed.
export function metricBySheetLabel(sheet: string, label: string): WcxMetricDef | null {
  return bySheetLabel.get(`${sheet}::${normalizeLabel(label)}`) ?? null;
}

export type WcxMetricMatch = {
  metric: WcxMetricDef | null;
  alternatives: WcxMetricDef[];
};

// Chatbot-side resolution: key → exact label → synonym → token overlap.
// Returns alternatives when the query is ambiguous so the model can ask
// the user instead of silently picking the wrong metric.
export function resolveMetric(query: string): WcxMetricMatch {
  const exactKey = byKey.get(query.trim());
  if (exactKey) return { metric: exactKey, alternatives: [] };

  const q = normalizeLabel(query);
  if (!q) return { metric: null, alternatives: [] };

  const exactLabel = WCX_ALL_METRICS.filter((d) => normalizeLabel(d.label) === q);
  if (exactLabel.length === 1) return { metric: exactLabel[0]!, alternatives: [] };
  if (exactLabel.length > 1) return { metric: null, alternatives: exactLabel };

  const exactSyn = WCX_ALL_METRICS.filter((d) =>
    (d.synonyms ?? []).some((s) => normalizeLabel(s) === q),
  );
  if (exactSyn.length === 1) return { metric: exactSyn[0]!, alternatives: [] };
  if (exactSyn.length > 1) return { metric: null, alternatives: exactSyn };

  // Token-overlap scoring as last resort. Require every query token to
  // appear in the candidate's label/synonym tokens.
  const qTokens = q.split(" ");
  const scored = WCX_ALL_METRICS.map((d) => {
    const hayLabel = normalizeLabel(d.label).split(" ");
    const haySyn = (d.synonyms ?? []).flatMap((s) => normalizeLabel(s).split(" "));
    const hay = new Set([...hayLabel, ...haySyn]);
    const hits = qTokens.filter((t) => hay.has(t)).length;
    return { def: d, score: hits === qTokens.length ? hits / hay.size : 0 };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { metric: null, alternatives: [] };
  const top = scored[0]!;
  const runnersUp = scored.slice(1, 5).filter((s) => s.score >= top.score * 0.99);
  if (runnersUp.length > 0) {
    return { metric: null, alternatives: [top.def, ...runnersUp.map((s) => s.def)] };
  }
  return { metric: top.def, alternatives: scored.slice(1, 4).map((s) => s.def) };
}

export function isMonth(v: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

// Inclusive month range, both "YYYY-MM".
export function monthRange(from: string, to: string): string[] {
  if (!isMonth(from) || !isMonth(to)) return [];
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// "FY-2024" | "FY-24" | "2024" → ["2024-01" … "2024-12"].
export function fiscalYearMonths(label: string): string[] | null {
  const match = /^(?:fy[- ]?)?(\d{2}|\d{4})$/i.exec(label.trim());
  if (!match) return null;
  const raw = match[1]!;
  const year = raw.length === 2 ? 2000 + Number(raw) : Number(raw);
  if (year < 2000 || year > 2100) return null;
  return monthRange(`${year}-01`, `${year}-12`);
}
