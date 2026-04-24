import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableProviders,
  modelsForProvider,
  ProviderNotConfiguredError,
  resolveModel,
  UnsupportedModelError,
} from "@/lib/chatbots/providers";

describe("resolveModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when the Anthropic key is missing", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => resolveModel("anthropic", "claude-sonnet-4-6")).toThrow(
      ProviderNotConfiguredError,
    );
  });

  it("throws when the OpenAI key is missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => resolveModel("openai", "gpt-4o")).toThrow(ProviderNotConfiguredError);
  });

  it("rejects a model id on the wrong provider", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(() =>
      // `gpt-4o` is an OpenAI model — asking Anthropic for it must error.
      resolveModel("anthropic", "gpt-4o" as never),
    ).toThrow(UnsupportedModelError);
  });

  it("returns a model object when Anthropic is configured", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const m = resolveModel("anthropic", "claude-sonnet-4-6");
    expect(m).toBeDefined();
    // Vercel AI SDK language models expose a `specificationVersion` + `provider`.
    expect(typeof (m as unknown as { provider: string }).provider).toBe("string");
  });

  it("returns a model object when OpenAI is configured", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const m = resolveModel("openai", "gpt-4o");
    expect(m).toBeDefined();
  });

  it("returns a model object when Google is configured", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-01234567890");
    const m = resolveModel("google", "gemini-2.5-flash");
    expect(m).toBeDefined();
  });

  it("returns a model object when xAI is configured", () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");
    const m = resolveModel("xai", "grok-2");
    expect(m).toBeDefined();
  });
});

describe("availableProviders", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    vi.stubEnv("XAI_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty when no provider keys are set", () => {
    expect(availableProviders()).toEqual([]);
  });

  it("returns only providers whose keys are configured", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "AIza-test-01234567890");
    const got = availableProviders();
    expect(got).toContain("anthropic");
    expect(got).toContain("google");
    expect(got).not.toContain("openai");
    expect(got).not.toContain("xai");
  });
});

describe("modelsForProvider", () => {
  it("returns only Anthropic models for Anthropic", () => {
    const models = modelsForProvider("anthropic");
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.startsWith("claude-"))).toBe(true);
  });

  it("returns o3-mini in the OpenAI list", () => {
    expect(modelsForProvider("openai")).toContain("o3-mini");
  });

  it("returns grok models for xAI", () => {
    const models = modelsForProvider("xai");
    expect(models.every((m) => m.startsWith("grok-"))).toBe(true);
  });

  it("returns gemini models for Google", () => {
    const models = modelsForProvider("google");
    expect(models.every((m) => m.startsWith("gemini-"))).toBe(true);
  });
});
