// Pure math for the Working Capital & CCC dashboard. Mirrors the
// identities used in /public/dashboards/working-capital-ccc.html so the
// new DB-backed dashboard, the chunk builder, and unit tests all share
// one source of truth.
//
// All numeric inputs are SAR millions for balance-sheet items and days
// for DIO/DSO/DPO. Derived values (cogs_d, rev_d, group totals) are
// never stored — recomputed on read.

export type SbuShape = {
  inv: number;
  ar: number;
  ca: number;
  ap: number;
  dio: number;
  dso: number;
  dpo: number;
};

export type SbuWithTargets = SbuShape & {
  key: string;
  tInv: number;
  tAr: number;
  tCa: number;
  tAp: number;
  tDio: number;
  tDso: number;
  tDpo: number;
};

export const SBU_FIELDS = ["inv", "ar", "ca", "ap", "dio", "dso", "dpo"] as const;
export type SbuField = (typeof SBU_FIELDS)[number];
export const TARGET_FIELDS = [
  "tInv", "tAr", "tCa", "tAp", "tDio", "tDso", "tDpo",
] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];

// Operating NWC = Inv + AR + CA − AP. Same definition as the brief.
export function nwcOf(s: SbuShape): number {
  return s.inv + s.ar + s.ca - s.ap;
}

// Cash Conversion Cycle = DIO + DSO − DPO.
export function cccOf(s: SbuShape): number {
  return s.dio + s.dso - s.dpo;
}

// Daily COGS implied by inventory and DIO. Falls back to AP/DPO when
// DIO=0 (so MEAC/SMC stay sane), and a 0.05 floor for SBUs with neither.
// Used to keep slider math internally consistent: editing Inv updates
// DIO via Inv / cogs_d, and vice versa.
export function cogsPerDay(s: SbuShape): number {
  if (s.dio > 0) return s.inv / s.dio;
  if (s.dpo > 0) return s.ap / s.dpo;
  return 0.05;
}

// Daily revenue implied by (AR + CA) and DSO, with a 0.05 floor for
// SBUs whose DSO is zero.
export function revPerDay(s: SbuShape): number {
  if (s.dso > 0) return (s.ar + s.ca) / s.dso;
  return 0.05;
}

// Annualised revenue at the SBU level. The dashboard's group revenue
// chip is the sum of these.
export function annualRevenue(s: SbuShape): number {
  return revPerDay(s) * 365;
}

export type GroupTotals = {
  nwc: number;
  inv: number;
  ar: number;
  ca: number;
  ap: number;
  ccc: number; // weighted via group cogs/rev, not a raw sum
  revenue: number;
  cogs: number;
  nwcPctRevenue: number; // 0..1
};

// Group-level aggregation. CCC at the group level is computed from
// summed components (totInv/totCogs*365, totArCa/totRev*365, etc.) —
// this is what the brief shows, not the average of per-SBU CCCs.
export function groupTotalsOf(sbus: SbuShape[]): GroupTotals {
  let totInv = 0, totAr = 0, totCa = 0, totAp = 0;
  let totRev = 0, totCogs = 0;
  for (const s of sbus) {
    totInv += s.inv;
    totAr += s.ar;
    totCa += s.ca;
    totAp += s.ap;
    totRev += revPerDay(s) * 365;
    totCogs += cogsPerDay(s) * 365;
  }
  const nwc = totInv + totAr + totCa - totAp;
  const dioG = totCogs > 0 ? (totInv / totCogs) * 365 : 0;
  const dsoG = totRev > 0 ? ((totAr + totCa) / totRev) * 365 : 0;
  const dpoG = totCogs > 0 ? (totAp / totCogs) * 365 : 0;
  return {
    nwc,
    inv: totInv,
    ar: totAr,
    ca: totCa,
    ap: totAp,
    ccc: dioG + dsoG - dpoG,
    revenue: totRev,
    cogs: totCogs,
    nwcPctRevenue: totRev > 0 ? nwc / totRev : 0,
  };
}

// Linear interpolation from baseline → target by `factor` ∈ [0,1].
// 0 returns the baseline, 1 returns the target. The HTML's preset
// buttons (Conservative=0.35, Aggressive=0.7, Hit-All=1.0) call this.
export function applyPreset(s: SbuWithTargets, factor: number): SbuShape {
  const f = Math.max(0, Math.min(1, factor));
  const lerp = (a: number, b: number) => a + (b - a) * f;
  return {
    inv: lerp(s.inv, s.tInv),
    ar: lerp(s.ar, s.tAr),
    ca: lerp(s.ca, s.tCa),
    ap: lerp(s.ap, s.tAp),
    dio: lerp(s.dio, s.tDio),
    dso: lerp(s.dso, s.tDso),
    dpo: lerp(s.dpo, s.tDpo),
  };
}

// "Cash released" vs the FY-2025 baseline, summed across SBUs. Positive
// means the adjusted scenario freed cash; negative means it absorbed.
export function cashReleased(
  baseline: SbuShape[],
  adjusted: SbuShape[],
): number {
  let release = 0;
  for (let i = 0; i < baseline.length; i++) {
    const b = baseline[i];
    const a = adjusted[i];
    if (!b || !a) continue;
    release += nwcOf(b) - nwcOf(a);
  }
  return release;
}
