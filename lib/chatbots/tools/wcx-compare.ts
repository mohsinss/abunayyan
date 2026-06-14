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
  "Deterministic comparisons over the active WC workbook upload. All deltas and percentages " +
  "are computed in code — never compute them yourself. mode='sbus': one metric, one period, " +
  "several SBUs side by side. mode='periods': one metric, one SBU, period A vs period B " +
  "(month-over-month, year-over-year, FY vs FY). mode='target': an SBU's latest derived " +
  "DIO/DSO/DPO/CCC and balances vs its Sheet-14 operational targets. mode='variance': WHY did " +
  "NWC/CCC change between two periods — decomposes the NWC move into component contributions " +
  "(inventory, AR, contract assets, AP) and the CCC move into DIO/DSO/DPO day deltas, ranked " +
  "by impact. Use it whenever the user asks what DROVE a change.";

function delta(a: number, b: number) {
  const abs = b - a;
  return {
    delta: round(abs),
    deltaPct: a !== 0 ? round((abs / Math.abs(a)) * 100) : null,
  };
}

export const wcxCompare: ToolDefinition = {
  id: "wcxCompare",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        mode: z.enum(["sbus", "periods", "target", "variance"]),
        metric: z.string().max(96).optional()
          .describe("Metric key/label/synonym. Required for mode 'sbus' and 'periods'."),
        sbus: z.array(z.string().max(48)).max(13).optional()
          .describe("mode='sbus': SBU codes to compare (omit for all)."),
        period: z.string().max(32).optional()
          .describe("mode='sbus': 'YYYY-MM' | 'FY-YYYY'. Defaults to latest month."),
        sbu: z.string().max(48).optional()
          .describe("mode='periods'/'variance'/'target': the SBU ('GROUP' allowed except for target)."),
        periodA: z.string().max(32).optional().describe("mode='periods'/'variance': baseline period."),
        periodB: z.string().max(32).optional().describe("mode='periods'/'variance': comparison period."),
      }),
      execute: async (args) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        if (args.mode === "target") {
          if (!args.sbu) return { error: "MISSING_SBU", message: "mode='target' requires `sbu`." };
          const targets = await listTargetsForUpload(ctx.upload.id);
          const probe = resolveMetricOrError("derived.ccc");
          if (isToolError(probe)) return probe;
          const entity = resolveEntityOrError(ctx, probe, args.sbu);
          if (isToolError(entity)) return entity;
          if (entity.entity === GROUP_AGG) {
            return { error: "BAD_SBU", message: "mode='target' compares one SBU, not GROUP." };
          }
          const target = targets.find((t) => t.sbuCode === entity.entity);
          if (!target) {
            return { error: "NO_TARGET", message: `No Sheet-14 targets for ${entity.entity}.` };
          }
          const month = ctx.upload.periodEnd!;
          const keys = [
            "derived.dio", "derived.dso", "derived.dpo", "derived.ccc",
            "bs.inventory_net", "bs.trade_receivables", "bs.contract_assets", "bs.trade_payables",
          ];
          const idx = await loadIndex(ctx.upload.id, keys, [entity.entity]);
          const actual = (k: string) => computeValue(idx, entity.entity, k, [month]);
          const rows = [
            { label: "DIO (days)", actual: actual("derived.dio"), target: target.targetDio },
            { label: "DSO (days)", actual: actual("derived.dso"), target: target.targetDso },
            { label: "DPO (days)", actual: actual("derived.dpo"), target: target.targetDpo },
            { label: "CCC (days)", actual: actual("derived.ccc"),
              target: target.targetDio !== null && target.targetDso !== null && target.targetDpo !== null
                ? target.targetDio + target.targetDso - target.targetDpo : null },
            { label: "Inventory (SAR)", actual: actual("bs.inventory_net"), target: target.targetInventory },
            { label: "AR (SAR)", actual: actual("bs.trade_receivables"), target: target.targetAr },
            { label: "Contract assets (SAR)", actual: actual("bs.contract_assets"), target: target.targetContractAssets },
            { label: "AP (SAR)", actual: actual("bs.trade_payables"), target: target.targetAp },
          ].map((r) => ({
            metric: r.label,
            actual: r.actual ? round(r.actual.value) : null,
            target: r.target !== null ? round(r.target) : null,
            gap: r.actual && r.target !== null ? round(r.actual.value - r.target) : null,
          }));
          return {
            sbu: entity.entityLabel,
            asOf: month,
            targetCashReleased: target.targetCashReleased,
            rows,
            note: "Targets from Sheet 14 (year-agnostic, apply FY-26 forward). Target CCC recomputed as DIO + DSO − DPO.",
            provenance: provenanceOf(ctx.upload, null),
          };
        }

        if (args.mode === "variance") {
          if (!args.periodA || !args.periodB) {
            return { error: "MISSING_PERIODS", message: "mode='variance' requires periodA and periodB." };
          }
          const probe = resolveMetricOrError("derived.nwc");
          if (isToolError(probe)) return probe;
          const entity = resolveEntityOrError(ctx, probe, args.sbu);
          if (isToolError(entity)) return entity;
          const pa = resolvePeriodOrError(ctx, args.periodA);
          if (isToolError(pa)) return pa;
          const pb = resolvePeriodOrError(ctx, args.periodB);
          if (isToolError(pb)) return pb;

          const keys = [
            "bs.inventory_net", "bs.trade_receivables", "bs.contract_assets", "bs.trade_payables",
            "derived.nwc", "derived.dio", "derived.dso", "derived.dpo", "derived.ccc",
          ];
          let idx = await loadIndex(
            ctx.upload.id,
            keys,
            entity.entity === GROUP_AGG ? undefined : [entity.entity],
          );
          if (entity.entity === GROUP_AGG) {
            idx = withGroupAggregate(idx, ctx.sbus.map((s) => s.code), keys);
          }
          const at = (key: string, months: string[]) =>
            computeValue(idx, entity.entity, key, months)?.value ?? null;

          // ΔNWC = Δinv + Δar + Δca − Δap. Contributions are signed in NWC
          // terms so they sum to the total move.
          const components: Array<[string, string, 1 | -1]> = [
            ["Inventory", "bs.inventory_net", 1],
            ["Trade receivables", "bs.trade_receivables", 1],
            ["Contract assets", "bs.contract_assets", 1],
            ["Trade payables", "bs.trade_payables", -1],
          ];
          const nwcDrivers = components
            .map(([label, key, sign]) => {
              const a = at(key, pa.months);
              const b = at(key, pb.months);
              if (a === null || b === null) return null;
              return {
                component: label,
                from: round(a),
                to: round(b),
                contributionToNwc: round((b - a) * sign),
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .sort((x, y) => Math.abs(y.contributionToNwc) - Math.abs(x.contributionToNwc));

          const daysParts: Array<[string, string, 1 | -1]> = [
            ["DIO", "derived.dio", 1],
            ["DSO", "derived.dso", 1],
            ["DPO", "derived.dpo", -1],
          ];
          const cccDrivers = daysParts
            .map(([label, key, sign]) => {
              const a = at(key, pa.months);
              const b = at(key, pb.months);
              if (a === null || b === null) return null;
              return {
                component: label,
                from: round(a),
                to: round(b),
                contributionToCcc: round((b - a) * sign),
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .sort((x, y) => Math.abs(y.contributionToCcc) - Math.abs(x.contributionToCcc));

          const nwcA = at("derived.nwc", pa.months);
          const nwcB = at("derived.nwc", pb.months);
          const cccA = at("derived.ccc", pa.months);
          const cccB = at("derived.ccc", pb.months);

          return {
            entity: entity.entityLabel,
            periodA: pa.label,
            periodB: pb.label,
            nwc: {
              from: nwcA !== null ? round(nwcA) : null,
              to: nwcB !== null ? round(nwcB) : null,
              change: nwcA !== null && nwcB !== null ? round(nwcB - nwcA) : null,
              drivers: nwcDrivers,
            },
            ccc: {
              from: cccA !== null ? round(cccA) : null,
              to: cccB !== null ? round(cccB) : null,
              changeDays: cccA !== null && cccB !== null ? round(cccB - cccA) : null,
              drivers: cccDrivers,
            },
            basis:
              "NWC contributions are signed (payables inverted) so they sum to the NWC change; CCC contributions likewise (DPO inverted). Balances at period end; days on the period basis. Great input for renderWaterfall.",
            provenance: provenanceOf(ctx.upload, null),
          };
        }

        if (!args.metric) {
          return { error: "MISSING_METRIC", message: `mode='${args.mode}' requires \`metric\`.` };
        }
        const def = resolveMetricOrError(args.metric);
        if (isToolError(def)) return def;

        if (args.mode === "sbus") {
          const period = resolvePeriodOrError(ctx, args.period);
          if (isToolError(period)) return period;
          const codes =
            args.sbus && args.sbus.length > 0
              ? args.sbus.map((q) => resolveEntityOrError(ctx, def, q))
              : ctx.sbus.map((s) => ({ entity: s.code, entityLabel: `${s.code} (${s.name})` }));
          const firstError = codes.find(isToolError);
          if (firstError) return firstError;
          const resolved = codes as Array<{ entity: string; entityLabel: string }>;

          const idx = await loadIndex(ctx.upload.id, [def.key]);
          const rows = resolved
            .map((e) => {
              const v = computeValue(idx, e.entity, def.key, period.months);
              return v ? { sbu: e.entityLabel, value: round(v.value) } : { sbu: e.entityLabel, value: null };
            })
            .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
          return {
            metric: { key: def.key, label: def.label, unit: def.unit },
            period: period.label,
            rows,
            provenance: provenanceOf(ctx.upload, def),
          };
        }

        // mode === "periods"
        const entity = resolveEntityOrError(ctx, def, args.sbu);
        if (isToolError(entity)) return entity;
        if (!args.periodA || !args.periodB) {
          return { error: "MISSING_PERIODS", message: "mode='periods' requires periodA and periodB." };
        }
        const pa = resolvePeriodOrError(ctx, args.periodA);
        if (isToolError(pa)) return pa;
        const pb = resolvePeriodOrError(ctx, args.periodB);
        if (isToolError(pb)) return pb;

        let idx = await loadIndex(
          ctx.upload.id,
          [def.key],
          entity.entity === GROUP_AGG ? undefined : [entity.entity],
        );
        if (entity.entity === GROUP_AGG) {
          idx = withGroupAggregate(idx, ctx.sbus.map((s) => s.code), [def.key]);
        }
        const a = computeValue(idx, entity.entity, def.key, pa.months);
        const b = computeValue(idx, entity.entity, def.key, pb.months);
        if (!a || !b) {
          return {
            error: "NO_DATA",
            message: `Missing data: ${!a ? pa.label : pb.label} has no ${def.label} for ${entity.entityLabel}.`,
          };
        }
        return {
          metric: { key: def.key, label: def.label, unit: def.unit },
          entity: entity.entityLabel,
          periodA: { period: pa.label, value: round(a.value), basis: a.basis },
          periodB: { period: pb.label, value: round(b.value), basis: b.basis },
          change: delta(a.value, b.value),
          provenance: provenanceOf(ctx.upload, def),
        };
      },
    }),
};
