import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getBuiltinByKey } from "@/lib/datasets/builtins";
import { getDatasetBySlug, getRowsForDataset } from "@/lib/db/queries/datasets";
import { CardConfigProposalSchema } from "@/lib/datasets/proposer";
import { CardRenderer } from "@/components/dashboard/generated/card-renderer";

// Accepts the editable subset of CardConfigProposal we actually persist on a
// generated card (no title/description/narrative required here — those live
// on the row).
const StoredConfigSchema = z.object({
  columns: CardConfigProposalSchema.shape.columns,
  views: CardConfigProposalSchema.shape.views,
  narrative: CardConfigProposalSchema.shape.narrative.optional(),
  chatbotSystemPrompt: CardConfigProposalSchema.shape.chatbotSystemPrompt.optional(),
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const ds = await getDatasetBySlug(slug);
  return { title: ds?.title ? `${ds.title} · Dashboard` : "Dataset · Dashboard" };
}

export default async function DatasetCardPage({ params }: Props) {
  await requireUser();
  const { slug } = await params;
  const dataset = await getDatasetBySlug(slug);
  if (!dataset) notFound();

  // Builtins have their own static pages (e.g. /dashboard/sbu-performance-atlas).
  // If someone ends up here for a builtin — Next.js prefers the static path,
  // but routing edge cases exist — redirect to the builtin's canonical route.
  if (dataset.kind === "builtin") {
    const b = getBuiltinByKey(dataset.config?.builtinKey);
    if (b && b.route !== slug) redirect(`/dashboard/${b.route}`);
  }

  const parsed = StoredConfigSchema.safeParse(dataset.config);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{dataset.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The config for this card is invalid or incomplete. An admin can re-run the proposer
          from <code>/dashboard/new</code> and re-generate.
        </p>
      </div>
    );
  }

  const rows = await getRowsForDataset(dataset.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {dataset.title}
        </h1>
        {dataset.description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{dataset.description}</p>
        ) : null}
        {parsed.data.narrative ? (
          <p className="mt-4 max-w-3xl rounded-md border border-border bg-muted/40 p-3 text-sm">
            {parsed.data.narrative}
          </p>
        ) : null}
      </header>

      {parsed.data.views.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No views configured yet.
        </div>
      ) : (
        <CardRenderer columns={parsed.data.columns} views={parsed.data.views} rows={rows} />
      )}
    </div>
  );
}
