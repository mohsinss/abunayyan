# Implementation Plan — 2026 Upgrade

## Goal

Transform this ShipFast-derived Next.js 15 SaaS template into a state-of-the-art 2026 AI-SaaS boilerplate suitable for spinning up 2–3 production web apps per week, each with streaming AI, typed data layer, auth, billing, observability, and CI.

## Guiding principles

1. **Typed end-to-end.** Env, DB, API contracts, forms — all Zod/TypeScript validated at build time where possible, runtime otherwise.
2. **State-of-the-art defaults.** Where there is a clear 2026 default (Drizzle over Prisma for AI-native stacks, Vercel AI SDK over raw fetch, shadcn over DaisyUI, Resend over Mailgun), use it.
3. **One command to spin up a new project.** Velocity comes from the scaffold script, not from copying folders.
4. **No half-finished implementations.** Every doc ends with a green checklist or it's not merged.
5. **Prefer removing code to adding abstractions.** Delete DaisyUI, NextAuth, Mailgun, in-memory rate-limiter, dead nodemailer dep — don't leave compat shims.

## Phased sequencing

The 12 setup docs are grouped into three phases. Within a phase, docs are independent unless noted; across phases, respect ordering.

### Phase 1 — Foundation (week 1)

**Goal:** a developer can clone, `pnpm install`, `pnpm dev`, and land on a page that authenticates, reads/writes typed data, and streams an AI response.

| Order | Doc | Depends on |
|-------|-----|------------|
| 1 | `01-environment.md` | — |
| 2 | `02-database.md` | 01 |
| 3 | `03-authentication.md` | 01 |
| 4 | `04-ui-components.md` | — |
| 5 | `05-ai-sdk.md` | 01, 04 |
| 6 | `08-observability.md` | 01 |
| 7 | `09-caching-queues.md` | 01 |

**Exit criteria:**
- `pnpm dev` boots with no env errors.
- Sign up via Clerk succeeds; a `users` row is synced into Postgres via webhook.
- A `/chat` route streams tokens from Claude with tool-use wired.
- Sentry captures a deliberately thrown error in dev.
- Upstash rate-limit returns 429 after N requests on a protected route.

### Phase 2 — Commerce + Comms (week 2)

| Order | Doc | Depends on |
|-------|-----|------------|
| 8 | `06-payments.md` | 02, 03 |
| 9 | `07-email.md` | 01 |

**Exit criteria:**
- Stripe checkout → webhook → Clerk metadata update → Postgres subscription row.
- Receipt email rendered from React Email template and sent via Resend.

### Phase 3 — Quality + Velocity (week 3)

| Order | Doc | Depends on |
|-------|-----|------------|
| 10 | `10-testing.md` | all |
| 11 | `11-ci-deployment.md` | 10 |
| 12 | `12-scaffold-cli.md` | all |

**Exit criteria:**
- `pnpm test` and `pnpm test:e2e` both pass locally and on CI.
- Every PR gets a Vercel preview + Sentry release + PostHog release.
- `pnpm new-project acme` produces a fresh, deployable app in under 5 minutes with all secrets prompted interactively.

## Deprecations — things to delete, not keep

Remove fully (no backwards-compat shims):

| Remove | Replaced by |
|--------|-------------|
| `next-auth`, `@auth/mongodb-adapter` | Clerk |
| `mongoose`, `mongodb`, `lib/db/mongoose.ts`, `lib/db/mongo.ts`, `models/` | Drizzle + Postgres (`lib/db/`, `db/schema/`) |
| `mailgun.js`, `nodemailer`, `form-data`, `lib/email/mailgun.ts` | Resend + `emails/` (React Email) |
| `daisyui`, `@headlessui/react` (if unused after shadcn) | shadcn/ui + Radix primitives |
| `openai` (keep only if you genuinely need OpenAI-specific features) | `@ai-sdk/anthropic` via Vercel AI SDK (add `@ai-sdk/openai` as fallback) |
| `lib/middleware/rateLimit.ts` (in-memory) | `@upstash/ratelimit` |
| `next-plausible`, `crisp-sdk-web` | PostHog (+ Intercom/Plain later if needed) |
| `jest`, `ts-jest`, `jest-environment-jsdom` | Vitest + React Testing Library |
| `lib/infrastructure/logger.ts` (console-based) | `pino` + Sentry breadcrumbs |
| Duplicate unversioned API routes (`app/api/auth`, `app/api/lead`, etc.) | Keep only `app/api/v1/*`; delete duplicates |

When deleting, do NOT leave `// removed`, `_deprecated`, or re-export shims. Delete the files, update all imports, let the type-checker find stragglers.

## Package manager

Switch from npm to **pnpm**. Faster installs, stricter hoisting, plays nicely with Turborepo later if you monorepo.

```bash
rm package-lock.json
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

Commit the new `pnpm-lock.yaml` and add `packageManager: "pnpm@9.x"` to `package.json`.

## Node version

Pin to Node 22 LTS (active LTS as of 2026). Add `.nvmrc`:

```
22
```

And `"engines": { "node": ">=22" }` in `package.json`.

## Folder discipline

Target layout (see [architecture.md](architecture.md) for full spec):

```
app/                       # Next.js App Router
  (marketing)/             # public, unauthed
  (auth)/                  # sign-in, sign-up
  (app)/                   # authed dashboard
  api/v1/                  # versioned REST
components/
  ui/                      # shadcn primitives (generated, do not hand-edit)
  ai/                      # Chat, Message, ToolCall
  forms/                   # Form wrappers over react-hook-form
  marketing/               # Hero, Pricing, FAQ
db/
  schema/                  # Drizzle schemas
  migrations/              # Drizzle migrations (generated)
  seed.ts
emails/                    # React Email templates
lib/
  ai/                      # Anthropic client, tools, prompt cache
  auth/                    # Clerk helpers, permissions
  db/                      # Drizzle client + query helpers
  payments/                # Stripe
  email/                   # Resend client
  analytics/               # PostHog
  flags/                   # PostHog feature flags
  ratelimit/               # Upstash
  queue/                   # QStash
  env.ts                   # t3-env validated config
tests/
  unit/
  e2e/
scripts/
  new-project.ts           # Scaffold CLI
  seed.ts
.github/workflows/
  ci.yml
Dockerfile
docker-compose.yml
proxy.ts                   # Clerk middleware (per Clerk's latest docs)
```

## Non-goals (for this upgrade)

These are explicitly **out of scope** — resist scope creep. Revisit after Phase 3 is green:

- Monorepo / Turborepo (one repo for now; scaffold clones a new repo per project)
- i18n (add when the first project needs it)
- Storybook (shadcn components are stable; add if building a design system)
- Native mobile apps
- OpenAPI codegen / tRPC (typed REST + Zod is enough for single-team apps)
- Self-hosting (Vercel + Neon + Upstash is the default deployment path)

## Decisions log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Postgres + Drizzle + pgvector | Typed SQL, AI-native vector search, zero-cost dev on Neon |
| D2 | Clerk for auth | Orgs/RBAC/billing OOTB saves 2–3 weeks per app |
| D3 | Vercel AI SDK + Anthropic primary | Streaming, tool-use, provider-agnostic; Claude is best model as of 2026 |
| D4 | shadcn/ui + Tailwind | Copy-in components, own the code, no lock-in |
| D5 | Resend + React Email | JSX templates, first-class DX, cheap |
| D6 | PostHog (analytics + flags + replay) | One product replaces 3 vendors |
| D7 | Sentry for errors/perf | Industry default; great Next.js integration |
| D8 | Upstash (Redis + QStash) | Serverless-friendly; no idle cost |
| D9 | Vitest over Jest | Faster, ESM-native, better TS story in 2026 |
| D10 | pnpm | Speed + disk usage + monorepo-ready |

If any decision changes during execution, amend this table with the reason — don't silently drift.

## Risk register

| Risk | Mitigation |
|------|------------|
| Clerk + Stripe billing overlap (Clerk Billing exists) | Doc 06 picks one clearly; don't double-handle entitlements |
| Drizzle migration churn if schema changes a lot early | Start with a minimal `users` + `subscriptions` + `documents` schema; grow deliberately |
| pgvector extension availability on chosen host | Neon supports pgvector natively; Supabase does too. Avoid Heroku Postgres |
| Next.js 16 breaking changes | Pin to 15.x until 16 stable + migration guide published |
| Prompt-caching costs if misused | Doc 05 documents cache-block boundaries |

## Rollout strategy

This is a boilerplate, not a running product, so there's no migration / zero-downtime concern. Do the work on `claude/nifty-chatelet-e44bac`, open a PR when each phase is green, merge when reviewed.

After merge, tag the repo (e.g. `v2026.1`) so the scaffold script can pin to a known-good template revision.
