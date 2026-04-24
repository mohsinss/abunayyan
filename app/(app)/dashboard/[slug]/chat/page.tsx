import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getBotById } from "@/lib/chatbots/registry";
import { getDatasetBySlug } from "@/lib/db/queries/datasets";
import { ChatSurface } from "@/components/chatbots/chat-surface";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const ds = await getDatasetBySlug(slug);
  return { title: ds?.title ? `Chat · ${ds.title}` : "Chat · Dashboard" };
}

export default async function DatasetChatPage({ params }: Props) {
  await requireUser();
  const { slug } = await params;
  const dataset = await getDatasetBySlug(slug);
  if (!dataset) notFound();

  const bot = dataset.chatbotId ? await getBotById(dataset.chatbotId) : null;
  if (!bot) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Chat · {dataset.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No chatbot is linked to this card yet. An admin can re-run Generate from the review
          page to seed one.
        </p>
        <div className="mt-6">
          <Button asChild variant="ghost">
            <Link href={`/dashboard/${slug}`}>← Back to card</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col px-6 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{dataset.title}</h1>
          <p className="text-xs text-muted-foreground">
            Chatbot is scoped to this card&apos;s documents and rows.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/${slug}`}>← Card</Link>
        </Button>
      </header>
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <ChatSurface
          slug={bot.slug}
          placeholder={`Ask about ${dataset.title}…`}
          className="h-full"
        />
      </div>
    </div>
  );
}
