// Accuracy verification: compares random raw workbook cells against the
// values served from Postgres through the same derive/aggregate code path
// the chat tools use. Exact equality required for raw cells.
// Usage: pnpm tsx --env-file=.env --env-file=.env.local scripts/verify-wcx-accuracy.ts "/path/to/workbook.xlsx"

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, desc } from "drizzle-orm";
import * as schema from "../db/schema";
import { parseWorkbook } from "../lib/wcx/parse-workbook";
import { buildIndex, aggregateMetric, cccAt, valueAt } from "../lib/wcx/derive";
import { fiscalYearMonths } from "../lib/wcx/metrics";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema });
const { wcxUploads, wcxMonthlyFacts } = schema;

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx scripts/verify-wcx-accuracy.ts <workbook.xlsx>");
  process.exit(1);
}

async function main() {
  // Re-parse the workbook locally as the independent source of truth.
  const buf = readFileSync(path!);
  const parsed = parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

  const [active] = await db
    .select()
    .from(wcxUploads)
    .where(and(eq(wcxUploads.isActive, true), eq(wcxUploads.status, "ready")))
    .orderBy(desc(wcxUploads.createdAt))
    .limit(1);
  if (!active) throw new Error("No active upload in DB");
  console.log("Active upload:", active.filename, active.id);

  const dbFacts = await db
    .select({
      sbuCode: wcxMonthlyFacts.sbuCode,
      metricKey: wcxMonthlyFacts.metricKey,
      month: wcxMonthlyFacts.month,
      value: wcxMonthlyFacts.value,
    })
    .from(wcxMonthlyFacts)
    .where(eq(wcxMonthlyFacts.uploadId, active.id));
  console.log("DB facts:", dbFacts.length, "· workbook facts:", parsed.facts.length);
  if (dbFacts.length !== parsed.facts.length) throw new Error("Fact count mismatch!");

  const dbIdx = buildIndex(dbFacts);

  // 1) Exact-equality spot checks on 50 random raw cells.
  let exactPass = 0;
  for (let i = 0; i < 50; i++) {
    const f = parsed.facts[Math.floor(Math.random() * parsed.facts.length)]!;
    const dbVal = valueAt(dbIdx, f.sbuCode, f.metricKey, f.month);
    if (dbVal === f.value) exactPass++;
    else console.log(`  MISMATCH ${f.sbuCode} ${f.metricKey} ${f.month}: xlsx=${f.value} db=${dbVal}`);
  }
  console.log(`Raw-cell exact equality: ${exactPass}/50`);

  // 2) FY aggregation: sum FY-2024 invoiced revenue for ATC from the
  //    workbook by hand vs aggregateMetric over the DB index.
  const fy24 = fiscalYearMonths("FY-2024")!;
  const handSum = parsed.facts
    .filter((f) => f.sbuCode === "ATC" && f.metricKey === "pl.revenue_invoiced" && f.month.startsWith("2024-"))
    .reduce((a, b) => a + b.value, 0);
  const agg = aggregateMetric(dbIdx, "ATC", "pl.revenue_invoiced", fy24);
  console.log(`FY-2024 ATC revenue: hand=${handSum} engine=${agg?.value} agg=${agg?.agg}`);
  if (!agg || Math.abs(agg.value - handSum) > 1e-9) throw new Error("FY aggregation mismatch!");

  // 3) Balance EOP rule: FY-2025 ATC inventory must equal the 2025-12 cell,
  //    not a sum.
  const fy25 = fiscalYearMonths("FY-2025")!;
  const eop = aggregateMetric(dbIdx, "ATC", "bs.inventory_net", fy25);
  const dec = valueAt(dbIdx, "ATC", "bs.inventory_net", "2025-12");
  console.log(`FY-2025 ATC inventory (eop rule): engine=${eop?.value} dec-cell=${dec}`);
  if (!eop || eop.value !== dec) throw new Error("EOP aggregation rule violated!");

  // 4) Derived CCC determinism: same inputs → same output from both indexes.
  const xlsIdx = buildIndex(parsed.facts);
  const a = cccAt(xlsIdx, "KSB", "2025-12")?.value;
  const b = cccAt(dbIdx, "KSB", "2025-12")?.value;
  console.log(`Derived KSB CCC 2025-12: xlsx-path=${a} db-path=${b}`);
  if (a === undefined || b === undefined || Math.abs((a ?? 0) - (b ?? 0)) > 1e-9) {
    throw new Error("Derived CCC mismatch!");
  }

  if (exactPass !== 50) throw new Error("Raw-cell mismatches found!");
  console.log("\n✓ All accuracy checks passed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
