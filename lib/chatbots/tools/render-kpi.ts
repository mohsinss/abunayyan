import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

const KpiSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  items: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        note: z.string().optional(),
        // Accept the same tone vocabulary as the other render tools, and
        // fall back to "neutral" for anything unexpected so an off-vocab tone
        // never rejects the whole KPI card (it used to throw on "warn").
        tone: z.enum(["positive", "negative", "neutral", "warn"]).catch("neutral").optional(),
      }),
    )
    .min(1)
    .max(10),
});

const description =
  "Render a compact KPI list inline — for single-entity financial snapshots.";

export const renderKpiList: ToolDefinition = {
  id: "renderKpiList",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: KpiSchema,
      execute: async (args) => args,
    }),
};
