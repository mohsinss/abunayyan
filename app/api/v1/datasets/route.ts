import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { insertDataset, slugExists } from "@/lib/db/queries/datasets";
import { checkCanCreateDataset } from "@/lib/datasets/limits";
import { uniqueSlug } from "@/lib/datasets/slug";

export const runtime = "nodejs";

const CreateSchema = z.object({
  // Title is optional now — the wizard creates a draft on first file drop and
  // the AI fills in the title via /suggest-meta after parsing. Server defaults
  // to "Untitled dataset" so the slug + row constraints stay satisfied.
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
});

function defaultDraftTitle() {
  return `Untitled dataset ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
}

export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const cap = await checkCanCreateDataset();
  if (!cap.ok) {
    return Response.json(
      { error: cap.code, max: cap.max, current: cap.current },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION_FAILED", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const title = parsed.data.title ?? defaultDraftTitle();
  const slug = await uniqueSlug(title, slugExists);

  try {
    const row = await insertDataset({
      slug,
      title,
      description: parsed.data.description ?? null,
      kind: "generated",
      config: { version: 1, columns: [], views: [] },
      createdBy: guard.user.id,
    });
    await capture({
      distinctId: guard.user.id,
      event: EVENTS.dataset_created,
      properties: { datasetId: row.id, slug: row.slug },
    });
    return Response.json({ id: row.id, slug: row.slug, kind: row.kind }, { status: 201 });
  } catch (err) {
    captureError(err, { route: "datasets.create" });
    return new Response("Create failed", { status: 500 });
  }
}
