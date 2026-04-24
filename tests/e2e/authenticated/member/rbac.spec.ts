import { expect, test } from "@playwright/test";

// Member-authenticated journeys. storageState loaded from
// tests/e2e/.auth/member.json.

test.describe("member cannot access admin surfaces", () => {
  test("GET /admin → 307 → /dashboard?error=forbidden", async ({ request }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    const loc = res.headers()["location"] ?? "";
    expect(loc).toContain("/dashboard");
    expect(loc).toContain("error=forbidden");
  });

  test("GET /admin/chatbots redirects too", async ({ request }) => {
    const res = await request.get("/admin/chatbots", { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    const loc = res.headers()["location"] ?? "";
    expect(loc).toContain("/dashboard");
    expect(loc).toContain("error=forbidden");
  });

  test("GET /api/v1/admin/users returns 403", async ({ request }) => {
    const res = await request.get("/api/v1/admin/users", { failOnStatusCode: false });
    expect(res.status()).toBe(403);
  });

  test("POST /api/v1/admin/chatbots returns 403", async ({ request }) => {
    const res = await request.post("/api/v1/admin/chatbots", {
      data: {},
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });

  test("POST /api/v1/admin/settings/kill-switch returns 403", async ({ request }) => {
    const res = await request.post("/api/v1/admin/settings/kill-switch", {
      data: { enabled: true },
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("member can access their own surfaces", () => {
  test("GET /dashboard returns 200", async ({ request }) => {
    const res = await request.get("/dashboard");
    expect(res.status()).toBe(200);
  });

  test("GET /chat renders the launcher + recent list", async ({ request }) => {
    const res = await request.get("/chat");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("your chats");
    expect(html.toLowerCase()).toContain("start a new chat");
  });

  test("GET /api/v1/chatbots/atlas-analyst/threads returns own threads", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/chatbots/atlas-analyst/threads");
    // 404 if the atlas-analyst slug isn't seeded, 200 if it is.
    expect([200, 404]).toContain(res.status());
    if (res.ok()) {
      const body = (await res.json()) as { threads: unknown[] };
      expect(Array.isArray(body.threads)).toBe(true);
    }
  });
});
