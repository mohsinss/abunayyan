import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getMessagesForThread,
  getThreadForUser,
  toUIMessages,
} from "@/lib/chatbots/persistence";
import { getBotById } from "@/lib/chatbots/registry";
import { canUserAccessBot } from "@/lib/chatbots/authz";
import { ChatSurface } from "@/components/chatbots/chat-surface";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireUser();

  const thread = await getThreadForUser(threadId, user.id);
  if (!thread) notFound();

  const bot = await getBotById(thread.chatbotId);
  if (!bot) notFound();
  if (!canUserAccessBot({ role: user.role, disabled: user.disabled }, bot)) {
    notFound();
  }

  const dbMessages = await getMessagesForThread(threadId);
  // Exclude tool-role messages (they're internal). The useChat hook only
  // understands user/assistant/system.
  const initialMessages = toUIMessages(
    dbMessages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system"),
  );

  return (
    <div className="container flex max-w-4xl flex-col py-8" style={{ minHeight: "calc(100dvh - 4rem)" }}>
      <header className="mb-4">
        <div className="text-xs font-mono uppercase tracking-wide text-neutral-500">
          <Link href="/chat" className="hover:underline">
            Chats
          </Link>{" "}
          / {bot.name}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
          {thread.title ?? "Conversation"}
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          Started {new Date(thread.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="flex-1 min-h-[520px]">
        <ChatSurface
          slug={bot.slug}
          initialThreadId={thread.id}
          initialMessages={initialMessages}
          placeholder={`Continue chatting with ${bot.name}…`}
          className="h-full"
        />
      </div>
    </div>
  );
}
