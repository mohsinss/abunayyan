import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/queue";
import {
  BlobNotConfiguredError,
  isBlobConfigured,
  uploadBlob,
} from "@/lib/datasets/blob";
import { insertUpload, listUploads } from "@/lib/db/queries/wc-intelligence";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const uploads = await listUploads();
  return Response.json({
    uploads: uploads.map((u) => ({
      id: u.id,
      filename: u.filename,
      status: u.status,
      parseError: u.parseError,
      periodStart: u.periodStart,
      periodEnd: u.periodEnd,
      factsCount: u.factsCount,
      recordsCount: u.recordsCount,
      isActive: u.isActive,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
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
  if (!file.name.toLowerCase().endsWith(".xlsx") && file.type !== XLSX_MIME) {
    return Response.json(
      { error: "UNSUPPORTED_FILE_TYPE", message: "Upload the .xlsx workbook" },
      { status: 415 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "FILE_TOO_LARGE", max: MAX_UPLOAD_BYTES }, { status: 409 });
  }

  let blob;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    blob = await uploadBlob(`wcx/${file.name}`, buffer, file.type || XLSX_MIME);
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return new Response("Blob storage not configured", { status: 503 });
    }
    captureError(err, { route: "wcx.uploads.post" });
    return new Response("Upload failed", { status: 500 });
  }

  const row = await insertUpload({
    filename: file.name,
    sizeBytes: file.size,
    storageKey: blob.url,
    uploadedBy: guard.user.id,
  });

  try {
    await enqueue({
      job: "parse-wcx-workbook",
      url: `${env.NEXT_PUBLIC_APP_URL}/api/v1/webhook/qstash`,
      body: { uploadId: row.id },
    });
  } catch (err) {
    captureError(err, { route: "wcx.uploads.enqueue", uploadId: row.id });
    // The row stays `queued`; admin can retry from the admin page.
  }

  return Response.json(
    { uploadId: row.id, filename: row.filename, status: row.status },
    { status: 201 },
  );
}
