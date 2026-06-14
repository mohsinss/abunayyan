import "server-only";
import { type UIMessage } from "ai";
import type { Chatbot } from "@/db/schema/chatbots";
import type { UserRole } from "@/db/schema/users";
import { appendMessage, autoTitleIfNeeded, getOrCreateThread } from "./persistence";
import { ratelimit, budget } from "./rate-limit";
import { canUserAccessBot } from "./authz";
import { writeAudit } from "./audit";
import { getPlatformSettings } from "./settings";
import { streamViaAiSdk } from "./runtime-ai-sdk";
import { streamViaAnthropicDirect } from "./runtime-anthropic";
import type { RuntimeStream } from "./runtime-shared";
import { captureError } from "@/lib/logger";

// Top-level entry point used by the chat route handler. Owns all the
// engine-agnostic concerns (auth, rate limit, budget cap, thread
// resolution, user-message persistence) and then dispatches to the
// engine-specific stream implementation based on bot.engine.

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
  // Per-card chatbots set this so tools like searchDatasetDocs /
  // queryDatasetRows scope to the card. The chat route handler resolves
  // it via getDatasetByChatbotId before calling us.
  datasetId?: string | null;
};

export type RunSuccess = {
  ok: true;
  threadId: string;
  result: RuntimeStream;
};

export type RunResult = RunSuccess | { ok: false; error: RunError };

export async function runBotStream(input: RunInput): Promise<RunResult> {
  const { bot, user, threadId, messages, datasetId } = input;

  // Access is a free in-memory check — deny before touching DB/Redis.
  if (!canUserAccessBot(user, bot)) {
    await writeAudit({
      actorId: user.id,
      botId: bot.id,
      event: "bot.access_denied",
    });
    return { ok: false, error: { kind: "unauthorized" } };
  }

  // The remaining pre-stream reads are independent — run them concurrently
  // instead of as 4 serial Neon/Redis round-trips. On the HTTP driver each
  // round-trip is a fresh request, so serializing them added ~hundreds of ms
  // of dead time before the model was even dispatched (time-to-first-token).
  const [settings, rl, b, thread] = await Promise.all([
    getPlatformSettings(),
    ratelimit.bot(bot, user.id),
    budget.check(bot, user.id),
    getOrCreateThread({ userId: user.id, chatbotId: bot.id, threadId }),
  ]);

  if (settings.globalChatDisabled) {
    return { ok: false, error: { kind: "global_disabled" } };
  }
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

  // Persist the user message OFF the critical path. Writing it (insert +
  // thread bump + auto-title = 3 statements) used to block the model
  // dispatch; the first token shouldn't wait on it. The assistant message is
  // saved later in recordTurnEnd, and this insert fires now and completes in
  // ~tens of ms (well before the stream closes), so createdAt ordering holds.
  const userMsg = messages.at(-1);
  if (userMsg?.role === "user" && typeof userMsg.content === "string" && userMsg.content.length) {
    const content = userMsg.content;
    void (async () => {
      await appendMessage({ threadId: thread.id, role: "user", content });
      await autoTitleIfNeeded(thread.id, content);
    })().catch((err) =>
      captureError(err, { route: "runtime.persistUserMsg", botId: bot.id, threadId: thread.id }),
    );
  }

  // Dispatch to the engine. Default `ai_sdk` keeps the original
  // streamText() pipeline; the direct engines bypass the AI SDK and
  // call provider SDKs directly while still emitting the same
  // DataStream wire format the client consumes.
  switch (bot.engine) {
    case "anthropic_direct": {
      if (bot.provider !== "anthropic") {
        return { ok: false, error: { kind: "bot_disabled" } };
      }
      const result = streamViaAnthropicDirect({
        bot,
        user,
        threadId: thread.id,
        messages,
        datasetId: datasetId ?? null,
      });
      return { ok: true, threadId: thread.id, result };
    }
    case "ai_sdk":
    default: {
      const result = streamViaAiSdk({
        bot,
        user,
        threadId: thread.id,
        messages,
        datasetId: datasetId ?? null,
      });
      return { ok: true, threadId: thread.id, result };
    }
  }
}
