import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const HeatmapSchema = z.object({
  title: z.string().min(1).max(90),
  description: z.string().max(140).optional(),
  xLabels: z.array(z.string().max(30)).min(2).max(30),
  yLabels: z.array(z.string().max(30)).min(2).max(30),
  cells: z
    .array(
      z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        value: z.number(),
        label: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(900),
  unit: z.string().max(12).optional(),
  scale: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      // ONLY two palettes — both brand-aligned. `navy` is the default
      // light-to-dark brand-3 → brand-1 ramp used for non-negative
      // values; `diverging` is for matrices where values genuinely
      // cross zero (red→white→green). No off-brand warm/gold ramp.
      palette: z.enum(["navy", "diverging"]).optional(),
    })
    .optional(),
});

const description =
  "Render a dense 2-D heatmap (grid of coloured cells) inline. Use for matrices " +
  "like SLA × SBU allocations, metric × period grids, or any value-by-two-categories " +
  "comparison. xLabels / yLabels define the axes; each cell carries an integer x, y " +
  "(indices into those arrays) and a numeric value. ALWAYS use palette='navy' " +
  "(the default) unless values genuinely span positive AND negative — in that case " +
  "use palette='diverging'. Never invent a warm/gold/sepia ramp.";

export const renderHeatmap: ToolDefinition = {
  id: "renderHeatmap",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: HeatmapSchema,
      execute: async (args) => args,
    }),
};

export type HeatmapArgs = z.infer<typeof HeatmapSchema>;
