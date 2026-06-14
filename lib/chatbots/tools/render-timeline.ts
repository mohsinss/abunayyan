import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedString } from "./schema";

const TimelineSchema = z.object({
  title: clampedString(120),
  description: clampedString(240).optional(),
  events: z
    .array(
      z.object({
        at: clampedString(40),
        label: clampedString(72),
        detail: clampedString(240).optional(),
        tone: z.enum(["info", "good", "bad", "warn"]).optional(),
        group: clampedString(40).optional(),
      }),
    )
    .min(1)
    .max(40),
  range: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

const description =
  "Render events on a horizontal time axis. Useful for audit-style histories, " +
  "milestones, or version timelines. `at` is an ISO 8601 timestamp; pass `group` " +
  "to put related events on their own swim-lane.";

export const renderTimeline: ToolDefinition = {
  id: "renderTimeline",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: TimelineSchema,
      execute: async (args) => args,
    }),
};

export type TimelineArgs = z.infer<typeof TimelineSchema>;
