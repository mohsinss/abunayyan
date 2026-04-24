import { describe, expect, it } from "vitest";
import {
  ChatbotPatchSchema,
  ChatbotUpsertSchema,
} from "@/lib/validation/chatbot";

const VALID = {
  slug: "cs-triage",
  name: "Customer Support Triage",
  provider: "anthropic" as const,
  modelId: "claude-sonnet-4-6" as const,
  temperature: 0.3,
  maxSteps: 3,
  systemPrompt: "You are the customer support triage assistant.",
  tools: ["renderChart"] as const,
  allowedRoles: [],
  rateLimitTokens: 20,
  rateLimitWindow: "1 h" as const,
  dailyCostCapUsd: 0,
  enabled: true,
};

describe("ChatbotUpsertSchema", () => {
  it("accepts a valid bot config", () => {
    const r = ChatbotUpsertSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("rejects an empty slug", () => {
    const r = ChatbotUpsertSchema.safeParse({ ...VALID, slug: "" });
    expect(r.success).toBe(false);
  });

  it("rejects an uppercase slug", () => {
    const r = ChatbotUpsertSchema.safeParse({ ...VALID, slug: "CS-Triage" });
    expect(r.success).toBe(false);
  });

  it("rejects a slug shorter than 3 chars", () => {
    const r = ChatbotUpsertSchema.safeParse({ ...VALID, slug: "ab" });
    expect(r.success).toBe(false);
  });

  it("rejects a system prompt over 32k chars", () => {
    const r = ChatbotUpsertSchema.safeParse({
      ...VALID,
      systemPrompt: "x".repeat(32_001),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a negative temperature", () => {
    const r = ChatbotUpsertSchema.safeParse({ ...VALID, temperature: -0.1 });
    expect(r.success).toBe(false);
  });

  it("rejects a temperature over 2", () => {
    const r = ChatbotUpsertSchema.safeParse({ ...VALID, temperature: 2.5 });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown tool id", () => {
    const r = ChatbotUpsertSchema.safeParse({
      ...VALID,
      tools: ["renderChart", "renderGalaxy"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown role in allowedRoles", () => {
    const r = ChatbotUpsertSchema.safeParse({
      ...VALID,
      allowedRoles: ["god"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid rate-limit window", () => {
    const r = ChatbotUpsertSchema.safeParse({
      ...VALID,
      rateLimitWindow: "1 year",
    });
    expect(r.success).toBe(false);
  });

  it("rejects maxSteps over 10", () => {
    const r = ChatbotUpsertSchema.safeParse({ ...VALID, maxSteps: 11 });
    expect(r.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const minimal = {
      slug: "ok-bot",
      name: "OK Bot",
      provider: "openai" as const,
      modelId: "gpt-4o-mini" as const,
      systemPrompt: "Reply with OK.",
    };
    const r = ChatbotUpsertSchema.safeParse(minimal);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.temperature).toBe(0.3);
      expect(r.data.maxSteps).toBe(3);
      expect(r.data.rateLimitTokens).toBe(20);
      expect(r.data.rateLimitWindow).toBe("1 h");
      expect(r.data.enabled).toBe(true);
    }
  });
});

describe("ChatbotPatchSchema", () => {
  it("accepts an empty patch", () => {
    const r = ChatbotPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a partial update of a single field", () => {
    const r = ChatbotPatchSchema.safeParse({ temperature: 0.7 });
    expect(r.success).toBe(true);
  });

  it("still enforces per-field constraints in a patch", () => {
    const r = ChatbotPatchSchema.safeParse({ temperature: 3 });
    expect(r.success).toBe(false);
  });
});
