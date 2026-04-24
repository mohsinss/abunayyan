import "server-only";
import { and, eq } from "drizzle-orm";
import {
  db,
  datasetFiles,
  datasetRows,
  datasets,
  documents,
  type NewDatasetRow,
} from "@/db";
import { captureError } from "@/lib/logger";
import { fetchBlob } from "./blob";
import { checkCanAddRows } from "./limits";
import { parseFile, UnsupportedFileError } from "./parsers";

const ROW_INSERT_BATCH = 500;
const CHUNK_INSERT_BATCH = 100;

export type ParseJobCode =
  | "NOT_FOUND"
  | "UNSUPPORTED"
  | "ROW_CAP"
  | "FETCH"
  | "PARSE"
  | "DB";

export class ParseJobError extends Error {
  readonly code: ParseJobCode;
  constructor(message: string, code: ParseJobCode) {
    super(`[${code}] ${message}`);
    this.name = "ParseJobError";
    this.code = code;
  }
}

export async function runParseJob(fileId: string): Promise<void> {
  const [file] = await db
    .select()
    .from(datasetFiles)
    .where(eq(datasetFiles.id, fileId))
    .limit(1);
  if (!file) throw new ParseJobError(`file ${fileId} not found`, "NOT_FOUND");

  // Transition to parsing. If another worker already picked it up we abort —
  // QStash retries should not double-parse.
  const [claimed] = await db
    .update(datasetFiles)
    .set({ status: "parsing", parseError: null })
    .where(and(eq(datasetFiles.id, fileId), eq(datasetFiles.status, "queued")))
    .returning({ id: datasetFiles.id });
  if (!claimed) return;

  try {
    const [dataset] = await db
      .select({ id: datasets.id, createdBy: datasets.createdBy })
      .from(datasets)
      .where(eq(datasets.id, file.datasetId))
      .limit(1);
    if (!dataset) throw new ParseJobError("dataset row vanished", "NOT_FOUND");

    const buffer = await fetchBlob(file.storageKey);
    const result = await parseFile(buffer, file.mimeType, file.filename);

    const cap = await checkCanAddRows(file.datasetId, result.rows.length);
    if (!cap.ok) {
      throw new ParseJobError(
        `row cap exceeded: ${cap.current}/${cap.max}`,
        "ROW_CAP",
      );
    }

    await insertRowsBatched(file.datasetId, file.id, result.rows);
    await insertChunksBatched(file.datasetId, dataset.createdBy, result.chunks);

    await db
      .update(datasetFiles)
      .set({ status: "ready", parseError: null })
      .where(eq(datasetFiles.id, fileId));
  } catch (err) {
    const message = errorMessage(err);
    captureError(err, { job: "parse-dataset-file", fileId });
    await db
      .update(datasetFiles)
      .set({ status: "failed", parseError: message })
      .where(eq(datasetFiles.id, fileId));
    throw err;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof UnsupportedFileError) return err.message;
  if (err instanceof ParseJobError) return err.message;
  if (err instanceof Error) return err.message.slice(0, 500);
  return "Unknown parse error";
}

async function insertRowsBatched(
  datasetId: string,
  fileId: string,
  rows: Array<{ sheet: string | null; rowIndex: number; data: Record<string, unknown> }>,
) {
  if (rows.length === 0) return;
  const payload: NewDatasetRow[] = rows.map((r) => ({
    datasetId,
    fileId,
    sheet: r.sheet,
    rowIndex: r.rowIndex,
    data: r.data,
  }));
  for (let i = 0; i < payload.length; i += ROW_INSERT_BATCH) {
    await db.insert(datasetRows).values(payload.slice(i, i + ROW_INSERT_BATCH));
  }
}

async function insertChunksBatched(datasetId: string, userId: string, chunks: string[]) {
  if (chunks.length === 0) return;
  // Embeddings land in phase 4; we store the plain content here so the
  // embedder can backfill in bulk without re-parsing the blob.
  const payload = chunks.map((content) => ({ datasetId, userId, content, embedding: null }));
  for (let i = 0; i < payload.length; i += CHUNK_INSERT_BATCH) {
    await db.insert(documents).values(payload.slice(i, i + CHUNK_INSERT_BATCH));
  }
}
