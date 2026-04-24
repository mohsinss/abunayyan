import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  datasetFiles,
  datasetRows,
  datasets,
  type Dataset,
  type DatasetFile,
  type DatasetRow,
  type NewDataset,
  type NewDatasetFile,
} from "@/db";

export async function listDatasets(): Promise<Dataset[]> {
  return db
    .select()
    .from(datasets)
    .where(isNull(datasets.deletedAt))
    .orderBy(desc(datasets.createdAt));
}

export async function getDatasetBySlug(slug: string): Promise<Dataset | null> {
  const [row] = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.slug, slug), isNull(datasets.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getDatasetById(id: string): Promise<Dataset | null> {
  const [row] = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, id), isNull(datasets.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function slugExists(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.slug, slug))
    .limit(1);
  return !!row;
}

export async function insertDataset(input: NewDataset): Promise<Dataset> {
  const [row] = await db.insert(datasets).values(input).returning();
  if (!row) throw new Error("insertDataset returned no row");
  return row;
}

export async function listFilesForDataset(datasetId: string): Promise<DatasetFile[]> {
  return db
    .select()
    .from(datasetFiles)
    .where(eq(datasetFiles.datasetId, datasetId))
    .orderBy(asc(datasetFiles.createdAt));
}

export async function insertDatasetFile(input: NewDatasetFile): Promise<DatasetFile> {
  const [row] = await db.insert(datasetFiles).values(input).returning();
  if (!row) throw new Error("insertDatasetFile returned no row");
  return row;
}

export async function updateDataset(
  id: string,
  patch: Partial<Pick<Dataset, "title" | "description" | "config">>,
): Promise<Dataset | null> {
  const [row] = await db
    .update(datasets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(datasets.id, id), isNull(datasets.deletedAt)))
    .returning();
  return row ?? null;
}

// Fetches all parsed rows for a dataset, ordered deterministically so pages
// paginate consistently. Row count is capped at platform_settings
// dataset_max_rows_per_dataset (default 100k), well within a single query's
// sane budget — no pagination needed at the query layer today.
export async function getRowsForDataset(datasetId: string): Promise<DatasetRow[]> {
  return db
    .select()
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, datasetId))
    .orderBy(asc(datasetRows.fileId), asc(datasetRows.sheet), asc(datasetRows.rowIndex));
}
