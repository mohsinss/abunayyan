import "server-only";
import { streamText, convertToCoreMessages, type StreamTextResult, type UIMessage } from "ai";
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

  return streamText({
    model,
    system: bot.systemPrompt,
    messages: convertToCoreMessages(messages),
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
    onFinish: async ({ text, toolCalls, usage, finishReason }) => {
      await recordTurnEnd({
        bot,
        user,
        threadId,
        text,
        toolCalls: toolCalls as unknown as unknown[],
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
        },
        finishReason: finishReason as FinishReason,
      });
    },
  });
}
