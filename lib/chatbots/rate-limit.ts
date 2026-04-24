import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/ratelimit/redis";
import { env } from "@/lib/env";
import type { Chatbot } from "@/db/schema/chatbots";

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

function failOpen(tokens: number): LimitResult {
  return { success: true, limit: tokens, remaining: tokens, reset: Date.now() + 60_000 };
}
function failClosed(tokens: number): LimitResult {
  return { success: false, limit: tokens, remaining: 0, reset: Date.now() + 30_000 };
}

function limiterFor(tokens: number, window: Window) {
  if (!redis) {
    return {
      limit: async () =>
        env.DISABLE_RATELIMIT === "1" ? failOpen(tokens) : failClosed(tokens),
    };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "rl:bot",
  });
}

const cache = new Map<string, ReturnType<typeof limiterFor>>();

function getLimiter(bot: Chatbot) {
  const key = `${bot.id}:${bot.rateLimitTokens}:${bot.rateLimitWindow}`;
  let lim = cache.get(key);
  if (!lim) {
    lim = limiterFor(bot.rateLimitTokens, bot.rateLimitWindow as Window);
    cache.set(key, lim);
  }
  return lim;
}

export const ratelimit = {
  async bot(bot: Chatbot, userId: string): Promise<LimitResult> {
    const lim = getLimiter(bot);
    return lim.limit(`${bot.id}:${userId}`);
  },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const budget = {
  async check(
    bot: Chatbot,
    userId: string,
  ): Promise<{ ok: boolean; spentUsd: number; capUsd: number }> {
    const capUsd = bot.dailyCostCapUsd;
    if (capUsd <= 0) return { ok: true, spentUsd: 0, capUsd: 0 };
    if (!redis) return { ok: env.DISABLE_RATELIMIT === "1", spentUsd: 0, capUsd };
    const key = `cost:${bot.id}:${userId}:${todayKey()}`;
    const raw = await redis.get<string | number>(key);
    const spent = typeof raw === "number" ? raw : parseFloat(String(raw ?? 0));
    return { ok: spent < capUsd, spentUsd: spent, capUsd };
  },

  async record(bot: Chatbot, userId: string, costUsd: number) {
    if (bot.dailyCostCapUsd <= 0) return;
    if (!redis) return;
    const key = `cost:${bot.id}:${userId}:${todayKey()}`;
    await redis.incrbyfloat(key, costUsd);
    await redis.expire(key, 26 * 60 * 60);
  },
};
