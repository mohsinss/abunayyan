import { auth } from "@/lib/auth";
import { getBotBySlug } from "@/lib/chatbots/registry";
import { listThreadsForUser } from "@/lib/chatbots/persistence";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });
  const bot = await getBotBySlug(slug);
  if (!bot) return new Response("Not Found", { status: 404 });
  const all = await listThreadsForUser(user.id);
  const scoped = all.filter((t) => t.chatbotId === bot.id);
  return Response.json({ threads: scoped });
}
