// Client-safe metadata. No server-only imports. Kept in sync with the
// actual tool definitions under lib/chatbots/tools/*.
import type { ToolId } from "@/db/schema/chatbots";

export type ToolMetadata = {
  id: ToolId;
  description: string;
  costClass: "free" | "cheap" | "expensive";
};

export const TOOL_METADATA: readonly ToolMetadata[] = [
  {
    id: "renderChart",
    description: "Render a chart inline (bar, horizontal-bar, pie, scatter).",
    costClass: "free",
  },
  {
    id: "renderTable",
    description: "Render a table inline for side-by-side comparisons.",
    costClass: "free",
  },
  {
    id: "renderKpiList",
    description: "Render a compact KPI list for single-entity snapshots.",
    costClass: "free",
  },
  {
    id: "renderDelta",
    description: "Render a 'before → after' big-number delta with sign + tone.",
    costClass: "free",
  },
  {
    id: "renderSparkline",
    description: "Render a tiny inline trend chart for a sequence of values.",
    costClass: "free",
  },
  {
    id: "renderHeatmap",
    description: "Render a 2-D grid of coloured cells (matrix view).",
    costClass: "free",
  },
  {
    id: "renderQuadrant",
    description: "Render a 2-axis scatter with labeled quadrants.",
    costClass: "free",
  },
  {
    id: "renderTimeline",
    description: "Render events on a horizontal time axis, optionally grouped.",
    costClass: "free",
  },
  {
    id: "searchDocs",
    description: "Search the user's uploaded documents by semantic similarity.",
    costClass: "cheap",
  },
  {
    id: "atlasSnapshot",
    description: "Return the FY2026 Atlas snapshot (entities, departments, matrix).",
    costClass: "free",
  },
  {
    id: "wcSnapshot",
    description: "Read the working-capital tables (group / SBU / narrative) directly.",
    costClass: "free",
  },
  {
    id: "wcScenarioCalc",
    description: "Run a working-capital what-if scenario (preset + per-SBU overrides).",
    costClass: "free",
  },
];
