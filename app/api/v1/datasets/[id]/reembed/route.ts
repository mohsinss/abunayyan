import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { getDatasetById } from "@/lib/db/queries/datasets";
import { backfillDatasetEmbeddings } from "@/lib/datasets/embed-backfill";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) return new Response("Not found", { status: 404 });

  try {
    const embedded = await backfillDatasetEmbeddings(id);
    return Response.json({ datasetId: id, embedded });
  } catch (err) {
    captureError(err, { route: "datasets.reembed", datasetId: id });
    return new Response("Re-embed failed", { status: 500 });
  }
}
