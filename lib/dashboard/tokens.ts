import type { DeptClassification, Tier } from "./types";

export const tierMeta: Record<
  Tier,
  { label: string; color: string; soft: string; range: string }
> = {
  strong: {
    label: "Strong",
    color: "var(--atlas-ok)",
    soft: "var(--atlas-ok-soft)",
    range: "< 25",
  },
  healthy: {
    label: "Healthy",
    color: "var(--atlas-ok-2)",
    soft: "var(--atlas-ok-soft)",
    range: "25–40",
  },
  watch: {
    label: "Watch",
    color: "var(--atlas-accent)",
    soft: "var(--atlas-accent-soft)",
    range: "40–50",
  },
  "at-risk": {
    label: "At Risk",
    color: "var(--atlas-warn)",
    soft: "var(--atlas-warn-soft)",
    range: "50–80",
  },
  critical: {
    label: "Critical",
    color: "var(--atlas-alert)",
    soft: "var(--atlas-alert-soft)",
    range: "> 80",
  },
};

export const tierOrder: Tier[] = ["strong", "healthy", "watch", "at-risk", "critical"];

export const deptClassMeta: Record<
  DeptClassification,
  { label: string; color: string; soft: string }
> = {
  tier1: {
    label: "Tier 1",
    color: "var(--atlas-alert)",
    soft: "var(--atlas-alert-soft)",
  },
  tier2: {
    label: "Tier 2",
    color: "var(--atlas-warn)",
    soft: "var(--atlas-warn-soft)",
  },
  tier3: {
    label: "Tier 3",
    color: "var(--atlas-accent-2)",
    soft: "var(--atlas-accent-soft)",
  },
  quickwin: {
    label: "Quick Win",
    color: "var(--atlas-ok)",
    soft: "var(--atlas-ok-soft)",
  },
  "ceo-named": {
    label: "CEO-named",
    color: "var(--atlas-alert)",
    soft: "var(--atlas-alert-soft)",
  },
  "wc-lever": {
    label: "WC Lever",
    color: "var(--atlas-alert)",
    soft: "var(--atlas-alert-soft)",
  },
};

// Used for bar chart colors based on severity of entity score.
export function scoreToSeverity(score: number): "strong" | "healthy" | "watch" | "at-risk" | "critical" {
  if (score < 25) return "strong";
  if (score < 40) return "healthy";
  if (score < 50) return "watch";
  if (score < 80) return "at-risk";
  return "critical";
}

export const severityGradient: Record<
  ReturnType<typeof scoreToSeverity>,
  string
> = {
  strong: "linear-gradient(90deg, var(--atlas-ok), var(--atlas-ok-2))",
  healthy: "linear-gradient(90deg, var(--atlas-ok-2), #a8b876)",
  watch: "linear-gradient(90deg, var(--atlas-accent-2), var(--atlas-warn))",
  "at-risk": "linear-gradient(90deg, var(--atlas-warn), #d48543)",
  critical: "linear-gradient(90deg, var(--atlas-alert), #c44536)",
};

// Used for per-SBU bar fill inside the distribution chart.
export function severityForIndex(idx: number, total: number) {
  const ratio = idx / Math.max(total - 1, 1);
  if (ratio < 0.25) return "ok";
  if (ratio < 0.55) return "watch";
  if (ratio < 0.8) return "alert";
  return "critical";
}

export const sectionAnchors = [
  { id: "composite", num: "01", title: "Composite Ranking", desc: "Weighted health index" },
  { id: "performance", num: "02", title: "Performance Table", desc: "Full metrics, sortable" },
  { id: "quadrant", num: "03", title: "Quadrant Analysis", desc: "Damage vs. scale" },
  { id: "distribution", num: "04", title: "Distribution", desc: "Revenue & profit" },
  { id: "matrix", num: "05", title: "Cost Matrix", desc: "Dept × SBU heatmap" },
  { id: "departments", num: "06", title: "Department Budgets", desc: "HQ overhead" },
  { id: "strategy", num: "07", title: "Strategic Readout", desc: "Three clusters" },
] as const;

export type SectionId = (typeof sectionAnchors)[number]["id"];
