import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, datasets, type Dataset } from "@/db";

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
