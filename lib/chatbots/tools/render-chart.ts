import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedString } from "./schema";

const ChartSchema = z.object({
  type: z.enum(["bar", "horizontal-bar", "pie", "scatter", "line", "area"]),
  title: clampedString(120),
  description: clampedString(240).optional(),
  unit: clampedString(12).optional(),
  xAxisLabel: clampedString(60).optional(),
  yAxisLabel: clampedString(60).optional(),
  data: z
    .array(
      z.object({
        label: clampedString(32),
        value: z.number().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        tone: z.enum(["positive", "neutral", "warn", "negative"]).optional(),
      }),
    )
    .min(1)
    // 60 fits a full monthly series from wcxSeries (36+ months).
    .max(60),
});

const description =
  "Render a chart inline in the chat. Use 'bar' for rankings, 'horizontal-bar' for " +
  "side-by-side comparisons, 'pie' for share-of-whole, 'scatter' for relationships, " +
  "'line' for time series / trends (preferred for monthly series — labels are the periods), " +
  "'area' for cumulative or magnitude-over-time trends. " +
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
