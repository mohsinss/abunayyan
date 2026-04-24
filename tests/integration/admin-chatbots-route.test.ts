import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

// Always-allow ratelimit for this file so we can test the admin logic in
// isolation. The guard's 429 branch is covered in tests/unit/auth/rbac-guards.
vi.mock("@/lib/ratelimit", () => {
  const ok = () =>
    Promise.resolve({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 });
  return {
    ratelimit: {
      admin: { limit: vi.fn(ok) },
      adminMutations: { limit: vi.fn(ok) },
      api: { limit: vi.fn(ok) },
      ai: { limit: vi.fn(ok) },
      auth: { limit: vi.fn(ok) },
      public: { limit: vi.fn(ok) },
    },
  };
});

vi.mock("@/lib/chatbots/registry", () => ({
  listBots: vi.fn(),
  getBotBySlug: vi.fn(),
  getBotById: vi.fn(),
  listEnabledBotsForRole: vi.fn(),
}));
vi.mock("@/lib/chatbots/admin-queries", () => ({
  createChatbot: vi.fn(),
  updateChatbot: vi.fn(),
  softDeleteChatbot: vi.fn(),
}));
vi.mock("@/lib/chatbots/audit", () => ({
  writeAudit: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/chatbots/providers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/chatbots/providers")>(
      "@/lib/chatbots/providers",
    );
  return {
    ...actual,
    resolveModel: vi.fn(() => ({ modelId: "fake" })),
  };
});

import { listBots } from "@/lib/chatbots/registry";
import { createChatbot } from "@/lib/chatbots/admin-queries";
import {
  ProviderNotConfiguredError,
  UnsupportedModelError,
  resolveModel,
} from "@/lib/chatbots/providers";
import { GET, POST } from "@/app/api/v1/admin/chatbots/route";

const authMock = auth as unknown as Mock<() => Promise<Session | null>>;

function admin(id = "admin-1"): Session {
  return {
    user: { id, role: "admin", disabled: false },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as Session;
}
function member(id = "member-1"): Session {
  return {
    user: { id, role: "member", disabled: false },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as Session;
}

const VALID_BODY = {
  slug: "cs-triage",
  name: "Customer Support Triage",
  provider: "anthropic",
  modelId: "claude-sonnet-4-6",
  temperature: 0.3,
  maxSteps: 3,
  systemPrompt: "You are the triage assistant.",
  tools: ["renderChart"],
  allowedRoles: [],
  rateLimitTokens: 20,
  rateLimitWindow: "1 h",
  dailyCostCapUsd: 0,
  enabled: true,
};

function jsonReq(body: unknown, method: "GET" | "POST" = "POST"): Request {
  return new Request("http://localhost/api/v1/admin/chatbots", {
    method,
    body: method === "GET" ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/v1/admin/chatbots", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.mocked(listBots).mockReset();
  });

  it("401 without session", async () => {
    authMock.mockResolvedValueOnce(null);
    const r = await GET(new Request("http://x/api/v1/admin/chatbots"));
    expect(r.status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    authMock.mockResolvedValueOnce(member());
    const r = await GET(new Request("http://x/api/v1/admin/chatbots"));
    expect(r.status).toBe(403);
  });

  it("200 + chatbots list for an admin", async () => {
    authMock.mockResolvedValueOnce(admin());
    vi.mocked(listBots).mockResolvedValueOnce([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: "b1", slug: "atlas" } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: "b2", slug: "general" } as any,
    ]);
    const r = await GET(new Request("http://x/api/v1/admin/chatbots"));
    expect(r.status).toBe(200);
    const body = (await r.json()) as { chatbots: { slug: string }[] };
    expect(body.chatbots.map((b) => b.slug)).toEqual(["atlas", "general"]);
  });
});

describe("POST /api/v1/admin/chatbots", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.mocked(createChatbot).mockReset();
    vi.mocked(resolveModel).mockReset();
    vi.mocked(resolveModel).mockImplementation(() => ({ modelId: "fake" }) as never);
  });

  it("401 without session", async () => {
    authMock.mockResolvedValueOnce(null);
    const r = await POST(jsonReq(VALID_BODY));
    expect(r.status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    authMock.mockResolvedValueOnce(member());
    const r = await POST(jsonReq(VALID_BODY));
    expect(r.status).toBe(403);
  });

  it("400 on malformed JSON body", async () => {
    authMock.mockResolvedValueOnce(admin());
    const badReq = new Request("http://x/api/v1/admin/chatbots", {
      method: "POST",
      body: "{ not json",
      headers: { "content-type": "application/json" },
    });
    const r = await POST(badReq);
    expect(r.status).toBe(400);
  });

  it("400 VALIDATION_FAILED on bad slug", async () => {
    authMock.mockResolvedValueOnce(admin());
    const r = await POST(jsonReq({ ...VALID_BODY, slug: "BAD SLUG" }));
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: string; fields: Record<string, unknown> };
    expect(body.error).toBe("VALIDATION_FAILED");
    expect(body.fields.slug).toBeDefined();
  });

  it("422 PROVIDER_NOT_CONFIGURED when the provider API key is missing", async () => {
    authMock.mockResolvedValueOnce(admin());
    vi.mocked(resolveModel).mockImplementationOnce(() => {
      throw new ProviderNotConfiguredError("anthropic");
    });
    const r = await POST(jsonReq(VALID_BODY));
    expect(r.status).toBe(422);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("422 UNSUPPORTED_MODEL when model doesn't belong to provider", async () => {
    authMock.mockResolvedValueOnce(admin());
    vi.mocked(resolveModel).mockImplementationOnce(() => {
      throw new UnsupportedModelError("anthropic", "gpt-4o");
    });
    const r = await POST(jsonReq(VALID_BODY));
    expect(r.status).toBe(422);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("UNSUPPORTED_MODEL");
  });

  it("409 CONFLICT on unique-slug collision", async () => {
    authMock.mockResolvedValueOnce(admin());
    vi.mocked(createChatbot).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "chatbots_slug_unique"'),
    );
    const r = await POST(jsonReq(VALID_BODY));
    expect(r.status).toBe(409);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("CONFLICT");
  });

  it("201 with the created chatbot on happy path", async () => {
    authMock.mockResolvedValueOnce(admin("me-1"));
    vi.mocked(createChatbot).mockResolvedValueOnce({
      id: "bot-created",
      slug: "cs-triage",
      name: "Customer Support Triage",
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const r = await POST(jsonReq(VALID_BODY));
    expect(r.status).toBe(201);
    const body = (await r.json()) as { chatbot: { id: string; slug: string } };
    expect(body.chatbot.id).toBe("bot-created");
    expect(body.chatbot.slug).toBe("cs-triage");

    // Confirm the admin's id was stamped on createdBy and passed as actor.
    expect(vi.mocked(createChatbot)).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "me-1" }),
      "me-1",
    );
  });
});
