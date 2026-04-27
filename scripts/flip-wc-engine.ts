// One-shot smoke-test helper: flips the working-capital-analyst bot
// between engines so we can manually verify the direct path emits the
// same chat experience as the AI SDK path.
//
// Usage:
//   pnpm tsx --env-file=.env --env-file=.env.local scripts/flip-wc-engine.ts ai_sdk
//   pnpm tsx --env-file=.env --env-file=.env.local scripts/flip-wc-engine.ts anthropic_direct

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });

const target = process.argv[2];
if (!target || !["ai_sdk", "anthropic_direct", "openai_direct"].includes(target)) {
  console.error(`usage: flip-wc-engine.ts <ai_sdk|anthropic_direct|openai_direct>`);
  process.exit(1);
}

await db
  .update(schema.chatbots)
  .set({ engine: target as "ai_sdk", updatedAt: new Date() })
  .where(eq(schema.chatbots.slug, "working-capital-analyst"));

const [bot] = await db
  .select({ slug: schema.chatbots.slug, engine: schema.chatbots.engine, modelId: schema.chatbots.modelId })
  .from(schema.chatbots)
  .where(eq(schema.chatbots.slug, "working-capital-analyst"))
  .limit(1);

console.log(`✓ ${bot?.slug} → engine=${bot?.engine}, model=${bot?.modelId}`);
process.exit(0);
