import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedString } from "./schema";

const SparklineSchema = z.object({
  label: clampedString(80),
  // 60 matches wcxSeries' max range (e.g. a full 36-month workbook trend);
  // the SVG path renders any count without crowding.
  values: z.array(z.number()).min(2).max(60),
  current: z.number().optional(),
  unit: clampedString(12).optional(),
  // Direction hint colours the line. "up-good": rising = green / falling
  // = red. "up-bad": rising = red / falling = green. "neutral": ink.
  tone: z.enum(["up-good", "up-bad", "neutral"]).optional(),
  hint: clampedString(120).optional(),
});

const description =
  "Render a tiny inline trend chart (~120×30px) showing a sequence of values, " +
  "optionally with a headline current number. Useful for week-over-week or " +
  "fiscal-period trends inside tight chat bubbles.";

export const renderSparkline: ToolDefinition = {
  id: "renderSparkline",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: SparklineSchema,
      execute: async (args) => args,
    }),
};

export type SparklineArgs = z.infer<typeof SparklineSchema>;
