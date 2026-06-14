import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chatbot } from "@/db/schema/chatbots";

// Mock every collaborator BEFORE importing runBotStream so it binds to the
// mocks. runtime.ts is pure orchestration over these — the tests assert the
// guard-rail SEQUENCE, short-circuits, matching audit events, and engine
// dispatch, without touching a DB or Redis.
vi.mock("@/lib/chatbots/settings", () => ({ getPlatformSettings: vi.fn() }));
vi.mock("@/lib/chatbots/authz", () => ({ canUserAccessBot: vi.fn() }));
vi.mock("@/lib/chatbots/rate-limit", () => ({
  ratelimit: { bot: vi.fn() },
  budget: { check: vi.fn() },
}));
vi.mock("@/lib/chatbots/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/chatbots/persistence", () => ({
  getOrCreateThread: vi.fn(),
  appendMessage: vi.fn(),
  autoTitleIfNeeded: vi.fn(),
}));
vi.mock("@/lib/chatbots/runtime-ai-sdk", () => ({ streamViaAiSdk: vi.fn() }));
vi.mock("@/lib/chatbots/runtime-anthropic", () => ({ streamViaAnthropicDirect: vi.fn() }));

import { runBotStream } from "@/lib/chatbots/runtime";
import { getPlatformSettings } from "@/lib/chatbots/settings";
import { canUserAccessBot } from "@/lib/chatbots/authz";
import { ratelimit, budget } from "@/lib/chatbots/rate-limit";
import { writeAudit } from "@/lib/chatbots/audit";
import {
  getOrCreateThread,
  appendMessage,
  autoTitleIfNeeded,
} from "@/lib/chatbots/persistence";
import { streamViaAiSdk } from "@/lib/chatbots/runtime-ai-sdk";
import { streamViaAnthropicDirect } from "@/lib/chatbots/runtime-anthropic";

const m = {
  settings: vi.mocked(getPlatformSettings),
  access: vi.mocked(canUserAccessBot),
  rl: vi.mocked(ratelimit.bot),
  budget: vi.mocked(budget.check),
  audit: vi.mocked(writeAudit),
  thread: vi.mocked(getOrCreateThread),
  append: vi.mocked(appendMessage),
  title: vi.mocked(autoTitleIfNeeded),
  aiSdk: vi.mocked(streamViaAiSdk),
  anthropic: vi.mocked(streamViaAnthropicDirect),
};

function bot(overrides: Partial<Chatbot> = {}): Chatbot {
  return {
    id: "bot-1",
    slug: "test-bot",
    name: "Test Bot",
    description: null,
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    temperature: 0.3,
    maxTokens: null,
    maxSteps: 3,
    engine: "ai_sdk",
    systemPrompt: "hello",
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

const user = { id: "u1", role: "member" as const, disabled: false };
// runtime only reads the last message's role/content, so a minimal shape is
// fine — cast past the AI SDK UIMessage's `parts` requirement.
const userMessages = [{ id: "1", role: "user", content: "hi" }] as never;

const AI_SDK_STREAM = { __engine: "ai_sdk" } as never;
const ANTHROPIC_STREAM = { __engine: "anthropic_direct" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  // Happy-path defaults; individual tests override the gate under test.
  m.settings.mockResolvedValue({ globalChatDisabled: false } as never);
  m.access.mockReturnValue(true);
  m.rl.mockResolvedValue({ success: true, limit: 20, remaining: 19, reset: Date.now() + 3_600_000 });
  m.budget.mockResolvedValue({ ok: true, spentUsd: 0, capUsd: 0 });
  m.thread.mockResolvedValue({ id: "thread-1" } as never);
  m.append.mockResolvedValue(undefined as never);
  m.title.mockResolvedValue(undefined as never);
  m.audit.mockResolvedValue(undefined as never);
  m.aiSdk.mockReturnValue(AI_SDK_STREAM);
  m.anthropic.mockReturnValue(ANTHROPIC_STREAM);
});

function run(overrides: Partial<Parameters<typeof runBotStream>[0]> = {}) {
  return runBotStream({ bot: bot(), user, messages: userMessages, ...overrides });
}

describe("runBotStream guard rails", () => {
  it("short-circuits on global kill switch before any other check", async () => {
    m.settings.mockResolvedValue({ globalChatDisabled: true } as never);
    const res = await run();
    expect(res).toEqual({ ok: false, error: { kind: "global_disabled" } });
    // The gate reads now run concurrently, so other spies may be called; the
    // contract is that the global switch wins the result and writes no audit.
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("denies access, audits it, and never reaches the rate limiter", async () => {
    m.access.mockReturnValue(false);
    const res = await run();
    expect(res).toEqual({ ok: false, error: { kind: "unauthorized" } });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "u1", botId: "bot-1", event: "bot.access_denied" }),
    );
    expect(m.rl).not.toHaveBeenCalled();
  });

  it("returns rate_limited with retry metadata + audit, before budget check", async () => {
    const reset = Date.now() + 5_000;
    m.rl.mockResolvedValue({ success: false, limit: 20, remaining: 0, reset });
    const res = await run();
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.error.kind).toBe("rate_limited");
    if (res.error.kind !== "rate_limited") throw new Error("unreachable");
    expect(res.error.limit).toBe(20);
    expect(res.error.remaining).toBe(0);
    expect(res.error.reset).toBe(reset);
    expect(res.error.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(res.error.retryAfterSec).toBeLessThanOrEqual(5);
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "bot.rate_limited" }),
    );
  });

  it("returns budget_exceeded with cap/spent + audit", async () => {
    m.budget.mockResolvedValue({ ok: false, spentUsd: 7.5, capUsd: 5 });
    const res = await run();
    expect(res).toEqual({
      ok: false,
      error: { kind: "budget_exceeded", capUsd: 5, spentUsd: 7.5 },
    });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "bot.budget_exceeded", payload: { capUsd: 5, spentUsd: 7.5 } }),
    );
  });
});

describe("runBotStream persistence + dispatch", () => {
  it("persists the user message and auto-titles, then dispatches to ai_sdk", async () => {
    const res = await run();
    expect(res).toEqual({ ok: true, threadId: "thread-1", result: AI_SDK_STREAM });
    expect(m.thread).toHaveBeenCalledWith({ userId: "u1", chatbotId: "bot-1", threadId: undefined });
    expect(m.anthropic).not.toHaveBeenCalled();
    // Persistence is deferred (fire-and-forget) so it doesn't block dispatch;
    // flush microtasks before asserting the writes happened.
    await new Promise((r) => setTimeout(r, 0));
    expect(m.append).toHaveBeenCalledWith({ threadId: "thread-1", role: "user", content: "hi" });
    expect(m.title).toHaveBeenCalledWith("thread-1", "hi");
  });

  it("forwards an existing threadId and datasetId to the engine", async () => {
    await run({ threadId: "t-existing", datasetId: "ds-9" });
    expect(m.thread).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "t-existing" }),
    );
    expect(m.aiSdk).toHaveBeenCalledWith(expect.objectContaining({ datasetId: "ds-9", threadId: "thread-1" }));
  });

  it("defaults datasetId to null when omitted", async () => {
    await run();
    expect(m.aiSdk).toHaveBeenCalledWith(expect.objectContaining({ datasetId: null }));
  });

  it("does not persist when the last message is not a non-empty user string", async () => {
    await run({ messages: [{ id: "1", role: "assistant", content: "prior" }] as never });
    expect(m.append).not.toHaveBeenCalled();
    expect(m.title).not.toHaveBeenCalled();
    // still dispatches
    expect(m.aiSdk).toHaveBeenCalled();
  });

  it("does not persist an empty user message", async () => {
    await run({ messages: [{ id: "1", role: "user", content: "" }] as never });
    expect(m.append).not.toHaveBeenCalled();
  });
});

describe("runBotStream engine selection", () => {
  it("routes anthropic_direct (anthropic provider) to the direct engine", async () => {
    const res = await run({ bot: bot({ engine: "anthropic_direct", provider: "anthropic" }) });
    expect(res).toEqual({ ok: true, threadId: "thread-1", result: ANTHROPIC_STREAM });
    expect(m.anthropic).toHaveBeenCalledTimes(1);
    expect(m.aiSdk).not.toHaveBeenCalled();
  });

  it("rejects anthropic_direct with a non-anthropic provider as bot_disabled", async () => {
    const res = await run({ bot: bot({ engine: "anthropic_direct", provider: "openai" }) });
    expect(res).toEqual({ ok: false, error: { kind: "bot_disabled" } });
    expect(m.anthropic).not.toHaveBeenCalled();
    expect(m.aiSdk).not.toHaveBeenCalled();
  });

  it("falls back to ai_sdk for the default engine", async () => {
    const res = await run({ bot: bot({ engine: "ai_sdk" }) });
    expect(res.ok).toBe(true);
    expect(m.aiSdk).toHaveBeenCalledTimes(1);
  });
});
