import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";
import { env } from "@/lib/env";

type Window = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type Limiter = { limit: (_id: string) => Promise<LimitResult> };

/**
 * Fail-closed by default: if Redis is not configured, reject requests.
 * Escape hatch: `DISABLE_RATELIMIT=1` allows traffic through (incident mode).
 */
function makeLimiter(tokens: number, window: Window, prefix: string): Limiter {
  if (!redis) {
    if (env.DISABLE_RATELIMIT === "1") {
      return {
        limit: async () => ({
          success: true,
          limit: tokens,
          remaining: tokens,
          reset: Date.now() + 60_000,
        }),
      };
    }
    return {
      limit: async () => ({
        success: false,
        limit: tokens,
        remaining: 0,
        reset: Date.now() + 30_000,
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
  admin: makeLimiter(100, "1 m", "rl:admin"),
  adminMutations: makeLimiter(20, "1 m", "rl:admin:mutations"),
};
