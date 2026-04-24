import { expect, test } from "@playwright/test";

// Middleware contract — unauthenticated callers cannot slip past guards.
// These tests use the `request` context (no browser) so they run in any
// CI env without needing a Chromium install. Authenticated journeys live
// in `authenticated.spec.ts` (deferred — see tests/e2e/README.md).

test.describe("middleware: unauthenticated access", () => {
  test("GET /dashboard redirects to /sign-in with callbackUrl", async ({ request }) => {
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    // Next.js issues a 307 (or 302) redirect via middleware.
    expect([302, 307, 308]).toContain(res.status());
    const loc = res.headers()["location"];
    expect(loc).toBeTruthy();
    expect(loc).toContain("/sign-in");
    expect(loc).toContain("callbackUrl=%2Fdashboard");
  });

  test("GET /chat redirects to /sign-in", async ({ request }) => {
    const res = await request.get("/chat", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/sign-in");
  });

  test("GET /billing redirects to /sign-in", async ({ request }) => {
    const res = await request.get("/billing", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/sign-in");
  });

  test("GET /admin redirects to /sign-in (auth check runs before admin check)", async ({
    request,
  }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/sign-in");
  });

  test("GET /admin/users preserves nested callbackUrl", async ({ request }) => {
    const res = await request.get("/admin/users", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    const loc = res.headers()["location"] ?? "";
    expect(loc).toContain("/sign-in");
    expect(loc).toContain("callbackUrl=%2Fadmin%2Fusers");
  });

  test("POST /api/v1/chatbots/atlas-analyst/chat returns 401", async ({ request }) => {
    const res = await request.post("/api/v1/chatbots/atlas-analyst/chat", {
      data: { messages: [{ role: "user", content: "hi" }] },
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/chatbots/atlas-analyst/threads returns 401", async ({ request }) => {
    const res = await request.get("/api/v1/chatbots/atlas-analyst/threads", {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/v1/admin/users returns 401 or 403", async ({ request }) => {
    // 401 without session; 403 if the middleware admin check fires first.
    // Either is a correct reject.
    const res = await request.get("/api/v1/admin/users", { failOnStatusCode: false });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/v1/admin/chatbots returns 401 or 403 without a session", async ({
    request,
  }) => {
    const res = await request.post("/api/v1/admin/chatbots", {
      data: {},
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/v1/admin/settings/kill-switch rejects without admin session", async ({
    request,
  }) => {
    const res = await request.post("/api/v1/admin/settings/kill-switch", {
      data: { enabled: true },
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });
});
