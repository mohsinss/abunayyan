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
    modelId: "claude-sonnet-4-7",
    systemPrompt: ATLAS_PROMPT,
    tools: ["renderChart", "renderTable", "renderKpiList", "atlasSnapshot"],
    allowedRoles: [],
    rateLimitTokens: 30,
    rateLimitWindow: "1 h",
    dailyCostCapUsd: 5,
  },
  {
    slug: "general",
    name: "General Assistant",
    description: "Generic chatbot with document search.",
    provider: "anthropic",
    modelId: "claude-sonnet-4-7",
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
