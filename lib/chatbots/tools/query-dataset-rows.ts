import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { getDatasetById, getRowsForDataset } from "@/lib/db/queries/datasets";
import {
  aggregateBarOrLine,
  aggregateKpi,
  aggregatePie,
  findColumn,
  projectTable,
} from "@/lib/datasets/renderer/aggregate";
import { CardConfigProposalSchema, type ProposedColumn } from "@/lib/datasets/proposer";

const AGG = z.enum(["sum", "avg", "count", "min", "max"]);

// Constrained query spec — not free SQL. One of three shapes, driven by
// `kind`. The LLM must pick columnIds that exist in the card's config; the
// tool fails cleanly on drift rather than guessing.
const ParamSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("kpi"),
    columnId: z.string(),
    aggregation: AGG.default("sum"),
  }),
  z.object({
    kind: z.literal("groupBy"),
    xColumnId: z.string(),
    yColumnId: z.string(),
    aggregation: AGG.default("sum"),
    seriesColumnId: z.string().optional(),
    topN: z.number().int().min(1).max(100).optional(),
  }),
  z.object({
    kind: z.literal("pie"),
    categoryColumnId: z.string(),
    valueColumnId: z.string(),
    aggregation: AGG.default("sum"),
  }),
  z.object({
    kind: z.literal("table"),
    columnIds: z.array(z.string()).min(1).max(12),
    limit: z.number().int().min(1).max(100).default(25),
  }),
]);

const description =
  "Run a constrained aggregation over this card's tabular rows (dataset_rows). " +
  "Four shapes: kpi (one aggregate), groupBy (one numeric grouped by x ± series), " +
  "pie (one numeric by category), table (project selected columns, capped rows). " +
  "Never returns full row data unless kind='table'. Scoped to this card only.";

export const queryDatasetRows: ToolDefinition = {
  id: "queryDatasetRows",
  description,
  costClass: "cheap",
  builder: (ctx) =>
    tool({
      description,
      parameters: ParamSchema,
      execute: async (args) => {
        if (!ctx.datasetId) {
          return {
            error: "NO_DATASET_CONTEXT",
            message: "This tool only works inside a dataset card's chatbot.",
          };
        }
        const dataset = await getDatasetById(ctx.datasetId);
        if (!dataset) return { error: "DATASET_NOT_FOUND" };
        const cfg = CardConfigProposalSchema.pick({ columns: true }).safeParse(dataset.config);
        if (!cfg.success) return { error: "INVALID_CONFIG" };
        const columns = cfg.data.columns as ProposedColumn[];
        const rows = await getRowsForDataset(ctx.datasetId);

        switch (args.kind) {
          case "kpi": {
            const col = findColumn(columns, args.columnId);
            if (!col) return { error: "UNKNOWN_COLUMN", missing: [args.columnId] };
            return {
              kind: "kpi",
              column: { id: col.id, label: col.label },
              aggregation: args.aggregation,
              value: aggregateKpi(rows, col, args.aggregation),
              rowCount: rows.length,
            };
          }
          case "groupBy": {
            const xCol = findColumn(columns, args.xColumnId);
            const yCol = findColumn(columns, args.yColumnId);
            const seriesCol = args.seriesColumnId ? findColumn(columns, args.seriesColumnId) : null;
            const missing = [
              !xCol && args.xColumnId,
              !yCol && args.yColumnId,
              args.seriesColumnId && !seriesCol && args.seriesColumnId,
            ].filter(Boolean) as string[];
            if (missing.length) return { error: "UNKNOWN_COLUMN", missing };
            const points = aggregateBarOrLine(rows, xCol!, yCol!, args.aggregation, {
              groupBy: seriesCol ?? undefined,
              topN: args.topN,
            });
            return {
              kind: "groupBy",
              x: { id: xCol!.id, label: xCol!.label },
              y: { id: yCol!.id, label: yCol!.label },
              series: seriesCol ? { id: seriesCol.id, label: seriesCol.label } : null,
              aggregation: args.aggregation,
              points,
            };
          }
          case "pie": {
            const catCol = findColumn(columns, args.categoryColumnId);
            const valCol = findColumn(columns, args.valueColumnId);
            const missing = [
              !catCol && args.categoryColumnId,
              !valCol && args.valueColumnId,
            ].filter(Boolean) as string[];
            if (missing.length) return { error: "UNKNOWN_COLUMN", missing };
            return {
              kind: "pie",
              category: { id: catCol!.id, label: catCol!.label },
              value: { id: valCol!.id, label: valCol!.label },
              aggregation: args.aggregation,
              slices: aggregatePie(rows, catCol!, valCol!, args.aggregation),
            };
          }
          case "table": {
            const resolved = args.columnIds
              .map((id) => findColumn(columns, id))
              .filter(Boolean) as ProposedColumn[];
            const missing = args.columnIds.filter(
              (id) => !resolved.find((c) => c.id === id),
            );
            if (missing.length) return { error: "UNKNOWN_COLUMN", missing };
            const projected = projectTable(rows, resolved).slice(0, args.limit);
            return {
              kind: "table",
              columns: resolved.map((c) => ({ id: c.id, label: c.label, type: c.type })),
              rows: projected,
              truncated: rows.length > args.limit,
              totalRows: rows.length,
            };
          }
        }
      },
    }),
};
