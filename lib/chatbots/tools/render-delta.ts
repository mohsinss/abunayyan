import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedString, tolerantEnum } from "./schema";

const DeltaSchema = z.object({
  label: clampedString(80),
  before: z.number(),
  after: z.number(),
  unit: clampedString(12).optional(),
  // Clamp an out-of-range precision to 1 dp rather than rejecting the card.
  precision: z.number().int().min(0).max(4).catch(1).optional(),
  // "auto" picks tone from the direction of the change. Most metrics
  // we model are lower-is-better (CCC, NWC, DSO, DIO); use
  // direction="lower-is-better" to flip "auto" properly.
  tone: tolerantEnum(["good", "bad", "neutral", "auto"], "auto").optional(),
  direction: tolerantEnum(["higher-is-better", "lower-is-better"], "higher-is-better").optional(),
  hint: clampedString(120).optional(),
});

const description =
  "Render a single big-number 'before → after' delta inline. Pairs well with " +
  "wcScenarioCalc to show the headline cash release or CCC compression.";

export const renderDelta: ToolDefinition = {
  id: "renderDelta",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: DeltaSchema,
      execute: async (args) => args,
    }),
};

export type DeltaArgs = z.infer<typeof DeltaSchema>;
