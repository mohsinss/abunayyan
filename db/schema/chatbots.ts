import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users, type UserRole } from "./users";

export const AI_PROVIDERS = ["anthropic", "openai", "google", "xai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const MODEL_IDS = [
  // Anthropic
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  // OpenAI
  "gpt-4o",
  "gpt-4o-mini",
  "o3-mini",
  // Google
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  // xAI
  "grok-2",
  "grok-beta",
] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const TOOL_IDS = [
  "renderChart",
  "renderTable",
  "renderKpiList",
  "searchDocs",
  "searchDatasetDocs",
  "atlasSnapshot",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const chatbots = pgTable(
  "chatbots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    provider: varchar("provider", { length: 16, enum: AI_PROVIDERS }).notNull(),
    modelId: varchar("model_id", { length: 64, enum: MODEL_IDS }).notNull(),
    temperature: real("temperature").default(0.3).notNull(),
    maxTokens: integer("max_tokens"),
    maxSteps: integer("max_steps").default(3).notNull(),
    systemPrompt: text("system_prompt").notNull(),
    systemPromptVersion: integer("system_prompt_version").default(1).notNull(),
    tools: jsonb("tools").$type<ToolId[]>().default([]).notNull(),
    allowedRoles: jsonb("allowed_roles").$type<UserRole[]>().default([]).notNull(),
    rateLimitTokens: integer("rate_limit_tokens").default(20).notNull(),
    rateLimitWindow: varchar("rate_limit_window", { length: 16 }).default("1 h").notNull(),
    dailyCostCapUsd: real("daily_cost_cap_usd").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: index("chatbots_slug_idx").on(t.slug),
    enabledIdx: index("chatbots_enabled_idx").on(t.enabled),
  }),
);

export type Chatbot = typeof chatbots.$inferSelect;
export type NewChatbot = typeof chatbots.$inferInsert;

export const chatbotPrompts = pgTable(
  "chatbot_prompts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbots.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    note: text("note"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chatbotVersionIdx: index("chatbot_prompts_chatbot_version_idx").on(t.chatbotId, t.version),
    uniqueChatbotVersion: uniqueIndex("chatbot_prompts_unique").on(t.chatbotId, t.version),
  }),
);

export type ChatbotPrompt = typeof chatbotPrompts.$inferSelect;
export type NewChatbotPrompt = typeof chatbotPrompts.$inferInsert;
