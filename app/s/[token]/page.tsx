import { notFound } from "next/navigation";
import { z } from "zod";
import { getBotById } from "@/lib/chatbots/registry";
import { getDatasetByShareToken, getRowsForDataset } from "@/lib/db/queries/datasets";
import { CardConfigProposalSchema } from "@/lib/datasets/proposer";
import { CardRenderer } from "@/components/dashboard/generated/card-renderer";
import { ChatSurface } from "@/components/chatbots/chat-surface";

// Deliberately NO auth — this is the public share page. Access is gated by
// the opaque share token; getDatasetByShareToken also enforces
// share_enabled=true and not-deleted, so revoking (or soft-deleting) kills
// the link immediately.

const StoredConfigSchema = z.object({
  columns: CardConfigProposalSchema.shape.columns,
  views: CardConfigProposalSchema.shape.views,
  narrative: CardConfigProposalSchema.shape.narrative.optional(),
  chatbotSystemPrompt: CardConfigProposalSchema.shape.chatbotSystemPrompt.optional(),
});

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const ds = await getDatasetByShareToken(token);
  return { title: ds?.title ? `${ds.title} · Shared` : "Shared dataset" };
}

export default async function PublicSharePage({ params }: Props) {
  const { token } = await params;
  const dataset = await getDatasetByShareToken(token);
  if (!dataset) notFound();

  const parsed = StoredConfigSchema.safeParse(dataset.config);
  const rows = parsed.success ? await getRowsForDataset(dataset.id) : [];
  const bot = dataset.chatbotId ? await getBotById(dataset.chatbotId) : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{dataset.title}</h1>
            <p className="text-xs text-muted-foreground">Shared view · read-only</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Public link
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_360px]">
        <section>
          <header className="mb-6">
            {dataset.description ? (
              <p className="max-w-3xl text-sm text-muted-foreground">{dataset.description}</p>
            ) : null}
            {parsed.success && parsed.data.narrative ? (
              <p className="mt-4 max-w-3xl rounded-md border border-border bg-muted/40 p-3 text-sm">
                {parsed.data.narrative}
              </p>
            ) : null}
          </header>
          {parsed.success && parsed.data.views.length > 0 ? (
            <CardRenderer columns={parsed.data.columns} views={parsed.data.views} rows={rows} />
          ) : (
            <div className="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No views configured.
            </div>
          )}
        </section>

        <aside className="h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-lg border border-border bg-card lg:sticky lg:top-6">
          {bot ? (
            <ChatSurface
              slug={bot.slug}
              api={`/api/v1/public/chat/${token}`}
              placeholder={`Ask about ${dataset.title}…`}
              className="h-full"
            />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              Chat is unavailable for this card.
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
