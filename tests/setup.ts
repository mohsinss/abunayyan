import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("SKIP_ENV_VALIDATION", "1");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock("server-only", () => ({}));

// `@/lib/env` uses @t3-oss/env-nextjs which snapshots process.env at module
// load, so vi.stubEnv inside a test wouldn't flow through. Replace it with a
// Proxy that reads process.env lazily on every access — that way stubEnv
// updates are visible to the code under test.
vi.mock("@/lib/env", () => ({
  env: new Proxy({} as Record<string, string | undefined>, {
    get(_t, key: string) {
      const v = process.env[key];
      return v === "" ? undefined : v;
    },
  }),
}));

// next-auth v5 pulls in edge-runtime-only modules that can't resolve in
// vitest's Node/jsdom environment. We don't exercise the real auth surface
// in unit tests — every guard that reads the session is tested by mocking
// `auth()` directly in the test file.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(null)),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));
