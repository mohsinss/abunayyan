// Idempotent standalone seeder for the wc_groups / wc_sbus / wc_narrative
// tables. Run after applying migration 0004:
//
//   pnpm tsx --env-file=.env --env-file=.env.local scripts/seed-working-capital.ts
//
// Re-running is a no-op for rows that already exist; admin edits are
// preserved. Use this in production to populate the new tables without
// triggering the full db/seed.ts (which inserts dev users + builtins).

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import {
  GROUP_SEED,
  NARRATIVE_SEEDS,
  SBU_SEEDS,
} from "../lib/working-capital-data/seed-data";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required for seeding");

const sql = neon(url);
const db = drizzle(sql, { schema });

async function main() {
  await db
    .insert(schema.wcGroups)
    .values({
      id: 1,
      fiscalYear: GROUP_SEED.fiscalYear,
      groupRevenue: GROUP_SEED.groupRevenue,
      nwcTargetRelease: GROUP_SEED.nwcTargetRelease,
      notes: GROUP_SEED.notes,
    })
    .onConflictDoNothing({ target: schema.wcGroups.id });
  console.log("✓ wc_groups singleton");

  let sbuCount = 0;
  for (let i = 0; i < SBU_SEEDS.length; i++) {
    const s = SBU_SEEDS[i];
    if (!s) continue;
    const res = await db
      .insert(schema.wcSbus)
      .values({
        key: s.key,
        name: s.name,
        shareText: s.shareText,
        posture: s.posture,
        displayOrder: i,
        inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
        dio: s.dio, dso: s.dso, dpo: s.dpo,
        tInv: s.tInv, tAr: s.tAr, tCa: s.tCa, tAp: s.tAp,
        tDio: s.tDio, tDso: s.tDso, tDpo: s.tDpo,
        notes: s.notes,
      })
      .onConflictDoNothing({ target: schema.wcSbus.key })
      .returning({ id: schema.wcSbus.id });
    if (res.length) sbuCount++;
  }
  console.log(`✓ wc_sbus inserted=${sbuCount} (existing rows preserved)`);

  let narrativeCount = 0;
  for (const n of NARRATIVE_SEEDS) {
    const res = await db
      .insert(schema.wcNarrative)
      .values({
        slot: n.slot,
        title: n.title,
        body: n.body,
        displayOrder: n.displayOrder,
      })
      .onConflictDoNothing({ target: schema.wcNarrative.slot })
      .returning({ id: schema.wcNarrative.id });
    if (res.length) narrativeCount++;
  }
  console.log(`✓ wc_narrative inserted=${narrativeCount} (existing rows preserved)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
