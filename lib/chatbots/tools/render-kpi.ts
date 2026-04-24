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
        tone: z.enum(["positive", "negative", "neutral"]).optional(),
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
