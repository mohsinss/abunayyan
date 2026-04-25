import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { getDatasetById } from "@/lib/db/queries/datasets";
import { ReviewForm } from "@/components/dashboard/new/review-form";

export const metadata = { title: "Review proposal · Dashboard" };

type Props = { searchParams: Promise<{ draft?: string }> };

export default async function DashboardNewReviewPage({ searchParams }: Props) {
  const user = await requireUser();
  if (!hasRole(user.role, "admin")) redirect("/dashboard?error=forbidden");

  const { draft } = await searchParams;
  if (!draft) redirect("/dashboard/new");

  const dataset = await getDatasetById(draft);
  if (!dataset) redirect("/dashboard/new");
  if (dataset.kind !== "generated") redirect("/dashboard");
  const cfg = dataset.config;
  if (!cfg?.views || cfg.views.length === 0) {
    redirect(`/dashboard/new?draft=${draft}`);
  }

  return (
    <div className="px-6 py-10">
      <header className="mx-auto mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Review proposed card
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The model proposed this based on your files. Edit anything before generating.
        </p>
      </header>
      <ReviewForm
        datasetId={dataset.id}
        initial={{
          title: dataset.title,
          description: dataset.description ?? "",
          narrative: (cfg.narrative as string | undefined) ?? "",
          chatbotSystemPrompt: (cfg.chatbotSystemPrompt as string | undefined) ?? "",
          starterPrompts: cfg.starterPrompts ?? [],
          columns: cfg.columns as unknown[],
          views: cfg.views as unknown[],
        }}
      />
    </div>
  );
}
