import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { getDatasetById, listFilesForDataset, updateDataset } from "@/lib/db/queries/datasets";
import { gatherFileSamples } from "@/lib/datasets/sample-data";
import { proposeCardConfig } from "@/lib/datasets/proposer";
import type { CardConfig } from "@/db/schema/datasets";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const dataset = await getDatasetById(id);
  if (!dataset) return new Response("Not found", { status: 404 });
  if (dataset.kind !== "generated") {
    return new Response("Propose only supported for generated datasets", { status: 400 });
  }

  const files = await listFilesForDataset(id);
  if (files.length === 0) {
    return Response.json({ error: "NO_FILES" }, { status: 400 });
  }
  const anyPending = files.some((f) => f.status === "queued" || f.status === "parsing");
  if (anyPending) {
    return Response.json({ error: "FILES_PENDING" }, { status: 409 });
  }
  const anyReady = files.some((f) => f.status === "ready");
  if (!anyReady) {
    return Response.json({ error: "ALL_FAILED" }, { status: 409 });
  }

  try {
    const samples = await gatherFileSamples(id);
    const proposal = await proposeCardConfig({
      title: dataset.title,
      description: dataset.description,
      samples,
    });

    const nextConfig: CardConfig = {
      version: 1,
      columns: proposal.columns,
      views: proposal.views,
      narrative: proposal.narrative,
      chatbotSystemPrompt: proposal.chatbotSystemPrompt,
    };

    // Don't override title/description here — the wizard's "describe" /
    // "suggest-meta" step lets the admin choose those, and we already
    // PATCHed the row before /propose was called. The proposer's title +
    // description suggestions surface in the Review form as the AI's
    // "preferred" framing if the admin wants to swap.
    await updateDataset(id, { config: nextConfig });

    await capture({
      distinctId: guard.user.id,
      event: EVENTS.dataset_proposed,
      properties: {
        datasetId: id,
        viewCount: proposal.views.length,
        columnCount: proposal.columns.length,
      },
    });

    return Response.json({ proposal });
  } catch (err) {
    captureError(err, { route: "datasets.propose", datasetId: id });
    return new Response("Proposal failed", { status: 500 });
  }
}
