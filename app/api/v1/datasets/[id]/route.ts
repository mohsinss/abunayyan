import { requireAdminApi } from "@/lib/auth/rbac";
import { getDatasetById, listFilesForDataset } from "@/lib/db/queries/datasets";

export const runtime = "nodejs";

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
