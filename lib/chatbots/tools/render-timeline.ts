import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const TimelineSchema = z.object({
  title: z.string().min(1).max(90),
  description: z.string().max(140).optional(),
  events: z
    .array(
      z.object({
        at: z.string().min(1).max(40),
        label: z.string().max(60),
        detail: z.string().max(200).optional(),
        tone: z.enum(["info", "good", "bad", "warn"]).optional(),
        group: z.string().max(30).optional(),
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
