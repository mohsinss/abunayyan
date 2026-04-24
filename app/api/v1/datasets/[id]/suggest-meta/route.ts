import { z } from "zod";
import { generateObject } from "ai";
import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { models } from "@/lib/ai/client";
import { getDatasetById, listFilesForDataset } from "@/lib/db/queries/datasets";
import { gatherFileSamples } from "@/lib/datasets/sample-data";

export const runtime = "nodejs";
export const maxDuration = 60;

const SuggestSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
});

const SYSTEM_PROMPT = `You name and summarise newly uploaded datasets so admins don't have to.

Rules:
- title: 3–7 words, Title Case, no quotes, no trailing punctuation. Concrete.
- description: 1–2 sentences, plain English. Mention the most useful framing for someone who hasn't seen the files.
- Ground every choice in the file metadata you're shown. If the data is sparse, say "Dataset of <kind>" rather than inventing context.`;

// Lightweight metadata pass — only proposes title + description from the
// uploaded files. The full proposer (columns + views + chatbot prompt) runs
// later in /propose. Returns the suggestion without persisting; the wizard
// PATCHes whatever the admin lands on.
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
    return new Response("Only generated datasets support suggest-meta", { status: 400 });
  }

  const files = await listFilesForDataset(id);
  if (files.length === 0) {
    return Response.json({ error: "NO_FILES" }, { status: 400 });
  }
  if (files.some((f) => f.status === "queued" || f.status === "parsing")) {
    return Response.json({ error: "FILES_PENDING" }, { status: 409 });
  }
  if (!files.some((f) => f.status === "ready")) {
    return Response.json({ error: "ALL_FAILED" }, { status: 409 });
  }

  try {
    const samples = await gatherFileSamples(id);
    const userPrompt = buildPrompt(samples);
    const { object } = await generateObject({
      model: models.cheap,
      schema: SuggestSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });
    return Response.json(object);
  } catch (err) {
    captureError(err, { route: "datasets.suggest-meta", datasetId: id });
    return new Response("Suggest failed", { status: 500 });
  }
}

function buildPrompt(samples: Awaited<ReturnType<typeof gatherFileSamples>>): string {
  const lines: string[] = ["Files:"];
  for (const f of samples) {
    lines.push(`- ${f.filename} (${f.kind}, ${f.mimeType})`);
    if (f.kind === "tabular" && f.sheets) {
      for (const sheet of f.sheets) {
        lines.push(
          `  · Sheet "${sheet.sheet || "(default)"}" — ${sheet.rowCount} rows, columns: ${sheet.columns.join(", ") || "(none)"}`,
        );
      }
    } else if (f.kind === "text" && f.textSample) {
      lines.push(`  · Text preview: ${f.textSample.slice(0, 600)}`);
    }
  }
  lines.push("\nPropose a title and a 1–2 sentence description.");
  return lines.join("\n");
}
