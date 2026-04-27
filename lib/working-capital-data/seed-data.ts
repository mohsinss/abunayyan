// Source-of-truth seed values mirrored from
// /public/dashboards/working-capital-ccc.html (the SBUS array + hero
// framing). Pure data — no DB imports. The seed script and unit tests
// both pull from here.
//
// `display_order` is set by array position. `groupRevenue` is a stored
// baseline; the HTML derives it from sum((ar+ca)/dso * 365), which
// rounds to ~SAR 3,868m for the values below. Admins can override.

export type SbuSeed = {
  key: string;
  name: string;
  shareText: string;
  posture: string;
  inv: number;
  ar: number;
  ca: number;
  ap: number;
  dio: number;
  dso: number;
  dpo: number;
  tInv: number;
  tAr: number;
  tCa: number;
  tAp: number;
  tDio: number;
  tDso: number;
  tDpo: number;
  notes: string[];
};

export const GROUP_SEED = {
  fiscalYear: "FY-2025",
  // SAR millions. ~SAR 3.87B group revenue, derived from per-SBU
  // (AR + CA) / DSO * 365. Stored, not recomputed at read time.
  groupRevenue: 3868,
  nwcTargetRelease: 540,
  notes:
    "Operating NWC excludes cash and short-term debt (not present in source workbook).",
};

export const SBU_SEEDS: SbuSeed[] = [
  {
    key: "ATC",
    name: "ATC",
    shareText: "20% of revenue",
    posture: "Optimise — within band, trajectory wrong",
    inv: 183, ar: 243, ca: 59, ap: 368,
    dio: 100, dso: 140, dpo: 201,
    tInv: 80, tAr: 203, tCa: 59, tAp: 368, tDio: 44, tDso: 117, tDpo: 201,
    notes: [
      "DIO 100 vs group median 23 — inventory built 25% on 9% revenue growth.",
      "DSO jumped 23 days in FY-2025; SAR 49m newly trapped in receivables.",
      "DPO 201 — strongest supplier leverage in the portfolio. Hold, do not stretch.",
      "Lever: ML demand forecasting + collection AI. Identified release ≈ SAR 151m.",
    ],
  },
  {
    key: "Wetico",
    name: "Wetico",
    shareText: "42% of revenue",
    posture: "Stabilise volatility, not reduce position",
    inv: 18, ar: 348, ca: 195, ap: 392,
    dio: 5, dso: 123, dpo: 109,
    tInv: 18, tAr: 348, tCa: 195, tAp: 450, tDio: 5, tDso: 123, tDpo: 125,
    notes: [
      "Best CCC of any large SBU (19 days); NWC at 10% of revenue.",
      "DPO swung 168 → 48 → 109 — supplier terms unstable by project cycle.",
      "AR fell SAR 375m in FY-2025; reclassification suspected — forensic audit required.",
      "Lever: Master Service Agreements at 120 days to stop the swings.",
    ],
  },
  {
    key: "Citiscape",
    name: "Citiscape",
    shareText: "10.5% of revenue",
    posture: "Restructure billing discipline",
    inv: 4, ar: 70, ca: 196, ap: 92,
    dio: 5, dso: 238, dpo: 105,
    tInv: 4, tAr: 70, tCa: 65, tAp: 115, tDio: 5, tDso: 130, tDpo: 130,
    notes: [
      "Contract Assets at 48% of revenue — half of annual sales unbilled.",
      "AR fell 32m while Unbilled rose 131m — billing milestones lag revenue recognition.",
      "Gross margin collapsed 1,010 bps in FY-2025 — investigate separately.",
      "Lever: contract intelligence platform, halve unbilled. Identified release ≈ SAR 152m.",
    ],
  },
  {
    key: "AQ",
    name: "AQ",
    shareText: "5.3% of revenue",
    posture: "Restructure billing + margin investigation",
    inv: 3, ar: 60, ca: 101, ap: 76,
    dio: 6, dso: 286, dpo: 164,
    tInv: 3, tAr: 60, tCa: 50, tAp: 76, tDio: 6, tDso: 145, tDpo: 164,
    notes: [
      "Fastest CAGR in portfolio (+42%); no slowdown.",
      "Contract Assets at 49% of revenue — chronic three-year pattern.",
      "Gross margin collapsed 1,300 bps in FY-2025 on 37% revenue growth.",
      "Lever: shared contract intelligence platform with Citiscape. Release ≈ SAR 80m.",
    ],
  },
  {
    key: "MEAC",
    name: "MEAC",
    shareText: "3.0% of revenue",
    posture: "Restore supplier terms",
    inv: 22, ar: 31, ca: 0, ap: 16,
    dio: 90, dso: 96, dpo: 68,
    tInv: 15, tAr: 31, tCa: 0, tAp: 31, tDio: 60, tDso: 96, tDpo: 127,
    notes: [
      "Revenue plateaued at SAR 118–120m — mature niche.",
      "DPO dropped 59 days over two years (127 → 68); SAR 14m of WC cost.",
      "DIO actively reduced 147 → 90 — best-in-class operational management.",
      "Lever: restore FY-2023 supplier terms. Release ≈ SAR 21m.",
    ],
  },
  {
    key: "Eaton-KSA",
    name: "Eaton-KSA",
    shareText: "4.3% of revenue",
    posture: "Tighten billing milestones",
    inv: 15, ar: 40, ca: 54, ap: 48,
    dio: 41, dso: 206, dpo: 128,
    tInv: 11, tAr: 40, tCa: 25, tAp: 51, tDio: 30, tDso: 150, tDpo: 140,
    notes: [
      "CCC improved 33 days over three years.",
      "Unbilled grew from 12% to 32% of revenue — real DSO drift masked.",
      "Gross margin volatile (22.9% / 31.7% / 18.6%) — project-mix driven.",
      "Lever: shared contract intelligence platform. Release ≈ SAR 30m.",
    ],
  },
  {
    key: "SMC",
    name: "SMC",
    shareText: "7.8% of revenue",
    posture: "Forensic restoration",
    inv: 61, ar: 35, ca: 0, ap: 48,
    dio: 96, dso: 43, dpo: 75,
    tInv: 38, tAr: 35, tCa: 0, tAp: 116, tDio: 60, tDso: 43, tDpo: 182,
    notes: [
      "FY-2024 was best-in-class: CCC −8 days, suppliers fully financing operations.",
      "DPO collapsed 182 → 75 in FY-2025 — largest single-metric deterioration.",
      "Lost financing worth ~SAR 68m of working capital.",
      "Lever: diagnose supplier rupture, restore DPO. Release ≈ SAR 91m.",
    ],
  },
  {
    key: "KSB",
    name: "KSB",
    shareText: "6.4% of revenue",
    posture: "Aggressive optimisation",
    inv: 79, ar: 110, ca: 0, ap: 26,
    dio: 154, dso: 161, dpo: 50,
    tInv: 46, tAr: 89, tCa: 0, tAp: 61, tDio: 90, tDso: 130, tDpo: 120,
    notes: [
      "CCC 265 days — longest in portfolio. NWC at 65% of revenue, 2.6× benchmark.",
      "KSB pays suppliers in <2 months while collecting in 5 months.",
      "Lever: group-level supplier renegotiation (DPO 50→120) — biggest single move.",
      "Identified release ≈ SAR 90m.",
    ],
  },
  {
    key: "STCL",
    name: "STCL",
    shareText: "<1% of revenue",
    posture: "Portfolio decision required",
    inv: 0, ar: 65, ca: 1, ap: 23,
    dio: 0, dso: 1947, dpo: 676,
    tInv: 0, tAr: 30, tCa: 0, tAp: 23, tDio: 0, tDso: 600, tDpo: 676,
    notes: [
      "Revenue collapsed 84% in FY-2025; AR represents 5.3 years of sales.",
      "Gross margin fell 28% → 1%; structurally distressed.",
      "Lever: provision uncollectable AR, aggressive collection.",
      "Strategic decision: wind-down, merge or divest.",
    ],
  },
  {
    key: "IICS",
    name: "IICS",
    shareText: "<1% of revenue",
    posture: "Portfolio decision required",
    inv: 0, ar: 7, ca: 7, ap: 4,
    dio: 3, dso: 409, dpo: 102,
    tInv: 0, tAr: 4, tCa: 4, tAp: 4, tDio: 3, tDso: 200, tDpo: 102,
    notes: [
      "Revenue collapsed 78% in FY-2025; sub-scale and structurally unprofitable.",
      "Gross margin flipped to −25%.",
      "Lever: collect or write off stranded balance.",
      "Combined with STCL/ABCI: ~SAR 60m of WC tied up across <1% of revenue.",
    ],
  },
];

// Narrative slots — long-form prose addressed by stable keys. Mirrors
// the framing/definition/summary chunks currently in lib/working-capital/
// knowledge.ts. Per-SBU narratives live on the SBU rows themselves.
export const NARRATIVE_SEEDS: Array<{
  slot: string;
  title: string;
  body: string;
  displayOrder: number;
}> = [
  {
    slot: "framing.overview",
    title: "Framing — overview",
    displayOrder: 10,
    body: `Abunayyan Holding's Working Capital & CCC interactive brief models the FY-2025 baseline across ten active SBUs plus the consolidated group view. Operating NWC is defined as Inventory + Accounts Receivable + Contract Assets minus Accounts Payable. The Cash Conversion Cycle (CCC) is DIO + DSO − DPO. The brief lets users drag levers — inventory days, AR days, contract assets, payable days — and recalculates SBU-level NWC, group totals, and identified cash release in real time.`,
  },
  {
    slot: "framing.target",
    title: "Framing — target",
    displayOrder: 20,
    body: `The headline operational target is SAR 540 million of cash released versus the FY-2025 baseline. Three scenario presets interpolate every SBU's slider between the FY-2025 actual and its 12-month operational target: Conservative reaches 35% of target, Aggressive reaches 70%, and Hit All Targets reaches 100%. The same scenario adjustment compresses CCC and lowers NWC / Revenue. Operating NWC excludes cash and short-term debt (not present in the source workbook).`,
  },
  {
    slot: "definitions.metrics",
    title: "Definitions",
    displayOrder: 30,
    body: `Key metric definitions used throughout the brief. DIO (Days Inventory Outstanding) measures how many days of cost-of-goods are tied up in inventory. DSO (Days Sales Outstanding) measures how long it takes to collect cash after a sale. DPO (Days Payable Outstanding) measures how long the business takes to pay suppliers. Contract Assets (CA) are unbilled revenue — work performed but not yet invoiced. Operating NWC at the group level is reported in SAR millions; CCC components are reported in days.`,
  },
  {
    slot: "summary.releases",
    title: "Cash-release summary",
    displayOrder: 80,
    body: `Cash-release summary at full operational targets, by SBU: Citiscape ≈ SAR 152m, ATC ≈ SAR 151m, SMC ≈ SAR 91m, KSB ≈ SAR 90m, AQ ≈ SAR 80m, Eaton-KSA ≈ SAR 30m, MEAC ≈ SAR 21m, with Wetico contributing stability rather than release and STCL/IICS handled via portfolio actions. Aggregating across the portfolio produces the SAR 540m operational target tracked in the hero.`,
  },
  {
    slot: "summary.themes",
    title: "Cross-portfolio themes",
    displayOrder: 90,
    body: `Three cross-portfolio themes emerge. First, unbilled revenue is the single largest trapped-cash pool — Citiscape, AQ, and Eaton-KSA all benefit from a shared contract-intelligence platform. Second, supplier terms are the largest single lever where they have ruptured (SMC) or never been negotiated (KSB) — DPO restoration alone unlocks roughly SAR 159m across those two SBUs. Third, two units (STCL, IICS) are below scale and require portfolio decisions rather than working-capital optimisation.`,
  },
];
