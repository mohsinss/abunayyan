import { expect, test } from "@playwright/test";

// Confirms the CSP + hardening headers added in next.config.mjs actually
// reach the wire. Any regression in the config (a stray quote, a missing
// header) would break here.

test.describe("security headers", () => {
  test("public landing has CSP + frame-options + content-type + referrer", async ({
    request,
  }) => {
    const res = await request.get("/");
    expect(res.ok()).toBe(true);

    const csp = res.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");

    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers()["permissions-policy"]).toContain("camera=()");
  });

  test("Strict-Transport-Security is emitted", async ({ request }) => {
    const res = await request.get("/");
    const hsts = res.headers()["strict-transport-security"];
    expect(hsts).toBeTruthy();
    expect(hsts).toContain("max-age=");
    expect(hsts).toContain("includeSubDomains");
  });

  test("sign-in page also carries the security headers", async ({ request }) => {
    const res = await request.get("/sign-in");
    expect(res.ok()).toBe(true);
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["content-security-policy"]).toBeTruthy();
  });

  test("pricing page carries CSP + security headers (public route)", async ({ request }) => {
    // Secondary sanity check: hardening applies to more than just /.
    const res = await request.get("/pricing");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-security-policy"]).toBeTruthy();
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
