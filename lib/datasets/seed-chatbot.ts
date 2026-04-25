import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chatbots, chatbotPrompts, type ToolId } from "@/db/schema/chatbots";
import { getPlatformSettings } from "@/lib/chatbots/settings";
import { getDatasetById, updateDataset } from "@/lib/db/queries/datasets";

const DATASET_TOOLS: ToolId[] = [
  "searchDatasetDocs",
  "queryDatasetRows",
  "renderChart",
  "renderTable",
  "renderKpiList",
];

function slugForDataset(datasetSlug: string): string {
  // chatbots.slug is varchar(64); cap so we stay within the limit.
  return `dataset-${datasetSlug}`.slice(0, 64);
}

// Atlas-style fallback prompt. Mirrors the contract used by atlas-analyst
// (see lib/chatbots/seed-defaults.ts) so dataset cards behave the same way:
// always reach for tools, render charts/tables inline, never fabricate.
// Used when the AI proposer didn't produce a chatbotSystemPrompt; in
// practice the proposer almost always emits one and this is the safety net.
function defaultPrompt(title: string, columnLabels: string[]): string {
  const columnLine = columnLabels.length
    ? `Available columns: ${columnLabels.slice(0, 16).join(", ")}.`
    : "This card has no tabular columns yet — only documents.";
  return `You are the assistant for the dataset card "${title}".

Tools you MUST use:
- queryDatasetRows — structured aggregation over this card's tabular rows
  (kpi / groupBy / pie / table). Use it for any "how many", "compare", "top
  N", "sum / average / count" question, and use \`kind="table"\` if the user
  asks to see specific rows.
- searchDatasetDocs — semantic search over this card's uploaded documents
  (.docx, .pptx). Use it for "what does X say", "find the section about Y".
- renderChart — emit \`bar\`, \`horizontal-bar\`, \`pie\`, or \`scatter\` so the
  answer renders inline. Always call this when you've fetched aggregated
  numbers; words alone are not enough.
- renderTable — for side-by-side comparisons of ≤8 columns × ≤20 rows.
- renderKpiList — for single-entity snapshots (one entity, multiple stats).

${columnLine}

Output rhythm — every reply:
1. One short paragraph of plain text (max ~60 words) framing the finding.
2. The tool calls (renderChart / renderTable / renderKpiList).
3. A one-line closer with the takeaway.

Hard rules:
- NEVER fabricate numbers. Only emit values returned by queryDatasetRows
  or quoted from searchDatasetDocs results.
- Keep chart labels under 22 characters and units short (USD, %, M, K).
- If a question can't be answered from this card, say so plainly and
  suggest what data would be needed.
- Tone: concise, analyst, no marketing fluff. No emoji.`;
}

/**
 * Creates (or updates) the chatbot row that backs a generated dataset card,
 * and links it via `datasets.chatbot_id`. Idempotent on rerun — safe to call
 * from /generate on every save. Reads platform defaults from
 * `platform_settings` for provider / model / temperature / rate limit /
 * cost cap so admins can tweak defaults without touching the per-bot row.
 */
export async function seedCardChatbot(datasetId: string): Promise<string> {
  const dataset = await getDatasetById(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);
  if (dataset.kind !== "generated") {
    throw new Error("Chatbot seeding only applies to generated datasets");
  }

  const settings = await getPlatformSettings();
  const slug = slugForDataset(dataset.slug);
  const columnLabels = (
    (dataset.config?.columns as Array<{ label?: string }> | undefined) ?? []
  )
    .map((c) => c?.label)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  const systemPrompt =
    dataset.config?.chatbotSystemPrompt ||
    defaultPrompt(dataset.title, columnLabels);
  const name = `${dataset.title} Assistant`.slice(0, 120);

  const [existing] = await db
    .select({ id: chatbots.id, systemPromptVersion: chatbots.systemPromptVersion })
    .from(chatbots)
    .where(and(eq(chatbots.slug, slug), isNull(chatbots.deletedAt)))
    .limit(1);

  if (existing) {
    await db
      .update(chatbots)
      .set({
        name,
        systemPrompt,
        systemPromptVersion: existing.systemPromptVersion + 1,
        tools: DATASET_TOOLS,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, existing.id));

    await db.insert(chatbotPrompts).values({
      chatbotId: existing.id,
      version: existing.systemPromptVersion + 1,
      systemPrompt,
      note: "card-regenerated",
    });

    if (dataset.chatbotId !== existing.id) {
      await updateDataset(datasetId, { chatbotId: existing.id });
    }
    return existing.id;
  }

  const [bot] = await db
    .insert(chatbots)
    .values({
      slug,
      name,
      description: `Per-card chatbot for ${dataset.title}`,
      provider: settings.fallbackProvider ?? "anthropic",
      modelId: settings.defaultChatbotModelId ?? "claude-sonnet-4-6",
      temperature: settings.defaultChatbotTemperature,
      systemPrompt,
      systemPromptVersion: 1,
      tools: DATASET_TOOLS,
      allowedRoles: [],
      rateLimitTokens: settings.defaultRateLimitTokens,
      rateLimitWindow: settings.defaultRateLimitWindow,
      dailyCostCapUsd: settings.defaultDailyCostCapUsd,
      enabled: true,
    })
    .returning();
  if (!bot) throw new Error("Failed to seed card chatbot");

  await db.insert(chatbotPrompts).values({
    chatbotId: bot.id,
    version: 1,
    systemPrompt,
    note: "card-seeded",
  });

  await updateDataset(datasetId, { chatbotId: bot.id });
  return bot.id;
}
