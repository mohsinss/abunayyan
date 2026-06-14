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
    id: "wcSnapshot",
    description: "Read the working-capital tables (group / SBU / narrative) directly.",
    costClass: "free",
  },
  {
    id: "wcScenarioCalc",
    description: "Run a working-capital what-if scenario (preset + per-SBU overrides).",
    costClass: "free",
  },
  {
    id: "wcxLookup",
    description: "Exact-value lookup from the WC Intelligence workbook (with provenance).",
    costClass: "free",
  },
  {
    id: "wcxSeries",
    description: "Monthly time series for a WC Intelligence metric (stored or derived).",
    costClass: "free",
  },
  {
    id: "wcxCompare",
    description: "Deterministic SBU / period / target comparisons over the WC workbook.",
    costClass: "free",
  },
  {
    id: "wcxAggregate",
    description: "Aggregate a WC metric over FY/range using its registered rule.",
    costClass: "free",
  },
  {
    id: "wcxRank",
    description: "Rank SBUs by a WC metric (level or period-over-period change).",
    costClass: "free",
  },
  {
    id: "wcxScenarioCalc",
    description: "What-if scenario on latest WC actuals (presets toward targets + lever overrides).",
    costClass: "free",
  },
  {
    id: "wcxSnapshot",
    description: "Full WC panel for one SBU/GROUP in one call (balances, days, cash, target gaps).",
    costClass: "free",
  },
  {
    id: "wcxRecords",
    description: "Read workbook record tables (customers, vendors, projects, benchmarks, forecast…).",
    costClass: "free",
  },
  {
    id: "renderWaterfall",
    description: "Render a waterfall/bridge chart inline (cash bridges, NWC walks).",
    costClass: "free",
  },
];
