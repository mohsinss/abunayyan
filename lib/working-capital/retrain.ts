import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  chatbots,
  chatbotPrompts,
  datasets,
  documents,
  type CardConfig,
} from "@/db";
import { backfillDatasetEmbeddings } from "@/lib/datasets/embed-backfill";
import { getPlatformSettings } from "@/lib/chatbots/settings";
import { WORKING_CAPITAL_CHUNKS } from "./knowledge";

const DATASET_SLUG = "working-capital-ccc";
const BOT_SLUG = "working-capital-analyst";
const BOT_NAME = "Working Capital Analyst";

const SYSTEM_PROMPT = `You are Working Capital Analyst, the cash-cycle co-pilot for Abunayyan Holding's FY-2025 Working Capital & CCC interactive brief.

Tool you MUST use:
- searchDatasetDocs — retrieve passages from the FY-2025 working capital brief BEFORE answering. Run it on EVERY question that touches numbers, SBU performance, DSO/DIO/DPO/CCC, or any specific claim. If the retrieved passages don't cover the question, say so plainly.

Optional rendering tools:
- renderChart (bar | horizontal-bar | pie | scatter) — when comparing SBUs or showing trend.
- renderTable — for ≤8 columns × ≤20 rows side-by-side comparisons.
- renderKpiList — for a single-SBU snapshot.

Output rhythm — every reply:
1. One short paragraph (max ~60 words) framing the answer.
2. Tool call(s) for visuals when numbers are involved.
3. One-line closer with the takeaway.

Hard rules:
- NEVER fabricate numbers. Every figure must come from a searchDatasetDocs result. Quote sparingly; prefer paraphrase.
- Keep chart labels under 22 characters; units short (SAR, %, M, days).
- Tone: concise analyst, no marketing fluff, no emoji.`;

const BOT_TOOLS = [
  "searchDatasetDocs",
  "renderChart",
  "renderTable",
  "renderKpiList",
] as const;

// Each chunk gets a stable content hash; we store it as a sentinel prefix
// in `content` so the existing schema (no extra column) can carry it. The
// embedding query reads `content` raw, so the prefix is a few extra
// embedding tokens — acceptable for ~30 chunks.
const HASH_PREFIX = "[wc-chunk:";
const HASH_PATTERN = /^\[wc-chunk:([a-z0-9.-]+):([a-f0-9]{12})\]\n/;

function chunkHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function withSentinel(id: string, body: string): string {
  return `${HASH_PREFIX}${id}:${chunkHash(body)}]\n${body}`;
}

function parseSentinel(content: string): { id: string; hash: string } | null {
  const m = content.match(HASH_PATTERN);
  if (!m) return null;
  return { id: m[1] ?? "", hash: m[2] ?? "" };
}

export type RetrainResult = {
  datasetId: string;
  botId: string;
  inserted: number;
  deleted: number;
  unchanged: number;
  embedded: number;
};

export async function retrainWorkingCapitalKnowledge(
  actorUserId: string,
): Promise<RetrainResult> {
  const settings = await getPlatformSettings();

  const bot = await ensureBot(actorUserId, settings);
  const dataset = await ensureDataset(actorUserId, bot.id);

  // Existing chunks for this dataset.
  const existing = await db
    .select({ id: documents.id, content: documents.content })
    .from(documents)
    .where(eq(documents.datasetId, dataset.id));

  const existingByChunkId = new Map<string, { docId: string; hash: string }>();
  const orphanDocIds: string[] = [];
  for (const row of existing) {
    const sentinel = parseSentinel(row.content);
    if (!sentinel) {
      orphanDocIds.push(row.id);
      continue;
    }
    existingByChunkId.set(sentinel.id, { docId: row.id, hash: sentinel.hash });
  }

  // Compute inserts (new or changed) and deletes (chunk no longer present
  // OR present but with a different hash, i.e. content edited).
  const toDeleteDocIds: string[] = [...orphanDocIds];
  const toInsertContents: string[] = [];
  let unchanged = 0;

  const desiredIds = new Set<string>();
  for (const chunk of WORKING_CAPITAL_CHUNKS) {
    desiredIds.add(chunk.id);
    const hash = chunkHash(chunk.content);
    const prior = existingByChunkId.get(chunk.id);
    if (prior && prior.hash === hash) {
      unchanged++;
      continue;
    }
    if (prior) toDeleteDocIds.push(prior.docId);
    toInsertContents.push(withSentinel(chunk.id, chunk.content));
  }

  // Drop chunks that were removed from the source file entirely.
  for (const [id, prior] of existingByChunkId) {
    if (!desiredIds.has(id)) toDeleteDocIds.push(prior.docId);
  }

  if (toDeleteDocIds.length) {
    await db.delete(documents).where(inArray(documents.id, toDeleteDocIds));
  }

  if (toInsertContents.length) {
    await db.insert(documents).values(
      toInsertContents.map((content) => ({
        userId: actorUserId,
        datasetId: dataset.id,
        content,
      })),
    );
  }

  // Embed any chunk that's still missing a vector (handles partial prior runs
  // as well as the rows we just inserted).
  const embedded = await backfillDatasetEmbeddings(dataset.id);

  // Touch updatedAt so the admin page can show "last retrained" cheaply.
  await db
    .update(datasets)
    .set({ updatedAt: new Date() })
    .where(eq(datasets.id, dataset.id));

  return {
    datasetId: dataset.id,
    botId: bot.id,
    inserted: toInsertContents.length,
    deleted: toDeleteDocIds.length,
    unchanged,
    embedded,
  };
}

async function ensureBot(
  actorUserId: string,
  settings: Awaited<ReturnType<typeof getPlatformSettings>>,
) {
  const [existing] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.slug, BOT_SLUG), isNull(chatbots.deletedAt)))
    .limit(1);

  if (existing) {
    // Keep the prompt and tool list authoritative; admins can still override
    // model/rate-limit/cap via the standard admin chatbot UI.
    if (
      existing.systemPrompt !== SYSTEM_PROMPT ||
      !sameStringArray(existing.tools as string[], [...BOT_TOOLS])
    ) {
      const nextVersion = existing.systemPromptVersion + 1;
      await db
        .update(chatbots)
        .set({
          systemPrompt: SYSTEM_PROMPT,
          systemPromptVersion: nextVersion,
          tools: [...BOT_TOOLS],
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, existing.id));
      await db.insert(chatbotPrompts).values({
        chatbotId: existing.id,
        version: nextVersion,
        systemPrompt: SYSTEM_PROMPT,
        note: "working-capital-retrain",
        createdBy: actorUserId,
      });
    }
    return existing;
  }

  const [created] = await db
    .insert(chatbots)
    .values({
      slug: BOT_SLUG,
      name: BOT_NAME,
      description:
        "RAG co-pilot for the FY-2025 Working Capital & CCC interactive brief.",
      provider: settings.fallbackProvider ?? "anthropic",
      modelId: settings.defaultChatbotModelId ?? "claude-sonnet-4-6",
      temperature: settings.defaultChatbotTemperature,
      maxSteps: 4,
      systemPrompt: SYSTEM_PROMPT,
      systemPromptVersion: 1,
      tools: [...BOT_TOOLS],
      allowedRoles: [],
      rateLimitTokens: settings.defaultRateLimitTokens,
      rateLimitWindow: settings.defaultRateLimitWindow,
      dailyCostCapUsd: settings.defaultDailyCostCapUsd,
      enabled: true,
      createdBy: actorUserId,
    })
    .returning();
  if (!created) throw new Error("Failed to create working-capital-analyst bot");

  await db.insert(chatbotPrompts).values({
    chatbotId: created.id,
    version: 1,
    systemPrompt: SYSTEM_PROMPT,
    note: "working-capital-seeded",
    createdBy: actorUserId,
  });

  return created;
}

async function ensureDataset(actorUserId: string, botId: string) {
  const [existing] = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.slug, DATASET_SLUG), isNull(datasets.deletedAt)))
    .limit(1);

  const config: CardConfig = { version: 1, builtinKey: "working-capital-ccc" };

  if (existing) {
    if (existing.chatbotId !== botId) {
      await db
        .update(datasets)
        .set({ chatbotId: botId, config, updatedAt: new Date() })
        .where(eq(datasets.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(datasets)
    .values({
      slug: DATASET_SLUG,
      title: "Working Capital & CCC FY-2025 Brief",
      description:
        "Curated narrative + per-SBU figures backing the Working Capital Analyst RAG bot.",
      kind: "builtin",
      config,
      chatbotId: botId,
      createdBy: actorUserId,
    })
    .returning();
  if (!created) throw new Error("Failed to create working-capital-ccc dataset");
  return created;
}

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export type WorkingCapitalKbStatus = {
  datasetId: string | null;
  botId: string | null;
  totalChunks: number;
  embeddedChunks: number;
  pendingChunks: number;
  lastRetrainedAt: Date | null;
};

export async function getWorkingCapitalKbStatus(): Promise<WorkingCapitalKbStatus> {
  const [ds] = await db
    .select({ id: datasets.id, chatbotId: datasets.chatbotId, updatedAt: datasets.updatedAt })
    .from(datasets)
    .where(and(eq(datasets.slug, DATASET_SLUG), isNull(datasets.deletedAt)))
    .limit(1);
  if (!ds) {
    return {
      datasetId: null,
      botId: null,
      totalChunks: 0,
      embeddedChunks: 0,
      pendingChunks: 0,
      lastRetrainedAt: null,
    };
  }
  const [{ total = 0, embedded = 0 } = {}] = await db
    .select({
      total: sql<number>`count(*)::int`,
      embedded: sql<number>`count(${documents.embedding})::int`,
    })
    .from(documents)
    .where(eq(documents.datasetId, ds.id));
  return {
    datasetId: ds.id,
    botId: ds.chatbotId,
    totalChunks: Number(total),
    embeddedChunks: Number(embedded),
    pendingChunks: Math.max(0, Number(total) - Number(embedded)),
    lastRetrainedAt: ds.updatedAt,
  };
}
