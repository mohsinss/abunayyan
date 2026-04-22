# Target Architecture

This is the file/folder skeleton and module-boundary spec that every setup doc converges on. Reference this while implementing — do not invent alternative layouts.

## Directory tree

```
.
├── app/
│   ├── (marketing)/                 # Public pages (no auth)
│   │   ├── layout.tsx               # Marketing shell (header/footer)
│   │   ├── page.tsx                 # Landing
│   │   ├── pricing/page.tsx
│   │   ├── blog/
│   │   ├── privacy-policy/page.tsx
│   │   └── tos/page.tsx
│   ├── (auth)/                      # Clerk-hosted sign-in/up (catch-all)
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (app)/                       # Authed app (Clerk required)
│   │   ├── layout.tsx               # Dashboard shell, reads auth()
│   │   ├── dashboard/page.tsx
│   │   ├── chat/page.tsx            # AI streaming chat
│   │   ├── settings/page.tsx
│   │   └── billing/page.tsx
│   ├── api/v1/
│   │   ├── ai/
│   │   │   ├── chat/route.ts        # POST — streaming completion
│   │   │   └── tools/route.ts       # tool registry endpoint (if needed)
│   │   ├── stripe/
│   │   │   ├── create-checkout/route.ts
│   │   │   └── create-portal/route.ts
│   │   ├── webhook/
│   │   │   ├── stripe/route.ts
│   │   │   ├── clerk/route.ts       # Clerk user.created → sync to Postgres
│   │   │   └── qstash/route.ts      # QStash job handler
│   │   └── health/route.ts
│   ├── layout.tsx                   # Root: <ClerkProvider>, providers, fonts
│   ├── globals.css                  # Tailwind + shadcn tokens
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                          # shadcn primitives — DO NOT hand-edit headers
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── form.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── toast.tsx
│   │   └── …                        # Added via `pnpm dlx shadcn@latest add X`
│   ├── ai/
│   │   ├── chat.tsx                 # <Chat /> — streaming UI
│   │   ├── message.tsx
│   │   └── tool-call.tsx
│   ├── forms/                       # Re-usable react-hook-form wrappers
│   │   └── form-field.tsx
│   ├── marketing/
│   │   ├── hero.tsx
│   │   ├── pricing.tsx
│   │   ├── faq.tsx
│   │   └── cta.tsx
│   └── providers.tsx                # PostHog + Theme + Toaster providers
├── db/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── subscriptions.ts
│   │   ├── projects.ts
│   │   ├── documents.ts             # pgvector embeddings for RAG
│   │   └── index.ts                 # re-exports all tables
│   ├── migrations/                  # drizzle-kit generated
│   ├── seed.ts
│   └── index.ts                     # Drizzle `db` client export
├── emails/
│   ├── welcome.tsx                  # React Email templates
│   ├── receipt.tsx
│   └── subscription-cancelled.tsx
├── lib/
│   ├── ai/
│   │   ├── client.ts                # Anthropic model instance
│   │   ├── tools/                   # Tool definitions
│   │   │   ├── index.ts
│   │   │   └── search-docs.ts
│   │   └── prompts/                 # Prompt templates (cached with cache_control)
│   │       └── system.ts
│   ├── auth/
│   │   ├── clerk.ts                 # Server helpers: requireUser, requireOrg
│   │   └── permissions.ts           # RBAC checks
│   ├── db/
│   │   └── queries/                 # Typed query helpers per table
│   │       ├── users.ts
│   │       └── projects.ts
│   ├── payments/
│   │   └── stripe.ts
│   ├── email/
│   │   └── resend.ts
│   ├── analytics/
│   │   └── posthog.ts               # Server-side capture
│   ├── flags/
│   │   └── index.ts                 # PostHog feature-flag SDK wrapper
│   ├── ratelimit/
│   │   └── index.ts                 # Upstash Ratelimit instances (by tier)
│   ├── queue/
│   │   └── index.ts                 # QStash publish helpers
│   ├── api/
│   │   ├── handler.ts               # Route-handler factory (zod + auth + rate-limit)
│   │   └── errors.ts                # Typed error classes + normalizer
│   ├── logger.ts                    # pino server logger
│   ├── utils.ts                     # cn(), invariant(), etc.
│   └── env.ts                       # @t3-oss/env-nextjs — build-time validated
├── tests/
│   ├── unit/
│   │   └── lib/*.test.ts
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── chat.spec.ts
│   │   └── checkout.spec.ts
│   └── fixtures/
├── scripts/
│   ├── new-project.ts               # Scaffold CLI
│   └── db-reset.ts
├── public/
│   └── …
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── preview-cleanup.yml
├── drizzle.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── next.config.mjs
├── postcss.config.mjs
├── tsconfig.json
├── eslint.config.mjs
├── components.json                  # shadcn config
├── proxy.ts                         # Clerk middleware (per Clerk latest docs)
├── Dockerfile
├── docker-compose.yml               # Local Postgres + Redis for offline dev
├── .nvmrc
├── .env.example
├── .env.local                       # gitignored
├── package.json
└── pnpm-lock.yaml
```

## Module boundaries

Treat these as **strict** import rules. A linter rule (e.g. `eslint-plugin-boundaries`) can enforce them later.

| Layer | May import from | Must not import from |
|-------|-----------------|----------------------|
| `app/**` | `components/**`, `lib/**`, `db/**`, `emails/**` | `tests/**`, `scripts/**` |
| `components/ui/**` | `lib/utils` only | Anything with side effects (no DB, no fetch, no analytics) |
| `components/{ai,forms,marketing}/**` | `components/ui/**`, `lib/**` | `db/**` directly (go through `lib/` queries) |
| `lib/db/**` | `db/schema/**` | `app/**`, `components/**` |
| `lib/ai/**` | `lib/env`, `lib/logger` | `db/**`, `app/**` (keep LLM layer pure) |
| `db/schema/**` | Drizzle only | Everything else |
| `tests/**` | Everything | — |
| `scripts/**` | `lib/**` selectively | `app/**`, `components/**` |

## Data flow invariants

1. **All env vars** go through `lib/env.ts`. Never `process.env.X` directly in feature code.
2. **All DB writes** go through `lib/db/queries/*.ts`. No inline Drizzle queries in route handlers beyond the simplest reads.
3. **All API routes** use `createHandler()` from `lib/api/handler.ts` — it wraps Zod validation, Clerk auth, rate-limit, error normalization, request-ID logging.
4. **All forms** use `react-hook-form` + `zodResolver` against the same Zod schema the API route uses. One schema, two consumers.
5. **All emails** are React components in `emails/`, rendered via `resend.emails.send({ react: <Template /> })`.
6. **All analytics events** go through `lib/analytics/posthog.ts`. Event names are string constants exported from that file.
7. **All AI calls** go through `lib/ai/client.ts`. Never `new Anthropic()` in feature code.

## Naming conventions

- **Files:** kebab-case (`create-checkout.ts`). Exception: React components are PascalCase (`Hero.tsx`).
- **Directories:** kebab-case.
- **DB tables:** snake_case, plural (`users`, `subscription_events`).
- **Drizzle schema exports:** camelCase (`export const users = pgTable(...)`).
- **Zod schemas:** `xxxSchema` (`createProjectSchema`). Inferred types: `XxxInput` / `XxxRow`.
- **Env vars:** `SCREAMING_SNAKE_CASE`. Public ones prefixed `NEXT_PUBLIC_`.
- **Event names (PostHog):** `$noun_verbed` (`project_created`, `checkout_started`).
- **Feature flags:** `kebab-case` (`new-chat-ui`).

## Path alias

One alias, `@/*` → repo root. Already configured in `tsconfig.json`. Do not add more.

## Server / client split

- Default to **Server Components**. Mark `"use client"` only when needed (event handlers, hooks, browser-only APIs).
- `lib/**` defaults to server-only. Files that are safe for both must add a comment at the top noting that.
- Anything touching secrets (env vars without `NEXT_PUBLIC_`) MUST import `server-only` at the top: `import "server-only";`.
- Client-only modules (PostHog browser SDK, shadcn hooks) import `client-only` at the top.

## Telemetry hooks

Every state-changing action should emit one PostHog event and one Sentry breadcrumb. This is non-negotiable — it's how you debug production without access to the user's data.

Wire these in `lib/api/handler.ts` so engineers don't forget.
