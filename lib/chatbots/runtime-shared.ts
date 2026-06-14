import "server-only";
import type { Chatbot } from "@/db/schema/chatbots";
import { appendMessage } from "./persistence";
import { writeAudit } from "./audit";
import { budget } from "./rate-limit";
import { estimateCostUsd } from "./cost";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { captureError } from "@/lib/logger";

export type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other"
  | "unknown";

export type TurnUsage = {
  promptTokens: number;
  completionTokens: number;
};

// Engine-agnostic recorder. Every runtime (AI SDK, Anthropic direct,
// OpenAI direct) must call this exactly once when a turn finishes so
// that messages, audit log, budget, and analytics stay consistent.
export async function recordTurnEnd(args: {
  bot: Chatbot;
  user: { id: string };
  threadId: string;
  text: string;
  toolCalls: unknown[];
  // Ordered UI parts (text / tool-invocation) for history interleaving.
  parts?: unknown[];
  usage: TurnUsage;
  finishReason: FinishReason;
}) {
  const { bot, user, threadId, text, toolCalls, parts, usage, finishReason } = args;
  try {
    const costUsd = estimateCostUsd(bot.provider, bot.modelId, usage);
    await appendMessage({
      threadId,
      role: "assistant",
      content: text,
      toolCalls,
      parts,
      tokensIn: usage.promptTokens,
      tokensOut: usage.completionTokens,
      costUsd,
      finishReason,
      modelId: bot.modelId,
      promptVersion: bot.systemPromptVersion,
      status: finishReason === "error" ? "errored" : "complete",
    });
    await budget.record(bot, user.id, costUsd);
    await writeAudit({
      actorId: user.id,
      botId: bot.id,
      threadId,
      event: finishReason === "error" ? "bot.turn_errored" : "bot.turn_completed",
      payload: {
        tokensIn: usage.promptTokens,
        tokensOut: usage.completionTokens,
        costUsd,
        finishReason,
        modelId: bot.modelId,
        provider: bot.provider,
        engine: bot.engine,
      },
    });
    await capture({
      distinctId: user.id,
      event: EVENTS.ai_completion,
      properties: {
        bot: bot.slug,
        provider: bot.provider,
        engine: bot.engine,
        model: bot.modelId,
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        cost_usd: costUsd,
        finish_reason: finishReason,
        thread_id: threadId,
      },
    }).catch(() => {});
  } catch (err) {
    captureError(err, {
      route: "runtime.recordTurnEnd",
      slug: bot.slug,
      botId: bot.id,
      userId: user.id,
      threadId,
      provider: bot.provider,
      engine: bot.engine,
      modelId: bot.modelId,
    });
  }
}

// What every engine must return so the chat route handler can serve
// the response uniformly. The AI SDK's StreamTextResult satisfies this
// shape natively; the direct engines build it manually around
// createDataStreamResponse.
export interface RuntimeStream {
  toDataStreamResponse(_opts: {
    headers?: Record<string, string>;
    getErrorMessage?: (_err: unknown) => string;
  }): Response;
}
