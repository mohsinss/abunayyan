# 10 — Testing (Vitest + Playwright + MSW)

**Phase:** 3 · **Depends on:** all prior · **P1**

Swaps Jest for Vitest (faster, ESM-native), adds Playwright for E2E, and wires MSW for API mocking. Real tests from day 1; no "placeholder" scaffolding.

## Goal

- `pnpm test` — unit + integration, <5 s for the default set.
- `pnpm test:e2e` — Playwright headless Chromium against a dev server.
- MSW for mocking outbound HTTP (Stripe, Anthropic, Resend) in tests.
- Coverage threshold gate: ≥70% on `lib/`.
- Run on CI (doc 11).

## Stack

- **[Vitest](https://vitest.dev)** — unit / integration test runner, Vite-fast, Jest-compatible API.
- **[@testing-library/react](https://testing-library.com/)** — component tests.
- **[Playwright](https://playwright.dev)** — E2E.
- **[MSW](https://mswjs.io)** — HTTP mocking.

## Steps — Vitest

### 1. Install

```bash
pnpm add -D vitest @vitejs/plugin-react @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  jsdom msw

pnpm remove jest ts-jest jest-environment-jsdom @types/jest
```

### 2. Config

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**", "app/**/route.ts"],
      thresholds: { lines: 70, branches: 70, functions: 70, statements: 70 },
    },
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}", "lib/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

### 3. Test setup

```ts
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

// Default env for tests
process.env.NODE_ENV = "test";
process.env.SKIP_ENV_VALIDATION = "1";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock("server-only", () => ({}));
```

### 4. MSW handlers

```ts
// tests/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("https://api.stripe.com/v1/checkout/sessions", () =>
    HttpResponse.json({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }),
  ),
  http.post("https://api.resend.com/emails", () =>
    HttpResponse.json({ id: "re_test_123" }),
  ),
  http.post("https://api.anthropic.com/v1/messages", () =>
    HttpResponse.json({
      id: "msg_test",
      role: "assistant",
      content: [{ type: "text", text: "Mocked response" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  ),
];
```

```ts
// tests/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

### 5. Example tests

```ts
// lib/validation/schemas.test.ts
import { describe, it, expect } from "vitest";
import { createProjectSchema } from "./schemas";

describe("createProjectSchema", () => {
  it("accepts a valid project", () => {
    const r = createProjectSchema.safeParse({
      name: "Acme",
      description: "x".repeat(20),
      budget: 5000,
      timeline: "Q2",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative budget", () => {
    const r = createProjectSchema.safeParse({ name: "X", description: "y", budget: -1, timeline: "Q1" });
    expect(r.success).toBe(false);
  });
});
```

```tsx
// components/forms/create-project-form.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectForm } from "./create-project-form";

describe("<CreateProjectForm />", () => {
  it("shows validation error for empty name", async () => {
    const user = userEvent.setup();
    render(<CreateProjectForm />);
    await user.click(screen.getByRole("button", { name: /create/i }));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });
});
```

### 6. Package scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### 7. Delete Jest artifacts

```bash
rm -f jest.config.mjs jest.setup.js
rg "jest\.(mock|fn|spyOn)|describe\(|it\(" --type ts --type tsx  # audit; most migrate 1:1
```

## Steps — Playwright

### 1. Install

```bash
pnpm dlx create-playwright@latest --quiet --install-deps --browser=chromium tests/e2e
```

This generates:
- `playwright.config.ts`
- `tests/e2e/example.spec.ts`

### 2. Config

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### 3. Authenticated tests

Clerk supports testing mode. Set up a test user:

```ts
// tests/e2e/helpers/auth.ts
import { clerkSetup } from "@clerk/testing/playwright";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  await clerkSetup();
}
```

Reference in `playwright.config.ts`: `globalSetup: "./tests/e2e/helpers/auth.ts"`.

In tests:

```ts
// tests/e2e/chat.spec.ts
import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

test("authenticated chat streams a response", async ({ page }) => {
  await page.goto("/");
  await clerk.signIn({ page, signInParams: { strategy: "password", identifier: "test@example.com", password: "TestPass123!" } });
  await page.goto("/chat");
  await page.getByPlaceholder(/ask anything/i).fill("Say hi");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/mocked response|hi/i)).toBeVisible({ timeout: 15_000 });
});
```

Install: `pnpm add -D @clerk/testing`.

### 4. Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

## What to test, what to skip

| Test | How | Priority |
|------|-----|----------|
| Zod schemas | Vitest | Must |
| Drizzle queries (via test DB) | Vitest | Must (with a Neon branch or local pg) |
| API route handlers (with MSW) | Vitest | Must |
| Service-layer logic | Vitest | Must |
| React forms (submit + validation) | Vitest + RTL | Should |
| Visual regressions | — | Skip (use Percy later if you care) |
| Auth flow end-to-end | Playwright | Must |
| Chat streaming | Playwright | Must |
| Checkout happy path | Playwright (Stripe test mode) | Must |
| 100% UI coverage | — | Skip; diminishing returns |

## Test DB strategy

For Drizzle tests against real Postgres:

1. Create a Neon branch: `pnpm dlx neonctl branches create --name test`.
2. Pass its connection string via `DATABASE_URL` in CI.
3. Reset the branch between runs (or drop+recreate schemas).

For faster local iteration, use `docker-compose up postgres` (doc 11) with `pgvector` extension.

## Verification checklist

- [ ] `pnpm test` runs and passes green.
- [ ] `pnpm test:coverage` shows ≥70% line coverage on `lib/`.
- [ ] `pnpm test:e2e` boots the dev server and runs a headless chat test successfully.
- [ ] MSW catches a deliberate unmocked HTTP call (`onUnhandledRequest: "error"`).
- [ ] `rg "from ['\"]jest['\"]"` returns zero.

## Gotchas

- **Vitest + MSW + Node native fetch**: make sure `msw >= 2.x` for native fetch support.
- **Playwright + Next.js dev server** is slow on cold start; `reuseExistingServer: !process.env.CI` makes local runs fast.
- **Clerk test mode rate limits.** Use one persistent test user across tests; don't create a new one each run.
- **Flaky streaming tests.** Always assert with a generous `timeout` — tokens stream in over seconds.
- **Don't mock Clerk in Playwright** — use `@clerk/testing`. Mocks in Vitest (`vi.mock("@clerk/nextjs/server", …)`) are fine for unit tests.
