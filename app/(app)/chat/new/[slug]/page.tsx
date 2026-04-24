import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getBotBySlug } from "@/lib/chatbots/registry";
import { canUserAccessBot } from "@/lib/chatbots/authz";
import { NewChatSurface } from "@/components/chatbots/new-chat-surface";

export const dynamic = "force-dynamic";

export default async function NewChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const bot = await getBotBySlug(slug);
  if (!bot) notFound();
  if (!canUserAccessBot({ role: user.role, disabled: user.disabled }, bot)) {
    notFound();
  }

  return (
    <div className="container flex max-w-4xl flex-col py-8" style={{ minHeight: "calc(100dvh - 4rem)" }}>
      <header className="mb-4">
        <div className="text-xs font-mono uppercase tracking-wide text-neutral-500">
          <Link href="/chat" className="hover:underline">
            Chats
          </Link>{" "}
          / New / {bot.name}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{bot.name}</h1>
        {bot.description && (
          <p className="mt-1 text-sm text-neutral-600">{bot.description}</p>
        )}
      </header>

      <div className="flex-1 min-h-[520px]">
        <NewChatSurface
          slug={bot.slug}
          placeholder={`Start a conversation with ${bot.name}…`}
          className="h-full"
        />
      </div>
    </div>
  );
}
