import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { monthRange } from "@/lib/wcx/metrics";
import {
  GROUP_AGG,
  computeValue,
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
  round,
} from "./wcx-shared";

const description =
  "Monthly time series for one metric and one SBU (or 'GROUP') from the active WC workbook " +
  "upload. Use for trends, seasonality, and 'how did X evolve' questions, then plot with " +
  "renderChart or renderSparkline. Derived metrics (derived.ccc, derived.nwc, derived.dso, " +
  "derived.dio, derived.dpo, derived.gross_margin_pct) are recomputed per month in code.";

export const wcxSeries: ToolDefinition = {
  id: "wcxSeries",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        metric: z.string().max(96).describe("Metric key, label, or synonym."),
        sbu: z.string().max(48).optional()
          .describe("SBU code/name, or 'GROUP'. Defaults to GROUP aggregate."),
        fromMonth: z.string().max(7).optional().describe("'YYYY-MM', inclusive."),
        toMonth: z.string().max(7).optional().describe("'YYYY-MM', inclusive."),
      }),
      execute: async ({ metric, sbu, fromMonth, toMonth }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        const def = resolveMetricOrError(metric);
        if (isToolError(def)) return def;
        const entity = resolveEntityOrError(ctx, def, sbu);
        if (isToolError(entity)) return entity;

        const from = fromMonth ?? ctx.upload.periodStart;
        const to = toMonth ?? ctx.upload.periodEnd;
        if (!from || !to) {
          return { error: "NO_PERIOD", message: "Upload has no period coverage." };
        }
        const months = monthRange(from, to);
        if (months.length === 0 || months.length > 60) {
          return {
            error: "BAD_RANGE",
            message: `Range ${from} → ${to} is invalid or longer than 60 months.`,
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

        const points = months
          .map((m) => {
            const v = computeValue(idx, entity.entity, def.key, [m]);
            return v ? { month: m, value: round(v.value) } : null;
          })
          .filter((p): p is { month: string; value: number } => p !== null);

        if (points.length === 0) {
          return {
            error: "NO_DATA",
            message: `No data for ${def.label} · ${entity.entityLabel} in ${from} → ${to}.`,
          };
        }
        return {
          metric: { key: def.key, label: def.label, unit: def.unit },
          entity: entity.entityLabel,
          range: `${from} → ${to}`,
          points,
          provenance: provenanceOf(ctx.upload, def),
        };
      },
    }),
};
