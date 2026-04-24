import "server-only";
import { captureError } from "@/lib/logger";
import {
  hardDeleteChatbotIfSoftDeleted,
  hardDeleteDataset,
  listFilesForDataset,
  listStaleDeletedDatasets,
} from "@/lib/db/queries/datasets";
import { deleteBlob, isBlobConfigured } from "./blob";

export type SweepResult = {
  datasetsHardDeleted: number;
  blobsDeleted: number;
  blobErrors: number;
  chatbotsHardDeleted: number;
};

const DEFAULT_RETENTION_DAYS = 30;

/**
 * Hard-deletes soft-deleted datasets past retention, along with their
 * Vercel Blob objects and linked chatbot rows. Safe to rerun: targets
 * only rows whose deletedAt is older than the cutoff.
 *
 * Cascading DELETE on dataset_files / dataset_rows / documents (via
 * dataset_id FK onDelete: cascade) cleans those rows for free. Blobs
 * live outside Postgres, so we delete them explicitly BEFORE the dataset
 * row goes — otherwise we'd lose the storage_key and orphan the blob.
 */
export async function runDatasetSweep(opts: { retentionDays?: number } = {}): Promise<SweepResult> {
  const days = opts.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stale = await listStaleDeletedDatasets(cutoff);
  const result: SweepResult = {
    datasetsHardDeleted: 0,
    blobsDeleted: 0,
    blobErrors: 0,
    chatbotsHardDeleted: 0,
  };

  const canDeleteBlobs = isBlobConfigured();

  for (const ds of stale) {
    const files = await listFilesForDataset(ds.id);

    if (canDeleteBlobs) {
      for (const f of files) {
        try {
          await deleteBlob(f.storageKey);
          result.blobsDeleted++;
        } catch (err) {
          result.blobErrors++;
          captureError(err, { flow: "dataset-sweep", fileId: f.id });
        }
      }
    }

    await hardDeleteDataset(ds.id);
    result.datasetsHardDeleted++;

    if (ds.chatbotId) {
      const deleted = await hardDeleteChatbotIfSoftDeleted(ds.chatbotId);
      if (deleted) result.chatbotsHardDeleted++;
    }
  }

  return result;
}
