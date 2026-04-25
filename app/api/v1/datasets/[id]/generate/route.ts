import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { getDatasetById, updateDataset } from "@/lib/db/queries/datasets";
import { CardConfigProposalSchema } from "@/lib/datasets/proposer";
import { seedCardChatbot } from "@/lib/datasets/seed-chatbot";
import type { CardConfig } from "@/db/schema/datasets";

export const runtime = "nodejs";

// Review page posts the (admin-edited) final config here. Same schema the
// proposer emits; we just persist it verbatim.
const BodySchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  config: z.object({
    columns: CardConfigProposalSchema.shape.columns,
    views: CardConfigProposalSchema.shape.views,
    narrative: CardConfigProposalSchema.shape.narrative.optional(),
    chatbotSystemPrompt: CardConfigProposalSchema.shape.chatbotSystemPrompt.optional(),
    starterPrompts: CardConfigProposalSchema.shape.starterPrompts.optional(),
  }),
});

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
    return new Response("Generate only supported for generated datasets", { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION_FAILED", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const nextConfig: CardConfig = {
    version: 1,
    columns: parsed.data.config.columns,
    views: parsed.data.config.views,
    narrative: parsed.data.config.narrative,
    chatbotSystemPrompt: parsed.data.config.chatbotSystemPrompt,
    starterPrompts: parsed.data.config.starterPrompts,
  };

  try {
    const updated = await updateDataset(id, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      config: nextConfig,
    });
    if (!updated) return new Response("Not found", { status: 404 });

    // Seed/refresh the per-card chatbot. Failure here isn't fatal for the
    // admin's save — we log and still return success so the card lands in
    // the gallery; an admin can re-run /generate to retry bot seeding.
    try {
      await seedCardChatbot(updated.id);
    } catch (err) {
      captureError(err, { route: "datasets.generate.seedChatbot", datasetId: id });
    }

    await capture({
      distinctId: guard.user.id,
      event: EVENTS.dataset_generated,
      properties: {
        datasetId: id,
        slug: updated.slug,
        viewCount: parsed.data.config.views.length,
      },
    });

    return Response.json({ id: updated.id, slug: updated.slug });
  } catch (err) {
    captureError(err, { route: "datasets.generate", datasetId: id });
    return new Response("Generate failed", { status: 500 });
  }
}
