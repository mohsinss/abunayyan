import "server-only";
import { asc, eq, isNull } from "drizzle-orm";
import {
  db,
  wcGroups,
  wcNarrative,
  wcSbus,
  type WcGroup,
  type WcNarrative,
  type WcSbu,
} from "@/db";

// Singleton row at id=1. Returns null until the seed has been applied.
export async function getWorkingCapitalGroup(): Promise<WcGroup | null> {
  const [row] = await db
    .select()
    .from(wcGroups)
    .where(eq(wcGroups.id, 1))
    .limit(1);
  return row ?? null;
}

// All non-archived SBUs, ordered for the dashboard tab strip and group
// charts. Archived rows are hidden from both the dashboard and the
// chunk builder.
export async function listActiveSbus(): Promise<WcSbu[]> {
  return db
    .select()
    .from(wcSbus)
    .where(isNull(wcSbus.archivedAt))
    .orderBy(asc(wcSbus.displayOrder), asc(wcSbus.key));
}

export async function getSbuById(id: string): Promise<WcSbu | null> {
  const [row] = await db.select().from(wcSbus).where(eq(wcSbus.id, id)).limit(1);
  return row ?? null;
}

export async function getSbuByKey(key: string): Promise<WcSbu | null> {
  const [row] = await db.select().from(wcSbus).where(eq(wcSbus.key, key)).limit(1);
  return row ?? null;
}

export async function listActiveNarrative(): Promise<WcNarrative[]> {
  return db
    .select()
    .from(wcNarrative)
    .where(isNull(wcNarrative.archivedAt))
    .orderBy(asc(wcNarrative.displayOrder), asc(wcNarrative.slot));
}

export async function getNarrativeBySlot(slot: string): Promise<WcNarrative | null> {
  const [row] = await db
    .select()
    .from(wcNarrative)
    .where(eq(wcNarrative.slot, slot))
    .limit(1);
  return row ?? null;
}
