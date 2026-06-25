import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedArray, tolerantEnum } from "./schema";

const TableSchema = z.object({
  title: z.string(),
  caption: z.string().optional(),
  // 12 columns / 25 rows fits record-table answers (top customers/vendors,
  // project registers) without blowing up the bubble; both clamp if over.
  headers: clampedArray(z.string(), { min: 2, max: 12 }),
  rows: clampedArray(z.array(z.union([z.string(), z.number()])), { min: 1, max: 25 }),
  emphasis: z
    .array(
      z.object({
        rowIndex: z.number().int().nonnegative(),
        tone: tolerantEnum(["positive", "negative", "neutral"], "neutral"),
      }),
    )
    .optional(),
});

const description =
  "Render a table inline in the chat. Best for side-by-side metric comparisons across a small number of entities.";

export const renderTable: ToolDefinition = {
  id: "renderTable",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: TableSchema,
      execute: async (args) => args,
    }),
};
