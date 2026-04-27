import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { BUILTIN_CARDS } from "../lib/datasets/builtins";
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
  // Dev user for local smoke tests.
  await db
    .insert(schema.users)
    .values({
      id: "seed-dev-user",
      email: "dev@example.com",
      name: "Dev Seed",
    })
    .onConflictDoNothing();
  console.log("✓ seeded users");

  // Ensure the platform settings singleton exists.
  await db.insert(schema.platformSettings).values({ id: 1 }).onConflictDoNothing();
  console.log("✓ platform_settings row");

  // Promote SEED_OWNER_EMAIL to owner if the env var is set.
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  if (ownerEmail) {
    const res = await db
      .update(schema.users)
      .set({ role: "owner" })
      .where(eq(schema.users.email, ownerEmail))
      .returning({ id: schema.users.id });
    if (res.length) console.log(`✓ promoted ${ownerEmail} to owner`);
    else console.log(`! SEED_OWNER_EMAIL ${ownerEmail} not found (sign in first, then re-run)`);
  }

  // Seed builtin dataset cards (phase 2). Links to the seeded chatbot (by slug)
  // when present; if the chatbot hasn't been seeded yet, chatbot_id stays null
  // and the dashboard resolves it at request time via the builtins registry.
  for (const card of Object.values(BUILTIN_CARDS)) {
    const [existingBot] = await db
      .select({ id: schema.chatbots.id })
      .from(schema.chatbots)
      .where(and(eq(schema.chatbots.slug, card.chatbotSlug), isNull(schema.chatbots.deletedAt)))
      .limit(1);

    const inserted = await db
      .insert(schema.datasets)
      .values({
        slug: card.route,
        title: card.title,
        description: card.description,
        kind: "builtin",
        config: { version: 1, builtinKey: card.key },
        chatbotId: existingBot?.id ?? null,
        createdBy: "seed-dev-user",
      })
      .onConflictDoNothing({ target: schema.datasets.slug })
      .returning({ id: schema.datasets.id });

    if (inserted.length) {
      console.log(`✓ seeded builtin dataset: ${card.route}`);
    } else if (existingBot) {
      // Backfill chatbotId on an existing row that was seeded before the
      // atlas-analyst chatbot existed.
      await db
        .update(schema.datasets)
        .set({ chatbotId: existingBot.id })
        .where(and(eq(schema.datasets.slug, card.route), isNull(schema.datasets.chatbotId)));
    }
  }

  await seedWorkingCapital();
}

// Idempotent: re-running on existing rows is a no-op. Admin edits are
// preserved — we only insert when a row is missing.
async function seedWorkingCapital() {
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

  for (let i = 0; i < SBU_SEEDS.length; i++) {
    const s = SBU_SEEDS[i];
    if (!s) continue;
    await db
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
      .onConflictDoNothing({ target: schema.wcSbus.key });
  }
  console.log(`✓ wc_sbus rows (${SBU_SEEDS.length} entries)`);

  for (const n of NARRATIVE_SEEDS) {
    await db
      .insert(schema.wcNarrative)
      .values({
        slot: n.slot,
        title: n.title,
        body: n.body,
        displayOrder: n.displayOrder,
      })
      .onConflictDoNothing({ target: schema.wcNarrative.slot });
  }
  console.log(`✓ wc_narrative rows (${NARRATIVE_SEEDS.length} slots)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
