import { requireAdminApi } from "@/lib/auth/rbac";
import { getMessagesForThread } from "@/lib/chatbots/persistence";
import { db } from "@/db";
import { threads } from "@/db/schema/threads";
import { and, eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id, threadId } = await params;

  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, id)))
    .limit(1);
  if (!thread) return new Response("Not Found", { status: 404 });

  const msgs = await getMessagesForThread(threadId);
  return Response.json({ thread, messages: msgs });
}
