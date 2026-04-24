# E2E tests (Playwright)

## What runs today

Three suites, all unauthenticated — safe to run in any environment:

- **`smoke.spec.ts`** — public pages render + health endpoint.
- **`middleware.spec.ts`** — every protected route redirects / rejects
  without a session; covers the pages AND the API boundaries (chat, admin).
- **`security-headers.spec.ts`** — CSP, X-Frame-Options, HSTS,
  Referrer-Policy, Permissions-Policy reach the wire.
- **`sign-in-page.spec.ts`** — sign-in page renders, callbackUrl preserved
  when bounced from protected routes (including nested paths like
  `/admin/chatbots`).

Run:

```bash
pnpm test:e2e           # headless
pnpm test:e2e:headed    # with a visible browser
pnpm test:e2e:ui        # Playwright UI mode
```

The config uses **port 3005 by default** so `pnpm dev` on 3000 doesn't
clash. Override with `E2E_PORT=3010 pnpm test:e2e`.

## What's deferred: authenticated journeys

The full critical-path E2Es below all require an authenticated session.
They're queued for the next session once we add a test-auth fixture
(either session-cookie injection from a seeded user row, or the Auth.js
"Credentials" provider gated to `NODE_ENV !== 'production'`).

Once the fixture lands, these tests go in `tests/e2e/authenticated/`:

1. **Chat + persistence.** Sign in → send "hello" to `atlas-analyst` →
   wait for the stream to finish → refresh the page → the message is
   still there. Confirms thread + message rows persist and the rehydrate
   path works.

2. **Admin creates a bot via UI.** Sign in as admin → `/admin/chatbots/new`
   → fill provider, model, prompt, tools → submit → land on edit page
   → use the "Test" button → response comes back.

3. **Admin changes a user's role.** Sign in as admin → `/admin/users/[id]`
   → change role dropdown → save → navigate to `/admin/audit` → the
   `user.role_changed` event is visible.

4. **Admin views another user's conversation.** Sign in as admin → click
   a thread in `/admin/users/[id]` → read-only conversation viewer
   renders token/cost metadata per turn.

5. **Prompt rollback.** Edit prompt (creates v2) → click Restore on v1
   → prompt reverts (shows up as v3 forward) → `bot.prompt_updated`
   audited twice.

6. **Kill switch blocks chat.** Sign in as admin → `/admin` → click
   "Emergency stop" → send a chat from another tab → 503 → toggle back.

7. **Rate limit 429.** Seed a test bot with `rateLimitTokens: 2` /
   `rateLimitWindow: 1 m` → fire 3 requests → third returns 429 with
   `Retry-After`.

8. **Non-admin cannot access /admin.** Member-role user → `/admin` →
   redirect to `/dashboard?error=forbidden`.

## Auth fixture plan (for the next session)

The cleanest fixture approach is Playwright's
[`storageState`](https://playwright.dev/docs/auth):

```ts
// global-setup.ts
import { chromium } from "@playwright/test";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";

export default async function globalSetup() {
  // Insert a test admin user + an active DB session row directly.
  const userId = "e2e-admin";
  const token = crypto.randomUUID();
  await db.insert(users).values({ id: userId, email: "e2e-admin@test", role: "owner", disabled: false }).onConflictDoNothing();
  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires: new Date(Date.now() + 3600_000),
  });
  // Bake the session cookie into storageState.
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies([{
    name: "authjs.session-token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
  }]);
  await ctx.storageState({ path: "tests/e2e/.auth/admin.json" });
  await browser.close();
}
```

Reference this file from `playwright.config.ts` with
`use.storageState: "tests/e2e/.auth/admin.json"` (per-project, so we can
have `member` + `admin` + `anonymous` contexts running in parallel).

Teardown wipes the `sessions` row.

## CI

Unauthenticated E2Es can run in the existing GitHub Actions pipeline
after the `build` job. Authenticated E2Es need a test Postgres + Redis
(cheap: Neon branch + Upstash free tier) — add as an optional nightly
job rather than per-PR.
