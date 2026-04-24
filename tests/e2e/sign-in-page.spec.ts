import { expect, test } from "@playwright/test";

test.describe("sign-in page", () => {
  test("renders (200 OK)", async ({ request }) => {
    const res = await request.get("/sign-in");
    expect(res.ok()).toBe(true);
    const body = await res.text();
    // Auth.js default sign-in lists provider names ("Google"); our custom
    // page (if any) keeps the phrase "sign in" somewhere recognizable.
    expect(body.toLowerCase()).toMatch(/sign[ -]?in|google/);
  });

  test("carries callbackUrl through redirect from /dashboard", async ({ request }) => {
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    const loc = res.headers()["location"];
    expect(loc).toBeTruthy();
    expect(loc).toContain("/sign-in");
    expect(loc).toContain("callbackUrl=%2Fdashboard");
  });

  test("carries nested callbackUrl from /admin/chatbots", async ({ request }) => {
    const res = await request.get("/admin/chatbots", { maxRedirects: 0 });
    const loc = res.headers()["location"];
    expect(loc).toBeTruthy();
    expect(loc).toContain("/sign-in");
    expect(loc).toContain("callbackUrl=%2Fadmin%2Fchatbots");
  });
});
