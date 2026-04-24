import { requireAdminApi } from "@/lib/auth/rbac";
import { listPromptHistory } from "@/lib/chatbots/prompts";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const prompts = await listPromptHistory(id);
  return Response.json({ prompts });
}
