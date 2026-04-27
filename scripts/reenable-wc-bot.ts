import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const db = drizzle(neon(url), { schema });
  await db
    .update(schema.chatbots)
    .set({ enabled: true, updatedAt: new Date() })
    .where(eq(schema.chatbots.slug, "working-capital-analyst"));
  const [bot] = await db
    .select({ slug: schema.chatbots.slug, enabled: schema.chatbots.enabled })
    .from(schema.chatbots)
    .where(eq(schema.chatbots.slug, "working-capital-analyst"))
    .limit(1);
  console.log(`✓ ${bot?.slug} → enabled=${bot?.enabled}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
