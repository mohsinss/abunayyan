import "server-only";
// Server-side assembly of the WC Intelligence dashboard payload. All math
// runs here (shared with the chat tools via derive.ts) so the client island
// only renders. Everything returned is JSON-serializable.

import { getFacts, listTargetsForUpload } from "@/lib/db/queries/wc-intelligence";
import { GROUP_AGG, wcxContext, withGroupAggregate } from "./engine";
import { buildScenarioBaselines } from "./scenario-baseline";
import type { WcxScenarioBaseline } from "./scenario";
import {
  buildIndex,
  cccAt,
  dioAt,
  dpoAt,
  dsoAt,
  nwcAt,
  ttmAnnualized,
  valueAt,
  type FactsIndex,
} from "./derive";

const BASE_KEYS = [
  "bs.inventory_net",
  "bs.trade_receivables",
  "bs.contract_assets",
  "bs.trade_payables",
  "pl.revenue_invoiced",
  "pl.cogs_total",
  "pl.cogs_materials",
  "pl.cogs_labor",
  "pl.cogs_overhead",
  "pl.cogs_subcontracted",
  "cf.collections",
  "cf.supplier_payments",
  "cf.payroll",
  "cf.opex",
  "cf.tax_zakat",
  "cf.interest",
  "cf.other_operating",
  "cf.closing_cash",
];

export const AGING_BUCKET_LABELS = ["Current", "1-30", "31-60", "61-90", "91-180", "180+"];
const AR_BUCKETS = [
  "ar.bucket_current", "ar.bucket_1_30", "ar.bucket_31_60",
  "ar.bucket_61_90", "ar.bucket_91_180", "ar.bucket_180_plus",
];
const AP_BUCKETS = [
  "ap.bucket_current", "ap.bucket_1_30", "ap.bucket_31_60",
  "ap.bucket_61_90", "ap.bucket_91_180", "ap.bucket_180_plus",
];

export type Kpi = { value: number | null; delta1m: number | null; delta12m: number | null };

export type WcxDashboardData = {
  upload: {
    filename: string;
    uploadedAt: string;
    periodStart: string;
    periodEnd: string;
    factsCount: number;
    qa: { passed: number; failed: number; skipped: number; unknownLabels: number } | null;
  };
  sbus: Array<{ code: string; name: string }>;
  months: string[];
  latestMonth: string;
  kpis: { nwc: Kpi; ccc: Kpi; revenueTtm: Kpi; ocfTtm: Kpi; cash: Kpi };
  nwcTrend: Array<{ month: string; inv: number; arCa: number; ap: number; nwc: number }>;
  revVsOcf: Array<{ month: string; revenue: number | null; ocf: number | null }>;
  cccBySbu: Array<{
    code: string;
    name: string;
    ccc: number | null;
    dio: number | null;
    dso: number | null;
    dpo: number | null;
  }>;
  sbuTrends: Record<string, Array<{ month: string; nwc: number | null; ccc: number | null }>>;
  arAging: Array<{ code: string; shares: Array<number | null>; total: number | null }>;
  apAging: Array<{ code: string; shares: Array<number | null>; total: number | null }>;
  targets: Array<{
    code: string;
    actualCcc: number | null;
    targetCcc: number | null;
    actualDso: number | null;
    targetDso: number | null;
    actualDio: number | null;
    targetDio: number | null;
    actualDpo: number | null;
    targetDpo: number | null;
  }>;
  scenario: {
    baselines: WcxScenarioBaseline[];
    targetCashTotal: number | null;
  };
};

function monthShift(month: string, deltaMonths: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// Monthly group OCF recomputed from direct-cash-flow components (the
// workbook's OCF calc cells are formula cells and often empty).
function ocfAt(idx: FactsIndex, entity: string, month: string): number | null {
  const collections = valueAt(idx, entity, "cf.collections", month);
  if (collections === null) return null;
  const outflows = ["cf.supplier_payments", "cf.payroll", "cf.opex", "cf.tax_zakat", "cf.interest"]
    .map((k) => valueAt(idx, entity, k, month) ?? 0)
    .reduce((a, b) => a + b, 0);
  const other = valueAt(idx, entity, "cf.other_operating", month) ?? 0;
  return collections - outflows + other;
}

function kpiOf(
  at: (_month: string) => number | null,
  latest: string,
): Kpi {
  const value = at(latest);
  const prev = at(monthShift(latest, -1));
  const yearAgo = at(monthShift(latest, -12));
  return {
    value,
    delta1m: value !== null && prev !== null ? value - prev : null,
    delta12m: value !== null && yearAgo !== null ? value - yearAgo : null,
  };
}

export async function getWcxDashboardData(): Promise<WcxDashboardData | null> {
  const ctx = await wcxContext();
  if (!ctx) return null;
  const { upload, sbus } = ctx;
  const periodStart = upload.periodStart;
  const periodEnd = upload.periodEnd;
  if (!periodStart || !periodEnd) return null;
  const codes = sbus.map((s) => s.code);

  const facts = await getFacts(upload.id, {
    metricKeys: [...BASE_KEYS, ...AR_BUCKETS, ...AP_BUCKETS],
  });
  const idx = withGroupAggregate(buildIndex(facts), codes, [...BASE_KEYS, ...AR_BUCKETS, ...AP_BUCKETS]);

  const months = [...new Set(facts.map((f) => f.month))].sort();
  const latest = periodEnd;

  // ── Group KPI strip ────────────────────────────────────────────────────
  const kpis = {
    nwc: kpiOf((m) => nwcAt(idx, GROUP_AGG, m)?.value ?? null, latest),
    ccc: kpiOf((m) => cccAt(idx, GROUP_AGG, m)?.value ?? null, latest),
    revenueTtm: kpiOf(
      (m) => ttmAnnualized(idx, GROUP_AGG, "pl.revenue_invoiced", m)?.value ?? null,
      latest,
    ),
    ocfTtm: kpiOf((m) => {
      let sum = 0;
      let used = 0;
      for (let k = 0; k < 12; k++) {
        const v = ocfAt(idx, GROUP_AGG, monthShift(m, -k));
        if (v !== null) {
          sum += v;
          used += 1;
        }
      }
      return used > 0 ? sum * (12 / used) : null;
    }, latest),
    cash: kpiOf((m) => valueAt(idx, GROUP_AGG, "cf.closing_cash", m), latest),
  };

  // ── 36-month group trends ──────────────────────────────────────────────
  const nwcTrend = months.map((m) => {
    const inv = valueAt(idx, GROUP_AGG, "bs.inventory_net", m) ?? 0;
    const ar = valueAt(idx, GROUP_AGG, "bs.trade_receivables", m) ?? 0;
    const ca = valueAt(idx, GROUP_AGG, "bs.contract_assets", m) ?? 0;
    const ap = valueAt(idx, GROUP_AGG, "bs.trade_payables", m) ?? 0;
    return { month: m, inv, arCa: ar + ca, ap, nwc: inv + ar + ca - ap };
  });

  const revVsOcf = months.map((m) => ({
    month: m,
    revenue: valueAt(idx, GROUP_AGG, "pl.revenue_invoiced", m),
    ocf: ocfAt(idx, GROUP_AGG, m),
  }));

  // ── Per-SBU latest CCC decomposition + trends ──────────────────────────
  const cccBySbu = sbus.map((s) => ({
    code: s.code,
    name: s.name,
    ccc: cccAt(idx, s.code, latest)?.value ?? null,
    dio: dioAt(idx, s.code, latest)?.value ?? null,
    dso: dsoAt(idx, s.code, latest)?.value ?? null,
    dpo: dpoAt(idx, s.code, latest)?.value ?? null,
  }));

  const sbuTrends: WcxDashboardData["sbuTrends"] = {};
  for (const s of sbus) {
    sbuTrends[s.code] = months.map((m) => ({
      month: m,
      nwc: nwcAt(idx, s.code, m)?.value ?? null,
      ccc: cccAt(idx, s.code, m)?.value ?? null,
    }));
  }

  // ── Aging heatmaps (latest month, share of total per SBU) ──────────────
  const agingRows = (buckets: string[]) =>
    sbus.map((s) => {
      const values = buckets.map((k) => valueAt(idx, s.code, k, latest));
      const present = values.filter((v): v is number => v !== null);
      const total = present.length > 0 ? present.reduce((a, b) => a + b, 0) : null;
      return {
        code: s.code,
        shares: values.map((v) => (v !== null && total ? v / total : null)),
        total,
      };
    });

  // ── Targets vs latest actuals ──────────────────────────────────────────
  const targetRows = await listTargetsForUpload(upload.id);
  const targets = sbus.map((s) => {
    const t = targetRows.find((r) => r.sbuCode === s.code);
    const targetCcc =
      t && t.targetDio !== null && t.targetDso !== null && t.targetDpo !== null
        ? t.targetDio + t.targetDso - t.targetDpo
        : null;
    return {
      code: s.code,
      actualCcc: cccAt(idx, s.code, latest)?.value ?? null,
      targetCcc,
      actualDso: dsoAt(idx, s.code, latest)?.value ?? null,
      targetDso: t?.targetDso ?? null,
      actualDio: dioAt(idx, s.code, latest)?.value ?? null,
      targetDio: t?.targetDio ?? null,
      actualDpo: dpoAt(idx, s.code, latest)?.value ?? null,
      targetDpo: t?.targetDpo ?? null,
    };
  });

  // ── Scenario Lab baselines (latest actuals over real TTM flows) ────────
  const scenarioBaselines = buildScenarioBaselines(
    idx,
    sbus.map((s) => ({ code: s.code, name: s.name })),
    targetRows,
    latest,
  );
  const cashTargets = targetRows
    .map((t) => t.targetCashReleased)
    .filter((v): v is number => v !== null);
  const targetCashTotal =
    cashTargets.length > 0 ? cashTargets.reduce((a, b) => a + b, 0) : null;

  const qa = upload.qaReport
    ? {
        passed: upload.qaReport.checks.filter((c) => c.status === "pass").length,
        failed: upload.qaReport.checks.filter((c) => c.status === "fail").length,
        skipped: upload.qaReport.checks.filter((c) => c.status === "skip").length,
        unknownLabels: upload.qaReport.unknownLabels.length,
      }
    : null;

  return {
    upload: {
      filename: upload.filename,
      uploadedAt: upload.createdAt.toISOString().slice(0, 10),
      periodStart,
      periodEnd,
      factsCount: upload.factsCount,
      qa,
    },
    sbus: sbus.map((s) => ({ code: s.code, name: s.name })),
    months,
    latestMonth: latest,
    kpis,
    nwcTrend,
    revVsOcf,
    cccBySbu,
    sbuTrends,
    arAging: agingRows(AR_BUCKETS),
    apAging: agingRows(AP_BUCKETS),
    targets,
    scenario: { baselines: scenarioBaselines, targetCashTotal },
  };
}
