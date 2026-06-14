import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { metricByKey } from "@/lib/wcx/metrics";
import {
  GROUP_AGG,
  computeValue,
  isGroupable,
  loadIndex,
  provenanceOf,
  withGroupAggregate,
} from "@/lib/wcx/engine";
import type { ToolDefinition } from "./types";
import {
  isToolError,
  requireWcxContext,
  resolveEntityOrError,
  resolveMetricOrError,
  resolvePeriodOrError,
  round,
} from "./wcx-shared";

const description =
  "Aggregate one metric over a period (FY or month range) for one SBU or the GROUP, using the " +
  "metric's registered aggregation rule: flows are summed, balances take the end-of-period " +
  "value, rates are averaged. Use this for 'total FY-2025 revenue', 'group NWC for FY-24', " +
  "'average SAIBOR in 2024'. The rule applied is reported in `basis` — quote it when the " +
  "distinction matters.";

export const wcxAggregate: ToolDefinition = {
  id: "wcxAggregate",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        metric: z.string().max(96).describe("Metric key, label, or synonym."),
        period: z.string().max(32)
          .describe("'FY-YYYY' | 'YYYY-MM' | 'YYYY-MM to YYYY-MM'."),
        sbu: z.string().max(48).optional()
          .describe("SBU code/name or 'GROUP'. Defaults to GROUP aggregate."),
        breakdown: z.boolean().optional()
          .describe("When true, also return the per-SBU breakdown (groupable metrics only)."),
      }),
      execute: async ({ metric, period, sbu, breakdown }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        const def = resolveMetricOrError(metric);
        if (isToolError(def)) return def;
        const entity = resolveEntityOrError(ctx, def, sbu);
        if (isToolError(entity)) return entity;
        const months = resolvePeriodOrError(ctx, period);
        if (isToolError(months)) return months;

        const registered = metricByKey(def.key);
        if (registered && registered.agg === "none" && !def.key.startsWith("derived.")) {
          return {
            error: "NOT_AGGREGATABLE",
            message:
              `${def.label} is a per-month ratio and cannot be aggregated directly. ` +
              `Use the derived equivalent (e.g. derived.gross_margin_pct, derived.ccc) which is recomputed for the period.`,
          };
        }
        if (entity.entity === GROUP_AGG && !isGroupable(def.key)) {
          return {
            error: "NOT_GROUPABLE",
            message: `${def.label} is a rate/average metric — summing it across SBUs is not meaningful. Ask per SBU instead.`,
          };
        }

        let idx = await loadIndex(
          ctx.upload.id,
          [def.key],
          entity.entity === GROUP_AGG ? undefined : [entity.entity],
        );
        if (entity.entity === GROUP_AGG) {
          idx = withGroupAggregate(idx, ctx.sbus.map((s) => s.code), [def.key]);
        }

        const result = computeValue(idx, entity.entity, def.key, months.months);
        if (!result) {
          return {
            error: "NO_DATA",
            message: `No data for ${def.label} · ${entity.entityLabel} · ${months.label}.`,
          };
        }

        let perSbu: Array<{ sbu: string; value: number | null }> | undefined;
        if (breakdown && entity.entity === GROUP_AGG) {
          perSbu = ctx.sbus.map((s) => {
            const v = computeValue(idx, s.code, def.key, months.months);
            return { sbu: `${s.code}`, value: v ? round(v.value) : null };
          });
        }

        return {
          metric: { key: def.key, label: def.label, unit: def.unit },
          entity: entity.entityLabel,
          period: months.label,
          value: round(result.value),
          basis: result.basis,
          ...(perSbu ? { perSbu } : {}),
          provenance: provenanceOf(ctx.upload, def),
        };
      },
    }),
};
