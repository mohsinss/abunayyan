import { tool } from "ai";
import { z } from "zod";
import { entities, departments, matrix, kpis } from "@/lib/dashboard/data";
import type { ToolDefinition } from "./types";

const description =
  "Return the FY2026 Atlas snapshot: entity financials, HQ departments, SLA allocation matrix, " +
  "and top-level KPIs. Call this whenever the user asks about specific entities or departments.";

export const atlasSnapshot: ToolDefinition = {
  id: "atlasSnapshot",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        scope: z.enum(["all", "entities", "departments", "matrix", "kpis"]).default("all"),
      }),
      execute: async ({ scope }) => {
        switch (scope) {
          case "entities":    return { entities };
          case "departments": return { departments };
          case "matrix":      return { matrix };
          case "kpis":        return { kpis };
          case "all":
          default:
            return { entities, departments, matrix, kpis };
        }
      },
    }),
};
