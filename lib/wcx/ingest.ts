import "server-only";
import { captureError } from "@/lib/logger";
import { fetchBlob } from "@/lib/datasets/blob";
import {
  claimUploadForParsing,
  countActiveReadyUploads,
  getUploadById,
  insertFactsBatched,
  insertRecordsBatched,
  insertSbus,
  insertTargets,
  updateUpload,
} from "@/lib/db/queries/wc-intelligence";
import { parseWorkbook, WorkbookFormatError } from "./parse-workbook";
import { reconcile } from "./reconcile";

// Ingest one uploaded workbook version: blob → parse → reconcile → insert.
// Facts/records are keyed by uploadId, so a failed ingest never corrupts
// the active version — the upload row is simply marked failed and the
// previously active version keeps serving the dashboard and chatbot.
export async function runWcxIngestJob(uploadId: string): Promise<void> {
  const upload = await getUploadById(uploadId);
  if (!upload) throw new Error(`wcx upload ${uploadId} not found`);

  const claimed = await claimUploadForParsing(uploadId);
  if (!claimed) return;

  try {
    const buffer = await fetchBlob(upload.storageKey);
    const parsed = parseWorkbook(buffer);

    const qaReport = reconcile({
      facts: parsed.facts,
      sbus: parsed.sbus.map((s) => s.code),
      months: parsed.months,
      unknownLabels: parsed.unknownLabels,
      recordsCount: parsed.records.length,
    });

    await insertSbus(parsed.sbus.map((s) => ({ ...s, uploadId })));
    await insertFactsBatched(parsed.facts.map((f) => ({ ...f, uploadId })));
    await insertRecordsBatched(parsed.records.map((r) => ({ ...r, uploadId })));
    await insertTargets(parsed.targets.map((t) => ({ ...t, uploadId })));

    await updateUpload(uploadId, {
      status: "ready",
      parseError: null,
      periodStart: parsed.months[0] ?? null,
      periodEnd: parsed.months[parsed.months.length - 1] ?? null,
      factsCount: parsed.facts.length,
      recordsCount: parsed.records.length,
      qaReport,
    });

    // First successful upload becomes active automatically; later versions
    // wait for an explicit admin activation.
    const activeCount = await countActiveReadyUploads();
    if (activeCount === 0) {
      await updateUpload(uploadId, { isActive: true });
    }
  } catch (err) {
    const message =
      err instanceof WorkbookFormatError
        ? err.message
        : err instanceof Error
          ? err.message.slice(0, 500)
          : "Unknown ingest error";
    captureError(err, { job: "parse-wcx-workbook", uploadId });
    await updateUpload(uploadId, { status: "failed", parseError: message });
    throw err;
  }
}
