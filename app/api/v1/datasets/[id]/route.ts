import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { writeAudit } from "@/lib/chatbots/audit";
import {
  getDatasetById,
  listFilesForDataset,
  softDeleteDataset,
  updateDataset,
} from "@/lib/db/queries/datasets";

export const runtime = "nodejs";

const PatchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) return new Response("Not found", { status: 404 });

  const files = await listFilesForDataset(id);
  return Response.json({
    dataset: {
      id: dataset.id,
      slug: dataset.slug,
      title: dataset.title,
      description: dataset.description,
      kind: dataset.kind,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
    },
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      status: f.status,
      parseError: f.parseError,
      createdAt: f.createdAt,
    })),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) return new Response("Not found", { status: 404 });
  if (dataset.kind === "builtin") {
    return new Response("Cannot edit builtin cards", { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION_FAILED", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const updated = await updateDataset(id, {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    });
    if (!updated) return new Response("Not found", { status: 404 });
    return Response.json({ id: updated.id, slug: updated.slug, title: updated.title });
  } catch (err) {
    captureError(err, { route: "datasets.patch", datasetId: id });
    return new Response("Update failed", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) return new Response("Not found", { status: 404 });
  if (dataset.kind === "builtin") {
    return new Response("Cannot delete builtin cards", { status: 400 });
  }

  try {
    const deleted = await softDeleteDataset(id);
    if (!deleted) return new Response("Not found", { status: 404 });
    await writeAudit({
      actorId: guard.user.id,
      event: "dataset.soft_deleted",
      payload: { datasetId: id, slug: deleted.slug },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    captureError(err, { route: "datasets.delete", datasetId: id });
    return new Response("Delete failed", { status: 500 });
  }
}
