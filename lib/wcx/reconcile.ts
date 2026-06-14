// Reconciliation pass mirroring the workbook's own "(calc)" cross-checks.
// Runs at ingest time over the parsed facts; results land in the upload's
// QA report. Failures never block ingestion — they're surfaced to admins
// and to the chatbot ("how reliable is this number?").

import type { WcxQaCheck, WcxQaReport } from "@/db/schema/wc-intelligence";
import { buildIndex, valueAt, type FactInput, type FactsIndex } from "./derive";

const SAMPLE_CAP = 5;

function tolerance(expected: number): number {
  return Math.max(0.5, Math.abs(expected) * 0.005);
}

type CheckSpec = {
  id: string;
  label: string;
  // Returns [expected (recomputed), actual (stored calc cell)] or null to
  // skip this (sbu, month) cell.
  evaluate: (_idx: FactsIndex, _sbu: string, _month: string) => [number, number] | null;
};

function sumOf(idx: FactsIndex, sbu: string, month: string, keys: string[]): number | null {
  let sum = 0;
  let present = 0;
  for (const k of keys) {
    const v = valueAt(idx, sbu, k, month);
    if (v !== null) {
      sum += v;
      present += 1;
    }
  }
  return present > 0 ? sum : null;
}

function pair(expected: number | null, actual: number | null): [number, number] | null {
  if (expected === null || actual === null) return null;
  return [expected, actual];
}

const CHECKS: CheckSpec[] = [
  {
    id: "pl-cogs-total",
    label: "P&L: COGS components sum to COGS — Total",
    evaluate: (idx, sbu, month) =>
      pair(
        sumOf(idx, sbu, month, [
          "pl.cogs_materials",
          "pl.cogs_labor",
          "pl.cogs_overhead",
          "pl.cogs_subcontracted",
        ]),
        valueAt(idx, sbu, "pl.cogs_total", month),
      ),
  },
  {
    id: "bs-nwc",
    label: "BS: Inv + AR + CA − AP matches the NWC calc cell",
    evaluate: (idx, sbu, month) => {
      const inv = valueAt(idx, sbu, "bs.inventory_net", month);
      const ar = valueAt(idx, sbu, "bs.trade_receivables", month);
      const ca = valueAt(idx, sbu, "bs.contract_assets", month);
      const ap = valueAt(idx, sbu, "bs.trade_payables", month);
      if (inv === null && ar === null && ca === null && ap === null) return null;
      return pair((inv ?? 0) + (ar ?? 0) + (ca ?? 0) - (ap ?? 0), valueAt(idx, sbu, "bs.nwc_calc", month));
    },
  },
  {
    id: "ar-buckets-total",
    label: "AR aging: buckets sum to Total AR",
    evaluate: (idx, sbu, month) =>
      pair(
        sumOf(idx, sbu, month, [
          "ar.bucket_current",
          "ar.bucket_1_30",
          "ar.bucket_31_60",
          "ar.bucket_61_90",
          "ar.bucket_91_180",
          "ar.bucket_180_plus",
        ]),
        valueAt(idx, sbu, "ar.total_calc", month),
      ),
  },
  {
    id: "ar-vs-bs",
    label: "AR aging net of provision reconciles to Sheet 3 receivables",
    evaluate: (idx, sbu, month) => {
      // Calc cells are often empty (formula cells); recompute from buckets.
      const total =
        valueAt(idx, sbu, "ar.total_calc", month) ??
        sumOf(idx, sbu, month, [
          "ar.bucket_current",
          "ar.bucket_1_30",
          "ar.bucket_31_60",
          "ar.bucket_61_90",
          "ar.bucket_91_180",
          "ar.bucket_180_plus",
        ]);
      const prov = valueAt(idx, sbu, "ar.provision", month);
      if (total === null) return null;
      return pair(total - (prov ?? 0), valueAt(idx, sbu, "bs.trade_receivables", month));
    },
  },
  {
    id: "ap-buckets-total",
    label: "AP aging: buckets sum to Total AP",
    evaluate: (idx, sbu, month) =>
      pair(
        sumOf(idx, sbu, month, [
          "ap.bucket_current",
          "ap.bucket_1_30",
          "ap.bucket_31_60",
          "ap.bucket_61_90",
          "ap.bucket_91_180",
          "ap.bucket_180_plus",
        ]),
        valueAt(idx, sbu, "ap.total_calc", month),
      ),
  },
  {
    id: "ap-vs-bs",
    label: "AP aging total reconciles to Sheet 3 trade payables",
    evaluate: (idx, sbu, month) => {
      const total =
        valueAt(idx, sbu, "ap.total_calc", month) ??
        sumOf(idx, sbu, month, [
          "ap.bucket_current",
          "ap.bucket_1_30",
          "ap.bucket_31_60",
          "ap.bucket_61_90",
          "ap.bucket_91_180",
          "ap.bucket_180_plus",
        ]);
      return pair(total, valueAt(idx, sbu, "bs.trade_payables", month));
    },
  },
  {
    id: "inv-categories-gross",
    label: "Inventory: categories sum to Total Gross Inventory",
    evaluate: (idx, sbu, month) =>
      pair(
        sumOf(idx, sbu, month, [
          "inv.raw_materials",
          "inv.wip",
          "inv.finished_goods",
          "inv.spare_parts",
          "inv.goods_in_transit",
        ]),
        valueAt(idx, sbu, "inv.total_gross_calc", month),
      ),
  },
  {
    id: "inv-aging-total",
    label: "Inventory: aging buckets sum to Aging Total",
    evaluate: (idx, sbu, month) =>
      pair(
        sumOf(idx, sbu, month, [
          "inv.aging_0_90",
          "inv.aging_91_180",
          "inv.aging_181_365",
          "inv.aging_365_plus",
        ]),
        valueAt(idx, sbu, "inv.aging_total_calc", month),
      ),
  },
  {
    id: "inv-vs-bs",
    label: "Inventory gross − obsolescence reconciles to Sheet 3 net inventory",
    evaluate: (idx, sbu, month) => {
      const gross =
        valueAt(idx, sbu, "inv.total_gross_calc", month) ??
        sumOf(idx, sbu, month, [
          "inv.raw_materials",
          "inv.wip",
          "inv.finished_goods",
          "inv.spare_parts",
          "inv.goods_in_transit",
        ]);
      if (gross === null) return null;
      const prov = valueAt(idx, sbu, "inv.obsolescence_provision", month);
      return pair(gross - (prov ?? 0), valueAt(idx, sbu, "bs.inventory_net", month));
    },
  },
  {
    id: "cf-ocf",
    label: "Cash flow: OCF components sum to Operating Cash Flow",
    evaluate: (idx, sbu, month) => {
      const collections = valueAt(idx, sbu, "cf.collections", month);
      if (collections === null) return null;
      const out = sumOf(idx, sbu, month, [
        "cf.supplier_payments",
        "cf.payroll",
        "cf.opex",
        "cf.tax_zakat",
        "cf.interest",
      ]);
      const other = valueAt(idx, sbu, "cf.other_operating", month) ?? 0;
      return pair(collections - (out ?? 0) + other, valueAt(idx, sbu, "cf.ocf_calc", month));
    },
  },
  {
    id: "cf-cash-roll",
    label: "Cash flow: opening + net change equals closing cash",
    evaluate: (idx, sbu, month) => {
      const opening = valueAt(idx, sbu, "cf.opening_cash", month);
      const change = valueAt(idx, sbu, "cf.net_change_calc", month);
      if (opening === null || change === null) return null;
      return pair(opening + change, valueAt(idx, sbu, "cf.closing_cash", month));
    },
  },
];

export function reconcile(args: {
  facts: FactInput[];
  sbus: string[];
  months: string[];
  unknownLabels: Array<{ sheet: string; label: string }>;
  recordsCount: number;
}): WcxQaReport {
  const idx = buildIndex(args.facts);
  const checks: WcxQaCheck[] = CHECKS.map((spec) => {
    let total = 0;
    let failures = 0;
    const samples: WcxQaCheck["samples"] = [];
    for (const sbu of args.sbus) {
      for (const month of args.months) {
        const result = spec.evaluate(idx, sbu, month);
        if (!result) continue;
        total += 1;
        const [expected, actual] = result;
        if (Math.abs(expected - actual) > tolerance(expected)) {
          failures += 1;
          if (samples.length < SAMPLE_CAP) samples.push({ sbu, month, expected, actual });
        }
      }
    }
    return {
      id: spec.id,
      label: spec.label,
      status: total === 0 ? "skip" : failures === 0 ? "pass" : "fail",
      failures,
      total,
      samples,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    unknownLabels: args.unknownLabels,
    coverage: { months: args.months, sbus: args.sbus },
    factsCount: args.facts.length,
    recordsCount: args.recordsCount,
    checks,
  };
}
