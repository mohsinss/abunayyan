# E2E tests (Playwright)

## Suite layout

```
tests/e2e/
├─ smoke.spec.ts                        public  → landing, pricing, health
├─ middleware.spec.ts                   public  → redirects, API 401s
├─ security-headers.spec.ts             public  → CSP, HSTS, frame-options
├─ sign-in-page.spec.ts                 public  → sign-in page + callbackUrl
├─ auth.setup.ts                        setup   → seeds DB users + writes storageState
└─ authenticated/
   ├─ admin/
   │  └─ console.spec.ts                admin   → admin UI + admin API
   └─ member/
      └─ rbac.spec.ts                   member  → admin rejected, own surfaces ok
```

## Projects

Playwright's project system separates CI-safe tests from DB-requiring tests:

| Project | storageState | DB needed | Scripts |
|---------|--------------|-----------|---------|
| `public` | none | no | `pnpm test:e2e` |
| `setup-auth` | writes `.auth/admin.json` + `.auth/member.json` | yes | implicit |
| `authenticated:admin` | `.auth/admin.json` | yes | `pnpm test:e2e:authenticated` |
| `authenticated:member` | `.auth/member.json` | yes | `pnpm test:e2e:authenticated` |

Run everything locally:

```bash
pnpm test:e2e:all         # all projects — needs .env.local
pnpm test:e2e             # public only — no env needed
pnpm test:e2e:authenticated   # setup-auth + authenticated:* only
pnpm test:e2e:headed      # any project, with a browser window
pnpm test:e2e:ui          # Playwright UI mode
```

Port defaults to 3000; override with `E2E_PORT=3005` if it's taken.

## No browser required

All tests use Playwright's `request` context (HTTP only) — no Chromium
needed. The `auth.setup.ts` file writes `storageState` JSON directly via
`fs.writeFileSync` after seeding a user + session row in Postgres,
skipping the "launch browser and `addCookies`" step. This keeps CI
lightweight and the suite fast (~10 s for all 40 tests).

## Authenticated-E2E contract

The setup project (`auth.setup.ts`) is the heart of the authenticated
flow:

1. **Upsert** a deterministic test user (`e2e-playwright-admin` or
   `e2e-playwright-member`) with the right role.
2. **Issue** a fresh session row, deleting prior sessions for the user
   so the table doesn't grow.
3. **Write** `tests/e2e/.auth/{admin,member}.json` with a single
   `authjs.session-token` cookie that the test project picks up via
   `use.storageState`.

Every authenticated test then operates through the session cookie as
though a real user signed in via OAuth. The `request` fixture
automatically inherits cookies from the project's storageState.

## Running against a fresh DB

If you point `.env.local` at a new Neon branch, migrations must be
applied first:

```bash
pnpm db:migrate                  # applies pending Drizzle migrations
pnpm test:e2e:authenticated      # seeds + runs authenticated suite
```

The setup will throw with a clear error if `DATABASE_URL` is unset or
is the CI placeholder.

## Still deferred

Not yet written; no blockers left — just more tests:

1. **Chat + refresh persistence.** Create a thread via
   `POST /api/v1/chatbots/atlas-analyst/chat`, fetch via
   `GET /api/v1/chatbots/atlas-analyst/threads/[id]`, assert messages
   round-trip. Needs a stub LLM (MSW) or acceptance of a real API call.
2. **Admin creates a bot via UI.** Post the form action and follow to
   the edit page.
3. **Prompt rollback.** Edit → rollback → verify current version
   matches the restored text.
4. **Kill switch blocks chat.** Toggle on → chat returns 503 → toggle
   off.
5. **Rate-limit 429.** Seed a test bot with `rateLimitTokens: 2`
   + `rateLimitWindow: 1 m`, fire 3 calls, third returns 429.

## CI

- `public` project runs in the existing `e2e` job with placeholder env
  (no DB access needed — every protected path short-circuits at the
  middleware).
- Authenticated suite needs a real test DB; when we add one, spin up a
  new `e2e-authenticated` job (nightly, or gated by a label) with real
  secrets.
