import "server-only";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/messages";
import { messagesArchive } from "@/db/schema/messages-archive";
import { threads } from "@/db/schema/threads";

const DEFAULT_ARCHIVE_AFTER_DAYS = 180;
const DEFAULT_PRUNE_AFTER_DAYS = 90;
const DEFAULT_BATCH_SIZE = 500;

/**
 * Archive messages whose parent thread hasn't been touched in
 * `olderThanDays` days. Copies rows into `messages_archive`, then deletes
 * the originals. Idempotent: re-inserts are no-ops on the PK (same id)
 * and the delete is scoped to the ids we just successfully archived.
 *
 * Batched (`batchSize` default 500) so we don't OOM on a long backlog —
 * the caller can invoke this multiple times in a cron window to drain
 * the queue. Returns 0 when no work remains.
 */
export async function archiveOldMessages(opts: {
  olderThanDays?: number;
  batchSize?: number;
} = {}): Promise<{ archived: number }> {
  const cutoff = new Date(
    Date.now() - (opts.olderThanDays ?? DEFAULT_ARCHIVE_AFTER_DAYS) * 24 * 60 * 60 * 1000,
  );
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  const rows = await db
    .select({
      m: messages,
      userId: threads.userId,
      chatbotId: threads.chatbotId,
    })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(lt(threads.updatedAt, cutoff))
    .limit(batchSize);

  if (rows.length === 0) return { archived: 0 };

  await db
    .insert(messagesArchive)
    .values(
      rows.map((r) => ({
        id: r.m.id,
        threadId: r.m.threadId,
        userId: r.userId,
        chatbotId: r.chatbotId,
        role: r.m.role,
        content: r.m.content,
        toolCalls: r.m.toolCalls,
        toolResults: r.m.toolResults,
        status: r.m.status,
        finishReason: r.m.finishReason,
        tokensIn: r.m.tokensIn,
        tokensOut: r.m.tokensOut,
        costUsd: r.m.costUsd,
        modelId: r.m.modelId,
        promptVersion: r.m.promptVersion,
        originalCreatedAt: r.m.createdAt,
      })),
    )
    .onConflictDoNothing();

  const ids = rows.map((r) => r.m.id);
  await db.delete(messages).where(inArray(messages.id, ids));

  return { archived: rows.length };
}

/**
 * Hard-delete threads that were soft-deleted more than `olderThanDays`
 * days ago. Cascades to messages via the schema's `onDelete: "cascade"`
 * on threads → messages, so the DB takes care of cleanup.
 *
 * Archived-to-messages_archive rows keep threadId but have no FK, so
 * they're unaffected.
 */
export async function pruneSoftDeletedThreads(opts: {
  olderThanDays?: number;
} = {}): Promise<{ pruned: number }> {
  const cutoff = new Date(
    Date.now() - (opts.olderThanDays ?? DEFAULT_PRUNE_AFTER_DAYS) * 24 * 60 * 60 * 1000,
  );
  const deleted = await db
    .delete(threads)
    .where(and(isNotNull(threads.deletedAt), lt(threads.deletedAt, cutoff)))
    .returning({ id: threads.id });
  return { pruned: deleted.length };
}

/**
 * Orchestrator used by the QStash cron + the manual admin trigger.
 * Drains up to `maxBatches` archive batches (so one cron firing
 * catches up on any accumulated backlog), then prunes soft-deleted
 * threads. Returns counts for audit payload + admin UI feedback.
 */
export async function runArchivalSweep(opts: {
  archiveAfterDays?: number;
  pruneAfterDays?: number;
  batchSize?: number;
  maxBatches?: number;
} = {}): Promise<{ archivedTotal: number; pruned: number; batches: number }> {
  const maxBatches = opts.maxBatches ?? 5;
  let archivedTotal = 0;
  let batches = 0;
  for (let i = 0; i < maxBatches; i++) {
    const { archived } = await archiveOldMessages({
      olderThanDays: opts.archiveAfterDays,
      batchSize: opts.batchSize,
    });
    batches++;
    archivedTotal += archived;
    if (archived === 0) break;
  }
  const { pruned } = await pruneSoftDeletedThreads({
    olderThanDays: opts.pruneAfterDays,
  });
  return { archivedTotal, pruned, batches };
}
