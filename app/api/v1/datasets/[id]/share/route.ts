import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { writeAudit } from "@/lib/chatbots/audit";
import { getDatasetById, setShareState } from "@/lib/db/queries/datasets";
import { generateShareToken } from "@/lib/datasets/share";

export const runtime = "nodejs";

const PostSchema = z
  .object({
    rotate: z.boolean().optional(),
  })
  .optional();

// POST enables share + returns the URL. `{ rotate: true }` issues a fresh
// token (invalidating the old one immediately). DELETE disables share but
// keeps the token so "re-enable" restores the same URL.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) return new Response("Not found", { status: 404 });
  if (dataset.kind !== "generated") {
    return new Response("Only generated datasets can be shared", { status: 400 });
  }

  let body: z.infer<typeof PostSchema> = undefined;
  try {
    body = PostSchema.parse(await req.json().catch(() => ({})));
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const rotate = body?.rotate === true;
  const needsToken = rotate || !dataset.shareToken;
  const token = needsToken ? generateShareToken() : dataset.shareToken!;

  try {
    const updated = await setShareState(id, { enabled: true, rotate: needsToken, token });
    if (!updated) return new Response("Not found", { status: 404 });
    await writeAudit({
      actorId: guard.user.id,
      event: rotate ? "dataset.share_rotated" : "dataset.share_enabled",
      payload: { datasetId: id, slug: updated.slug },
    });
    return Response.json({
      enabled: updated.shareEnabled,
      token: updated.shareToken,
      path: updated.shareToken ? `/s/${updated.shareToken}` : null,
    });
  } catch (err) {
    captureError(err, { route: "datasets.share.enable", datasetId: id });
    return new Response("Enable failed", { status: 500 });
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

  try {
    const updated = await setShareState(id, { enabled: false });
    if (!updated) return new Response("Not found", { status: 404 });
    await writeAudit({
      actorId: guard.user.id,
      event: "dataset.share_disabled",
      payload: { datasetId: id, slug: updated.slug },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    captureError(err, { route: "datasets.share.disable", datasetId: id });
    return new Response("Disable failed", { status: 500 });
  }
}
