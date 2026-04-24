import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { chatbots } from "./chatbots";

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbots.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("threads_user_idx").on(t.userId, t.updatedAt),
    botIdx: index("threads_bot_idx").on(t.chatbotId),
    activeUserIdx: index("threads_active_user_idx")
      .on(t.userId, t.updatedAt)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
