import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { convertToCoreMessages, streamText, type StreamTextResult, type UIMessage } from "ai";
import type { Chatbot } from "@/db/schema/chatbots";
import { redis } from "@/lib/ratelimit/redis";
import { resolveModel } from "@/lib/chatbots/providers";
import { getToolsForBot } from "@/lib/chatbots/tools";
import { getPlatformSettings } from "@/lib/chatbots/settings";
import { canUserAccessBot } from "@/lib/chatbots/authz";
import { captureError } from "@/lib/logger";
import { env } from "@/lib/env";

type PublicRunError =
  | { kind: "unauthorized" }
  | { kind: "bot_disabled" }
  | { kind: "global_disabled" }
  | { kind: "rate_limited"; retryAfterSec: number; limit: number; remaining: number; reset: number };

type PublicRunResult =
  | {
      ok: true;
      result: StreamTextResult<Record<string, never>, never>;
    }
  | { ok: false; error: PublicRunError };

const DEFAULT_TOKENS = 10;
const DEFAULT_WINDOW = "1 h" as const;

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

function parseWindow(w: string): Window {
  // Keep the set short; matches what admin panel exposes.
  const allowed: Window[] = ["1 m", "5 m", "15 m", "30 m", "1 h", "6 h", "1 d"];
  return (allowed.find((x) => x === w) ?? DEFAULT_WINDOW) as Window;
}

/**
 * Streams a chat turn from an anonymous public-share visitor. Unlike the
 * authed runtime this does NOT persist threads/messages (no user row to
 * anchor to), does not write per-turn audit, and uses a per-card-per-IP
 * rate limit sourced from platform_settings.public_share_rate_limit_*.
 * Cost tracking for anonymous traffic is v2 — the daily cap platform
 * setting is reserved but not yet enforced.
 */
export async function runPublicBotStream(input: {
  bot: Chatbot;
  datasetId: string;
  clientIp: string;
  messages: UIMessage[];
}): Promise<PublicRunResult> {
  const { bot, datasetId, clientIp, messages } = input;

  const settings = await getPlatformSettings();
  if (settings.globalChatDisabled) {
    return { ok: false, error: { kind: "global_disabled" } };
  }

  // Synthetic "viewer" user — only used for access check + tool ctx.
  const anonUser = {
    id: `anon:${clientIp}`,
    role: "viewer" as const,
    disabled: false,
  };

  if (!canUserAccessBot(anonUser, bot)) {
    return { ok: false, error: { kind: bot.enabled ? "unauthorized" : "bot_disabled" } };
  }

  // Per-card-per-IP sliding-window limiter. Instantiated per-call because
  // the tokens + window are admin-tunable; Upstash's Ratelimit is cheap to
  // construct. Fail-closed if Redis isn't configured (same posture as
  // lib/ratelimit/index.ts).
  if (!redis) {
    if (env.DISABLE_RATELIMIT !== "1") {
      return {
        ok: false,
        error: {
          kind: "rate_limited",
          retryAfterSec: 30,
          limit: settings.publicShareRateLimitTokens,
          remaining: 0,
          reset: Date.now() + 30_000,
        },
      };
    }
  } else {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        settings.publicShareRateLimitTokens || DEFAULT_TOKENS,
        parseWindow(settings.publicShareRateLimitWindow),
      ),
      analytics: true,
      prefix: "rl:public-share",
    });
    const rl = await limiter.limit(`${datasetId}:${clientIp}`);
    if (!rl.success) {
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
  }

  const model = resolveModel(bot.provider, bot.modelId);
  const tools = getToolsForBot(bot, anonUser, null, datasetId);

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
      functionId: `public.${bot.slug}`,
    },
    onError: ({ error }) => {
      captureError(error, {
        route: "public-chat.streamText",
        slug: bot.slug,
        botId: bot.id,
        datasetId,
        clientIp,
      });
    },
  });

  return { ok: true, result };
}
