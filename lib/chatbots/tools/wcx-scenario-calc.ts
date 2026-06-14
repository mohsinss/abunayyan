import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { listTargetsForUpload } from "@/lib/db/queries/wc-intelligence";
import { loadIndex, provenanceOf, resolveSbu } from "@/lib/wcx/engine";
import { buildScenarioBaselines, SCENARIO_BASE_KEYS } from "@/lib/wcx/scenario-baseline";
import {
  applyLever,
  applyPreset,
  cashReleased,
  cccOf,
  groupTotalsOf,
  nwcOf,
  WCX_LEVER_FIELDS,
  type WcxLeverShape,
} from "@/lib/wcx/scenario";
import type { ToolDefinition } from "./types";
import { isToolError, requireWcxContext, round } from "./wcx-shared";

const description =
  "Run a working-capital what-if scenario on the latest actuals from the active WC workbook " +
  "upload — the same math as the dashboard's Scenario Lab. presetFactor interpolates every SBU " +
  "lever toward its Sheet-14 target (0=actuals, 0.35=conservative, 0.7=aggressive, 1=hit all " +
  "targets); overrides then pin specific levers (e.g. KSB dpo to 60 days). Balance edits reprice " +
  "the coupled day-count using the SBU's real trailing-12-month flows and vice versa. Returns " +
  "baseline vs adjusted group NWC/CCC, cash released, and per-SBU deltas — all computed in code. " +
  "What-if only: stored actuals are never modified.";

export const wcxScenarioCalc: ToolDefinition = {
  id: "wcxScenarioCalc",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        presetFactor: z.number().min(0).max(1).default(0)
          .describe("Progress toward Sheet-14 targets applied to ALL SBUs before overrides."),
        overrides: z
          .array(
            z.object({
              sbu: z.string().max(48),
              field: z.enum(WCX_LEVER_FIELDS),
              value: z.number().finite()
                .describe("New lever value (SAR for inv/ar/ca/ap, days for dio/dso/dpo)."),
            }),
          )
          .max(30)
          .default([]),
      }),
      execute: async ({ presetFactor, overrides }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;
        const latest = ctx.upload.periodEnd;
        if (!latest) return { error: "NO_PERIOD", message: "Upload has no period coverage." };

        const [idx, targets] = await Promise.all([
          loadIndex(ctx.upload.id, SCENARIO_BASE_KEYS),
          listTargetsForUpload(ctx.upload.id),
        ]);
        const baselines = buildScenarioBaselines(
          idx,
          ctx.sbus.map((s) => ({ code: s.code, name: s.name })),
          targets,
          latest,
        );

        const shapes: Record<string, WcxLeverShape> = {};
        for (const b of baselines) shapes[b.code] = applyPreset(b, presetFactor);

        const unknown: string[] = [];
        for (const ov of overrides) {
          const { code } = resolveSbu(ctx.sbus, ov.sbu);
          const baseline = baselines.find((b) => b.code === code);
          if (!code || !baseline) {
            unknown.push(ov.sbu);
            continue;
          }
          shapes[code] = applyLever(baseline, shapes[code] ?? baseline.shape, ov.field, ov.value);
        }

        const base = groupTotalsOf(baselines, Object.fromEntries(baselines.map((b) => [b.code, b.shape])));
        const adjusted = groupTotalsOf(baselines, shapes);
        const release = cashReleased(baselines, shapes);

        const perSbu = baselines
          .map((b) => {
            const s = shapes[b.code]!;
            const dNwc = nwcOf(s) - nwcOf(b.shape);
            const dCcc = cccOf(s) - cccOf(b.shape);
            return {
              sbu: b.code,
              nwc: round(nwcOf(s)),
              nwcDelta: round(dNwc),
              ccc: round(cccOf(s)),
              cccDelta: round(dCcc),
            };
          })
          .filter((r) => Math.abs(r.nwcDelta) >= 0.5 || Math.abs(r.cccDelta) >= 0.5)
          // Biggest cash release first so rankings quoted by the model
          // match the data without it having to sort.
          .sort((a, b) => a.nwcDelta - b.nwcDelta);

        return {
          scenario: {
            presetFactor,
            overridesApplied: overrides.length - unknown.length,
            ...(unknown.length > 0 ? { unknownSbus: unknown } : {}),
          },
          baselineMonth: latest,
          group: {
            baseline: { nwc: round(base.nwc), ccc: round(base.ccc) },
            adjusted: { nwc: round(adjusted.nwc), ccc: round(adjusted.ccc) },
            cashReleased: round(release),
            cccCompressionDays: round(base.ccc - adjusted.ccc),
          },
          changedSbus: perSbu,
          basis:
            "Lever coupling priced on each SBU's real trailing-12-month flows; group CCC from group balances over group flows. What-if only — stored actuals unchanged.",
          provenance: provenanceOf(ctx.upload, null),
        };
      },
    }),
};
