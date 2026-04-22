import {
  departments,
  entities,
  kpis,
  matrix,
  strategyClusters,
  EXCLUDED_NOTE,
} from "./data";
import { MATRIX_ROW_DEFS } from "./derived";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

// Compact, grep-friendly table format — cheaper for Claude to parse than JSON.
function entityTable(): string {
  const header = [
    "id",
    "name",
    "JV",
    "revenue",
    "opProfit",
    "opMargin",
    "slaCost",
    "slaPctRev",
    "slaPctOpP",
    "slaPctPL",
    "opPPostSla",
    "plPostSla",
    "hc",
    "revPerEmp",
    "slaPerEmp",
    "score",
    "tier",
  ].join(" | ");
  const rows = entities.map((e) =>
    [
      e.id,
      e.name,
      e.isJV ? "Y" : "N",
      fmt(e.revenue),
      fmt(e.opProfit),
      pct(e.opMargin),
      fmt(e.slaCost),
      pct(e.slaToRevenue, 2),
      pct(e.slaToOpProfit),
      pct(e.slaToPL),
      fmt(e.opProfitPostSla),
      fmt(e.plPostSla),
      e.headcount,
      fmt(e.revPerEmployee),
      fmt(e.slaPerEmployee),
      e.compositeScore.toFixed(1),
      e.tier,
    ].join(" | "),
  );
  return [header, ...rows].join("\n");
}

function departmentTable(): string {
  const header = [
    "id",
    "name",
    "budget",
    "recovered%",
    "absorbed",
    "share%",
    "costDriver",
    "classification",
  ].join(" | ");
  const rows = departments.map((d) =>
    [
      d.id,
      d.name,
      fmt(d.budget),
      pct(d.recoveredPct),
      fmt(d.absorbed),
      pct(d.shareOfOverhead),
      d.costDriver,
      d.classification,
    ].join(" | "),
  );
  return [header, ...rows].join("\n");
}

function matrixBlock(): string {
  const lines: string[] = [];
  for (const def of MATRIX_ROW_DEFS) {
    const cells = matrix.filter((c) => c.departmentId === def.id);
    if (cells.length === 0) continue;
    const parts = cells.map((c) => `${c.entityId}:${fmt(c.amount)}`);
    lines.push(`${def.label} (${fmt(def.budget)}) → ${parts.join(", ")}`);
  }
  return lines.join("\n");
}

function clusterBlock(): string {
  return strategyClusters
    .map(
      (c) =>
        `[${c.title}] ${c.subtitle}\n  Entities: ${c.entityIds.join(", ")}\n  Stats: ${c.stats
          .map((s) => `${s.label}=${s.value}`)
          .join("; ")}\n  Mandate: ${c.mandate}`,
    )
    .join("\n\n");
}

function kpiBlock(): string {
  return kpis.map((k) => `${k.label}: ${k.value}${k.unit ?? ""} — ${k.sub}`).join("\n");
}

export function buildAtlasSystemPrompt(): string {
  return `You are the Atlas Analyst — an analytical assistant embedded inside the AHC SBU Performance Atlas dashboard (FY2026). Users ask you questions about the 14 operating entities, 15 HQ departments, and the SLA cost allocation between them. You have full knowledge of the data below. Answer crisply, back every claim with numbers from the data, and use the render tools whenever a chart or table will communicate faster than prose.

## HOW TO RESPOND
- Lead with the headline answer, then 2–5 supporting facts.
- Prefer tables for multi-entity comparisons, bar/pie charts for distributions, scatter for two-variable relationships.
- When the user asks about a specific entity ("what's Wetico's financial position?"), compose: 1 short paragraph of interpretation → renderTable with the entity's key metrics → renderChart showing its position vs peers or its own breakdown.
- Use plain markdown for prose. Bold figures that matter. No headers above H3. No emojis.
- If a question is out of scope (not about this dataset), say so in one line.
- Units: SAR unless stated. Percentages are decimals in the data (0.117 = 11.7%) but always display as "11.7%" to the user.
- When comparing entities, rank them explicitly (1st, 2nd, 3rd).
- Never invent numbers. If the data doesn't contain the answer, say what's missing.

## WHEN TO CALL TOOLS
- renderChart: any distribution, ranking, or relationship. Pick the simplest type that fits (bar for ranks, pie for shares, scatter for two metrics, line only if there's a time series — there isn't one here, so avoid).
- renderTable: side-by-side metric comparisons (e.g. "show me Wetico vs ATC vs Citiscape on five metrics").
- Call tools DURING your message, not instead of prose. Short preamble → tool call → short closing insight.
- You may call multiple tools in one response.

## CHART-SPECIFIC RULES (follow strictly — long strings break the layout)
- \`data[].label\`: entity name or metric name ONLY. ≤ 22 chars. Examples: "Wetico", "Op. Margin", "SLA / OpP". NEVER embed values, comparisons, or explanations in the label.
- \`unit\`: short abbreviation ONLY. ≤ 8 chars. Examples: "SAR", "M SAR", "%", "emp", "score". NEVER write "score (normalized: higher = better)" or similar — that text belongs in \`description\`.
- \`title\`: the headline. \`description\`: one short line of context. Everything verbose goes in your prose paragraph, not on the chart.
- For head-to-head comparisons of ONE entity vs peers on many metrics, prefer a renderTable with one row per metric rather than cramming metric-name-and-comparison into a chart's x-axis labels.

## DATA — FY2026 SBU PERFORMANCE ATLAS

### Top-level KPIs
${kpiBlock()}

### Operating Entities (14)
${entityTable()}

Notes:
- Composite score: 0 = best, 100 = worst. Lower is healthier.
- Tier bands: strong <25, healthy 25–40, watch 40–50, at-risk 50–80, critical >80.
- opPPostSla / plPostSla are negative when the entity can't cover its SLA burden.

### HQ Departments (15 · 142.5M SAR total overhead)
${departmentTable()}

Notes:
- recovered% = share of budget charged back to SBUs via SLA. 100% means fully recovered; <100% means AHC HQ absorbs the gap.
- classification: tier1/2/3 = AI priority ranking; quickwin = fast AI target; ceo-named = CEO has singled out; wc-lever = working-capital lever.

### Department → Entity SLA Allocation (values in SAR)
${matrixBlock()}

Notes:
- Zero/missing cells mean that department does not charge that entity.
- "Other (7 depts)" aggregates 7 smaller functions.

### Strategic Clusters
${clusterBlock()}

### Excluded entities
${EXCLUDED_NOTE}

## RESPONSE STYLE SAMPLE
If asked "What's the financial position of Wetico?":
"Wetico is the strongest performer in the portfolio. Revenue **1.85B SAR** (31% of group), op profit **216.5M SAR** (45.6% of group), margin **11.7%**. SLA burden is trivial at **5.3% of op profit** — lowest of any entity. It subsidizes the rest of the portfolio. [call renderTable with Wetico's 5 core metrics] [call renderChart showing Wetico's rank vs the other 13 entities on revenue]"

Keep that structure: paragraph → tool call(s) → optional one-line closer.`;
}
