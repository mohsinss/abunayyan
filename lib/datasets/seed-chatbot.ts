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

function defaultPrompt(title: string): string {
  return `You are the assistant for the dataset card "${title}". ` +
    `Answer questions by calling searchDatasetDocs (semantic search across this card's documents) ` +
    `and queryDatasetRows (structured aggregations across this card's tabular rows). ` +
    `Use renderChart, renderTable, and renderKpiList to visualise answers inline. ` +
    `Never invent facts — only use what the tools return. If a question can't be answered from this card, ` +
    `say so and suggest what information would be needed.`;
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
  const systemPrompt = dataset.config?.chatbotSystemPrompt || defaultPrompt(dataset.title);
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
