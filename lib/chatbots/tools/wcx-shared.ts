import "server-only";
// Shared plumbing for the WC Intelligence chat tools. Every tool resolves
// entities/metrics/periods through these helpers so error messages and
// provenance are consistent, and the LLM gets actionable guidance instead
// of silent misses.

import type { WcxMetricDef } from "@/lib/wcx/metrics";
import { resolveMetric, WCX_GROUP_CODE } from "@/lib/wcx/metrics";
import {
  GROUP_AGG,
  isMacroMetric,
  parsePeriod,
  resolveSbu,
  wcxContext,
  type WcxContext,
} from "@/lib/wcx/engine";

export type ToolError = { error: string; message: string; [k: string]: unknown };

export function isToolError(v: unknown): v is ToolError {
  return typeof v === "object" && v !== null && "error" in v;
}

export async function requireWcxContext(): Promise<WcxContext | ToolError> {
  const ctx = await wcxContext();
  if (!ctx) {
    return {
      error: "NO_ACTIVE_UPLOAD",
      message:
        "No active WC workbook version. Ask an admin to upload and activate one at /admin/wc-intelligence.",
    };
  }
  return ctx;
}

export function resolveMetricOrError(query: string): WcxMetricDef | ToolError {
  const { metric, alternatives } = resolveMetric(query);
  if (metric) return metric;
  if (alternatives.length > 0) {
    return {
      error: "AMBIGUOUS_METRIC",
      message: `'${query}' matches multiple metrics. Pick one by key.`,
      candidates: alternatives.map((a) => ({ key: a.key, label: a.label, sheet: a.sheet })),
    };
  }
  return {
    error: "UNKNOWN_METRIC",
    message: `No metric matches '${query}'. Use wcxLookup with scope='metrics' to browse the catalog.`,
  };
}

// Resolves the entity for a metric: SBU code, the cross-SBU aggregate, or
// the workbook's group-level macro entity. Macro metrics are group-level
// only, so any entity collapses to GROUP for them.
export function resolveEntityOrError(
  ctx: WcxContext,
  metric: WcxMetricDef,
  sbuQuery: string | undefined,
): { entity: string; entityLabel: string } | ToolError {
  if (isMacroMetric(metric.key)) {
    return { entity: WCX_GROUP_CODE, entityLabel: "Group (macro variable)" };
  }
  if (!sbuQuery || sbuQuery.trim() === "") {
    return { entity: GROUP_AGG, entityLabel: "Group (all SBUs aggregated)" };
  }
  const { code, alternatives } = resolveSbu(ctx.sbus, sbuQuery);
  if (code === GROUP_AGG) return { entity: GROUP_AGG, entityLabel: "Group (all SBUs aggregated)" };
  if (code) {
    const sbu = ctx.sbus.find((s) => s.code === code);
    return { entity: code, entityLabel: sbu ? `${sbu.code} (${sbu.name})` : code };
  }
  return {
    error: "UNKNOWN_SBU",
    message:
      alternatives.length > 0
        ? `'${sbuQuery}' is ambiguous. Candidates: ${alternatives.join(", ")}`
        : `No SBU matches '${sbuQuery}'. Valid codes: ${ctx.sbus.map((s) => s.code).join(", ")}, or 'GROUP'.`,
  };
}

export function resolvePeriodOrError(
  ctx: WcxContext,
  raw: string | undefined,
): { months: string[]; label: string } | ToolError {
  if (!raw || raw.trim() === "") {
    const end = ctx.upload.periodEnd;
    if (!end) return { error: "NO_PERIOD", message: "Upload has no period coverage." };
    return { months: [end], label: `${end} (latest month in the active upload)` };
  }
  const parsed = parsePeriod(raw);
  if (!parsed) {
    return {
      error: "BAD_PERIOD",
      message: `Cannot parse period '${raw}'. Use 'YYYY-MM', 'FY-YYYY', or 'YYYY-MM to YYYY-MM'.`,
    };
  }
  return parsed;
}

export function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
