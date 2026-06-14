# Architecture

The module-boundary spec the codebase converges on. For day-to-day commands and the
chatbots-platform deep dive, see [`CLAUDE.md`](../CLAUDE.md) at the repo root — this doc
covers layering and invariants.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5.7 · **Auth.js v5 (NextAuth)** with the
Drizzle adapter and a **database** session strategy (Google OAuth) · Drizzle + Neon Postgres
(+ pgvector) · Vercel AI SDK + Anthropic (with an `anthropic_direct` engine) · shadcn/ui +
Tailwind · Stripe · Resend · Upstash (Redis ratelimit + QStash) · Sentry + PostHog.

## Top-level layout

```
app/
  (marketing)/        Public pages (no auth)
  (auth)/             sign-in / sign-up
  (app)/              Authed app — dashboard, chat, admin, billing, settings
  api/v1/             Versioned API (admin/* and wcx/* are admin-gated)
  layout.tsx          Root providers + fonts
components/
  ui/                 shadcn primitives (lib/utils only — no side effects)
  dashboard/, chatbots/, admin/, marketing/, auth/, billing-actions, …
db/
  schema/             One file per table, re-exported from schema/index.ts
  migrations/         drizzle-kit generated + custom verifier (scripts/verify-migrations.ts)
  index.ts            Drizzle `db` client
lib/
  chatbots/           The platform: registry, runtime (engine dispatch), tools, persistence, audit
  wcx/                WC Intelligence engine (uploaded workbook → metric store)
  working-capital-data/  Seeded WC dashboard derivation
  datasets/           Upload → parse → blob → embed (pgvector)
  auth/               session.ts (requireUser/getOptionalUser) + rbac.ts (roles, requireAdminApi)
  db/queries/         Typed query helpers per table
  validation/, payments/, email/, analytics/, ratelimit/, queue/, cache/, export/, env.ts, logger.ts
middleware.ts         Auth on protected prefixes + RBAC on /admin and /api/v1/admin
```

## Module boundaries (treat as strict)

| Layer | May import from | Must not import from |
|-------|-----------------|----------------------|
| `app/**` | `components/**`, `lib/**`, `db/**`, `emails/**` | `tests/**`, `scripts/**` |
| `components/ui/**` | `lib/utils` only | anything with side effects (no DB, fetch, analytics) |
| other `components/**` | `components/ui/**`, `lib/**` | `db/**` directly (go through `lib/db/queries`) |
| `lib/db/**` | `db/schema/**` | `app/**`, `components/**` |
| `db/schema/**` | Drizzle only | everything else |
| `tests/**` | everything | — |

Server-only `lib/**` files start with `import "server-only";`. Default to Server Components;
add `"use client"` only when needed.

## Data-flow invariants

1. **Env vars** go through `lib/env.ts` (`@t3-oss/env-nextjs`, build-time validated). Never `process.env.X` in feature code.
2. **DB writes** go through `lib/db/queries/*` (no inline Drizzle in route handlers beyond the simplest reads).
3. **Auth** — pages/server components call `requireUser()` (`lib/auth/session.ts`); admin API routes call `requireAdminApi()` (`lib/auth/rbac.ts`); `middleware.ts` is the coarse gate.
4. **API routes** follow one of three patterns (admin guard / `handleChatRequest` / inline auth+Zod) — see CLAUDE.md.
5. **Forms** use `react-hook-form` + `zodResolver` against the same Zod schema (`lib/validation/*`) the API validates with.
6. **Chatbots** are Postgres rows; the runtime centralizes every guard rail (`lib/chatbots/runtime.ts`) and dispatches by engine.
7. **AI calls** go through the chatbots runtime or `lib/ai/*` (client + embeddings) — never `new Anthropic()` in feature code.

## Naming

Files/dirs kebab-case (React components PascalCase). DB tables snake_case plural; Drizzle
exports camelCase. Zod schemas `xxxSchema` with `XxxInput`/`XxxRow` inferred types. Env vars
SCREAMING_SNAKE_CASE (public ones `NEXT_PUBLIC_`). Path alias: `@/*` → repo root (the only alias).
