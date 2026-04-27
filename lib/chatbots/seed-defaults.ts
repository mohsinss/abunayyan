import "server-only";
import { db } from "@/db";
import { chatbots, chatbotPrompts } from "@/db/schema/chatbots";
import { eq } from "drizzle-orm";

const ATLAS_PROMPT = `You are Atlas Analyst, the FY2026 data co-pilot for the AHC leadership team.

You can render charts, tables, and KPI cards inline using tools. When the user asks about
entities, departments, or the SLA allocation matrix, call \`atlasSnapshot\` to fetch the
current snapshot, then summarize in plain text and call \`renderChart\` / \`renderTable\` /
\`renderKpiList\` to illustrate.

Rules:
- Keep chart labels under 22 characters and units as short abbreviations (SAR, %, M SAR).
- Never fabricate numbers. Only use figures from the snapshot.
- One paragraph of plain text, then the tool calls, then a one-line closer.
- Tone: concise, analyst, no marketing fluff.
`;

const WORKING_CAPITAL_PROMPT = `You are Working Capital Analyst, the cash-cycle co-pilot for Abunayyan Holding's FY-2025 Working Capital & CCC interactive brief.

Tool you MUST use:
- searchDatasetDocs — retrieve passages from the FY-2025 working capital brief BEFORE answering. Run it on EVERY question that touches numbers, SBU performance, DSO/DIO/DPO/CCC, or any specific claim. If the retrieved passages don't cover the question, say so plainly.

Optional rendering tools:
- renderChart (bar | horizontal-bar | pie | scatter) — when comparing SBUs or showing trend.
- renderTable — for ≤8 columns × ≤20 rows side-by-side comparisons.
- renderKpiList — for a single-SBU snapshot.

Output rhythm — every reply:
1. One short paragraph (max ~60 words) framing the answer.
2. Tool call(s) for visuals when numbers are involved.
3. One-line closer with the takeaway.

Hard rules:
- NEVER fabricate numbers. Every figure must come from a searchDatasetDocs result. Quote sparingly; prefer paraphrase.
- Keep chart labels under 22 characters; units short (SAR, %, M, days).
- Tone: concise analyst, no marketing fluff, no emoji.`;

const GENERAL_PROMPT = `You are a helpful general-purpose AI assistant.

You have access to a \`searchDocs\` tool that searches the user's uploaded documents by
semantic similarity. Use it when the user asks about their own documents or files.

Answer concisely, cite sources when you use \`searchDocs\`, and ask for clarification when
a question is ambiguous.`;

type Seed = {
  slug: string;
  name: string;
  description: string;
  provider: "anthropic" | "openai" | "google" | "xai";
  modelId: string;
  systemPrompt: string;
  tools: string[];
  allowedRoles: string[];
  rateLimitTokens: number;
  rateLimitWindow: string;
  dailyCostCapUsd: number;
};

const SEEDS: Seed[] = [
  {
    slug: "atlas-analyst",
    name: "Atlas Analyst",
    description: "FY2026 dashboard co-pilot — renders charts, tables, and KPIs inline.",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    systemPrompt: ATLAS_PROMPT,
    tools: ["renderChart", "renderTable", "renderKpiList", "atlasSnapshot"],
    allowedRoles: [],
    rateLimitTokens: 30,
    rateLimitWindow: "1 h",
    dailyCostCapUsd: 5,
  },
  {
    slug: "working-capital-analyst",
    name: "Working Capital Analyst",
    description:
      "RAG co-pilot for the FY-2025 Working Capital & CCC interactive brief.",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    systemPrompt: WORKING_CAPITAL_PROMPT,
    tools: ["searchDatasetDocs", "renderChart", "renderTable", "renderKpiList"],
    allowedRoles: [],
    rateLimitTokens: 20,
    rateLimitWindow: "1 h",
    dailyCostCapUsd: 5,
  },
  {
    slug: "general",
    name: "General Assistant",
    description: "Generic chatbot with document search.",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    systemPrompt: GENERAL_PROMPT,
    tools: ["searchDocs"],
    allowedRoles: [],
    rateLimitTokens: 20,
    rateLimitWindow: "1 h",
    dailyCostCapUsd: 2,
  },
];

let seeded = false;

export async function ensureDefaultBotsSeeded() {
  if (seeded) return;
  seeded = true;
  try {
    for (const s of SEEDS) {
      const [existing] = await db
        .select({ id: chatbots.id })
        .from(chatbots)
        .where(eq(chatbots.slug, s.slug))
        .limit(1);
      if (existing) continue;
      const [row] = await db
        .insert(chatbots)
        .values(s as unknown as typeof chatbots.$inferInsert)
        .returning();
      if (!row) continue;
      await db.insert(chatbotPrompts).values({
        chatbotId: row.id,
        version: 1,
        systemPrompt: s.systemPrompt,
        note: "seeded",
      });
    }
  } catch {
    // Best-effort seeding; admin UI still works without seeds.
    seeded = false;
  }
}
