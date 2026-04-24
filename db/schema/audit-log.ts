import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { chatbots } from "./chatbots";
import { threads } from "./threads";

export const AUDIT_EVENTS = [
  "user.created",
  "user.role_changed",
  "user.disabled_changed",
  "user.deleted",
  "user.disabled_access_attempt",

  "bot.created",
  "bot.updated",
  "bot.deleted",
  "bot.prompt_updated",
  "bot.turn_completed",
  "bot.turn_errored",
  "bot.access_denied",
  "bot.rate_limited",
  "bot.budget_exceeded",

  "settings.updated",
  "settings.kill_switch_toggled",

  "persistence_failed",
] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    botId: uuid("bot_id").references(() => chatbots.id, { onDelete: "set null" }),
    threadId: uuid("thread_id").references(() => threads.id, { onDelete: "set null" }),
    event: varchar("event", { length: 64, enum: AUDIT_EVENTS }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createdIdx: index("audit_log_created_idx").on(t.createdAt),
    actorIdx: index("audit_log_actor_idx").on(t.actorId, t.createdAt),
    botIdx: index("audit_log_bot_idx").on(t.botId, t.createdAt),
    eventIdx: index("audit_log_event_idx").on(t.event, t.createdAt),
  }),
);

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
