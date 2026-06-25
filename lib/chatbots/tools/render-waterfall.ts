import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedArray, clampedString, tolerantEnum } from "./schema";

const WaterfallSchema = z.object({
  title: clampedString(120),
  // Generous cap — bridge captions legitimately list their components.
  description: clampedString(240).optional(),
  unit: clampedString(12).optional(),
  start: z.object({
    label: clampedString(32),
    value: z.number().finite(),
  }),
  // Signed deltas applied cumulatively after the start bar. Positive steps
  // rise (green), negative fall (red) unless a tone overrides.
  steps: clampedArray(
    z.object({
      label: clampedString(32),
      delta: z.number().finite(),
      tone: tolerantEnum(["positive", "neutral", "warn", "negative"], "neutral").optional(),
    }),
    { min: 1, max: 15 },
  ),
  endLabel: clampedString(32).optional().describe("Label for the computed final bar."),
});

const description =
  "Render a waterfall (bridge) chart inline — THE chart for cash bridges and NWC walks. " +
  "Provide a start bar, signed step deltas, and an optional end label; the cumulative path " +
  "and final bar are computed client-side. Classic uses: collections → supplier payments → " +
  "payroll → opex → tax → interest → OCF; or NWC(periodA) → Δinventory → ΔAR → ΔCA → " +
  "−ΔAP → NWC(periodB) using wcxCompare mode='variance' contributions.";

export const renderWaterfall: ToolDefinition = {
  id: "renderWaterfall",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: WaterfallSchema,
      execute: async (args) => args,
    }),
};

export type WaterfallArgs = z.infer<typeof WaterfallSchema>;
