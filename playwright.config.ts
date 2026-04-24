import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// E2E defaults to 3000. If you have a dev server already running on
// 3000, override with `E2E_PORT=3005 pnpm test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(HERE, "tests/e2e/.auth");
const ADMIN_STATE = path.join(AUTH_DIR, "admin.json");
const MEMBER_STATE = path.join(AUTH_DIR, "member.json");

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
  projects: [
    // ─── Public surface: no auth, no DB touch ─────────────────────────
    // These run in every CI pipeline with placeholder env.
    {
      name: "public",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/\/authenticated\//, /auth\.setup\.ts$/],
    },

    // ─── Auth fixture: seeds users + sessions, bakes storageState ─────
    {
      name: "setup-auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.setup\.ts$/,
    },

    // ─── Authenticated journeys (owner/admin) ─────────────────────────
    {
      name: "authenticated:admin",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
      testMatch: /authenticated\/admin\/.*\.spec\.ts/,
      dependencies: ["setup-auth"],
    },

    // ─── Authenticated journeys (member role) ─────────────────────────
    {
      name: "authenticated:member",
      use: { ...devices["Desktop Chrome"], storageState: MEMBER_STATE },
      testMatch: /authenticated\/member\/.*\.spec\.ts/,
      dependencies: ["setup-auth"],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: "development",
    },
  },
});
