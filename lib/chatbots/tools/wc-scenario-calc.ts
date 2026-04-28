import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { listActiveSbus } from "@/lib/db/queries/working-capital";
import { getWorkingCapitalGroup } from "@/lib/db/queries/working-capital";
import {
  applyOverrides,
  applyPreset,
  cccOf,
  groupTotalsOf,
  nwcOf,
  SBU_FIELDS,
  type LeverOverride,
  type SbuShape,
  type SbuWithTargets,
} from "@/lib/working-capital-data/derive";
import type { ToolDefinition } from "./types";

const description =
  "Run a working-capital what-if scenario. Use 'preset' (0..1) to interpolate every " +
  "SBU between FY-2025 baseline and 12-month target (Conservative=0.35, Aggressive=0.7, " +
  "HitAll=1.0). Use 'overrides' to set specific lever values for named SBUs (applied " +
  "after the preset). Returns per-SBU + group cash release. Math is identical to the " +
  "interactive sliders.";

function shapeOf(row: {
  inv: number; ar: number; ca: number; ap: number;
  dio: number; dso: number; dpo: number;
}): SbuShape {
  return { inv: row.inv, ar: row.ar, ca: row.ca, ap: row.ap, dio: row.dio, dso: row.dso, dpo: row.dpo };
}

function withTargets(s: {
  key: string;
  inv: number; ar: number; ca: number; ap: number;
  dio: number; dso: number; dpo: number;
  tInv: number; tAr: number; tCa: number; tAp: number;
  tDio: number; tDso: number; tDpo: number;
}): SbuWithTargets {
  return {
    key: s.key,
    inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
    dio: s.dio, dso: s.dso, dpo: s.dpo,
    tInv: s.tInv, tAr: s.tAr, tCa: s.tCa, tAp: s.tAp,
    tDio: s.tDio, tDso: s.tDso, tDpo: s.tDpo,
  };
}

export const wcScenarioCalc: ToolDefinition = {
  id: "wcScenarioCalc",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        preset: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "0..1 factor applied to every SBU. 0 = baseline, 1 = full target. Common: 0.35, 0.7, 1.",
          ),
        overrides: z
          .array(
            z.object({
              sbuKey: z.string().min(1).max(32),
              field: z.enum(SBU_FIELDS),
              value: z.number(),
            }),
          )
          .max(60)
          .optional()
          .describe("Per-SBU lever overrides applied AFTER preset. SBU keys not in the data are ignored."),
      }),
      execute: async ({ preset, overrides }) => {
        const [group, sbus] = await Promise.all([
          getWorkingCapitalGroup(),
          listActiveSbus(),
        ]);
        if (!group || sbus.length === 0) {
          return { error: "NOT_SEEDED", message: "wc_groups / wc_sbus are empty." };
        }

        const baseMap = new Map<string, SbuShape>(sbus.map((s) => [s.key, shapeOf(s)]));

        // Step 1: apply preset (or default to baseline) per SBU.
        const adjMap = new Map<string, SbuShape>();
        const factor = typeof preset === "number" ? preset : 0;
        for (const s of sbus) {
          adjMap.set(s.key, applyPreset(withTargets(s), factor));
        }

        // Step 2: layer per-SBU overrides on top.
        const finalMap = applyOverrides(
          adjMap,
          (overrides ?? []) as LeverOverride[],
        );

        const baseList = sbus.map((s) => baseMap.get(s.key)!);
        const adjList = sbus.map((s) => finalMap.get(s.key)!);

        const groupBase = groupTotalsOf(baseList);
        const groupAdj = groupTotalsOf(adjList);

        const perSbu = sbus.map((s, i) => {
          const b = baseList[i]!;
          const a = adjList[i]!;
          const nB = nwcOf(b);
          const nA = nwcOf(a);
          const cB = cccOf(b);
          const cA = cccOf(a);
          return {
            key: s.key,
            name: s.name,
            nwcBase: nB,
            nwcAdjusted: nA,
            deltaNwc: nA - nB,
            cccBase: cB,
            cccAdjusted: cA,
            deltaCcc: cA - cB,
            cashRelease: nB - nA,
          };
        });

        const cashRelease = groupBase.nwc - groupAdj.nwc;
        const targetRelease = group.nwcTargetRelease;
        const progressPct =
          targetRelease > 0
            ? Math.max(0, Math.min(1, cashRelease / targetRelease))
            : 0;

        return {
          input: {
            preset: factor,
            overridesApplied: (overrides ?? []).length,
          },
          perSbu,
          group: {
            fiscalYear: group.fiscalYear,
            revenue: groupBase.revenue,
            nwcBase: groupBase.nwc,
            nwcAdjusted: groupAdj.nwc,
            cccBase: groupBase.ccc,
            cccAdjusted: groupAdj.ccc,
            nwcPctRevenueBase: groupBase.nwcPctRevenue,
            nwcPctRevenueAdjusted: groupAdj.nwcPctRevenue,
            cashRelease,
            targetRelease,
            progressPct,
          },
        };
      },
    }),
};
