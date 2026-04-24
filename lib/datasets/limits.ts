import "server-only";
import { count, eq, isNull } from "drizzle-orm";
import { db, datasetFiles, datasetRows, datasets } from "@/db";
import { getPlatformSettings } from "@/lib/chatbots/settings";

export type LimitCheck =
  | { ok: true }
  | { ok: false; code: "TOO_MANY_DATASETS" | "TOO_MANY_FILES" | "FILE_TOO_LARGE" | "TOO_MANY_ROWS"; max: number; current: number };

export async function checkCanCreateDataset(): Promise<LimitCheck> {
  const s = await getPlatformSettings();
  const [{ value }] = await db
    .select({ value: count() })
    .from(datasets)
    .where(isNull(datasets.deletedAt));
  if (value >= s.datasetMaxDatasets) {
    return { ok: false, code: "TOO_MANY_DATASETS", max: s.datasetMaxDatasets, current: value };
  }
  return { ok: true };
}

export async function checkCanAddFile(datasetId: string, sizeBytes: number): Promise<LimitCheck> {
  const s = await getPlatformSettings();
  if (sizeBytes > s.datasetMaxFileBytes) {
    return { ok: false, code: "FILE_TOO_LARGE", max: s.datasetMaxFileBytes, current: sizeBytes };
  }
  const [{ value }] = await db
    .select({ value: count() })
    .from(datasetFiles)
    .where(eq(datasetFiles.datasetId, datasetId));
  if (value >= s.datasetMaxFilesPerDataset) {
    return {
      ok: false,
      code: "TOO_MANY_FILES",
      max: s.datasetMaxFilesPerDataset,
      current: value,
    };
  }
  return { ok: true };
}

export async function checkCanAddRows(datasetId: string, incoming: number): Promise<LimitCheck> {
  const s = await getPlatformSettings();
  const [{ value }] = await db
    .select({ value: count() })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, datasetId));
  const next = value + incoming;
  if (next > s.datasetMaxRowsPerDataset) {
    return {
      ok: false,
      code: "TOO_MANY_ROWS",
      max: s.datasetMaxRowsPerDataset,
      current: next,
    };
  }
  return { ok: true };
}

export const ACCEPTED_MIME_TYPES = new Set<string>([
  // xlsx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // xls (legacy)
  "application/vnd.ms-excel",
  // csv
  "text/csv",
  "application/csv",
  // docx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // pptx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const ACCEPTED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".docx", ".pptx"]);

export function mimeOrExtensionAllowed(mime: string, filename: string): boolean {
  if (ACCEPTED_MIME_TYPES.has(mime)) return true;
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return false;
  return ACCEPTED_EXTENSIONS.has(filename.slice(dot).toLowerCase());
}
