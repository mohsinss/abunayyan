import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getDatasetBySlug } from "@/lib/db/queries/datasets";
import { ReviewForm } from "@/components/dashboard/new/review-form";
import { DeleteCardButton } from "@/components/dashboard/delete-card-button";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ slug: string }> };

export const metadata = { title: "Edit card · Dashboard" };

export default async function DashboardEditCardPage({ params }: Props) {
  const user = await requireUser();
  if (!hasRole(user.role, "admin")) redirect("/dashboard?error=forbidden");

  const { slug } = await params;
  const dataset = await getDatasetBySlug(slug);
  if (!dataset) notFound();
  if (dataset.kind === "builtin") {
    // Builtins are code-owned; no edit UI. Redirect to the card view.
    redirect(`/dashboard/${slug}`);
  }

  const cfg = dataset.config;
  if (!cfg?.views || cfg.views.length === 0) {
    // Card was never proposed — send admin through the wizard review instead.
    redirect(`/dashboard/new?draft=${dataset.id}`);
  }

  return (
    <div className="px-6 py-10">
      <header className="mx-auto mb-6 flex max-w-3xl flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Edit “{dataset.title}”
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Changes save in place. Saving bumps the chatbot&apos;s system prompt version.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/dashboard/${slug}`}>← Card</Link>
          </Button>
          <DeleteCardButton datasetId={dataset.id} datasetTitle={dataset.title} />
        </div>
      </header>
      <ReviewForm
        datasetId={dataset.id}
        initial={{
          title: dataset.title,
          description: dataset.description ?? "",
          narrative: (cfg.narrative as string | undefined) ?? "",
          chatbotSystemPrompt: (cfg.chatbotSystemPrompt as string | undefined) ?? "",
          columns: cfg.columns as unknown[],
          views: cfg.views as unknown[],
        }}
      />
    </div>
  );
}
