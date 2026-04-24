import "server-only";
import { streamText, convertToCoreMessages, type StreamTextResult, type UIMessage } from "ai";
import type { Chatbot } from "@/db/schema/chatbots";
import type { UserRole } from "@/db/schema/users";
import { resolveModel } from "./providers";
import { getToolsForBot } from "./tools";
import { appendMessage, autoTitleIfNeeded, getOrCreateThread } from "./persistence";
import { ratelimit, budget } from "./rate-limit";
import { canUserAccessBot } from "./authz";
import { writeAudit } from "./audit";
import { estimateCostUsd } from "./cost";
import { getPlatformSettings } from "./settings";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { captureError } from "@/lib/logger";
import { env } from "@/lib/env";

export type RunError =
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfterSec: number; limit: number; remaining: number; reset: number }
  | { kind: "budget_exceeded"; capUsd: number; spentUsd: number }
  | { kind: "bot_disabled" }
  | { kind: "global_disabled" };

export type RunInput = {
  bot: Chatbot;
  user: { id: string; role: UserRole; disabled: boolean };
  threadId?: string;
  messages: UIMessage[];
};

export type RunSuccess = {
  ok: true;
  threadId: string;
  result: StreamTextResult<Record<string, never>, never>;
};

export type RunResult = RunSuccess | { ok: false; error: RunError };

export async function runBotStream(input: RunInput): Promise<RunResult> {
  const { bot, user, threadId, messages } = input;

  const settings = await getPlatformSettings();
  if (settings.globalChatDisabled) {
    return { ok: false, error: { kind: "global_disabled" } };
  }

  if (!canUserAccessBot(user, bot)) {
    await writeAudit({
      actorId: user.id,
      botId: bot.id,
      event: "bot.access_denied",
    });
    return { ok: false, error: { kind: "unauthorized" } };
  }

  const rl = await ratelimit.bot(bot, user.id);
  if (!rl.success) {
    await writeAudit({
      actorId: user.id,
      botId: bot.id,
      event: "bot.rate_limited",
      payload: { limit: rl.limit, reset: rl.reset },
    });
    return {
      ok: false,
      error: {
        kind: "rate_limited",
        retryAfterSec: Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
        limit: rl.limit,
        remaining: rl.remaining,
        reset: rl.reset,
      },
    };
  }

  const b = await budget.check(bot, user.id);
  if (!b.ok) {
    await writeAudit({
      actorId: user.id,
      botId: bot.id,
      event: "bot.budget_exceeded",
      payload: { capUsd: b.capUsd, spentUsd: b.spentUsd },
    });
    return {
      ok: false,
      error: { kind: "budget_exceeded", capUsd: b.capUsd, spentUsd: b.spentUsd },
    };
  }

  const thread = await getOrCreateThread({
    userId: user.id,
    chatbotId: bot.id,
    threadId,
  });

  const userMsg = messages.at(-1);
  if (userMsg?.role === "user" && typeof userMsg.content === "string" && userMsg.content.length) {
    await appendMessage({
      threadId: thread.id,
      role: "user",
      content: userMsg.content,
    });
    await autoTitleIfNeeded(thread.id, userMsg.content);
  }

  const model = resolveModel(bot.provider, bot.modelId);
  const tools = getToolsForBot(bot, user, thread.id);

  const result = streamText({
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
    onFinish: async ({ text, toolCalls, usage, finishReason }) => {
      try {
        const costUsd = estimateCostUsd(bot.provider, bot.modelId, usage);
        await appendMessage({
          threadId: thread.id,
          role: "assistant",
          content: text,
          toolCalls: toolCalls as unknown as unknown[],
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
          threadId: thread.id,
          event: finishReason === "error" ? "bot.turn_errored" : "bot.turn_completed",
          payload: {
            tokensIn: usage.promptTokens,
            tokensOut: usage.completionTokens,
            costUsd,
            finishReason,
            modelId: bot.modelId,
            provider: bot.provider,
          },
        });
        await capture({
          distinctId: user.id,
          event: EVENTS.ai_completion,
          properties: {
            bot: bot.slug,
            provider: bot.provider,
            model: bot.modelId,
            input_tokens: usage.promptTokens,
            output_tokens: usage.completionTokens,
            cost_usd: costUsd,
            finish_reason: finishReason,
            thread_id: thread.id,
          },
        }).catch(() => {});
      } catch (err) {
        captureError(err, {
          route: "runtime.onFinish",
          slug: bot.slug,
          botId: bot.id,
          userId: user.id,
          threadId: thread.id,
          provider: bot.provider,
          modelId: bot.modelId,
        });
      }
    },
  });

  return { ok: true, threadId: thread.id, result };
}
