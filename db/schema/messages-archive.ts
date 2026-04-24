import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Cold storage for messages whose parent thread hasn't been touched in a
// long time (see lib/chatbots/archival.ts). Intentionally carries NO
// indexes beyond the PK + no FKs — the parent thread may be hard-deleted
// later by the retention job; we preserve enough columns to replay a
// conversation without live joins.
//
// Same primary-key id as the original row: re-archiving is a no-op.
export const messagesArchive = pgTable("messages_archive", {
  id: uuid("id").primaryKey(),
  threadId: uuid("thread_id").notNull(),
  userId: text("user_id"),
  chatbotId: uuid("chatbot_id"),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").$type<unknown[]>(),
  toolResults: jsonb("tool_results").$type<unknown[]>(),
  status: varchar("status", { length: 16 }),
  finishReason: varchar("finish_reason", { length: 32 }),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costUsd: real("cost_usd"),
  modelId: varchar("model_id", { length: 64 }),
  promptVersion: integer("prompt_version"),
  originalCreatedAt: timestamp("original_created_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MessageArchive = typeof messagesArchive.$inferSelect;
export type NewMessageArchive = typeof messagesArchive.$inferInsert;
