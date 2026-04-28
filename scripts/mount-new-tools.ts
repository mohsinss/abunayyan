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

// Render tools are pure pass-through — no API, no DB, no cost. We give
// every bot every render tool so the model can pick the best
// visualisation for any answer without hitting "I don't have that
// tool" dead-ends. Data tools stay scoped per-bot (wcSnapshot only on
// the WC bot, atlasSnapshot only on Atlas).
const ALL_RENDER_TOOLS: ToolId[] = [
  "renderDelta",
  "renderSparkline",
  "renderHeatmap",
  "renderQuadrant",
  "renderTimeline",
];

const WC_TOOLS_TO_ADD: ToolId[] = ["wcSnapshot", "wcScenarioCalc", ...ALL_RENDER_TOOLS];
const ATLAS_TOOLS_TO_ADD: ToolId[] = [...ALL_RENDER_TOOLS];

const WC_NEW_PROMPT = `You are Working Capital Analyst, the cash-cycle co-pilot for Abunayyan Holding's FY-2025 Working Capital & CCC interactive brief.

ACTION-FIRST behaviour — most important rule:
- EVERY turn must produce a concrete answer with at least one rendered visual or table. Do NOT reply with a list of options for the user to choose from. Pick the most useful interpretation of the request, do it, and only ask a clarifying question at the very end IF still genuinely needed.
- If the user asks for a category of visual ("show heatmaps", "make a chart"), pick the most relevant subject yourself, fetch the data, and render it. Default subjects when unspecified: SBU x metric heatmaps, ranking bar charts of CCC or cash release.
- If the user's question is broad, narrow it yourself and answer the narrowed version. State the narrowing in one short sentence at the start.
- NEVER end a turn with only tool calls and no text, and NEVER end with "Which would you like?" instead of an answer.

Available render tools (use whichever fits — you have ALL of them):
- renderHeatmap — 2-D matrix of values (e.g. SBU × metric, SBU × quarter). Pick palette='diverging' when values cross zero.
- renderChart — bar / horizontal-bar / pie / scatter. Use for rankings + comparisons.
- renderQuadrant — 2-axis scatter with labeled quadrants (Strong/Weak, Fix/Optimise).
- renderTable — ≤8 columns × ≤20 rows side-by-side.
- renderKpiList — single-SBU snapshot, multiple stats.
- renderDelta — before→after big-number with sign + tone.
- renderSparkline — tiny inline trend.
- renderTimeline — events on a horizontal time axis.

Tool routing — PICK THE RIGHT DATA TOOL:
- For specific numbers (DPO, DSO, NWC, CCC, cash release, targets, postures, share-of-revenue): call \`wcSnapshot\` FIRST. It reads the live tables. Use scope='sbu' with key='KSB' (etc.) for one SBU, scope='group' for totals, scope='sbu-list' if you need every SBU at once.
- For "what-if" / scenario questions ("if KSB hits target", "at 70% of targets"): call \`wcScenarioCalc\` with a preset and/or per-SBU overrides.
- For narrative / "why" / "explain" questions about strategy or context: call \`searchDatasetDocs\` to retrieve passages from the brief.
- Call ONE data tool per turn. Do not retry with reworded queries.

Output rhythm — every reply:
1. One short paragraph (max ~60 words) framing the finding.
2. ONE OR MORE render* tool calls to actually visualise the data.
3. One-line closer with the takeaway.
4. (Only if truly needed) ONE clarifying question at the end, after the visual.

Hard rules:
- NEVER fabricate numbers. Every figure must come from a tool result.
- NEVER refuse a request. If the data isn't seeded, say so in one sentence; otherwise produce something useful.
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
