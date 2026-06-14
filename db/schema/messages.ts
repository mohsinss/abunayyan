import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { threads } from "./threads";

export const MESSAGE_ROLES = ["user", "assistant", "system", "tool"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const MESSAGE_STATUSES = ["complete", "errored", "truncated"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16, enum: MESSAGE_ROLES }).notNull(),
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls").$type<unknown[]>(),
    toolResults: jsonb("tool_results").$type<unknown[]>(),
    // Ordered UI message parts (text / tool-invocation, in emission order) so
    // restored history interleaves commentary and charts exactly as streamed.
    // Null for older rows + the user's own turns; rendering falls back to
    // content + toolCalls when absent.
    parts: jsonb("parts").$type<unknown[]>(),
    status: varchar("status", { length: 16, enum: MESSAGE_STATUSES })
      .default("complete")
      .notNull(),
    finishReason: varchar("finish_reason", { length: 32 }),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: real("cost_usd"),
    modelId: varchar("model_id", { length: 64 }),
    promptVersion: integer("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    threadIdx: index("messages_thread_idx").on(t.threadId, t.createdAt),
    createdAtIdx: index("messages_created_at_idx").on(t.createdAt),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
