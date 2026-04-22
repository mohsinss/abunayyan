import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required for seeding");

const sql = neon(url);
const db = drizzle(sql, { schema });

async function main() {
  await db
    .insert(schema.users)
    .values({
      id: "seed-dev-user",
      email: "dev@example.com",
      name: "Dev Seed",
    })
    .onConflictDoNothing();
  console.log("✓ seeded users");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
