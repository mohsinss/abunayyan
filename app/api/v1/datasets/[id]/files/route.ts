import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/queue";
import {
  BlobNotConfiguredError,
  isBlobConfigured,
  uploadBlob,
} from "@/lib/datasets/blob";
import {
  checkCanAddFile,
  mimeOrExtensionAllowed,
} from "@/lib/datasets/limits";
import {
  getDatasetById,
  insertDatasetFile,
} from "@/lib/db/queries/datasets";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id: datasetId } = await params;
  const dataset = await getDatasetById(datasetId);
  if (!dataset) return new Response("Not found", { status: 404 });
  if (dataset.kind !== "generated") {
    return new Response("Only generated datasets accept uploads", { status: 400 });
  }
  if (!isBlobConfigured()) {
    return new Response("Blob storage not configured", { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("Expected multipart/form-data", { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response("Missing 'file' field", { status: 400 });
  }

  if (!mimeOrExtensionAllowed(file.type, file.name)) {
    return Response.json(
      { error: "UNSUPPORTED_FILE_TYPE", mime: file.type, filename: file.name },
      { status: 415 },
    );
  }

  const cap = await checkCanAddFile(datasetId, file.size);
  if (!cap.ok) {
    return Response.json(
      { error: cap.code, max: cap.max, current: cap.current },
      { status: 409 },
    );
  }

  let blob;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pathname = `datasets/${datasetId}/${file.name}`;
    blob = await uploadBlob(pathname, buffer, file.type || "application/octet-stream");
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return new Response("Blob storage not configured", { status: 503 });
    }
    captureError(err, { route: "datasets.files.upload", datasetId });
    return new Response("Upload failed", { status: 500 });
  }

  const row = await insertDatasetFile({
    datasetId,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storageKey: blob.url,
    status: "queued",
  });

  try {
    await enqueue({
      job: "parse-dataset-file",
      url: `${env.NEXT_PUBLIC_APP_URL}/api/v1/webhook/qstash`,
      body: { fileId: row.id },
    });
  } catch (err) {
    captureError(err, { route: "datasets.files.enqueue", fileId: row.id });
    // Leave the file in `queued`; an admin can retry. The blob is already
    // written, so retry is just re-enqueuing.
  }

  await capture({
    distinctId: guard.user.id,
    event: EVENTS.dataset_file_uploaded,
    properties: {
      datasetId,
      fileId: row.id,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    },
  });

  return Response.json(
    {
      fileId: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      status: row.status,
      storageUrl: row.storageKey,
    },
    { status: 201 },
  );
}
