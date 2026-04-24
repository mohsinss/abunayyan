import { boolean, check, integer, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { AI_PROVIDERS, MODEL_IDS } from "./chatbots";

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
    // Dataset-card limits (see docs/datasets-cards-plan.md §12).
    datasetMaxFileBytes: integer("dataset_max_file_bytes").default(26_214_400).notNull(),
    datasetMaxFilesPerDataset: integer("dataset_max_files_per_dataset").default(10).notNull(),
    datasetMaxDatasets: integer("dataset_max_datasets").default(50).notNull(),
    datasetMaxRowsPerDataset: integer("dataset_max_rows_per_dataset").default(100_000).notNull(),
    // Platform-wide chatbot defaults — per-bot values in `chatbots` override these.
    defaultChatbotModelId: varchar("default_chatbot_model_id", { length: 64, enum: MODEL_IDS }),
    defaultChatbotTemperature: real("default_chatbot_temperature").default(0.3).notNull(),
    // Anonymous chatbot limits for `/s/<token>` public share pages (§11.3).
    publicShareRateLimitTokens: integer("public_share_rate_limit_tokens").default(10).notNull(),
    publicShareRateLimitWindow: varchar("public_share_rate_limit_window", { length: 16 })
      .default("1 h")
      .notNull(),
    publicShareDailyCostCapUsd: real("public_share_daily_cost_cap_usd").default(2.0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    singleton: check("platform_settings_singleton", sql`${t.id} = 1`),
  }),
);

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type NewPlatformSettings = typeof platformSettings.$inferInsert;
