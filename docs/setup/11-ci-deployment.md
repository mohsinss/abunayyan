# 11 — CI / Deployment / Docker

**Phase:** 3 · **Depends on:** 10 · **P1**

Wires GitHub Actions for CI, Vercel for hosting, and a `Dockerfile` + `docker-compose.yml` for self-hosting or local offline dev.

## Goal

- Every push / PR runs lint + typecheck + unit tests + E2E.
- Every PR gets a Vercel preview URL with Sentry + PostHog releases tagged.
- `Dockerfile` produces a multi-stage production image.
- `docker-compose.yml` brings up Postgres + Redis locally (no external deps required for offline dev).

## Stack

- **GitHub Actions** — CI.
- **Vercel** — hosting + preview deploys.
- **Docker Buildx** — multi-arch images.

## Steps — GitHub Actions

### 1. Main CI workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: 22

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm format:check

  unit:
    runs-on: ubuntu-latest
    env:
      SKIP_ENV_VALIDATION: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4
        if: always()
        with:
          files: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}

  e2e:
    runs-on: ubuntu-latest
    env:
      # Test-only keys (Clerk + Stripe test mode)
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_TEST_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_TEST_SECRET_KEY }}
      CLERK_WEBHOOK_SIGNING_SECRET: whsec_test
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_TEST_API_KEY }}
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm dlx playwright install --with-deps chromium
      - run: pnpm db:migrate
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit]
    env:
      SKIP_ENV_VALIDATION: "1"
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      SENTRY_ORG: ${{ vars.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### 2. Required GitHub secrets

Add via **Settings → Secrets and variables**:

| Secret | Where from |
|--------|------------|
| `CLERK_TEST_PUBLISHABLE_KEY`, `CLERK_TEST_SECRET_KEY` | Clerk dashboard (test env) |
| `TEST_DATABASE_URL` | Neon test branch |
| `ANTHROPIC_TEST_API_KEY` | Anthropic console (low-limit key) |
| `SENTRY_AUTH_TOKEN` | Sentry → Auth Tokens |
| `CODECOV_TOKEN` | Codecov |

And GitHub **variables** (non-secret):

- `SENTRY_ORG`, `SENTRY_PROJECT`

### 3. Branch protection

**Settings → Branches → main:**

- Require PR before merging.
- Require status checks: `lint-and-typecheck`, `unit`, `build`. (E2E optional.)
- Require branches up to date.
- No force pushes.

## Steps — Vercel

### 1. Connect repo

1. Vercel → **Add New** → **Project** → Import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Install command: `pnpm install --frozen-lockfile`.
4. Build command: `pnpm build`.

### 2. Env vars in Vercel

Mirror every var from `.env.example` into Vercel's env settings. Tag per environment:

- **Production**: prod Clerk, prod Stripe, prod Neon, etc.
- **Preview**: test Clerk, test Stripe, Neon preview branch.
- **Development**: optional, usually unused (we run locally).

For Neon, use their **Vercel integration** to auto-branch Postgres per preview deploy.

### 3. Preview URLs per PR

Vercel auto-creates preview URLs. Wire them to Clerk by adding each preview URL pattern to Clerk → **Domains** (or use a wildcard test domain).

### 4. Release tracking

The Sentry wizard in doc 08 already tags releases. For PostHog releases:

```ts
// sentry.server.config.ts (already) + add for PostHog in instrumentation.ts
import posthog from "posthog-node";
// Identify a release on startup — PostHog's annotations appear in dashboards
```

Alternatively, post a release annotation from a GH Actions step using PostHog's API.

## Steps — Docker

### 1. Dockerfile (multi-stage)

```dockerfile
# Dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# --- builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN pnpm build

# --- runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

Enable standalone output in `next.config.mjs`:

```js
const nextConfig = {
  output: "standalone",
  // …
};
```

### 2. `.dockerignore`

```
.git
node_modules
.next
.env*
!.env.example
*.log
coverage
playwright-report
test-results
```

### 3. Local dev docker-compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]

volumes:
  pgdata:
  redisdata:
```

Local `DATABASE_URL` then becomes: `postgresql://app:app@localhost:5432/app`.

For local Redis in `lib/ratelimit/redis.ts`, use the Upstash Redis SDK against a local Upstash-compatible proxy (e.g. `serverless-redis-http`) or skip Redis locally — the graceful no-op in doc 09 handles that.

### 4. Build & run

```bash
docker build -t acme-web .
docker run -p 3000:3000 --env-file .env.local acme-web
```

## Deployment targets (reference)

| Host | When to pick it | Notes |
|------|-----------------|-------|
| **Vercel** (default) | Any Next.js app | Zero config; edge runtime supported |
| **Railway / Render** | Need long-running workers, cron | Good for non-Vercel serverful workloads |
| **Fly.io** | Want multi-region, Dockerfile-based | Requires `fly.toml` |
| **Self-hosted Docker** | Compliance / egress requirements | Use the Dockerfile above |

For 2–3 apps/week velocity, **always start on Vercel** unless you have a concrete reason not to.

## Verification checklist

- [ ] Pushing to a feature branch opens a PR with green CI checks.
- [ ] Unit + E2E test runs complete in under 10 minutes on CI.
- [ ] Vercel creates a preview URL per PR, and the Clerk/Stripe flows work there.
- [ ] `docker build .` completes successfully.
- [ ] `docker run` produces a working app bound to port 3000.
- [ ] `docker compose up postgres redis` gives a working local DB + Redis.
- [ ] Sentry dashboard shows a release per CI build.

## Gotchas

- **`pnpm install --frozen-lockfile` fails if the lockfile is stale.** Always commit `pnpm-lock.yaml` changes.
- **Clerk domains.** Preview URLs on `*.vercel.app` need to be allowlisted in Clerk. Add a satellite domain pattern.
- **Playwright browsers in CI**: the `--with-deps` flag installs system libraries; forgetting it causes cryptic failures.
- **`next.config.mjs` `output: "standalone"`** is required for Docker — Vercel ignores it.
- **Don't bake secrets into images.** Docker `ARG` and `ENV` leak into the image history. Inject at runtime via `--env-file`.
