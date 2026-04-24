import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "@/lib/chatbots/cost";

describe("estimateCostUsd", () => {
  it("prices Claude Opus 4.7 at list rates", () => {
    // 1M input tokens at $15/M = $15; 1M output at $75/M = $75; total $90.
    const cost = estimateCostUsd("anthropic", "claude-opus-4-7", {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(90, 2);
  });

  it("prices Claude Sonnet 4.7 correctly", () => {
    const cost = estimateCostUsd("anthropic", "claude-sonnet-4-7", {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    expect(cost).toBeCloseTo(0.003 + 0.015, 6);
  });

  it("prices GPT-4o-mini", () => {
    const cost = estimateCostUsd("openai", "gpt-4o-mini", {
      promptTokens: 10_000,
      completionTokens: 10_000,
    });
    expect(cost).toBeCloseTo(10 * 0.00015 + 10 * 0.0006, 6);
  });

  it("prices Gemini 2.5 Flash as the cheapest", () => {
    const flash = estimateCostUsd("google", "gemini-2.5-flash", {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    const opus = estimateCostUsd("anthropic", "claude-opus-4-7", {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    expect(flash).toBeLessThan(opus);
  });

  it("returns 0 for an unknown model id", () => {
    const cost = estimateCostUsd("anthropic", "claude-not-a-real-model", {
      promptTokens: 1000,
      completionTokens: 1000,
    });
    expect(cost).toBe(0);
  });

  it("returns 0 for zero tokens", () => {
    const cost = estimateCostUsd("anthropic", "claude-sonnet-4-7", {
      promptTokens: 0,
      completionTokens: 0,
    });
    expect(cost).toBe(0);
  });

  it("is additive across the two token buckets", () => {
    const a = estimateCostUsd("anthropic", "claude-sonnet-4-7", {
      promptTokens: 500,
      completionTokens: 0,
    });
    const b = estimateCostUsd("anthropic", "claude-sonnet-4-7", {
      promptTokens: 0,
      completionTokens: 500,
    });
    const combined = estimateCostUsd("anthropic", "claude-sonnet-4-7", {
      promptTokens: 500,
      completionTokens: 500,
    });
    expect(combined).toBeCloseTo(a + b, 6);
  });
});
