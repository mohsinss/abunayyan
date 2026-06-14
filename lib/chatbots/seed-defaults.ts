import "server-only";
import { db } from "@/db";
import { chatbots, chatbotPrompts } from "@/db/schema/chatbots";
import { eq } from "drizzle-orm";
import { WCX_BOT_TOOLS, WCX_PROMPT } from "./wcx-prompt";

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
  maxSteps?: number;
};

const SEEDS: Seed[] = [
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
    slug: "wc-intelligence-analyst",
    name: "WC Intelligence Analyst",
    description:
      "Deterministic analyst over the uploaded WC Data Collection workbook — exact numbers, comparisons, trends, targets.",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    systemPrompt: WCX_PROMPT,
    tools: [...WCX_BOT_TOOLS],
    allowedRoles: [],
    rateLimitTokens: 30,
    rateLimitWindow: "1 h",
    dailyCostCapUsd: 5,
    // Speed-first: the prompt gathers in ~1 round and renders in the next, so
    // 4 steps is ample while capping a runaway 8-round / 10-tool fan-out.
    maxSteps: 4,
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
