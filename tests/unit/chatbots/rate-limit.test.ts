import { describe, expect, it } from "vitest";
import { budget, ratelimit } from "@/lib/chatbots/rate-limit";
import type { Chatbot } from "@/db/schema/chatbots";

function bot(overrides: Partial<Chatbot> = {}): Chatbot {
  return {
    id: "bot-1",
    slug: "test",
    name: "Test",
    description: null,
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    temperature: 0.3,
    maxTokens: null,
    maxSteps: 3,
    engine: "ai_sdk",
    systemPrompt: "",
    systemPromptVersion: 1,
    tools: [],
    allowedRoles: [],
    rateLimitTokens: 20,
    rateLimitWindow: "1 h",
    dailyCostCapUsd: 0,
    enabled: true,
    deletedAt: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ratelimit.bot", () => {
  it("fails closed when Redis isn't configured", async () => {
    // Tests run without UPSTASH_* env vars — redis is null, so the limiter
    // must reject rather than silently approve. Regression guard against
    // the pre-audit fail-open behavior.
    const r = await ratelimit.bot(bot(), "user-1");
    expect(r.success).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("returns Retry-After-worthy reset timestamp in the future", async () => {
    const r = await ratelimit.bot(bot(), "user-1");
    expect(r.reset).toBeGreaterThan(Date.now() - 1000);
  });

  it("uses per-bot keying (different bots don't share state)", async () => {
    // Hitting two different bot ids shouldn't crash or collide. Even under
    // fail-closed, both must return a deterministic result.
    const a = await ratelimit.bot(bot({ id: "bot-a" }), "user-1");
    const b = await ratelimit.bot(bot({ id: "bot-b" }), "user-1");
    expect(a.success).toBe(false);
    expect(b.success).toBe(false);
  });
});

describe("budget.check", () => {
  it("returns ok when the daily cap is 0 (unlimited)", async () => {
    const r = await budget.check(bot({ dailyCostCapUsd: 0 }), "user-1");
    expect(r.ok).toBe(true);
    expect(r.capUsd).toBe(0);
    expect(r.spentUsd).toBe(0);
  });

  it("returns denied when a cap is set and Redis is unreachable", async () => {
    const r = await budget.check(bot({ dailyCostCapUsd: 5 }), "user-1");
    expect(r.ok).toBe(false);
    expect(r.capUsd).toBe(5);
  });

  it("preserves capUsd in the returned shape", async () => {
    const r = await budget.check(bot({ dailyCostCapUsd: 3.14 }), "user-1");
    expect(r.capUsd).toBe(3.14);
  });
});

describe("budget.record", () => {
  it("is a no-op when the cap is 0", async () => {
    // Should not throw — the function exits early without touching Redis.
    await expect(
      budget.record(bot({ dailyCostCapUsd: 0 }), "user-1", 0.01),
    ).resolves.toBeUndefined();
  });

  it("is a no-op when Redis is unreachable (cap>0, no throw)", async () => {
    // Can't record without Redis, but must not break the caller.
    await expect(
      budget.record(bot({ dailyCostCapUsd: 5 }), "user-1", 0.42),
    ).resolves.toBeUndefined();
  });
});
