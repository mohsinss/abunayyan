import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import {
  db,
  wcxMonthlyFacts,
  wcxRecords,
  wcxSbus,
  wcxTargets,
  wcxUploads,
  type NewWcxMonthlyFact,
  type NewWcxRecord,
  type NewWcxSbu,
  type NewWcxTarget,
  type WcxMonthlyFact,
  type WcxRecord,
  type WcxSbu,
  type WcxTarget,
  type WcxUpload,
} from "@/db";

const FACT_BATCH = 500;
const RECORD_BATCH = 200;

// ── Uploads ──────────────────────────────────────────────────────────────

export async function insertUpload(values: {
  filename: string;
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
}): Promise<WcxUpload> {
  const [row] = await db
    .insert(wcxUploads)
    .values({ ...values, status: "queued" })
    .returning();
  if (!row) throw new Error("Failed to insert wcx upload");
  return row;
}

export async function getUploadById(id: string): Promise<WcxUpload | null> {
  const [row] = await db.select().from(wcxUploads).where(eq(wcxUploads.id, id)).limit(1);
  return row ?? null;
}

export async function listUploads(): Promise<WcxUpload[]> {
  return db.select().from(wcxUploads).orderBy(desc(wcxUploads.createdAt));
}

// The dashboard and every chat tool read from exactly one upload — the
// active one. Single source of truth, switchable/rollbackable by admins.
export async function getActiveUpload(): Promise<WcxUpload | null> {
  const [row] = await db
    .select()
    .from(wcxUploads)
    .where(and(eq(wcxUploads.isActive, true), eq(wcxUploads.status, "ready")))
    .orderBy(desc(wcxUploads.createdAt))
    .limit(1);
  return row ?? null;
}

export async function setActiveUpload(id: string): Promise<void> {
  await db.update(wcxUploads).set({ isActive: false }).where(ne(wcxUploads.id, id));
  await db.update(wcxUploads).set({ isActive: true }).where(eq(wcxUploads.id, id));
}

// Replace semantics: once a version is active, every other settled version
// (and its facts/records/targets/sbus, via FK cascade) is deleted. Uploads
// still queued/parsing are left alone — they'll be pruned when the next
// activation happens.
export async function pruneOtherUploads(activeId: string): Promise<number> {
  const deleted = await db
    .delete(wcxUploads)
    .where(
      and(
        ne(wcxUploads.id, activeId),
        inArray(wcxUploads.status, ["ready", "failed"]),
      ),
    )
    .returning({ id: wcxUploads.id });
  return deleted.length;
}

export async function updateUpload(
  id: string,
  patch: Partial<
    Pick<
      WcxUpload,
      | "status"
      | "parseError"
      | "periodStart"
      | "periodEnd"
      | "factsCount"
      | "recordsCount"
      | "qaReport"
      | "isActive"
    >
  >,
): Promise<void> {
  await db.update(wcxUploads).set(patch).where(eq(wcxUploads.id, id));
}

// Claim a queued upload for parsing. Returns false when another worker
// already picked it up (QStash retries must not double-ingest).
export async function claimUploadForParsing(id: string): Promise<boolean> {
  const [claimed] = await db
    .update(wcxUploads)
    .set({ status: "parsing", parseError: null })
    .where(and(eq(wcxUploads.id, id), eq(wcxUploads.status, "queued")))
    .returning({ id: wcxUploads.id });
  return Boolean(claimed);
}

export async function countActiveReadyUploads(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wcxUploads)
    .where(and(eq(wcxUploads.isActive, true), eq(wcxUploads.status, "ready")));
  return row?.n ?? 0;
}

// ── Bulk inserts (ingest) ────────────────────────────────────────────────

export async function insertSbus(rows: NewWcxSbu[]): Promise<void> {
  if (rows.length > 0) await db.insert(wcxSbus).values(rows);
}

export async function insertFactsBatched(rows: NewWcxMonthlyFact[]): Promise<void> {
  for (let i = 0; i < rows.length; i += FACT_BATCH) {
    await db.insert(wcxMonthlyFacts).values(rows.slice(i, i + FACT_BATCH));
  }
}

export async function insertRecordsBatched(rows: NewWcxRecord[]): Promise<void> {
  for (let i = 0; i < rows.length; i += RECORD_BATCH) {
    await db.insert(wcxRecords).values(rows.slice(i, i + RECORD_BATCH));
  }
}

export async function insertTargets(rows: NewWcxTarget[]): Promise<void> {
  if (rows.length > 0) await db.insert(wcxTargets).values(rows);
}

// ── Reads (dashboard + chat tools) ───────────────────────────────────────

export async function listSbusForUpload(uploadId: string): Promise<WcxSbu[]> {
  return db
    .select()
    .from(wcxSbus)
    .where(eq(wcxSbus.uploadId, uploadId))
    .orderBy(asc(wcxSbus.displayOrder));
}

export type FactFilter = {
  sbuCodes?: string[];
  metricKeys?: string[];
  monthFrom?: string;
  monthTo?: string;
};

export async function getFacts(
  uploadId: string,
  filter: FactFilter = {},
): Promise<WcxMonthlyFact[]> {
  const where = [eq(wcxMonthlyFacts.uploadId, uploadId)];
  if (filter.sbuCodes?.length) where.push(inArray(wcxMonthlyFacts.sbuCode, filter.sbuCodes));
  if (filter.metricKeys?.length) where.push(inArray(wcxMonthlyFacts.metricKey, filter.metricKeys));
  if (filter.monthFrom) where.push(gte(wcxMonthlyFacts.month, filter.monthFrom));
  if (filter.monthTo) where.push(lte(wcxMonthlyFacts.month, filter.monthTo));
  return db
    .select()
    .from(wcxMonthlyFacts)
    .where(and(...where))
    .orderBy(asc(wcxMonthlyFacts.month));
}

export async function listTargetsForUpload(uploadId: string): Promise<WcxTarget[]> {
  return db.select().from(wcxTargets).where(eq(wcxTargets.uploadId, uploadId));
}

export async function getRecords(
  uploadId: string,
  sheet: string,
  sbuCode?: string,
): Promise<WcxRecord[]> {
  const where = [eq(wcxRecords.uploadId, uploadId), eq(wcxRecords.sheet, sheet)];
  if (sbuCode) where.push(eq(wcxRecords.sbuCode, sbuCode));
  return db
    .select()
    .from(wcxRecords)
    .where(and(...where))
    .orderBy(asc(wcxRecords.sbuCode), asc(wcxRecords.recordIndex));
}
