import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { WCX_ALL_METRICS, WCX_DERIVED_DEFS } from "@/lib/wcx/metrics";
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
  resolvePeriodOrError,
  round,
} from "./wcx-shared";

const description =
  "Exact-value lookup against the active WC workbook upload. scope='value' returns one number " +
  "for (metric, sbu, period) with provenance — use it for EVERY specific figure. " +
  "scope='metrics' lists the metric catalog (keys, labels, units, aggregation rules, formulas); " +
  "scope='sbus' lists SBU codes; scope='coverage' shows which months/version are loaded. " +
  "sbu accepts a code (e.g. 'KSB'), a name, or 'GROUP' for the cross-SBU aggregate. " +
  "period accepts 'YYYY-MM', 'FY-YYYY', or omitted for the latest month.";

export const wcxLookup: ToolDefinition = {
  id: "wcxLookup",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        scope: z.enum(["value", "metrics", "sbus", "coverage"]).default("value"),
        metric: z.string().max(96).optional()
          .describe("Metric key, label, or synonym. Required when scope='value'."),
        sbu: z.string().max(48).optional()
          .describe("SBU code/name, or 'GROUP'. Defaults to GROUP aggregate."),
        period: z.string().max(32).optional()
          .describe("'YYYY-MM' | 'FY-YYYY' | 'YYYY-MM to YYYY-MM'. Defaults to latest month."),
        filter: z.string().max(48).optional()
          .describe("scope='metrics' only: substring filter over keys/labels."),
      }),
      execute: async ({ scope, metric, sbu, period, filter }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        if (scope === "metrics") {
          const q = (filter ?? "").toLowerCase();
          const list = WCX_ALL_METRICS.filter(
            (d) =>
              !q ||
              d.key.includes(q) ||
              d.label.toLowerCase().includes(q) ||
              (d.synonyms ?? []).some((s) => s.includes(q)),
          ).map((d) => ({
            key: d.key,
            label: d.label,
            sheet: d.sheet,
            unit: d.unit,
            aggregation: d.agg,
            formula: WCX_DERIVED_DEFS.find((x) => x.key === d.key)?.formula,
          }));
          return { metrics: list.slice(0, 80), totalMatches: list.length };
        }

        if (scope === "sbus") {
          return {
            sbus: ctx.sbus.map((s) => ({ code: s.code, name: s.name, pillar: s.pillar })),
            note: "Use 'GROUP' for the cross-SBU aggregate.",
          };
        }

        if (scope === "coverage") {
          return {
            upload: provenanceOf(ctx.upload, null),
            months: { from: ctx.upload.periodStart, to: ctx.upload.periodEnd },
            factsCount: ctx.upload.factsCount,
            qa: ctx.upload.qaReport
              ? {
                  checksFailed: ctx.upload.qaReport.checks.filter((c) => c.status === "fail").length,
                  checksPassed: ctx.upload.qaReport.checks.filter((c) => c.status === "pass").length,
                  unknownLabels: ctx.upload.qaReport.unknownLabels.length,
                }
              : null,
          };
        }

        // scope === "value"
        if (!metric) {
          return { error: "MISSING_METRIC", message: "scope='value' requires `metric`." };
        }
        const def = resolveMetricOrError(metric);
        if (isToolError(def)) return def;
        const entity = resolveEntityOrError(ctx, def, sbu);
        if (isToolError(entity)) return entity;
        const months = resolvePeriodOrError(ctx, period);
        if (isToolError(months)) return months;

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
        return {
          metric: { key: def.key, label: def.label, unit: def.unit },
          entity: entity.entityLabel,
          period: months.label,
          value: round(result.value),
          basis: result.basis,
          provenance: provenanceOf(ctx.upload, def),
        };
      },
    }),
};
