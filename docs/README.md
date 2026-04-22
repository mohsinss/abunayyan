# 2026 AI-SaaS Boilerplate — Implementation Docs

This directory is the single source of truth for upgrading this repo into a state-of-the-art 2026 AI-SaaS boilerplate that can be forked to spin up 2–3 new web apps per week.

## Who these docs are for

Software engineers (or AI coding agents like Claude Code in agent mode) executing the migration. Every doc is written to be actionable: exact commands, exact file paths, exact code to paste, and a verification checklist at the bottom.

## Read order

1. **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** — phased roadmap, sequencing, and acceptance criteria. Read this first.
2. **[architecture.md](architecture.md)** — target file/folder skeleton, naming conventions, module boundaries. Reference while working.
3. **[setup/](setup/)** — one numbered doc per subsystem. Execute in order; each doc is self-contained.

## Setup docs (execute in order)

| # | Doc | What it does | P |
|---|-----|-------------|---|
| 01 | [setup/01-environment.md](setup/01-environment.md) | Build-time env validation with `@t3-oss/env-nextjs` + Zod | P0 |
| 02 | [setup/02-database.md](setup/02-database.md) | Postgres (Neon) + Drizzle ORM + pgvector for RAG | P0 |
| 03 | [setup/03-authentication.md](setup/03-authentication.md) | Clerk (orgs/RBAC/billing) replacing NextAuth v4 | P0 |
| 04 | [setup/04-ui-components.md](setup/04-ui-components.md) | shadcn/ui + react-hook-form + zod resolvers | P0 |
| 05 | [setup/05-ai-sdk.md](setup/05-ai-sdk.md) | Vercel AI SDK + Anthropic primary (streaming, tool-use, caching) | P0 |
| 06 | [setup/06-payments.md](setup/06-payments.md) | Stripe subscriptions + Clerk Billing integration | P1 |
| 07 | [setup/07-email.md](setup/07-email.md) | Resend + React Email templates | P1 |
| 08 | [setup/08-observability.md](setup/08-observability.md) | Sentry (errors/tracing) + PostHog (analytics/flags/replay) | P0 |
| 09 | [setup/09-caching-queues.md](setup/09-caching-queues.md) | Upstash Redis (rate limit, cache) + QStash (jobs/webhooks) | P0 |
| 10 | [setup/10-testing.md](setup/10-testing.md) | Vitest (unit) + Playwright (E2E) + MSW | P1 |
| 11 | [setup/11-ci-deployment.md](setup/11-ci-deployment.md) | GitHub Actions CI, Vercel preview deploys, Dockerfile | P1 |
| 12 | [setup/12-scaffold-cli.md](setup/12-scaffold-cli.md) | `pnpm new-project` CLI to spin up a fresh app in <5 min | P1 |

## Acceptance criteria (whole project)

When every setup doc's verification checklist passes, you can:

- Fork this repo, run `pnpm new-project acme`, and have a deployable, typed, tested, monitored AI SaaS in under 10 minutes.
- Ship a streaming AI chat feature with tool-use and prompt caching on day 1.
- Have typed DB queries, typed env vars, typed API contracts end-to-end.
- Preview-deploy every PR automatically, with Sentry errors and PostHog events wired.
- Run `pnpm test` and `pnpm test:e2e` with meaningful coverage.

## Conventions used in these docs

- **Commands** assume `pnpm`. If you use `npm`/`yarn`/`bun`, substitute.
- **Paths** are relative to the repo root unless noted.
- **Code blocks** labeled with a path (`// lib/ai/anthropic.ts`) are meant to be pasted into that file verbatim.
- **Verification checklists** at the end of each doc are the gate for moving to the next doc.
- **TODO markers** (`// TODO: ENV`) mark spots where the engineer must paste secrets or IDs.

## Prior-state references

- [../MODERNIZATION_ANALYSIS.md](../MODERNIZATION_ANALYSIS.md) — original gap analysis (grade: C+). These docs supersede it.
- [../MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) — prior libs→lib consolidation. Still valid as historical context.
