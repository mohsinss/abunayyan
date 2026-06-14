import "server-only";
import {
  streamText,
  convertToCoreMessages,
  type CoreMessage,
  type StreamTextResult,
  type UIMessage,
} from "ai";
import type { Chatbot } from "@/db/schema/chatbots";
import type { UserRole } from "@/db/schema/users";
import { resolveModel } from "./providers";
import { getToolsForBot } from "./tools";
import { recordTurnEnd, type FinishReason } from "./runtime-shared";
import { captureError } from "@/lib/logger";
import { env } from "@/lib/env";

// Vercel AI SDK runtime — the original implementation. `streamText`
// owns the multi-step tool loop, the wire-format streaming, and the
// onFinish lifecycle. Persistence + audit + budget happen via
// recordTurnEnd, shared with the direct-engine runtimes.

export function streamViaAiSdk(args: {
  bot: Chatbot;
  user: { id: string; role: UserRole; disabled: boolean };
  threadId: string;
  messages: UIMessage[];
  datasetId: string | null;
}): StreamTextResult<Record<string, never>, never> {
  const { bot, user, threadId, messages, datasetId } = args;

  const model = resolveModel(bot.provider, bot.modelId);
  const tools = getToolsForBot(bot, user, threadId, datasetId);

  // Anthropic prompt caching: the API caches the prompt prefix up to a
  // cache_control breakpoint, and the prefix order is tools → system →
  // messages. Putting the breakpoint on the system message therefore
  // caches BOTH the (large) tool schemas and the system prompt, so a
  // multi-step turn (maxSteps up to 8) re-sends them as a cache hit
  // instead of re-billing/re-processing the full prefix every step. The
  // anthropic-namespaced option is ignored by non-Anthropic providers,
  // and Anthropic silently skips caching when the prefix is below the
  // minimum cacheable size, so this is safe to always set.
  const systemMessage: CoreMessage = {
    role: "system",
    content: bot.systemPrompt,
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  };

  return streamText({
    model,
    messages: [systemMessage, ...convertToCoreMessages(messages)],
    tools,
    maxSteps: bot.maxSteps,
    temperature: bot.temperature,
    maxTokens: bot.maxTokens ?? undefined,
    experimental_telemetry: {
      isEnabled: env.NODE_ENV !== "production" || env.ENABLE_AI_TRACES === "1",
      functionId: `bot.${bot.slug}`,
    },
    onError: ({ error }) => {
      captureError(error, {
        route: "runtime.streamText",
        slug: bot.slug,
        botId: bot.id,
        userId: user.id,
        threadId,
        provider: bot.provider,
        modelId: bot.modelId,
      });
    },
    onFinish: async ({ text, toolCalls, usage, finishReason, steps }) => {
      // `toolCalls` only covers the FINAL step of a multi-step turn — a
      // turn that ends with a text closer would persist zero tool calls
      // and lose its charts/tables on history restore. Flatten across
      // all steps instead.
      const allToolCalls =
        steps.length > 0 ? steps.flatMap((s) => s.toolCalls ?? []) : toolCalls;
      await recordTurnEnd({
        bot,
        user,
        threadId,
        text,
        toolCalls: allToolCalls as unknown as unknown[],
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        },
        finishReason: finishReason as FinishReason,
      });
    },
  });
}
