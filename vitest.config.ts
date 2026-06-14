import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Coverage scope — starts narrow. Every file listed in `include` has real
// unit tests that exercise it meaningfully (≥80%). Expand this list as we
// add tests for the remaining platform modules (registry, runtime, persistence,
// prompts, audit, rate-limit — all need DB/Redis integration fixtures first).
// See docs/platform/14-testing-strategy.md for the full coverage roadmap.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: [
        "lib/auth/rbac.ts",
        "lib/chatbots/cost.ts",
        "lib/chatbots/authz.ts",
        "lib/chatbots/providers.ts",
        "lib/chatbots/audit.ts",
        "lib/chatbots/persistence.ts",
        "lib/chatbots/prompts.ts",
        "lib/chatbots/rate-limit.ts",
        "lib/chatbots/registry.ts",
        "lib/chatbots/route-handler.ts",
        "lib/chatbots/runtime.ts",
        "lib/validation/chatbot.ts",
        "lib/validation/schemas.ts",
        "lib/text/diff.ts",
        "lib/text/csv.ts",
      ],
      thresholds: {
        lines: 85,
        branches: 75,
        functions: 85,
        statements: 85,
      },
    },
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
      "lib/**/*.{test,spec}.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
