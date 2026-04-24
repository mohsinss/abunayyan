import { boolean, check, integer, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { AI_PROVIDERS } from "./chatbots";

export const SIGNUP_POLICIES = ["open", "invite_only"] as const;

export const platformSettings = pgTable(
  "platform_settings",
  {
    id: integer("id").primaryKey().default(1),
    globalChatDisabled: boolean("global_chat_disabled").default(false).notNull(),
    defaultRateLimitTokens: integer("default_rate_limit_tokens").default(20).notNull(),
    defaultRateLimitWindow: varchar("default_rate_limit_window", { length: 16 })
      .default("1 h")
      .notNull(),
    defaultDailyCostCapUsd: real("default_daily_cost_cap_usd").default(5.0).notNull(),
    fallbackProvider: varchar("fallback_provider", { length: 16, enum: AI_PROVIDERS }),
    signupPolicy: varchar("signup_policy", { length: 16, enum: SIGNUP_POLICIES })
      .default("open")
      .notNull(),
    dataRetentionDays: integer("data_retention_days").default(90).notNull(),
    brandName: varchar("brand_name", { length: 64 }).default("Abunayyan").notNull(),
    brandPrimaryColor: varchar("brand_primary_color", { length: 16 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    singleton: check("platform_settings_singleton", sql`${t.id} = 1`),
  }),
);

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type NewPlatformSettings = typeof platformSettings.$inferInsert;
