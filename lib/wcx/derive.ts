// Deterministic derivation engine for the WC Intelligence dashboard and
// chat tools. All math the workbook marks as "(calc)" is recomputed here
// from raw facts; stored calc cells are used only for reconciliation.
//
// Conventions (documented in every tool response via `basis` strings):
// - Monthly DIO/DSO/DPO use trailing-12-month flows, annualized when fewer
//   than 12 months of history exist.
// - Period (FY / range) DIO/DSO/DPO use the period-end balance over the
//   period's flows, annualized by 12/n.
// - NWC = Inventory net + Trade receivables + Contract assets − Trade
//   payables (same definition as the workbook's Sheet 3 calc row).

import { metricByKey, monthRange, type WcxAgg } from "./metrics";

export type FactsIndex = Map<string, Map<string, Map<string, number>>>;

export type FactInput = { sbuCode: string; metricKey: string; month: string; value: number };

export function buildIndex(facts: FactInput[]): FactsIndex {
  const idx: FactsIndex = new Map();
  for (const f of facts) {
    let bySbu = idx.get(f.sbuCode);
    if (!bySbu) idx.set(f.sbuCode, (bySbu = new Map()));
    let byMetric = bySbu.get(f.metricKey);
    if (!byMetric) bySbu.set(f.metricKey, (byMetric = new Map()));
    byMetric.set(f.month, f.value);
  }
  return idx;
}

export function valueAt(
  idx: FactsIndex,
  sbu: string,
  metricKey: string,
  month: string,
): number | null {
  return idx.get(sbu)?.get(metricKey)?.get(month) ?? null;
}

const COGS_COMPONENTS = [
  "pl.cogs_materials",
  "pl.cogs_labor",
  "pl.cogs_overhead",
  "pl.cogs_subcontracted",
] as const;

// "COGS — Total" is a formula cell in the workbook and often arrives empty.
// Fall back to summing the four components so DIO/DPO/GM% stay computable.
export function effectiveValueAt(
  idx: FactsIndex,
  sbu: string,
  metricKey: string,
  month: string,
): number | null {
  const stored = valueAt(idx, sbu, metricKey, month);
  if (stored !== null) return stored;
  if (metricKey === "pl.cogs_total") {
    let sum = 0;
    let present = 0;
    for (const k of COGS_COMPONENTS) {
      const v = valueAt(idx, sbu, k, month);
      if (v !== null) {
        sum += v;
        present += 1;
      }
    }
    return present > 0 ? sum : null;
  }
  return null;
}

export function monthsOf(idx: FactsIndex, sbu: string, metricKey: string): string[] {
  return [...(idx.get(sbu)?.get(metricKey)?.keys() ?? [])].sort();
}

// Sum a flow metric over the months ending at `month` (inclusive), looking
// back up to 12 months, annualized to a 12-month run-rate when fewer
// months are present. Returns null when no data exists in the window.
export function ttmAnnualized(
  idx: FactsIndex,
  sbu: string,
  metricKey: string,
  month: string,
): { value: number; monthsUsed: number } | null {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const startY = m === 12 ? y : y - 1;
  const startM = m === 12 ? 1 : m + 1;
  const window = monthRange(`${startY}-${String(startM).padStart(2, "0")}`, month);
  let sum = 0;
  let used = 0;
  for (const mm of window) {
    const v = effectiveValueAt(idx, sbu, metricKey, mm);
    if (v !== null) {
      sum += v;
      used += 1;
    }
  }
  if (used === 0) return null;
  return { value: sum * (12 / used), monthsUsed: used };
}

// Aggregate a stored metric over a set of months using its registry rule.
export function aggregateMetric(
  idx: FactsIndex,
  sbu: string,
  metricKey: string,
  months: string[],
): { value: number; agg: WcxAgg; monthsUsed: number } | null {
  const def = metricByKey(metricKey);
  if (!def || def.agg === "none") return null;
  const present = months
    .map((m) => ({ month: m, value: valueAt(idx, sbu, metricKey, m) }))
    .filter((x): x is { month: string; value: number } => x.value !== null);
  if (present.length === 0) return null;

  if (def.agg === "sum") {
    return {
      value: present.reduce((a, b) => a + b.value, 0),
      agg: "sum",
      monthsUsed: present.length,
    };
  }
  if (def.agg === "avg") {
    return {
      value: present.reduce((a, b) => a + b.value, 0) / present.length,
      agg: "avg",
      monthsUsed: present.length,
    };
  }
  if (def.agg === "sop") {
    return { value: present[0]!.value, agg: "sop", monthsUsed: present.length };
  }
  // eop
  return { value: present[present.length - 1]!.value, agg: "eop", monthsUsed: present.length };
}

export type DerivedResult = { value: number; basis: string } | null;

// NWC at month end. Missing components are treated as 0 only when at least
// one component exists for that month.
export function nwcAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  const inv = valueAt(idx, sbu, "bs.inventory_net", month);
  const ar = valueAt(idx, sbu, "bs.trade_receivables", month);
  const ca = valueAt(idx, sbu, "bs.contract_assets", month);
  const ap = valueAt(idx, sbu, "bs.trade_payables", month);
  if (inv === null && ar === null && ca === null && ap === null) return null;
  return {
    value: (inv ?? 0) + (ar ?? 0) + (ca ?? 0) - (ap ?? 0),
    basis: `Inv ${inv ?? 0} + AR ${ar ?? 0} + CA ${ca ?? 0} − AP ${ap ?? 0} (month-end ${month})`,
  };
}

function daysMetric(
  balance: number | null,
  flowAnnualized: { value: number; monthsUsed: number } | null,
  label: string,
  month: string,
): DerivedResult {
  if (balance === null || !flowAnnualized || flowAnnualized.value <= 0) return null;
  return {
    value: (balance / flowAnnualized.value) * 365,
    basis: `${label}: balance at ${month} ÷ trailing-12m flow (annualized from ${flowAnnualized.monthsUsed} months) × 365`,
  };
}

export function dioAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  return daysMetric(
    valueAt(idx, sbu, "bs.inventory_net", month),
    ttmAnnualized(idx, sbu, "pl.cogs_total", month),
    "DIO = Inventory ÷ COGS",
    month,
  );
}

export function dsoAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  const ar = valueAt(idx, sbu, "bs.trade_receivables", month);
  const ca = valueAt(idx, sbu, "bs.contract_assets", month);
  const balance = ar === null && ca === null ? null : (ar ?? 0) + (ca ?? 0);
  return daysMetric(
    balance,
    ttmAnnualized(idx, sbu, "pl.revenue_invoiced", month),
    "DSO = (AR + Contract assets) ÷ Revenue",
    month,
  );
}

export function dpoAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  return daysMetric(
    valueAt(idx, sbu, "bs.trade_payables", month),
    ttmAnnualized(idx, sbu, "pl.cogs_total", month),
    "DPO = Trade payables ÷ COGS",
    month,
  );
}

export function cccAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  const dio = dioAt(idx, sbu, month);
  const dso = dsoAt(idx, sbu, month);
  const dpo = dpoAt(idx, sbu, month);
  if (!dio || !dso || !dpo) return null;
  return {
    value: dio.value + dso.value - dpo.value,
    basis: `CCC = DIO ${dio.value.toFixed(1)} + DSO ${dso.value.toFixed(1)} − DPO ${dpo.value.toFixed(1)} (${month})`,
  };
}

const OCF_OUTFLOWS = [
  "cf.supplier_payments",
  "cf.payroll",
  "cf.opex",
  "cf.tax_zakat",
  "cf.interest",
] as const;

// Direct OCF recomputed from components — the workbook's "Operating Cash
// Flow (calc)" cells are formula cells and frequently arrive empty.
export function ocfAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  const collections = valueAt(idx, sbu, "cf.collections", month);
  if (collections === null) return null;
  const outflows = OCF_OUTFLOWS.reduce(
    (sum, k) => sum + (valueAt(idx, sbu, k, month) ?? 0),
    0,
  );
  const other = valueAt(idx, sbu, "cf.other_operating", month) ?? 0;
  return {
    value: collections - outflows + other,
    basis: `OCF = collections − suppliers − payroll − opex − tax − interest + other (${month})`,
  };
}

export function grossMarginAt(idx: FactsIndex, sbu: string, month: string): DerivedResult {
  const rev = valueAt(idx, sbu, "pl.revenue_invoiced", month);
  const cogs = effectiveValueAt(idx, sbu, "pl.cogs_total", month);
  if (rev === null || cogs === null || rev === 0) return null;
  return {
    value: ((rev - cogs) / rev) * 100,
    basis: `GM% = (Revenue ${rev} − COGS ${cogs}) ÷ Revenue (${month})`,
  };
}

export function derivedAt(
  idx: FactsIndex,
  sbu: string,
  key: string,
  month: string,
): DerivedResult {
  switch (key) {
    case "derived.nwc":
      return nwcAt(idx, sbu, month);
    case "derived.dio":
      return dioAt(idx, sbu, month);
    case "derived.dso":
      return dsoAt(idx, sbu, month);
    case "derived.dpo":
      return dpoAt(idx, sbu, month);
    case "derived.ccc":
      return cccAt(idx, sbu, month);
    case "derived.gross_margin_pct":
      return grossMarginAt(idx, sbu, month);
    case "derived.ocf":
      return ocfAt(idx, sbu, month);
    default:
      return null;
  }
}

// Period versions: balances at period end over flows within the period.
function periodFlow(
  idx: FactsIndex,
  sbu: string,
  metricKey: string,
  months: string[],
): { value: number; used: number } | null {
  let sum = 0;
  let used = 0;
  for (const m of months) {
    const v = effectiveValueAt(idx, sbu, metricKey, m);
    if (v !== null) {
      sum += v;
      used += 1;
    }
  }
  return used > 0 ? { value: sum, used } : null;
}

export function derivedForPeriod(
  idx: FactsIndex,
  sbu: string,
  key: string,
  months: string[],
): DerivedResult {
  if (months.length === 0) return null;
  const end = months[months.length - 1]!;

  if (key === "derived.nwc") return nwcAt(idx, sbu, end);

  if (key === "derived.ocf") {
    let sum = 0;
    let used = 0;
    for (const m of months) {
      const v = ocfAt(idx, sbu, m);
      if (v) {
        sum += v.value;
        used += 1;
      }
    }
    if (used === 0) return null;
    return {
      value: sum,
      basis: `OCF summed over ${used} months (${months[0]}…${end}), components recomputed per month`,
    };
  }

  if (key === "derived.gross_margin_pct") {
    const rev = periodFlow(idx, sbu, "pl.revenue_invoiced", months);
    const cogs = periodFlow(idx, sbu, "pl.cogs_total", months);
    if (!rev || !cogs || rev.value === 0) return null;
    return {
      value: ((rev.value - cogs.value) / rev.value) * 100,
      basis: `GM% over ${months[0]}…${end} = (Σrevenue ${rev.value} − ΣCOGS ${cogs.value}) ÷ Σrevenue`,
    };
  }

  const periodDays = (balance: number | null, flowKey: string, label: string): DerivedResult => {
    const flow = periodFlow(idx, sbu, flowKey, months);
    if (balance === null || !flow || flow.value <= 0) return null;
    const annualized = flow.value * (12 / flow.used);
    return {
      value: (balance / annualized) * 365,
      basis: `${label} over ${months[0]}…${end}: period-end balance ÷ period flow (annualized from ${flow.used} months) × 365`,
    };
  };

  if (key === "derived.dio") {
    return periodDays(valueAt(idx, sbu, "bs.inventory_net", end), "pl.cogs_total", "DIO");
  }
  if (key === "derived.dpo") {
    return periodDays(valueAt(idx, sbu, "bs.trade_payables", end), "pl.cogs_total", "DPO");
  }
  if (key === "derived.dso") {
    const ar = valueAt(idx, sbu, "bs.trade_receivables", end);
    const ca = valueAt(idx, sbu, "bs.contract_assets", end);
    const balance = ar === null && ca === null ? null : (ar ?? 0) + (ca ?? 0);
    return periodDays(balance, "pl.revenue_invoiced", "DSO");
  }
  if (key === "derived.ccc") {
    const dio = derivedForPeriod(idx, sbu, "derived.dio", months);
    const dso = derivedForPeriod(idx, sbu, "derived.dso", months);
    const dpo = derivedForPeriod(idx, sbu, "derived.dpo", months);
    if (!dio || !dso || !dpo) return null;
    return {
      value: dio.value + dso.value - dpo.value,
      basis: `CCC = DIO ${dio.value.toFixed(1)} + DSO ${dso.value.toFixed(1)} − DPO ${dpo.value.toFixed(1)} over ${months[0]}…${end}`,
    };
  }
  return null;
}
