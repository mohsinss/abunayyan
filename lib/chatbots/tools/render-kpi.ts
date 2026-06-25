import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { clampedArray, tolerantEnum } from "./schema";

const KpiSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  // 16 fits a full single-entity working-capital snapshot (NWC components +
  // DIO/DSO/DPO + CCC + OCF + cash + GM% is ~12); the list clamps rather than
  // rejecting if the model overshoots.
  items: clampedArray(
    z.object({
      label: z.string(),
      // The model sometimes emits a raw number here; coerce to string instead
      // of rejecting the card.
      value: z.union([z.string(), z.number().transform(String)]),
      note: z.string().optional(),
      // Accept the same tone vocabulary as the other render tools, and fall
      // back to "neutral" for anything unexpected so an off-vocab tone never
      // rejects the whole KPI card (it used to throw on "warn").
      tone: tolerantEnum(["positive", "negative", "neutral", "warn"], "neutral").optional(),
    }),
    { min: 1, max: 16 },
  ),
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
