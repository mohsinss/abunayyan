import { z } from "zod";
import { AI_PROVIDERS, ENGINES, MODEL_IDS, TOOL_IDS } from "@/db/schema/chatbots";
import { USER_ROLES } from "@/db/schema/users";

const SLUG_RE = /^[a-z0-9-]{3,64}$/;
const WINDOWS = ["1 m", "5 m", "15 m", "1 h", "1 d"] as const;

export const ChatbotUpsertSchema = z.object({
  slug: z.string().regex(SLUG_RE, "slug must be 3-64 chars, a-z 0-9 -"),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  provider: z.enum(AI_PROVIDERS),
  modelId: z.enum(MODEL_IDS),
  engine: z.enum(ENGINES).default("ai_sdk"),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().positive().nullable().optional(),
  maxSteps: z.number().int().min(1).max(10).default(3),
  systemPrompt: z.string().min(1).max(32_000),
  tools: z.array(z.enum(TOOL_IDS)).default([]),
  allowedRoles: z.array(z.enum(USER_ROLES)).default([]),
  rateLimitTokens: z.number().int().min(1).max(10_000).default(20),
  rateLimitWindow: z.enum(WINDOWS).default("1 h"),
  dailyCostCapUsd: z.number().min(0).max(10_000).default(0),
  enabled: z.boolean().default(true),
}).refine(
  (v) =>
    v.engine !== "anthropic_direct" || v.provider === "anthropic",
  { message: "anthropic_direct engine requires provider=anthropic", path: ["engine"] },
);

// Patch needs to be derived BEFORE the .refine() chain because refined
// schemas don't expose .partial(). We rebuild it from the unrefined
// shape so the per-field engine/provider check still applies inline
// at the use site (admin actions.ts handles dispatch rejection).
const _UnrefinedChatbotSchema = z.object({
  slug: z.string().regex(SLUG_RE, "slug must be 3-64 chars, a-z 0-9 -"),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  provider: z.enum(AI_PROVIDERS),
  modelId: z.enum(MODEL_IDS),
  engine: z.enum(ENGINES).default("ai_sdk"),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().positive().nullable().optional(),
  maxSteps: z.number().int().min(1).max(10).default(3),
  systemPrompt: z.string().min(1).max(32_000),
  tools: z.array(z.enum(TOOL_IDS)).default([]),
  allowedRoles: z.array(z.enum(USER_ROLES)).default([]),
  rateLimitTokens: z.number().int().min(1).max(10_000).default(20),
  rateLimitWindow: z.enum(WINDOWS).default("1 h"),
  dailyCostCapUsd: z.number().min(0).max(10_000).default(0),
  enabled: z.boolean().default(true),
});

export const ChatbotPatchSchema = _UnrefinedChatbotSchema.partial();
export type ChatbotPatch = z.infer<typeof ChatbotPatchSchema>;
export type ChatbotUpsert = z.infer<typeof ChatbotUpsertSchema>;
