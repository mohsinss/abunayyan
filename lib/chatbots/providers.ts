import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { xai } from "@ai-sdk/xai";
import type { LanguageModelV1 } from "ai";
import { env } from "@/lib/env";
import {
  AI_PROVIDERS,
  MODEL_IDS,
  type AiProvider,
  type ModelId,
} from "@/db/schema/chatbots";

export class ProviderNotConfiguredError extends Error {
  constructor(provider: AiProvider) {
    super(`Provider "${provider}" is not configured — missing API key in env.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class UnsupportedModelError extends Error {
  constructor(provider: AiProvider, modelId: string) {
    super(`Model "${modelId}" is not supported by provider "${provider}".`);
    this.name = "UnsupportedModelError";
  }
}

const ANTHROPIC_MODELS = MODEL_IDS.filter((m) => m.startsWith("claude-"));
const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "o3-mini"] as const;
const GOOGLE_MODELS = MODEL_IDS.filter((m) => m.startsWith("gemini-"));
const XAI_MODELS = MODEL_IDS.filter((m) => m.startsWith("grok-"));

/**
 * Resolve a (provider, modelId) pair to a Vercel AI SDK language model.
 * The only place provider SDKs are instantiated.
 */
export function resolveModel(provider: AiProvider, modelId: ModelId): LanguageModelV1 {
  switch (provider) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) throw new ProviderNotConfiguredError("anthropic");
      if (!ANTHROPIC_MODELS.includes(modelId)) {
        throw new UnsupportedModelError("anthropic", modelId);
      }
      return anthropic(modelId);
    }
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new ProviderNotConfiguredError("openai");
      if (!(OPENAI_MODELS as readonly string[]).includes(modelId)) {
        throw new UnsupportedModelError("openai", modelId);
      }
      return openai(modelId);
    }
    case "google": {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new ProviderNotConfiguredError("google");
      if (!GOOGLE_MODELS.includes(modelId)) {
        throw new UnsupportedModelError("google", modelId);
      }
      return google(modelId);
    }
    case "xai": {
      if (!env.XAI_API_KEY) throw new ProviderNotConfiguredError("xai");
      if (!XAI_MODELS.includes(modelId)) {
        throw new UnsupportedModelError("xai", modelId);
      }
      return xai(modelId);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

/** Which providers have configured API keys right now. Used by the admin UI. */
export function availableProviders(): AiProvider[] {
  const out: AiProvider[] = [];
  if (env.ANTHROPIC_API_KEY) out.push("anthropic");
  if (env.OPENAI_API_KEY) out.push("openai");
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) out.push("google");
  if (env.XAI_API_KEY) out.push("xai");
  return out;
}

/** Which models exist for a given provider, regardless of key availability. */
export function modelsForProvider(provider: AiProvider): ModelId[] {
  switch (provider) {
    case "anthropic": return [...ANTHROPIC_MODELS];
    case "openai":    return [...OPENAI_MODELS];
    case "google":    return [...GOOGLE_MODELS];
    case "xai":       return [...XAI_MODELS];
  }
}

export { AI_PROVIDERS };
