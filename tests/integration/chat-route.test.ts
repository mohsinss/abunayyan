import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import type { Chatbot } from "@/db/schema/chatbots";

// Mock the registry + runtime BEFORE importing the route handler so it
// picks up the mocks.
vi.mock("@/lib/chatbots/registry", () => ({
  getBotBySlug: vi.fn(),
}));
vi.mock("@/lib/chatbots/runtime", () => ({
  runBotStream: vi.fn(),
}));
// Route handler now stamps datasetId by looking up the bot's linked card.
// Stub the reverse lookup so tests don't require a DB.
vi.mock("@/lib/db/queries/datasets", () => ({
  getDatasetByChatbotId: vi.fn(async () => null),
}));

import { getBotBySlug } from "@/lib/chatbots/registry";
import { runBotStream } from "@/lib/chatbots/runtime";
import { handleChatRequest } from "@/lib/chatbots/route-handler";

const authMock = auth as unknown as Mock<() => Promise<Session | null>>;

function session(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: { id: "u1", role: "member", disabled: false, ...overrides },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as Session;
}

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

function req(body: unknown = { messages: [{ role: "user", content: "hi" }] }) {
  return new Request("http://localhost/api/v1/chatbots/test-bot/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("handleChatRequest", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.mocked(getBotBySlug).mockReset();
    vi.mocked(runBotStream).mockReset();
  });

  it("returns 401 when the session is missing", async () => {
    authMock.mockResolvedValueOnce(null);
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(401);
    expect(vi.mocked(getBotBySlug)).not.toHaveBeenCalled();
    expect(vi.mocked(runBotStream)).not.toHaveBeenCalled();
  });

  it("returns 403 when the session user is disabled", async () => {
    authMock.mockResolvedValueOnce(session({ disabled: true }));
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(403);
    expect(vi.mocked(getBotBySlug)).not.toHaveBeenCalled();
  });

  it("returns 404 when the bot doesn't exist", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(null);
    const r = await handleChatRequest(req(), "missing-bot");
    expect(r.status).toBe(404);
    expect(vi.mocked(runBotStream)).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    const badReq = new Request("http://x/api/v1/chatbots/test-bot/chat", {
      method: "POST",
      body: "{ not json",
      headers: { "content-type": "application/json" },
    });
    const r = await handleChatRequest(badReq, "test-bot");
    expect(r.status).toBe(400);
  });

  it("returns 400 on empty messages array", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    const r = await handleChatRequest(req({ messages: [] }), "test-bot");
    expect(r.status).toBe(400);
  });

  it("maps runtime `unauthorized` to HTTP 403", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: false,
      error: { kind: "unauthorized" },
    });
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(403);
  });

  it("maps runtime `rate_limited` to HTTP 429 with headers", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    const reset = Date.now() + 42_000;
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: false,
      error: {
        kind: "rate_limited",
        retryAfterSec: 42,
        limit: 20,
        remaining: 0,
        reset,
      },
    });
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("42");
    expect(r.headers.get("X-RateLimit-Limit")).toBe("20");
    expect(r.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(r.headers.get("X-RateLimit-Reset")).toBe(String(reset));
  });

  it("maps runtime `budget_exceeded` to HTTP 402 with budget headers", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: false,
      error: { kind: "budget_exceeded", capUsd: 5, spentUsd: 5.5 },
    });
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(402);
    expect(r.headers.get("X-Budget-Cap-Usd")).toBe("5");
    expect(r.headers.get("X-Budget-Spent-Usd")).toBe("5.5");
  });

  it("maps runtime `bot_disabled` to HTTP 503", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: false,
      error: { kind: "bot_disabled" },
    });
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(503);
    expect(r.headers.get("Retry-After")).toBe("30");
  });

  it("maps runtime `global_disabled` to HTTP 503", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: false,
      error: { kind: "global_disabled" },
    });
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(503);
  });

  it("passes through the AI SDK stream and attaches X-Thread-Id on success", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    const toDataStreamResponse = vi.fn((opts?: { headers?: Record<string, string> }) => {
      return new Response("streamed-body", {
        status: 200,
        headers: { "content-type": "text/event-stream", ...opts?.headers },
      });
    });
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: true,
      threadId: "thread-abc",
      result: { toDataStreamResponse } as never,
    });
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(200);
    expect(r.headers.get("X-Thread-Id")).toBe("thread-abc");
    expect(toDataStreamResponse).toHaveBeenCalledOnce();
  });

  it("forwards threadId from the request body to runBotStream", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: true,
      threadId: "existing-thread",
      result: {
        toDataStreamResponse: () => new Response("ok", { status: 200 }),
      } as never,
    });
    const uuid = "11111111-1111-1111-1111-111111111111";
    await handleChatRequest(
      req({ messages: [{ role: "user", content: "hi" }], threadId: uuid }),
      "test-bot",
    );
    expect(vi.mocked(runBotStream)).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: uuid }),
    );
  });

  it("returns 500 when runBotStream throws unexpectedly", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockRejectedValueOnce(new Error("boom"));
    const r = await handleChatRequest(req(), "test-bot");
    expect(r.status).toBe(500);
  });

  it("scopes bot lookup by slug", async () => {
    authMock.mockResolvedValueOnce(session());
    vi.mocked(getBotBySlug).mockResolvedValueOnce(null);
    await handleChatRequest(req(), "some-slug");
    expect(vi.mocked(getBotBySlug)).toHaveBeenCalledWith("some-slug");
  });

  it("passes user id+role+disabled from the session to the runtime", async () => {
    authMock.mockResolvedValueOnce(session({ id: "user-x", role: "admin" }));
    vi.mocked(getBotBySlug).mockResolvedValueOnce(bot());
    vi.mocked(runBotStream).mockResolvedValueOnce({
      ok: true,
      threadId: "t",
      result: {
        toDataStreamResponse: () => new Response("ok", { status: 200 }),
      } as never,
    });
    await handleChatRequest(req(), "test-bot");
    expect(vi.mocked(runBotStream)).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: "user-x", role: "admin", disabled: false },
      }),
    );
  });
});
