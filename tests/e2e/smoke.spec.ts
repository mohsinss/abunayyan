import { expect, test } from "@playwright/test";

// Thin public-surface smoke. Uses the `request` context so it runs
// without a browser (faster CI + no extra install).

test("landing returns 200 and contains an h1", async ({ request }) => {
  const res = await request.get("/");
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body).toMatch(/<h1[^>]*>/i);
});

test("pricing page returns 200", async ({ request }) => {
  const res = await request.get("/pricing");
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body.toLowerCase()).toContain("pricing");
});

test("health endpoint responds ok", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  expect(res.ok()).toBe(true);
  const json = (await res.json()) as { status: string };
  expect(json.status).toBe("ok");
});
