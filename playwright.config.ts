import { defineConfig, devices } from "@playwright/test";

// E2E defaults to 3000. If you have a dev server already running on
// 3000, override with `E2E_PORT=3005 pnpm test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // E2E runs against the real Next build but with non-destructive defaults.
      NODE_ENV: "development",
    },
  },
});
