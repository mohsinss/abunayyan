// One-shot: extends two bots' tool lists with the seven new tools and
// patches the working-capital-analyst's system prompt to route numeric
// questions through wcSnapshot first (cheap, deterministic) and only
// fall back to searchDatasetDocs for narrative.
//
//   pnpm tsx --env-file=.env --env-file=.env.local scripts/mount-new-tools.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull, and } from "drizzle-orm";
import * as schema from "../db/schema";
import type { ToolId } from "../db/schema/chatbots";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });

const WC_TOOLS_TO_ADD: ToolId[] = [
  "wcSnapshot",
  "wcScenarioCalc",
  "renderDelta",
  "renderSparkline",
];

const ATLAS_TOOLS_TO_ADD: ToolId[] = [
  "renderHeatmap",
  "renderQuadrant",
  "renderTimeline",
  "renderDelta",
  "renderSparkline",
];

const WC_NEW_PROMPT = `You are Working Capital Analyst, the cash-cycle co-pilot for Abunayyan Holding's FY-2025 Working Capital & CCC interactive brief.

Tool routing — PICK THE RIGHT ONE:
- For specific numbers (DPO, DSO, NWC, CCC, cash release, targets, postures, share-of-revenue): call \`wcSnapshot\` FIRST. It reads the live tables. Use scope='sbu' with key='KSB' (etc.) for one SBU, scope='group' for totals, scope='sbu-list' if the user's wording is ambiguous.
- For "what-if" / scenario questions ("if KSB hits target", "at 70% of targets"): call \`wcScenarioCalc\` with a preset and/or per-SBU overrides.
- For narrative / "why" / "explain" questions about strategy or context: call \`searchDatasetDocs\` to retrieve passages from the brief.
- Call ONE retrieval tool per turn. Do not retry with reworded queries.
- After the data tool returns, you MUST write a final text response. NEVER end your turn with only tool calls.
- If the data doesn't cover the question, say so plainly in one sentence.

Optional rendering tools (use AFTER you have the data, not instead of writing):
- renderDelta — for headline before→after numbers (cash release, CCC compression).
- renderSparkline — for trend snippets.
- renderChart — bar / horizontal-bar / pie / scatter for SBU comparisons.
- renderTable — ≤8 columns × ≤20 rows side-by-side comparisons.
- renderKpiList — single-SBU snapshot.

Output rhythm — every reply:
1. One short paragraph (max ~60 words) framing the answer.
2. Optionally one render* tool call to visualise.
3. One-line closer with the takeaway.

Hard rules:
- NEVER fabricate numbers. Every figure must come from a tool result.
- Keep chart labels under 22 characters; units short (SAR, %, M, days).
- Tone: concise analyst, no marketing fluff, no emoji.`;

async function main() {
  // ---- Working Capital Analyst -------------------------------------------
  const [wc] = await db
    .select()
    .from(schema.chatbots)
    .where(
      and(
        eq(schema.chatbots.slug, "working-capital-analyst"),
        isNull(schema.chatbots.deletedAt),
      ),
    )
    .limit(1);
  if (wc) {
    const merged = Array.from(new Set([...(wc.tools as ToolId[]), ...WC_TOOLS_TO_ADD]));
    const nextVersion = wc.systemPromptVersion + 1;
    await db
      .update(schema.chatbots)
      .set({
        tools: merged,
        systemPrompt: WC_NEW_PROMPT,
        systemPromptVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(schema.chatbots.id, wc.id));
    await db.insert(schema.chatbotPrompts).values({
      chatbotId: wc.id,
      version: nextVersion,
      systemPrompt: WC_NEW_PROMPT,
      note: "tool-routing-update",
    });
    console.log(`✓ working-capital-analyst tools=[${merged.join(", ")}], prompt v${nextVersion}`);
  } else {
    console.log("! working-capital-analyst not found (skipped)");
  }

  // ---- Atlas Analyst -----------------------------------------------------
  const [atlas] = await db
    .select()
    .from(schema.chatbots)
    .where(
      and(
        eq(schema.chatbots.slug, "atlas-analyst"),
        isNull(schema.chatbots.deletedAt),
      ),
    )
    .limit(1);
  if (atlas) {
    const merged = Array.from(new Set([...(atlas.tools as ToolId[]), ...ATLAS_TOOLS_TO_ADD]));
    await db
      .update(schema.chatbots)
      .set({ tools: merged, updatedAt: new Date() })
      .where(eq(schema.chatbots.id, atlas.id));
    console.log(`✓ atlas-analyst tools=[${merged.join(", ")}]`);
  } else {
    console.log("! atlas-analyst not found (skipped)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
