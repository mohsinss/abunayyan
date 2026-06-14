import { requireAdminApi } from "@/lib/auth/rbac";
import { revalidatePath, revalidateTag } from "next/cache";
import { getUploadById, setActiveUpload } from "@/lib/db/queries/wc-intelligence";
import { WCX_DASHBOARD_CACHE_TAG } from "@/lib/wcx/dashboard-data";

export const runtime = "nodejs";

// Switch which upload version feeds the dashboard and the chatbot.
// Rollback semantics: activation only flips the active flag — every other
// settled version (and its facts/targets) is RETAINED, so a board brief is
// reproducible "as of" any prior upload and admins can roll back. Old
// versions stay listed in /admin/wc-intelligence; the dashboard + chat read
// only the active one (getActiveUpload filters isActive = true).
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
  // Drop the cached dashboard payload so the newly-active version's numbers
  // show immediately rather than after the 1h revalidate window.
  revalidateTag(WCX_DASHBOARD_CACHE_TAG);
  revalidatePath("/dashboard/wc-intelligence");
  revalidatePath("/admin/wc-intelligence");
  return Response.json({ ok: true, activeUploadId: id });
}
