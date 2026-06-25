// Syncs the live wc-intelligence-analyst bot row with the canonical prompt
// and tool list in lib/chatbots/wcx-prompt.ts (the seed only applies to
// fresh installs). Idempotent — run after any prompt/tool change.
//
//   pnpm tsx --env-file=.env --env-file=.env.local scripts/sync-wcx-bot.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../db/schema";
import type { ToolId } from "../db/schema/chatbots";
import { WCX_BOT_TOOLS, WCX_PROMPT } from "../lib/chatbots/wcx-prompt";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });

async function main() {
  const [bot] = await db
    .select()
    .from(schema.chatbots)
    .where(
      and(eq(schema.chatbots.slug, "wc-intelligence-analyst"), isNull(schema.chatbots.deletedAt)),
    )
    .limit(1);
  if (!bot) {
    console.log("! wc-intelligence-analyst not found — seed will create it with current defaults");
    return;
  }

  const tools = [...WCX_BOT_TOOLS] as ToolId[];
  const promptChanged = bot.systemPrompt !== WCX_PROMPT;
  const nextVersion = promptChanged ? bot.systemPromptVersion + 1 : bot.systemPromptVersion;

  await db
    .update(schema.chatbots)
    .set({
      tools,
      systemPrompt: WCX_PROMPT,
      systemPromptVersion: nextVersion,
      // One tool per turn (disable_parallel_tool_use) means each visual is
      // its own step: framing+snapshot, then one render per beat, then a
      // text closer. A 4-chart answer needs ~6 steps, so 8 gives headroom
      // (an extra data tool + 4 charts + closer) without a runaway fan-out.
      maxSteps: 8,
      updatedAt: new Date(),
    })
    .where(eq(schema.chatbots.id, bot.id));

  if (promptChanged) {
    await db.insert(schema.chatbotPrompts).values({
      chatbotId: bot.id,
      version: nextVersion,
      systemPrompt: WCX_PROMPT,
      note: "sync-wcx-bot",
    });
  }
  console.log(
    `✓ wc-intelligence-analyst synced · ${tools.length} tools · prompt v${nextVersion}${promptChanged ? " (updated)" : " (unchanged)"}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
