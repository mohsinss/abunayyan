// What-if scenario math for the WC Intelligence Scenario Lab and the
// wcxScenarioCalc chat tool. Pure and client-safe: baselines are built
// server-side from the active upload's latest actuals; everything here is
// in-memory lever math that NEVER mutates stored facts.
//
// Unlike the legacy working-capital brief (which inferred daily flows
// backwards from balances), cogsPerDay / revPerDay come from the actual
// trailing-12-month flows in the workbook, so dragging DSO implies an AR
// change priced at the SBU's real revenue run-rate.

export const WCX_LEVER_FIELDS = ["inv", "ar", "ca", "ap", "dio", "dso", "dpo"] as const;
export type WcxLeverField = (typeof WCX_LEVER_FIELDS)[number];
export type WcxLeverShape = Record<WcxLeverField, number>;

export type WcxScenarioBaseline = {
  code: string;
  name: string;
  shape: WcxLeverShape;
  // Real daily flows (TTM annualized / 365). Fallbacks applied at build
  // time so they are always > 0.
  cogsPerDay: number;
  revPerDay: number;
  // Sheet-14 operational targets; null where the workbook left them blank.
  target: Partial<Record<WcxLeverField, number>>;
  targetCashReleased: number | null;
};

export function nwcOf(s: WcxLeverShape): number {
  return s.inv + s.ar + s.ca - s.ap;
}

export function cccOf(s: WcxLeverShape): number {
  return s.dio + s.dso - s.dpo;
}

// Apply one slider move with the same coupling as the WC brief: balance
// edits update the matching day-count and vice versa, priced at the
// baseline's real daily flows.
export function applyLever(
  baseline: WcxScenarioBaseline,
  current: WcxLeverShape,
  field: WcxLeverField,
  raw: number,
): WcxLeverShape {
  const next: WcxLeverShape = { ...current, [field]: raw };
  const cd = baseline.cogsPerDay;
  const rd = baseline.revPerDay;

  if (field === "inv") next.dio = cd > 0 ? raw / cd : 0;
  else if (field === "ap") next.dpo = cd > 0 ? raw / cd : 0;
  else if (field === "ar" || field === "ca") next.dso = rd > 0 ? (next.ar + next.ca) / rd : 0;
  else if (field === "dio") next.inv = raw * cd;
  else if (field === "dpo") next.ap = raw * cd;
  else if (field === "dso") {
    const baseSum = baseline.shape.ar + baseline.shape.ca || 1;
    const arShare = baseline.shape.ar / baseSum;
    const newSum = raw * rd;
    next.ar = newSum * arShare;
    next.ca = newSum * (1 - arShare);
  }
  return next;
}

// Interpolate baseline → target by factor ∈ [0,1]. Fields without a
// Sheet-14 target stay at baseline.
export function applyPreset(baseline: WcxScenarioBaseline, factor: number): WcxLeverShape {
  const f = Math.max(0, Math.min(1, factor));
  const out: WcxLeverShape = { ...baseline.shape };
  for (const field of WCX_LEVER_FIELDS) {
    const t = baseline.target[field];
    if (t === undefined || t === null) continue;
    out[field] = baseline.shape[field] + (t - baseline.shape[field]) * f;
  }
  return out;
}

export type WcxGroupTotals = {
  nwc: number;
  inv: number;
  arCa: number;
  ap: number;
  ccc: number; // from group balances over group flows, not an average
  annualRevenue: number;
  annualCogs: number;
};

export function groupTotalsOf(
  baselines: WcxScenarioBaseline[],
  shapes: Record<string, WcxLeverShape>,
): WcxGroupTotals {
  let totInv = 0;
  let totArCa = 0;
  let totAp = 0;
  let cogsPerDay = 0;
  let revPerDay = 0;
  for (const b of baselines) {
    const s = shapes[b.code] ?? b.shape;
    totInv += s.inv;
    totArCa += s.ar + s.ca;
    totAp += s.ap;
    cogsPerDay += b.cogsPerDay;
    revPerDay += b.revPerDay;
  }
  const dioG = cogsPerDay > 0 ? totInv / cogsPerDay : 0;
  const dsoG = revPerDay > 0 ? totArCa / revPerDay : 0;
  const dpoG = cogsPerDay > 0 ? totAp / cogsPerDay : 0;
  return {
    nwc: totInv + totArCa - totAp,
    inv: totInv,
    arCa: totArCa,
    ap: totAp,
    ccc: dioG + dsoG - dpoG,
    annualRevenue: revPerDay * 365,
    annualCogs: cogsPerDay * 365,
  };
}

// Positive = the scenario frees cash vs the baseline actuals.
export function cashReleased(
  baselines: WcxScenarioBaseline[],
  shapes: Record<string, WcxLeverShape>,
): number {
  let release = 0;
  for (const b of baselines) {
    const s = shapes[b.code];
    if (!s) continue;
    release += nwcOf(b.shape) - nwcOf(s);
  }
  return release;
}
