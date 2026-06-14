import { requireAdminApi } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import {
  getUploadById,
  pruneOtherUploads,
  setActiveUpload,
} from "@/lib/db/queries/wc-intelligence";

export const runtime = "nodejs";

// Switch which upload version feeds the dashboard and the chatbot.
// Replace semantics: activation permanently deletes every other settled
// version — the new upload erases the former data.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const upload = await getUploadById(id);
  if (!upload) return new Response("Not found", { status: 404 });
  if (upload.status !== "ready") {
    return Response.json(
      { error: "NOT_READY", status: upload.status },
      { status: 409 },
    );
  }

  await setActiveUpload(id);
  const pruned = await pruneOtherUploads(id);
  revalidatePath("/dashboard/wc-intelligence");
  revalidatePath("/admin/wc-intelligence");
  return Response.json({ ok: true, activeUploadId: id, prunedVersions: pruned });
}
