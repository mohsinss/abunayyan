import { auth } from "@/lib/auth";
import {
  getMessagesForThread,
  getThreadForUser,
  softDeleteThread,
} from "@/lib/chatbots/persistence";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; threadId: string }> },
) {
  const { threadId } = await params;
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });

  const thread = await getThreadForUser(threadId, user.id);
  if (!thread) return new Response("Not Found", { status: 404 });

  const msgs = await getMessagesForThread(threadId);
  return Response.json({ thread, messages: msgs });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; threadId: string }> },
) {
  const { threadId } = await params;
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });
  await softDeleteThread(threadId, user.id);
  return new Response(null, { status: 204 });
}
