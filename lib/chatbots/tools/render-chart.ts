import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const ChartSchema = z.object({
  type: z.enum(["bar", "horizontal-bar", "pie", "scatter"]),
  title: z.string().max(90),
  description: z.string().max(140).optional(),
  unit: z.string().max(8).optional(),
  xAxisLabel: z.string().max(30).optional(),
  yAxisLabel: z.string().max(30).optional(),
  data: z
    .array(
      z.object({
        label: z.string().max(24),
        value: z.number().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        tone: z.enum(["positive", "neutral", "warn", "negative"]).optional(),
      }),
    )
    .min(1)
    .max(30),
});

const description =
  "Render a chart inline in the chat. Use 'bar' for rankings, 'horizontal-bar' for " +
  "side-by-side comparisons, 'pie' for share-of-whole, 'scatter' for relationships. " +
  "Keep labels under 22 characters and units as short abbreviations ('SAR', '%', 'M SAR').";

export const renderChart: ToolDefinition = {
  id: "renderChart",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: ChartSchema,
      execute: async (args) => args,
    }),
};
