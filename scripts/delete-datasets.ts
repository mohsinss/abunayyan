import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as schema from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const sql = neon(url);
const db = drizzle(sql, { schema });

const SLUGS = ["data-set-regarding-financials", "untitled-dataset-2026-04-24-21-49"];

async function main() {
  const rows = await db
    .select({
      id: schema.datasets.id,
      slug: schema.datasets.slug,
      title: schema.datasets.title,
      kind: schema.datasets.kind,
      chatbotId: schema.datasets.chatbotId,
      deletedAt: schema.datasets.deletedAt,
    })
    .from(schema.datasets)
    .where(inArray(schema.datasets.slug, SLUGS));

  if (rows.length === 0) {
    console.log("No matching datasets found.");
    return;
  }

  console.log("Found:");
  for (const r of rows) {
    console.log(`  - ${r.slug} (id=${r.id}, kind=${r.kind}, alreadyDeleted=${!!r.deletedAt}, title="${r.title}")`);
  }

  const now = new Date();
  for (const r of rows) {
    if (r.kind === "builtin") {
      console.log(`! Skipping builtin: ${r.slug}`);
      continue;
    }
    if (r.deletedAt) {
      console.log(`! Already soft-deleted: ${r.slug}`);
      continue;
    }
    await db
      .update(schema.datasets)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(schema.datasets.id, r.id), isNull(schema.datasets.deletedAt)));
    console.log(`✓ soft-deleted dataset: ${r.slug}`);

    if (r.chatbotId) {
      await db
        .update(schema.chatbots)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(schema.chatbots.id, r.chatbotId), isNull(schema.chatbots.deletedAt)));
      console.log(`  ✓ soft-deleted linked chatbot: ${r.chatbotId}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
