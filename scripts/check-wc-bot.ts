import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });

const [bot] = await db
  .select()
  .from(schema.chatbots)
  .where(eq(schema.chatbots.slug, "working-capital-analyst"))
  .limit(1);

if (!bot) {
  console.log("❌ bot not found");
  process.exit(1);
}

console.log({
  slug: bot.slug,
  enabled: bot.enabled,
  deletedAt: bot.deletedAt,
  allowedRoles: bot.allowedRoles,
  engine: bot.engine,
  provider: bot.provider,
  modelId: bot.modelId,
});
process.exit(0);
