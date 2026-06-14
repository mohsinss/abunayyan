import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { listTargetsForUpload } from "@/lib/db/queries/wc-intelligence";
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
  "Full working-capital panel for one SBU (or 'GROUP') in ONE call: revenue & COGS (TTM and " +
  "period), gross margin, NWC components (inventory, AR, contract assets, AP), derived " +
  "DIO/DSO/DPO/CCC, operating cash flow, closing cash, drawn debt & available facility, order " +
  "backlog, AR aging totals, and the Sheet-14 target gaps. PREFER this over many wcxLookup " +
  "calls when the user asks for an overview, health check, or 'tell me about X'.";

// (label, metricKey, unit) — computed via the same engine path as wcxLookup.
const PANEL: Array<[string, string, string]> = [
  ["Revenue (period)", "pl.revenue_invoiced", "SAR"],
  ["COGS (period)", "pl.cogs_total", "SAR"],
  ["Gross margin %", "derived.gross_margin_pct", "%"],
  ["Inventory (EOP)", "bs.inventory_net", "SAR"],
  ["Trade receivables (EOP)", "bs.trade_receivables", "SAR"],
  ["Contract assets (EOP)", "bs.contract_assets", "SAR"],
  ["Trade payables (EOP)", "bs.trade_payables", "SAR"],
  ["NWC", "derived.nwc", "SAR"],
  ["DIO", "derived.dio", "days"],
  ["DSO", "derived.dso", "days"],
  ["DPO", "derived.dpo", "days"],
  ["CCC", "derived.ccc", "days"],
  ["Operating cash flow", "derived.ocf", "SAR"],
  ["Closing cash (EOP)", "cf.closing_cash", "SAR"],
  ["Drawn debt (EOP)", "cf.drawn_debt", "SAR"],
  ["Available facility (EOP)", "cf.available_facility", "SAR"],
  ["Order backlog (EOP)", "drv.order_backlog", "SAR"],
  ["Total AR aging (EOP)", "ar.total_calc", "SAR"],
  ["AR 91+ days overdue", "ar.bucket_91_180", "SAR"],
  ["AR 180+ days overdue", "ar.bucket_180_plus", "SAR"],
];

export const wcxSnapshot: ToolDefinition = {
  id: "wcxSnapshot",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        sbu: z.string().max(48).optional()
          .describe("SBU code/name or 'GROUP'. Defaults to GROUP aggregate."),
        period: z.string().max(32).optional()
          .describe("'YYYY-MM' | 'FY-YYYY'. Defaults to latest month."),
      }),
      execute: async ({ sbu, period }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        const probe = resolveMetricOrError("derived.ccc");
        if (isToolError(probe)) return probe;
        const entity = resolveEntityOrError(ctx, probe, sbu);
        if (isToolError(entity)) return entity;
        const months = resolvePeriodOrError(ctx, period);
        if (isToolError(months)) return months;

        const keys = PANEL.map(([, k]) => k);
        let idx = await loadIndex(
          ctx.upload.id,
          keys,
          entity.entity === GROUP_AGG ? undefined : [entity.entity],
        );
        if (entity.entity === GROUP_AGG) {
          idx = withGroupAggregate(idx, ctx.sbus.map((s) => s.code), keys);
        }

        const panel = PANEL.map(([label, key, unit]) => {
          const v = computeValue(idx, entity.entity, key, months.months);
          return { label, key, unit, value: v ? round(v.value) : null };
        }).filter((row) => row.value !== null);

        // Target gaps (single SBU only — Sheet 14 has no group row).
        let targetGaps:
          | Array<{ metric: string; actual: number | null; target: number; gap: number | null }>
          | undefined;
        if (entity.entity !== GROUP_AGG) {
          const targets = await listTargetsForUpload(ctx.upload.id);
          const t = targets.find((row) => row.sbuCode === entity.entity);
          if (t) {
            const days = (k: string) => {
              const v = computeValue(idx, entity.entity, k, months.months);
              return v ? round(v.value) : null;
            };
            targetGaps = (
              [
                ["DIO (days)", days("derived.dio"), t.targetDio],
                ["DSO (days)", days("derived.dso"), t.targetDso],
                ["DPO (days)", days("derived.dpo"), t.targetDpo],
              ] as Array<[string, number | null, number | null]>
            )
              .filter((row): row is [string, number | null, number] => row[2] !== null)
              .map(([metric, actual, target]) => ({
                metric,
                actual,
                target,
                gap: actual !== null ? round(actual - target) : null,
              }));
          }
        }

        return {
          entity: entity.entityLabel,
          period: months.label,
          panel,
          ...(targetGaps && targetGaps.length > 0 ? { targetGaps } : {}),
          basis:
            "Balances are end-of-period; flows are period totals; DIO/DSO/DPO/CCC, NWC, GM% and OCF recomputed in code. Same engine as wcxLookup.",
          provenance: provenanceOf(ctx.upload, null),
        };
      },
    }),
};
