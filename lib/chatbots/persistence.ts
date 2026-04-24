import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Message as UIMessage } from "ai";
import { db } from "@/db";
import { threads } from "@/db/schema/threads";
import { chatbots } from "@/db/schema/chatbots";
import { messages, type Message, type MessageRole, type MessageStatus } from "@/db/schema/messages";

export async function getOrCreateThread(args: {
  userId: string;
  chatbotId: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (args.threadId) {
    const [existing] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, args.threadId), eq(threads.userId, args.userId)))
      .limit(1);
    if (existing) return existing;
  }
  const [created] = await db
    .insert(threads)
    .values({
      userId: args.userId,
      chatbotId: args.chatbotId,
      metadata: args.metadata,
    })
    .returning();
  if (!created) throw new Error("Failed to create thread");
  return created;
}

export async function appendMessage(args: {
  threadId: string;
  role: MessageRole;
  content: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  finishReason?: string;
  modelId?: string;
  promptVersion?: number;
  status?: MessageStatus;
}) {
  await db.insert(messages).values({
    threadId: args.threadId,
    role: args.role,
    content: args.content,
    toolCalls: args.toolCalls ?? null,
    toolResults: args.toolResults ?? null,
    tokensIn: args.tokensIn,
    tokensOut: args.tokensOut,
    costUsd: args.costUsd,
    finishReason: args.finishReason,
    modelId: args.modelId,
    promptVersion: args.promptVersion,
    status: args.status ?? "complete",
  });
  await db
    .update(threads)
    .set({ updatedAt: new Date() })
    .where(eq(threads.id, args.threadId));
}

export async function listThreadsForUser(userId: string, opts: { limit?: number } = {}) {
  return db
    .select()
    .from(threads)
    .where(and(eq(threads.userId, userId), isNull(threads.deletedAt)))
    .orderBy(desc(threads.updatedAt))
    .limit(opts.limit ?? 50);
}

export async function getThreadForUser(threadId: string, userId: string) {
  const [row] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getMessagesForThread(threadId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.createdAt);
}

export async function listThreadsForBot(chatbotId: string, opts: { limit?: number } = {}) {
  return db
    .select()
    .from(threads)
    .where(eq(threads.chatbotId, chatbotId))
    .orderBy(desc(threads.updatedAt))
    .limit(opts.limit ?? 50);
}

export async function softDeleteThread(threadId: string, userId: string) {
  await db
    .update(threads)
    .set({ deletedAt: new Date() })
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
}

export async function autoTitleIfNeeded(threadId: string, firstUserMessage: string) {
  const title = firstUserMessage.slice(0, 80).trim();
  if (!title) return;
  await db
    .update(threads)
    .set({ title })
    .where(and(eq(threads.id, threadId), sql`${threads.title} IS NULL`));
}

export type ThreadWithBot = {
  id: string;
  userId: string;
  chatbotId: string;
  title: string | null;
  updatedAt: Date;
  createdAt: Date;
  botSlug: string;
  botName: string;
};

export async function listThreadsWithBotForUser(
  userId: string,
  opts: { limit?: number } = {},
): Promise<ThreadWithBot[]> {
  return db
    .select({
      id: threads.id,
      userId: threads.userId,
      chatbotId: threads.chatbotId,
      title: threads.title,
      updatedAt: threads.updatedAt,
      createdAt: threads.createdAt,
      botSlug: chatbots.slug,
      botName: chatbots.name,
    })
    .from(threads)
    .innerJoin(chatbots, eq(chatbots.id, threads.chatbotId))
    .where(and(eq(threads.userId, userId), isNull(threads.deletedAt)))
    .orderBy(desc(threads.updatedAt))
    .limit(opts.limit ?? 100);
}

type StoredToolCall = { toolCallId: string; toolName: string; args: unknown };

/**
 * Convert a stored DB message into the shape the Vercel AI SDK's
 * `useChat({ initialMessages })` expects (UIMessage). Tool calls stored as
 * `CoreToolCall[]` get promoted to `ToolInvocation[]` with `state: "result"`
 * and `result` set to the args (our UI tools use pass-through execute).
 */
export function toUIMessage(m: Message): UIMessage {
  const stored = Array.isArray(m.toolCalls) ? (m.toolCalls as StoredToolCall[]) : [];
  const toolInvocations = stored
    .filter((c) => c && typeof c === "object" && "toolCallId" in c)
    .map((c) => ({
      state: "result" as const,
      toolCallId: c.toolCallId,
      toolName: c.toolName,
      args: c.args,
      result: c.args,
    }));
  const out: UIMessage = {
    id: m.id,
    role: m.role as UIMessage["role"],
    content: m.content,
    createdAt: m.createdAt,
  };
  if (toolInvocations.length) {
    out.toolInvocations = toolInvocations;
  }
  return out;
}

export function toUIMessages(ms: Message[]): UIMessage[] {
  return ms.map(toUIMessage);
}
