# magic-create

A 2026 state-of-the-art AI-SaaS boilerplate built to spin up new web apps in minutes.

> **Use this repo as a template.** Don't commit to `main` here — spin a new project from it, then work in that project's repo.

## Table of contents

1. [Stack](#stack)
2. [Prerequisites](#prerequisites)
3. [Clone & first run](#clone--first-run)
4. [Environment variables](#environment-variables)
5. [Daily commands](#daily-commands)
6. [Provisioning accounts](#provisioning-accounts)
7. [Spin up a new project](#spin-up-a-new-project)
8. [Deploy to Vercel](#deploy-to-vercel)
9. [Testing](#testing)
10. [Architecture & docs](#architecture--docs)
11. [Troubleshooting](#troubleshooting)

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript 5.7**
- **Auth.js v5 (NextAuth)** — Google OAuth, database sessions via Drizzle, zero vendor lock-in
- **Postgres (Neon) + Drizzle + pgvector** — typed SQL, RAG-ready
- **Vercel AI SDK + Anthropic Claude** — streaming, tool-use, prompt caching
- **shadcn/ui + Tailwind** — component system you own
- **Stripe** — subscriptions, billing portal, webhooks
- **Resend + React Email** — JSX email templates
- **Upstash Redis + QStash** — rate limiting + background jobs
- **Sentry + PostHog** — errors, analytics, flags, session replay
- **Vitest + Playwright + MSW** — unit + E2E tests
- **GitHub Actions + Docker** — CI + containerization
- **`pnpm new-project`** — one-command scaffold for fresh apps

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | 22 LTS | Required |
| **pnpm** | 9+ | Required (do NOT use npm — `package.json` pins pnpm) |
| **git** | any | Required |
| **Neon account** | free | Postgres host |
| **Google Cloud project** | free | OAuth credentials for Auth.js |
| **Anthropic account** | pay-as-you-go | AI |

Install pnpm if you don't have it:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Clone & first run

```bash
# 1. Clone
git clone https://github.com/mohsinss/typescript-saas-enhanced-2026.git my-app
cd my-app

# 2. Set up env vars
cp .env.example .env.local
# Open .env.local and replace every REPLACE_ME with real values.
# See "Environment variables" section below for what each means.

# 3. Install dependencies
pnpm install

# 4. Initialize the database (Neon must be provisioned, see "Provisioning")
pnpm db:generate   # creates SQL migration from schema
pnpm db:migrate    # applies migration to Neon

# 5. Start the dev server
pnpm dev
```

Open **http://localhost:3000**.

## Environment variables

All env vars are validated at **build time** via `@t3-oss/env-nextjs` in [`lib/env.ts`](lib/env.ts). A missing required var fails the build with a clear error.

### Required (build fails without these)

| Variable | Where to get it | Example |
|----------|-----------------|---------|
| `NODE_ENV` | fixed | `development` (local) / `production` (Vercel) |
| `NEXT_PUBLIC_APP_URL` | your URL | `http://localhost:3000` / `https://my-app.vercel.app` |
| `DATABASE_URL` | Neon dashboard → Connection string (pooled) | `postgresql://...@host-pooler.neon.tech/db?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | Neon dashboard → Connection string (direct) | `postgresql://...@host.neon.tech/db?sslmode=require` |
| `AUTH_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | `ryw/S55F...` (32+ bytes base64) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | `sk-ant-api03-...` |

### Recommended (features silently disabled otherwise)

| Variable | Feature | Where to get it |
|----------|---------|-----------------|
| `AUTH_GOOGLE_ID` | Google sign-in | console.cloud.google.com → Credentials → OAuth 2.0 Client ID |
| `AUTH_GOOGLE_SECRET` | Same | Same |
| `OPENAI_API_KEY` | Embeddings for RAG | platform.openai.com |
| `STRIPE_SECRET_KEY` | Subscriptions / billing | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Subscription state sync | Stripe dashboard → Developers → Webhooks |
| `RESEND_API_KEY` | Transactional email | resend.com → API Keys |
| `EMAIL_FROM` | Sender address | e.g. `"Acme <hello@acme.com>"` |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limit | upstash.com → Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Same | Same |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics + flags + replay | posthog.com → Project |
| `NEXT_PUBLIC_POSTHOG_HOST` | Same | `https://us.i.posthog.com` (default) |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking | sentry.io → Project → Settings |
| `SENTRY_AUTH_TOKEN` | Source-map upload | sentry.io → Auth Tokens |
| `QSTASH_TOKEN` | Background jobs | upstash.com → QStash |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash signature verify | Same |
| `QSTASH_NEXT_SIGNING_KEY` | QStash signature verify | Same |

See [`.env.example`](.env.example) for the full list with defaults.

## Daily commands

```bash
# --- Development
pnpm dev                 # Next dev server (Turbopack)
pnpm build               # Production build
pnpm start               # Run production build locally

# --- Code quality
pnpm type-check          # TypeScript strict check (should always pass)
pnpm lint                # ESLint
pnpm format              # Prettier write
pnpm format:check        # Prettier verify only

# --- Database (Drizzle + Neon)
pnpm db:generate         # Create SQL migration from schema diff
pnpm db:migrate          # Apply pending migrations
pnpm db:push             # Push schema directly (dev only — skips migration file)
pnpm db:studio           # Open Drizzle Studio (DB explorer on localhost:4983)
pnpm db:seed             # Insert dev seed data

# --- Testing
pnpm test                # Vitest unit tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # With coverage report
pnpm test:e2e            # Playwright E2E (spins dev server)
pnpm test:e2e:headed     # E2E with browser visible

# --- Email templates
pnpm email:dev           # Preview React Email templates on localhost:3000

# --- Scaffolding
pnpm new-project <slug> <git-url>    # Clone this boilerplate to a new repo
```

## Provisioning accounts

### Auth.js v5 (auth)

Auth.js lives in your own code + Postgres. No SaaS account, no dashboard, no domain approval — works on `localhost`, `*.vercel.app`, or any custom domain.

1. Generate a secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste the output into `AUTH_SECRET` in `.env.local`.

2. Create Google OAuth credentials at https://console.cloud.google.com/apis/credentials:
   - **Create Credentials → OAuth 2.0 Client ID** → Web application.
   - **Authorized redirect URIs**: add every URL that will run your app
     - `http://localhost:3000/api/auth/callback/google`
     - `https://<your-app>.vercel.app/api/auth/callback/google`
     - `https://<your-custom-domain>/api/auth/callback/google` (if any)
   - Copy Client ID → `AUTH_GOOGLE_ID`.
   - Copy Client Secret → `AUTH_GOOGLE_SECRET`.

3. First time you sign in, Auth.js creates a `users` row automatically via the Drizzle adapter — no webhook needed.

### Neon (Postgres)

1. Sign up at https://neon.tech.
2. Create a project. Region = closest to your Vercel deployment.
3. Copy the pooled connection string → `DATABASE_URL`.
4. Copy the direct (unpooled) connection string → `DATABASE_URL_UNPOOLED`.
5. In the Neon SQL console run once:
   ```sql
   create extension if not exists vector;
   ```
6. Back in terminal: `pnpm db:migrate`.

### Anthropic (Claude)

1. Sign up at https://console.anthropic.com.
2. Create an API key → `ANTHROPIC_API_KEY`.
3. Add a payment method if you hit the free-credit ceiling.

### Stripe (payments — optional)

1. Create products + prices in Stripe dashboard.
2. Update `config.ts` `stripe.plans` with your real `priceId`s.
3. Copy `sk_test_...` → `STRIPE_SECRET_KEY`.
4. Local webhook: `stripe listen --forward-to localhost:3000/api/v1/webhook/stripe` → copy `whsec_...` → `STRIPE_WEBHOOK_SECRET`.
5. Production webhook: Stripe dashboard → Developers → Webhooks → Add endpoint.
   - URL: `https://<your-domain>/api/v1/webhook/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

### Resend (email — optional)

1. Sign up at https://resend.com.
2. Verify a domain (or use `onboarding@resend.dev` for testing).
3. Copy `re_...` → `RESEND_API_KEY`.
4. Set `EMAIL_FROM="Your App <hello@yourdomain.com>"`.

### Upstash (rate limit + queue — optional)

1. Sign up at https://upstash.com.
2. Create a Redis database → copy REST URL + token.
3. (Optional) Create a QStash instance → copy token + current/next signing keys.

### PostHog (analytics — optional)

1. Sign up at https://posthog.com.
2. Create a project → copy API key (`phc_...`) → `NEXT_PUBLIC_POSTHOG_KEY`.

### Sentry (errors — optional)

1. Sign up at https://sentry.io.
2. Create a Next.js project → copy DSN → `NEXT_PUBLIC_SENTRY_DSN`.
3. Settings → Auth Tokens → create token with `project:releases` + `project:write` → `SENTRY_AUTH_TOKEN`.

## Spin up a new project

This repo is a template for all future projects. Use the scaffold CLI:

```bash
# 1. Create an empty GitHub repo (no README, no .gitignore, no license)
# 2. Back in the boilerplate:
pnpm new-project <slug> <git-url>
```

**Example:**

```bash
pnpm new-project sports-app https://github.com/you/sports-app.git
```

This:

1. Copies the boilerplate to `/Users/you/<slug>/` (sibling directory).
2. Excludes `.env`, `node_modules`, `.next`, `.vercel`, and other local state.
3. Renames `package.json` name, `config.ts` `appName` + `domainName`.
4. Copies `.env.example` → `.env.local` (you fill in secrets).
5. Runs `git init`, commits, adds remote, pushes to `main`.

Then:

```bash
cd /Users/you/<slug>
# Edit .env.local with secrets (Auth.js, Neon, Anthropic required)
pnpm install
pnpm db:generate && pnpm db:migrate
pnpm dev
```

**Create a new Neon project and fresh Google OAuth client per app** — don't share auth/DB across projects. Anthropic, OpenAI, Resend, Upstash, and PostHog keys can be reused.

Running `pnpm new-project` with no args gives interactive prompts for slug + URL.

## Deploy to Vercel

1. Import the GitHub repo in Vercel dashboard → **Add New** → **Project**.
2. Framework preset = **Next.js** (auto-detected).
3. Install command: `pnpm install --frozen-lockfile`.
4. Build command: `pnpm build` (default).
5. **Environment Variables** → paste every entry from your `.env.local` (or the Required + Recommended lists above). Scope to **Production**, **Preview**, and **Development** as appropriate.
6. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL.
7. In Google Cloud Console → your OAuth client, add `https://<your-vercel-url>/api/auth/callback/google` to Authorized redirect URIs.
8. Deploy.

### Neon + Vercel integration

Vercel has an official Neon integration that auto-creates a Neon branch per preview deploy (isolates data per PR). Enable it in Vercel → your project → **Integrations**.

## Testing

```bash
pnpm test              # Unit tests
pnpm test:coverage     # With coverage (threshold: 70%)
pnpm test:e2e          # Playwright E2E against http://localhost:3000
```

- Unit tests live in `tests/unit/**` and `lib/**/*.test.ts`.
- E2E tests live in `tests/e2e/**`.
- Outbound HTTP (Stripe, Anthropic, Resend) is mocked via MSW in `tests/mocks/`.

## Architecture & docs

Deep-dive documentation:

- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased roadmap with acceptance criteria
- [`docs/architecture.md`](docs/architecture.md) — full folder spec, module boundaries, naming
- [`docs/setup/`](docs/setup/) — 12 focused setup guides (env, db, auth, ui, ai, payments, email, observability, caching, testing, ci, scaffold)

## Troubleshooting

### `Invalid environment variables: ... Required`

A required env var is missing. Check `.env.local` matches the Required table above. On Vercel, check dashboard → Settings → Environment Variables.

### `pnpm build` fails at "Collecting page data"

Usually a missing env var manifesting later than the validation phase. Double-check `AUTH_SECRET` is set and real, and `DATABASE_URL` points at a live Neon project.

### Neon "password authentication failed"

Your connection string is stale. Re-copy from Neon dashboard; Neon rotates passwords when you reset them.

### Google sign-in "redirect_uri_mismatch"

Go to Google Cloud Console → your OAuth client → add the exact URL Auth.js is redirecting to (the error message shows it) to Authorized redirect URIs. Format: `<origin>/api/auth/callback/google`.

### Drizzle "relation users does not exist"

You skipped `pnpm db:migrate`. Run it.

### Rate limit returns 429 immediately

You didn't set `UPSTASH_REDIS_REST_URL` + `_TOKEN`. Without them, the limiter is a no-op (always allows). If you see 429s, you have a real request spike.

### `pnpm new-project <name> <url>` push fails

The target GitHub repo isn't empty. Either delete its initial commit or scaffold into a fresh empty repo.

## License

MIT
