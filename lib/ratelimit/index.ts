import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type Limiter = { limit: (id: string) => Promise<LimitResult> };

function makeLimiter(tokens: number, window: Window, prefix: string): Limiter {
  if (!redis) {
    return {
      limit: async () => ({
        success: true,
        limit: tokens,
        remaining: tokens,
        reset: Date.now() + 60_000,
      }),
    };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix,
  });
}

export const ratelimit = {
  api: makeLimiter(100, "1 m", "rl:api"),
  ai: makeLimiter(20, "1 h", "rl:ai"),
  auth: makeLimiter(5, "15 m", "rl:auth"),
  public: makeLimiter(30, "1 m", "rl:public"),
};
