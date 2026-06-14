// Mint a local owner session for manual testing (same mechanism as the
// Playwright auth fixture). Prints the session token to set as the
// `authjs.session-token` cookie on localhost.
// Usage: pnpm tsx --env-file=.env --env-file=.env.local scripts/dev-session.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { users } from "../db/schema/users";
import { sessions } from "../db/schema/sessions";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");
const db = drizzle(neon(url), { schema: { users, sessions } });

async function main() {
  const id = "e2e-playwright-admin";
  await db
    .insert(users)
    .values({ id, email: `${id}@test.local`, name: "E2E owner", role: "owner", disabled: false })
    .onConflictDoNothing();
  await db.update(users).set({ role: "owner", disabled: false }).where(eq(users.id, id));
  await db.delete(sessions).where(eq(sessions.userId, id));
  const token = crypto.randomUUID();
  await db.insert(sessions).values({
    sessionToken: token,
    userId: id,
    expires: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });
  console.log(`TOKEN=${token}`);
}

main().then(() => process.exit(0));
