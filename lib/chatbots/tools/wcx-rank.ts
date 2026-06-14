import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { isMacroMetric, computeValue, loadIndex, provenanceOf } from "@/lib/wcx/engine";
import type { ToolDefinition } from "./types";
import {
  isToolError,
  requireWcxContext,
  resolveMetricOrError,
  resolvePeriodOrError,
  round,
} from "./wcx-shared";

const description =
  "Rank all SBUs by one metric for a period (month or FY), computed deterministically from the " +
  "active WC workbook upload. Use for 'which SBU has the longest CCC', 'top 3 by revenue', " +
  "'who deteriorated most' (rank the period-over-period delta via deltaVsPeriod).";

export const wcxRank: ToolDefinition = {
  id: "wcxRank",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        metric: z.string().max(96).describe("Metric key, label, or synonym."),
        period: z.string().max(32).optional()
          .describe("'YYYY-MM' | 'FY-YYYY'. Defaults to latest month."),
        direction: z.enum(["desc", "asc"]).default("desc")
          .describe("'desc' = highest first."),
        limit: z.number().int().min(1).max(13).default(13),
        deltaVsPeriod: z.string().max(32).optional()
          .describe("When set, rank by the change from this baseline period to `period`."),
      }),
      execute: async ({ metric, period, direction, limit, deltaVsPeriod }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        const def = resolveMetricOrError(metric);
        if (isToolError(def)) return def;
        if (isMacroMetric(def.key)) {
          return {
            error: "NOT_RANKABLE",
            message: `${def.label} is a group-level macro variable — there is nothing to rank across SBUs.`,
          };
        }
        const months = resolvePeriodOrError(ctx, period);
        if (isToolError(months)) return months;
        const baseline = deltaVsPeriod ? resolvePeriodOrError(ctx, deltaVsPeriod) : null;
        if (baseline && isToolError(baseline)) return baseline;

        const idx = await loadIndex(ctx.upload.id, [def.key]);

        const rows = ctx.sbus
          .map((s) => {
            const cur = computeValue(idx, s.code, def.key, months.months);
            if (!cur) return null;
            if (baseline) {
              const base = computeValue(idx, s.code, def.key, baseline.months);
              if (!base) return null;
              return {
                sbu: `${s.code} (${s.name})`,
                value: round(cur.value - base.value),
                current: round(cur.value),
                baseline: round(base.value),
              };
            }
            return { sbu: `${s.code} (${s.name})`, value: round(cur.value) };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .sort((a, b) => (direction === "desc" ? b.value - a.value : a.value - b.value))
          .slice(0, limit);

        if (rows.length === 0) {
          return { error: "NO_DATA", message: `No data for ${def.label} in ${months.label}.` };
        }
        return {
          metric: { key: def.key, label: def.label, unit: def.unit },
          period: months.label,
          ...(baseline ? { rankedBy: `change vs ${baseline.label}` } : {}),
          rows,
          provenance: provenanceOf(ctx.upload, def),
        };
      },
    }),
};
