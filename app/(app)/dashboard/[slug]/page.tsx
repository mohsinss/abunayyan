import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { getBotById } from "@/lib/chatbots/registry";
import { getBuiltinByKey } from "@/lib/datasets/builtins";
import { getDatasetBySlug, getRowsForDataset } from "@/lib/db/queries/datasets";
import { CardConfigProposalSchema } from "@/lib/datasets/proposer";
import { CardRenderer } from "@/components/dashboard/generated/card-renderer";
import { AtlasHeader } from "@/components/dashboard/generated/atlas-header";
import { AtlasSidebar, type AtlasSidebarItem } from "@/components/dashboard/generated/atlas-sidebar";
import { AtlasCardChat } from "@/components/dashboard/generated/atlas-card-chat";
import { ShareCardButton } from "@/components/dashboard/share-card-button";
import { Button } from "@/components/ui/button";

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

function kindLabel(kind: "kpi" | "bar" | "line" | "pie" | "table"): string {
  switch (kind) {
    case "bar":
      return "Bar chart";
    case "line":
      return "Line chart";
    case "pie":
      return "Composition";
    case "table":
      return "Tabular";
    case "kpi":
      return "KPI";
  }
}

export default async function DatasetCardPage({ params }: Props) {
  const user = await requireUser();
  const isAdmin = hasRole(user.role, "admin");
  const { slug } = await params;
  const dataset = await getDatasetBySlug(slug);
  if (!dataset) notFound();

  // Builtins keep their hand-coded pages. Defence in depth — Next.js
  // normally picks the static path first.
  if (dataset.kind === "builtin") {
    const b = getBuiltinByKey(dataset.config?.builtinKey);
    if (b && b.route !== slug) redirect(`/dashboard/${b.route}`);
  }

  const parsed = StoredConfigSchema.safeParse(dataset.config);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-serif text-[32px] font-medium text-atlas-ink">{dataset.title}</h1>
        <p className="mt-4 font-sans text-sm text-atlas-ink-2">
          The config for this card is invalid or incomplete. An admin can re-run the proposer
          from{" "}
          <code className="rounded-sm bg-atlas-bg-3 px-1 font-mono text-[12px]">/dashboard/new</code>{" "}
          and re-generate.
        </p>
      </div>
    );
  }

  const rows = await getRowsForDataset(dataset.id);
  const bot = dataset.chatbotId ? await getBotById(dataset.chatbotId) : null;

  // Sidebar items mirror the renderer's section numbering. KPI views are
  // grouped into the top strip and don't get their own anchor.
  const sidebarItems: AtlasSidebarItem[] = parsed.data.views
    .filter((v) => v.kind !== "kpi")
    .map((v, i) => ({
      id: `view-${v.id}`,
      num: String(i + 1).padStart(2, "0"),
      title: v.title,
      desc: kindLabel(v.kind),
    }));

  const createdLabel = new Date(dataset.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex">
      <AtlasSidebar
        items={sidebarItems}
        title={dataset.title}
        eyebrow="Generated · Dataset card"
        meta={createdLabel}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1520px] overflow-x-hidden px-8 py-10 lg:px-12">
          <AtlasHeader
            title={dataset.title}
            description={parsed.data.narrative ?? dataset.description}
            eyebrow="Generated · Dataset card"
            meta={`Updated ${createdLabel}`}
          />

          {isAdmin && dataset.kind === "generated" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ShareCardButton
                datasetId={dataset.id}
                initial={{ enabled: dataset.shareEnabled, token: dataset.shareToken }}
              />
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/${slug}/edit`}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Manage
                </Link>
              </Button>
            </div>
          ) : null}

          {parsed.data.views.length === 0 ? (
            <div className="mt-14 rounded-sm border border-dashed border-atlas-line bg-atlas-bg-2 p-12 text-center font-mono text-[11px] uppercase tracking-[1.2px] text-atlas-ink-3">
              No views configured yet.
            </div>
          ) : (
            <CardRenderer columns={parsed.data.columns} views={parsed.data.views} rows={rows} />
          )}
        </div>
      </main>
      {bot ? <AtlasCardChat botSlug={bot.slug} datasetTitle={dataset.title} /> : null}
    </div>
  );
}
