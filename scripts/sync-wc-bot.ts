// Syncs the live working-capital-analyst bot row with the canonical prompt,
// tool list, and maxSteps in lib/working-capital/retrain.ts — WITHOUT running
// the heavy knowledge re-embed. (The full retrain also syncs these, but pulls
// blob + OpenAI; this is the cheap path when only the prompt/config changed.)
// Preserves the bot's engine (admins may have set anthropic_direct).
//
//   pnpm tsx --env-file=.env --env-file=.env.local scripts/sync-wc-bot.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../db/schema";
import type { ToolId } from "../db/schema/chatbots";
import { SYSTEM_PROMPT, BOT_TOOLS, WC_BOT_MAX_STEPS } from "../lib/working-capital/wc-prompt";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });

async function main() {
  const [bot] = await db
    .select()
    .from(schema.chatbots)
    .where(
      and(eq(schema.chatbots.slug, "working-capital-analyst"), isNull(schema.chatbots.deletedAt)),
    )
    .limit(1);
  if (!bot) {
    console.log("! working-capital-analyst not found — run a retrain to create it");
    return;
  }

  const tools = [...BOT_TOOLS] as ToolId[];
  const promptChanged = bot.systemPrompt !== SYSTEM_PROMPT;
  const nextVersion = promptChanged ? bot.systemPromptVersion + 1 : bot.systemPromptVersion;

  await db
    .update(schema.chatbots)
    .set({
      tools,
      systemPrompt: SYSTEM_PROMPT,
      systemPromptVersion: nextVersion,
      maxSteps: WC_BOT_MAX_STEPS,
      updatedAt: new Date(),
    })
    .where(eq(schema.chatbots.id, bot.id));

  if (promptChanged) {
    await db.insert(schema.chatbotPrompts).values({
      chatbotId: bot.id,
      version: nextVersion,
      systemPrompt: SYSTEM_PROMPT,
      note: "sync-wc-bot",
    });
  }
  console.log(
    `✓ working-capital-analyst synced · ${tools.length} tools · maxSteps ${WC_BOT_MAX_STEPS} · prompt v${nextVersion}${promptChanged ? " (updated)" : " (unchanged)"} · engine ${bot.engine} (preserved)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
