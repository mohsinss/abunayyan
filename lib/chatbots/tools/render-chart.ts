import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedArray, clampedString, tolerantEnum } from "./schema";

const ChartSchema = z.object({
  type: tolerantEnum(["bar", "horizontal-bar", "pie", "scatter", "line", "area"], "bar"),
  title: clampedString(120),
  description: clampedString(240).optional(),
  unit: clampedString(12).optional(),
  xAxisLabel: clampedString(60).optional(),
  yAxisLabel: clampedString(60).optional(),
  // 60 fits a full monthly series from wcxSeries (36+ months); clamps if over.
  data: clampedArray(
    z.object({
      label: clampedString(32),
      value: z.number().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      tone: tolerantEnum(["positive", "neutral", "warn", "negative"], "neutral").optional(),
    }),
    { min: 1, max: 60 },
  ),
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
