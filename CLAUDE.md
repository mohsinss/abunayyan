# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (pinned in `package.json` — do not use npm). Node 22+.

```bash
pnpm dev                 # next dev --turbopack (http://localhost:3000)
pnpm build               # runs `db:migrate` FIRST, then `next build`
pnpm lint                # next lint (eslint)
pnpm type-check          # tsc --noEmit
pnpm format              # prettier --write .

# Tests
pnpm test                # vitest run (unit + integration)
pnpm test:watch          # vitest watch
pnpm vitest run tests/unit/chatbots/cost.test.ts   # single test file
pnpm vitest run -t "name of test"                  # single test by name
pnpm test:e2e            # playwright, public project (unauthenticated)
pnpm test:e2e:authenticated  # admin + member projects (needs .env.local)
pnpm test:e2e:all        # every playwright project

# Database (Drizzle + Neon Postgres)
pnpm db:generate         # generate SQL migration from db/schema changes
pnpm db:migrate          # apply migrations + run db:verify:apply
pnpm db:push             # push schema directly (dev only, no migration file)
pnpm db:studio           # drizzle-kit studio
pnpm db:seed             # seed core data (db/seed.ts)
pnpm db:seed:wc          # seed working-capital data
pnpm db:verify           # verify migrations match schema (scripts/verify-migrations.ts)
```

Migrations are guarded by a custom verifier (`scripts/verify-migrations.ts`); `db:migrate` applies it automatically and `build` runs `db:migrate` before compiling, so a schema/migration mismatch fails the build.

## High-level architecture

Next.js 15 App Router + React 19 + TypeScript. Auth.js v5 (NextAuth), Drizzle + Neon Postgres (+ pgvector for RAG), Vercel AI SDK with Anthropic Claude, shadcn/ui + Tailwind, Stripe, Resend, Upstash (Redis ratelimit + QStash jobs), Sentry + PostHog.

> Note: the actual app uses **Auth.js v5 / NextAuth** (`lib/auth.ts`, database session strategy, Google OAuth, Drizzle adapter) — not Clerk. The original template's idealized layout has been kept in sync in `docs/architecture.md`; the **module boundaries, naming, and data-flow invariants there still hold** (see below).

### Route groups (`app/`)
- `(marketing)/` — public pages, no auth.
- `(auth)/` — sign-in/up.
- `(app)/` — authenticated app: `dashboard/`, `chat/`, `admin/`, `billing/`, `settings/`.
- `api/v1/` — versioned API. `api/v1/admin/*` is admin/owner only.

`middleware.ts` enforces auth on protected path prefixes and RBAC on `/admin` + `/api/v1/admin` (role must be `admin` or `owner`). API paths return 401/403; page paths redirect to `/sign-in`.

### API route handlers
There is no single route wrapper; routes follow one of three patterns by kind. Match the neighbours when adding a route:
- **Admin routes** (`api/v1/admin/*`, `api/v1/wcx/*`) call `requireAdminApi(req)` from `lib/auth/rbac.ts` at the top — it enforces admin+ role and a per-method Upstash rate limit, returning a `{ ok, response }` guard.
- **Chat** goes through `handleChatRequest(req, slug)` in `lib/chatbots/route-handler.ts`, which delegates to the chatbots runtime (auth → kill switch → rate limit → budget → persistence → audit).
- **Other routes** resolve the session inline via `auth()` and validate input with a Zod schema from `lib/validation/*`.
Error responses are inconsistent across these (plain-text `Response` vs `Response.json({ error })`); `lib/api/errors.ts` provides a normalizer used by the Stripe routes. Unifying this is a known cleanup.

### Chatbots platform (`lib/chatbots/`) — the core of this app
Database-backed, multi-tenant AI chatbots with per-bot tool grants and RBAC. `lib/chatbots/index.ts` is the public surface.
- **Registry** (`registry.ts`) — bots are rows in the `chatbots` table; React-`cache`d lookups by slug/id; soft-deleted via `deletedAt`. Bots have `enabled`, `allowedRoles`, and a `tools: ToolId[]` grant list.
- **Runtime** (`runtime.ts`) — single entry `runBotStream`. Owns engine-agnostic concerns (auth via `canUserAccessBot`, rate limit, per-user USD budget cap, thread resolution, message persistence, audit), then dispatches by `bot.engine` to either `runtime-ai-sdk.ts` (Vercel AI SDK) or `runtime-anthropic.ts` (direct Anthropic SDK). Returns typed `RunError | RunSuccess`.
- **Tools** (`tools/`) — `getToolsForBot(bot, user, threadId, datasetId)` builds the live tool set from the bot's grant list, filtered by the user's role rank (`viewer < member < manager < admin < owner`). Add a new tool by creating `tools/<name>.ts`, registering it in `ALL_TOOLS` in `tools/index.ts`, and adding its `ToolId` to `db/schema/chatbots.ts`. Tools split into render tools (`render-chart`, `render-table`, `render-waterfall`, …), dataset tools (`query-dataset-rows`, `search-dataset-docs`), and domain tools (`wcx-*`, `wc-*`, `atlas-snapshot`).
- Prompts are versioned with rollback (`prompts.ts`), and every state-changing action writes to the audit log (`audit.ts`).

### WCX — Working Capital Intelligence (`lib/wcx/`, `app/(app)/dashboard/wc-intelligence/`, `app/api/v1/wcx/`)
A domain feature for ingesting and analyzing working-capital workbooks: parsing (`parse-workbook.ts`), metric definitions/derivation (`metric-defs.ts`, `derive.ts`), scenario modeling (`scenario.ts`), and reconciliation. Schema lives in `db/schema/wc-intelligence.ts`. Exposed to chatbots through the `wcx-*` tools. (`lib/working-capital/` is the older/separate module — distinct from `lib/wcx/`.)

### Datasets (`lib/datasets/`)
Upload → parse (`parsers/`) → store (Vercel Blob) → embed (pgvector) → expose as a per-card chatbot. The chat route resolves a `datasetId` so dataset tools scope queries to that card.

## Conventions (from `docs/architecture.md`, still enforced)
- **Env vars** go through `lib/env.ts` (`@t3-oss/env-nextjs`, validated at build time). Never read `process.env.X` directly in feature code.
- Path alias is **`@/*` → repo root** (the only alias).
- Default to **Server Components**; add `"use client"` only when needed. Server-only `lib/` files (anything touching secrets or DB) start with `import "server-only";`.
- **Files/dirs**: kebab-case. React components: PascalCase. DB tables: snake_case plural. Drizzle exports: camelCase. Zod schemas: `xxxSchema` with `XxxInput`/`XxxRow` inferred types.
- shadcn primitives live in `components/ui/` — added via the shadcn CLI; don't hand-edit their generated headers.
- DB schema is per-table files in `db/schema/`, re-exported from `db/schema/index.ts`; the Drizzle client is `db` from `@/db`.

## Testing notes
- Unit/integration tests run under Vitest (jsdom, `tests/setup.ts`). Tests live in `tests/unit/`, `tests/integration/`, and co-located `lib/**/*.test.ts`. Coverage is intentionally scoped to a verified subset in `vitest.config.ts` (≥85% lines on those files) — expand the `include` list as DB/Redis fixtures land.
- `server-only` is stubbed for tests (`tests/stubs/server-only.ts`).
- MSW mocks network calls (`tests/mocks/`).
- Playwright projects: `public` (unauthenticated), `authenticated:admin`, `authenticated:member`; authenticated projects require real env and a setup-auth step.
