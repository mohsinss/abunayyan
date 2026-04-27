import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserPrefs } from "@/db/schema/users";

// Read a single key from users.prefs with a typed fallback. The column
// is jsonb default '{}' so missing keys cleanly return the fallback.
export async function getUserPref<T>(
  userId: string,
  key: string,
  fallback: T,
): Promise<T> {
  const [row] = await db
    .select({ prefs: users.prefs })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return fallback;
  const v = (row.prefs as UserPrefs)[key];
  return (v ?? fallback) as T;
}

// Set a single key on users.prefs. Uses jsonb_set so concurrent writes
// to other keys aren't lost on a slow round-trip; this matters because
// we'll likely add more view toggles over time and don't want them to
// stomp each other.
export async function setUserPref(
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await db
    .update(users)
    .set({
      prefs: sql`jsonb_set(coalesce(${users.prefs}, '{}'::jsonb), ${`{${key}}`}, ${JSON.stringify(value)}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
