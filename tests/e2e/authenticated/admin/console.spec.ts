import { expect, test } from "@playwright/test";

// Admin/owner-authenticated journeys. storageState is loaded from
// tests/e2e/.auth/admin.json (written by auth.setup.ts). `request` fixture
// inherits cookies from the project's storageState so every call below
// is authenticated as our seeded E2E owner.

test.describe("admin console pages", () => {
  test("GET /admin returns 200 with overview content", async ({ request }) => {
    const res = await request.get("/admin");
    expect(res.status()).toBe(200);
    const html = await res.text();
    // Sever-rendered HTML must include the page heading + KPI labels.
    expect(html).toMatch(/Overview/);
    expect(html.toLowerCase()).toContain("total users");
    expect(html.toLowerCase()).toContain("chatbots");
    expect(html.toLowerCase()).toContain("spend");
  });

  test("GET /admin/users renders the filter form + list", async ({ request }) => {
    const res = await request.get("/admin/users?q=e2e-playwright-admin");
    expect(res.status()).toBe(200);
    const html = await res.text();
    // Our seeded admin's email must appear in the filtered list.
    expect(html).toContain("e2e-playwright-admin@test.local");
  });

  test("GET /admin/chatbots renders list + new-bot link", async ({ request }) => {
    const res = await request.get("/admin/chatbots");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("chatbots");
    expect(html.toLowerCase()).toContain("new chatbot");
  });

  test("GET /admin/audit renders feed + CSV export link", async ({ request }) => {
    const res = await request.get("/admin/audit");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("audit log");
    expect(html).toContain("/api/v1/admin/audit/export");
  });

  test("GET /admin/settings renders kill-switch and defaults form", async ({
    request,
  }) => {
    const res = await request.get("/admin/settings");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("platform settings");
    expect(html.toLowerCase()).toContain("kill switch");
    expect(html.toLowerCase()).toContain("defaults for new bots");
  });
});

test.describe("admin API (authenticated)", () => {
  test("GET /api/v1/admin/users returns the seeded admin", async ({ request }) => {
    const res = await request.get("/api/v1/admin/users?q=e2e-playwright-admin");
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { users: Array<{ email: string | null }> };
    expect(
      body.users.some((u) => u.email === "e2e-playwright-admin@test.local"),
    ).toBe(true);
  });

  test("GET /api/v1/admin/chatbots returns JSON array", async ({ request }) => {
    const res = await request.get("/api/v1/admin/chatbots");
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { chatbots: unknown[] };
    expect(Array.isArray(body.chatbots)).toBe(true);
  });

  test("GET /api/v1/admin/audit returns the entries feed", async ({ request }) => {
    const res = await request.get("/api/v1/admin/audit?limit=5");
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { entries: unknown[] };
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test("GET /api/v1/admin/audit/export streams CSV with header row", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/admin/audit/export");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain("attachment");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe(
      "created_at,event,actor_id,target_user_id,bot_id,thread_id,ip_address,user_agent,payload",
    );
  });

  test("GET /api/v1/admin/settings returns the singleton", async ({ request }) => {
    const res = await request.get("/api/v1/admin/settings");
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as {
      settings: { brandName: string; globalChatDisabled: boolean };
    };
    expect(body.settings).toBeDefined();
    expect(typeof body.settings.globalChatDisabled).toBe("boolean");
  });
});
