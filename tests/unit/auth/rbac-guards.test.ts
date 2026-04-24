import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  requireAdminApi,
  requireRole,
  requireRoleOrRespond,
  requireUser,
} from "@/lib/auth/rbac";

// next-auth v5 `auth` is overloaded (middleware vs. session fetch). In
// tests we only use the zero-arg session-fetch form — cast once to a simple
// Mock so every .mockResolvedValueOnce(...) below type-checks cleanly.
const authMock = auth as unknown as Mock<() => Promise<Session | null>>;

// `redirect` throws in Next.js server contexts. We simulate that here so
// tests can assert the attempted destination without stubbing the whole
// navigation module.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

// Override the global @/lib/ratelimit mock for this file so we can control
// admin limiter outcomes per test.
vi.mock("@/lib/ratelimit", () => {
  const makeOk = () =>
    Promise.resolve({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 });
  const makeDenied = () =>
    Promise.resolve({ success: false, limit: 100, remaining: 0, reset: Date.now() + 30_000 });
  return {
    ratelimit: {
      admin: { limit: vi.fn(makeOk) },
      adminMutations: { limit: vi.fn(makeOk) },
      api: { limit: vi.fn(makeOk) },
      ai: { limit: vi.fn(makeOk) },
      auth: { limit: vi.fn(makeOk) },
      public: { limit: vi.fn(makeOk) },
    },
    // exposed for tests to flip a bucket to denied
    __makeDenied: makeDenied,
  };
});

function session(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      id: "u1",
      role: "member",
      disabled: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as Session;
}

describe("requireUser", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects to /sign-in when there is no session", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("redirects to sign-in with AccountDisabled when the user is disabled", async () => {
    authMock.mockResolvedValueOnce(session({ disabled: true }));
    await expect(requireUser()).rejects.toThrow(/REDIRECT:\/sign-in\?error=AccountDisabled/);
  });

  it("returns the user for a valid session", async () => {
    authMock.mockResolvedValueOnce(session({ role: "admin" }));
    const user = await requireUser();
    expect(user.role).toBe("admin");
    expect(user.id).toBe("u1");
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("redirects to /dashboard?error=forbidden when role is too low", async () => {
    authMock.mockResolvedValueOnce(session({ role: "member" }));
    await expect(requireRole("admin")).rejects.toThrow(/REDIRECT:\/dashboard\?error=forbidden/);
  });

  it("returns the user when role is sufficient", async () => {
    authMock.mockResolvedValueOnce(session({ role: "admin" }));
    const user = await requireRole("admin");
    expect(user.role).toBe("admin");
  });

  it("accepts a higher role", async () => {
    authMock.mockResolvedValueOnce(session({ role: "owner" }));
    const user = await requireRole("admin");
    expect(user.role).toBe("owner");
  });
});

describe("requireRoleOrRespond", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns 401 when there's no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const r = await requireRoleOrRespond("member");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("returns 403 when the session user is disabled", async () => {
    authMock.mockResolvedValueOnce(session({ role: "admin", disabled: true }));
    const r = await requireRoleOrRespond("admin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("returns 403 when role rank is below the minimum", async () => {
    authMock.mockResolvedValueOnce(session({ role: "member" }));
    const r = await requireRoleOrRespond("admin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("returns ok + user when the role matches", async () => {
    authMock.mockResolvedValueOnce(session({ role: "admin" }));
    const r = await requireRoleOrRespond("admin");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.role).toBe("admin");
  });

  it("lets a higher role satisfy a lower requirement", async () => {
    authMock.mockResolvedValueOnce(session({ role: "owner" }));
    const r = await requireRoleOrRespond("member");
    expect(r.ok).toBe(true);
  });
});

describe("requireAdminApi", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns 401 when there's no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const r = await requireAdminApi(new Request("http://x/api/v1/admin/users"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    authMock.mockResolvedValueOnce(session({ role: "member" }));
    const r = await requireAdminApi(new Request("http://x/api/v1/admin/users"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("returns ok for an admin GET under the limit", async () => {
    authMock.mockResolvedValueOnce(session({ role: "admin" }));
    const r = await requireAdminApi(new Request("http://x/api/v1/admin/users"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.role).toBe("admin");
  });

  it("uses the stricter mutation bucket for PATCH", async () => {
    // Prove we dispatched to `adminMutations` by routing its mock to denied
    // for this call.
    const ratelimitMod = await import("@/lib/ratelimit");
    const deniedOnce = () =>
      Promise.resolve({ success: false, limit: 20, remaining: 0, reset: Date.now() + 30_000 });
    vi.mocked(ratelimitMod.ratelimit.adminMutations.limit).mockImplementationOnce(deniedOnce);

    authMock.mockResolvedValueOnce(session({ role: "admin" }));
    const r = await requireAdminApi(
      new Request("http://x/api/v1/admin/chatbots", { method: "PATCH" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(429);
      expect(r.response.headers.get("Retry-After")).toBeTruthy();
      expect(r.response.headers.get("X-RateLimit-Limit")).toBe("20");
    }
  });

  it("returns 429 when the read bucket is exhausted on GET", async () => {
    const ratelimitMod = await import("@/lib/ratelimit");
    vi.mocked(ratelimitMod.ratelimit.admin.limit).mockImplementationOnce(() =>
      Promise.resolve({ success: false, limit: 100, remaining: 0, reset: Date.now() + 30_000 }),
    );
    authMock.mockResolvedValueOnce(session({ role: "admin" }));
    const r = await requireAdminApi(new Request("http://x/api/v1/admin/users"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(429);
  });
});
