// Builds Scenario Lab baselines from the active upload's facts index:
// latest month-end balances priced over real trailing-12-month flows.
// Shared by the dashboard payload and the wcxScenarioCalc chat tool.

import { ttmAnnualized, valueAt, type FactsIndex } from "./derive";
import type { WcxLeverShape, WcxScenarioBaseline } from "./scenario";

export type ScenarioTargetRow = {
  sbuCode: string;
  targetInventory: number | null;
  targetAr: number | null;
  targetContractAssets: number | null;
  targetAp: number | null;
  targetDio: number | null;
  targetDso: number | null;
  targetDpo: number | null;
  targetCashReleased: number | null;
};

export const SCENARIO_BASE_KEYS = [
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
];

export function buildScenarioBaselines(
  idx: FactsIndex,
  sbus: Array<{ code: string; name: string }>,
  targets: ScenarioTargetRow[],
  latestMonth: string,
): WcxScenarioBaseline[] {
  return sbus.map((sbu) => {
    const inv = valueAt(idx, sbu.code, "bs.inventory_net", latestMonth) ?? 0;
    const ar = valueAt(idx, sbu.code, "bs.trade_receivables", latestMonth) ?? 0;
    const ca = valueAt(idx, sbu.code, "bs.contract_assets", latestMonth) ?? 0;
    const ap = valueAt(idx, sbu.code, "bs.trade_payables", latestMonth) ?? 0;

    // ttmAnnualized applies the effective-COGS fallback (component sum)
    // internally when the workbook's "COGS — Total" calc cells are empty.
    const cogsTtm = ttmAnnualized(idx, sbu.code, "pl.cogs_total", latestMonth)?.value ?? null;
    const revTtm = ttmAnnualized(idx, sbu.code, "pl.revenue_invoiced", latestMonth)?.value ?? null;

    // Real flows preferred; tiny floors keep the lever coupling sane for
    // SBUs with no flow history (mirrors the legacy brief's 0.05 floor).
    const cogsPerDay = cogsTtm && cogsTtm > 0 ? cogsTtm / 365 : 0.05;
    const revPerDay = revTtm && revTtm > 0 ? revTtm / 365 : 0.05;

    const shape: WcxLeverShape = {
      inv,
      ar,
      ca,
      ap,
      dio: inv / cogsPerDay,
      dso: (ar + ca) / revPerDay,
      dpo: ap / cogsPerDay,
    };

    const t = targets.find((row) => row.sbuCode === sbu.code);
    const target: WcxScenarioBaseline["target"] = {};
    if (t) {
      if (t.targetInventory !== null) target.inv = t.targetInventory;
      if (t.targetAr !== null) target.ar = t.targetAr;
      if (t.targetContractAssets !== null) target.ca = t.targetContractAssets;
      if (t.targetAp !== null) target.ap = t.targetAp;
      if (t.targetDio !== null) target.dio = t.targetDio;
      if (t.targetDso !== null) target.dso = t.targetDso;
      if (t.targetDpo !== null) target.dpo = t.targetDpo;
    }
    // Every slider shows a target marker by default (like the original
    // brief). Levers Sheet 14 left blank fall back to "hold the baseline",
    // which also makes preset interpolation a no-op for them.
    const fields: Array<keyof WcxLeverShape> = ["inv", "ar", "ca", "ap", "dio", "dso", "dpo"];
    for (const f of fields) {
      if (target[f] === undefined) target[f] = shape[f];
    }

    return {
      code: sbu.code,
      name: sbu.name,
      shape,
      cogsPerDay,
      revPerDay,
      target,
      targetCashReleased: t?.targetCashReleased ?? null,
    };
  });
}
