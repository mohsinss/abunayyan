import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

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
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
