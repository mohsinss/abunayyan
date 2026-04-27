// Curated knowledge base for the Working Capital Analyst RAG chatbot.
//
// Each chunk pairs a stable `id` (used as the diff key on retrain) with a
// self-contained prose passage. Numbers are inlined as words so the
// embedding captures their meaning, not just labels. Source: the FY-2025
// Working Capital & CCC interactive brief at
// /public/dashboards/working-capital-ccc.html.
//
// Edit prose freely; an admin retrain re-embeds only changed chunks.

export type WorkingCapitalChunk = {
  id: string;
  content: string;
};

export const WORKING_CAPITAL_CHUNKS: WorkingCapitalChunk[] = [
  {
    id: "framing.overview",
    content: `Abunayyan Holding's Working Capital & CCC interactive brief models the FY-2025 baseline across ten active SBUs plus the consolidated group view. Operating NWC is defined as Inventory + Accounts Receivable + Contract Assets minus Accounts Payable. The Cash Conversion Cycle (CCC) is DIO + DSO − DPO. The brief lets users drag levers — inventory days, AR days, contract assets, payable days — and recalculates SBU-level NWC, group totals, and identified cash release in real time.`,
  },
  {
    id: "framing.target",
    content: `The headline operational target is SAR 540 million of cash released versus the FY-2025 baseline. Three scenario presets interpolate every SBU's slider between the FY-2025 actual and its 12-month operational target: Conservative reaches 35% of target, Aggressive reaches 70%, and Hit All Targets reaches 100%. The same scenario adjustment compresses CCC and lowers NWC / Revenue. Operating NWC excludes cash and short-term debt (not present in the source workbook).`,
  },
  {
    id: "definitions.metrics",
    content: `Key metric definitions used throughout the brief. DIO (Days Inventory Outstanding) measures how many days of cost-of-goods are tied up in inventory. DSO (Days Sales Outstanding) measures how long it takes to collect cash after a sale. DPO (Days Payable Outstanding) measures how long the business takes to pay suppliers. Contract Assets (CA) are unbilled revenue — work performed but not yet invoiced. Operating NWC at the group level is reported in SAR millions; CCC components are reported in days.`,
  },
  {
    id: "group.kpis",
    content: `Group-level KPIs displayed at the top of the dashboard: Group Revenue (FY-2025 baseline), Operating NWC in SAR millions, NWC / Revenue as a percentage, Group CCC in days, and Cash Released versus baseline. Movement in any SBU slider reflows the entire group view. The progress bar shows cash released as a fraction of the SAR 540m operational target. The current FY-2025 baseline NWC / Revenue is 21.2%.`,
  },
  {
    id: "group.charts",
    content: `Two group-level charts anchor the dashboard. "NWC contribution by SBU" stacks the four working-capital components — Inventory, AR, Contract Assets, AP — for each SBU, showing current vs adjusted side by side. "CCC by SBU (days)" plots baseline-vs-adjusted CCC sorted from longest to shortest, exposing which SBUs lengthen the group cycle most.`,
  },

  {
    id: "sbu.atc.summary",
    content: `ATC contributes about 20% of group revenue and is positioned "Optimise — within band, trajectory wrong." FY-2025 baseline: Inventory SAR 183m, AR SAR 243m, Contract Assets SAR 59m, Payables SAR 368m, with DIO 100 days, DSO 140 days, DPO 201 days. The 12-month operational target compresses DIO to 44 days and DSO to 117 days while preserving DPO at 201 days, dropping inventory to SAR 80m and AR to SAR 203m. Identified cash release at full target ≈ SAR 151m.`,
  },
  {
    id: "sbu.atc.story",
    content: `ATC's working-capital story has three lines. Inventory was built about 25% on only 9% revenue growth — DIO of 100 days versus a group median of 23 days flags overstocking. DSO jumped 23 days during FY-2025, newly trapping roughly SAR 49m in receivables. DPO of 201 days is the strongest supplier leverage in the portfolio and should be held, not stretched further. Lever recommended: ML demand forecasting plus collections AI.`,
  },
  {
    id: "sbu.wetico.summary",
    content: `Wetico is the largest SBU at 42% of group revenue and is positioned "Stabilise volatility, not reduce position." FY-2025 baseline: Inventory SAR 18m, AR SAR 348m, Contract Assets SAR 195m, Payables SAR 392m, with DIO 5 days, DSO 123 days, DPO 109 days. The operational target keeps DIO/DSO/CA flat and lifts DPO to 125 days, taking AP to SAR 450m.`,
  },
  {
    id: "sbu.wetico.story",
    content: `Wetico has the best CCC of any large SBU at 19 days and NWC at roughly 10% of revenue. The risk is volatility: DPO swung 168 → 48 → 109 days across recent years, signalling supplier terms that drift by project cycle. AR fell SAR 375m in FY-2025, large enough that a reclassification is suspected and a forensic audit is required to confirm. Recommended lever: lock Master Service Agreements at 120-day payable terms to stop the swings rather than chase further reductions.`,
  },
  {
    id: "sbu.citiscape.summary",
    content: `Citiscape contributes 10.5% of group revenue and is positioned "Restructure billing discipline." FY-2025 baseline: Inventory SAR 4m, AR SAR 70m, Contract Assets SAR 196m, Payables SAR 92m, with DIO 5 days, DSO 238 days, DPO 105 days. The operational target halves Contract Assets to SAR 65m, brings DSO to 130 days, and lifts DPO to 130 days. Identified cash release ≈ SAR 152m.`,
  },
  {
    id: "sbu.citiscape.story",
    content: `Citiscape's defining problem is unbilled revenue. Contract Assets sit at 48% of revenue — half of annual sales are unbilled at year-end. AR fell SAR 32m while Unbilled rose SAR 131m, evidence that billing milestones lag revenue recognition. Gross margin also collapsed about 1,010 basis points in FY-2025 and warrants a separate investigation. Recommended lever: a contract-intelligence platform to halve unbilled, shared with AQ where the same pattern exists.`,
  },
  {
    id: "sbu.aq.summary",
    content: `AQ contributes 5.3% of group revenue and is positioned "Restructure billing + margin investigation." FY-2025 baseline: Inventory SAR 3m, AR SAR 60m, Contract Assets SAR 101m, Payables SAR 76m, with DIO 6 days, DSO 286 days, DPO 164 days. The operational target halves Contract Assets to SAR 50m and brings DSO to 145 days while holding DPO at 164 days. Identified cash release ≈ SAR 80m.`,
  },
  {
    id: "sbu.aq.story",
    content: `AQ has the fastest CAGR in the portfolio at +42% and shows no slowdown. Contract Assets at 49% of revenue mirror the Citiscape pattern and form a chronic three-year trend. Gross margin collapsed about 1,300 basis points on 37% revenue growth — fast growth at deteriorating margins. Recommended lever: the same shared contract-intelligence platform proposed for Citiscape.`,
  },
  {
    id: "sbu.meac.summary",
    content: `MEAC contributes 3.0% of group revenue and is positioned "Restore supplier terms." FY-2025 baseline: Inventory SAR 22m, AR SAR 31m, Contract Assets SAR 0m, Payables SAR 16m, with DIO 90 days, DSO 96 days, DPO 68 days. The operational target lifts DPO to 127 days, drops DIO to 60 days and inventory to SAR 15m. Identified cash release ≈ SAR 21m.`,
  },
  {
    id: "sbu.meac.story",
    content: `MEAC's revenue has plateaued at SAR 118-120m, a mature niche. DPO dropped 59 days over two years (from 127 to 68), at a working-capital cost of about SAR 14m. On the operational side, DIO was actively reduced from 147 to 90 days — best-in-class operational management. Recommended lever: restore FY-2023 supplier payment terms.`,
  },
  {
    id: "sbu.eaton-ksa.summary",
    content: `Eaton-KSA contributes 4.3% of group revenue and is positioned "Tighten billing milestones." FY-2025 baseline: Inventory SAR 15m, AR SAR 40m, Contract Assets SAR 54m, Payables SAR 48m, with DIO 41 days, DSO 206 days, DPO 128 days. The operational target halves Contract Assets to SAR 25m, brings DSO to 150 days, and lifts DPO to 140 days. Identified cash release ≈ SAR 30m.`,
  },
  {
    id: "sbu.eaton-ksa.story",
    content: `Eaton-KSA's CCC improved 33 days over three years, but the headline understates drift. Unbilled revenue grew from 12% to 32% of revenue, masking real DSO drift behind reported numbers. Gross margin is volatile — 22.9% / 31.7% / 18.6% across recent years — driven by project mix. Recommended lever: the shared contract-intelligence platform deployed for Citiscape and AQ.`,
  },
  {
    id: "sbu.smc.summary",
    content: `SMC contributes 7.8% of group revenue and is positioned "Forensic restoration." FY-2025 baseline: Inventory SAR 61m, AR SAR 35m, Contract Assets SAR 0m, Payables SAR 48m, with DIO 96 days, DSO 43 days, DPO 75 days. The operational target compresses DIO to 60 days and inventory to SAR 38m, and lifts DPO sharply to 182 days, taking AP to SAR 116m. Identified cash release ≈ SAR 91m.`,
  },
  {
    id: "sbu.smc.story",
    content: `SMC's FY-2024 was best-in-class: CCC of negative 8 days, with suppliers fully financing operations. In FY-2025, DPO collapsed from 182 to 75 days — the largest single-metric deterioration in the portfolio. The lost financing represents about SAR 68m of working capital. Recommended lever: diagnose the supplier rupture and restore FY-2024 DPO levels.`,
  },
  {
    id: "sbu.ksb.summary",
    content: `KSB contributes 6.4% of group revenue and is positioned "Aggressive optimisation." FY-2025 baseline: Inventory SAR 79m, AR SAR 110m, Contract Assets SAR 0m, Payables SAR 26m, with DIO 154 days, DSO 161 days, DPO 50 days. The operational target compresses DIO to 90 days and DSO to 130 days while more than doubling DPO to 120 days, taking AP to SAR 61m. Identified cash release ≈ SAR 90m.`,
  },
  {
    id: "sbu.ksb.story",
    content: `KSB has the longest CCC in the portfolio at 265 days. NWC sits at 65% of revenue, about 2.6× the relevant benchmark. The structural problem is a payable/receivable mismatch: KSB pays suppliers in under two months while collecting from customers in five months. Recommended lever: group-level supplier renegotiation taking DPO from 50 to 120 days — the single largest cash-release move available.`,
  },
  {
    id: "sbu.stcl.summary",
    content: `STCL contributes under 1% of group revenue and is in "Portfolio decision required." FY-2025 baseline: Inventory SAR 0m, AR SAR 65m, Contract Assets SAR 1m, Payables SAR 23m, with DIO 0 days, DSO 1,947 days, DPO 676 days. Targets compress DSO to 600 days while holding DPO. AR represents about 5.3 years of sales.`,
  },
  {
    id: "sbu.stcl.story",
    content: `STCL is structurally distressed. Revenue collapsed 84% in FY-2025; gross margin fell from 28% to 1%. The AR balance equates to roughly 5.3 years of sales, indicating uncollectable receivables. Recommended action: provision uncollectable AR, run aggressive collection, and take a strategic decision to wind down, merge, or divest the unit.`,
  },
  {
    id: "sbu.iics.summary",
    content: `IICS contributes under 1% of group revenue and is in "Portfolio decision required." FY-2025 baseline: Inventory SAR 0m, AR SAR 7m, Contract Assets SAR 7m, Payables SAR 4m, with DIO 3 days, DSO 409 days, DPO 102 days. The operational target compresses DSO to 200 days and AR to SAR 4m while leaving payables flat.`,
  },
  {
    id: "sbu.iics.story",
    content: `IICS is sub-scale and structurally unprofitable. Revenue collapsed 78% in FY-2025. The unit is too small to fund a turnaround and the strategic question is the same as STCL: wind down, merge, or divest.`,
  },

  {
    id: "summary.releases",
    content: `Cash-release summary at full operational targets, by SBU: Citiscape ≈ SAR 152m, ATC ≈ SAR 151m, SMC ≈ SAR 91m, KSB ≈ SAR 90m, AQ ≈ SAR 80m, Eaton-KSA ≈ SAR 30m, MEAC ≈ SAR 21m, with Wetico contributing stability rather than release and STCL/IICS handled via portfolio actions. Aggregating across the portfolio produces the SAR 540m operational target tracked in the hero.`,
  },
  {
    id: "summary.themes",
    content: `Three cross-portfolio themes emerge. First, unbilled revenue is the single largest trapped-cash pool — Citiscape, AQ, and Eaton-KSA all benefit from a shared contract-intelligence platform. Second, supplier terms are the largest single lever where they have ruptured (SMC) or never been negotiated (KSB) — DPO restoration alone unlocks roughly SAR 159m across those two SBUs. Third, two units (STCL, IICS) are below scale and require portfolio decisions rather than working-capital optimisation.`,
  },
];
