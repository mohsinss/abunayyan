// Local end-to-end ingest: reads the workbook from disk and runs the same
// pipeline as the QStash job (parse → reconcile → insert → activate),
// without requiring Vercel Blob. Standalone drizzle client (like the other
// scripts/) because lib/db imports "server-only".
// Usage: pnpm tsx --env-file=.env --env-file=.env.local scripts/ingest-wcx-local.ts "/path/to/workbook.xlsx"

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, ne, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { parseWorkbook } from "../lib/wcx/parse-workbook";
import { reconcile } from "../lib/wcx/reconcile";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });
const { wcxUploads, wcxSbus, wcxMonthlyFacts, wcxRecords, wcxTargets } = schema;

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx scripts/ingest-wcx-local.ts <workbook.xlsx>");
  process.exit(1);
}

async function main() {
  const buf = readFileSync(path!);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const [upload] = await db
    .insert(wcxUploads)
    .values({
      filename: basename(path!),
      sizeBytes: buf.byteLength,
      storageKey: `local:${path}`,
      status: "parsing",
    })
    .returning();
  if (!upload) throw new Error("insert failed");
  console.log("Upload row:", upload.id);

  const parsed = parseWorkbook(arrayBuffer);
  console.log(`Parsed: ${parsed.facts.length} facts, ${parsed.records.length} records`);

  const qaReport = reconcile({
    facts: parsed.facts,
    sbus: parsed.sbus.map((s) => s.code),
    months: parsed.months,
    unknownLabels: parsed.unknownLabels,
    recordsCount: parsed.records.length,
  });

  console.log("Inserting SBUs/facts/records/targets…");
  const t0 = Date.now();
  await db.insert(wcxSbus).values(parsed.sbus.map((s) => ({ ...s, uploadId: upload.id })));
  const facts = parsed.facts.map((f) => ({ ...f, uploadId: upload.id }));
  for (let i = 0; i < facts.length; i += 500) {
    await db.insert(wcxMonthlyFacts).values(facts.slice(i, i + 500));
    if ((i / 500) % 20 === 0) console.log(`  facts ${i}/${facts.length}`);
  }
  const records = parsed.records.map((r) => ({ ...r, uploadId: upload.id }));
  for (let i = 0; i < records.length; i += 200) {
    await db.insert(wcxRecords).values(records.slice(i, i + 200));
  }
  if (parsed.targets.length > 0) {
    await db.insert(wcxTargets).values(parsed.targets.map((t) => ({ ...t, uploadId: upload.id })));
  }
  console.log(`Inserted in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await db
    .update(wcxUploads)
    .set({
      status: "ready",
      periodStart: parsed.months[0] ?? null,
      periodEnd: parsed.months[parsed.months.length - 1] ?? null,
      factsCount: parsed.facts.length,
      recordsCount: parsed.records.length,
      qaReport,
    })
    .where(eq(wcxUploads.id, upload.id));

  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wcxUploads)
    .where(and(eq(wcxUploads.isActive, true), eq(wcxUploads.status, "ready"), ne(wcxUploads.id, upload.id)))) as [{ n: number }];
  if (n === 0) {
    await db.update(wcxUploads).set({ isActive: true }).where(eq(wcxUploads.id, upload.id));
    console.log("Activated (first ready version).");
  } else {
    console.log("Left inactive — activate from /admin/wc-intelligence.");
  }

  console.log(
    "QA:",
    qaReport.checks.map((c) => `${c.id}=${c.status}${c.failures ? `(${c.failures})` : ""}`).join(" "),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
