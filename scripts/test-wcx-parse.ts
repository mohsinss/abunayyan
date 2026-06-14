// Offline smoke test for the WC workbook parser + reconciler. No DB.
// Usage: pnpm tsx scripts/test-wcx-parse.ts "/path/to/workbook.xlsx"

import { readFileSync } from "node:fs";
import { parseWorkbook } from "@/lib/wcx/parse-workbook";
import { reconcile } from "@/lib/wcx/reconcile";
import { buildIndex, cccAt, nwcAt } from "@/lib/wcx/derive";

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx scripts/test-wcx-parse.ts <workbook.xlsx>");
  process.exit(1);
}

const buf = readFileSync(path);
const parsed = parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

console.log("SBUs:", parsed.sbus.map((s) => s.code).join(", "));
console.log("Facts:", parsed.facts.length);
console.log("Records:", parsed.records.length);
console.log("Targets:", parsed.targets.length);
console.log("Months:", parsed.months[0], "→", parsed.months[parsed.months.length - 1], `(${parsed.months.length})`);
console.log("Unknown labels:", parsed.unknownLabels.length);
for (const u of parsed.unknownLabels.slice(0, 20)) console.log("  ?", u.sheet, "·", u.label);

const bySheet = new Map<string, number>();
for (const f of parsed.facts) {
  const prefix = f.metricKey.split(".")[0]!;
  bySheet.set(prefix, (bySheet.get(prefix) ?? 0) + 1);
}
console.log("Facts by prefix:", Object.fromEntries([...bySheet.entries()].sort()));

const recBySheet = new Map<string, number>();
for (const r of parsed.records) recBySheet.set(r.sheet, (recBySheet.get(r.sheet) ?? 0) + 1);
console.log("Records by sheet:", Object.fromEntries([...recBySheet.entries()].sort()));

// Spot-check a known cell: ATC · pl.revenue_invoiced · 2023-01 should be 460
// in the FILLED dummy file.
const idx = buildIndex(parsed.facts);
const spot = parsed.facts.find(
  (f) => f.sbuCode === "ATC" && f.metricKey === "pl.revenue_invoiced" && f.month === "2023-01",
);
console.log("Spot ATC revenue 2023-01:", spot?.value);
console.log("Derived ATC NWC 2025-12:", nwcAt(idx, "ATC", "2025-12"));
console.log("Derived ATC CCC 2025-12:", cccAt(idx, "ATC", "2025-12"));

const qa = reconcile({
  facts: parsed.facts,
  sbus: parsed.sbus.map((s) => s.code),
  months: parsed.months,
  unknownLabels: parsed.unknownLabels,
  recordsCount: parsed.records.length,
});
console.log("\nQA checks:");
for (const c of qa.checks) {
  console.log(`  [${c.status}] ${c.id}: ${c.failures}/${c.total} failures`);
}
