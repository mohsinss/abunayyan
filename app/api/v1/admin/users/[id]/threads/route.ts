import { requireAdminApi } from "@/lib/auth/rbac";
import { listThreadsForUser } from "@/lib/chatbots/persistence";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const threads = await listThreadsForUser(id, { limit: 200 });
  return Response.json({ threads });
}
