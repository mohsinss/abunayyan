# 01 — Environment & Secrets

**Phase:** 1 · **Depends on:** nothing · **P0**

Every other doc depends on env vars being validated. Do this first.

## Goal

- Validate env vars at **build time** (fail the build if something's missing).
- Separate **server** secrets from **client** (`NEXT_PUBLIC_*`) vars with a typed split.
- Provide a generated `.env.example` that a new-project scaffold can copy.
- One import (`import { env } from "@/lib/env"`) — never touch `process.env` in feature code.

## Stack

- [`@t3-oss/env-nextjs`](https://env.t3.gg/docs/nextjs) — Next-specific wrapper around Zod.
- `zod` — already installed.

## Steps

### 1. Install

```bash
pnpm add @t3-oss/env-nextjs
```

### 2. Replace `lib/config/env.ts` with `lib/env.ts`

Delete the existing `lib/config/env.ts` (which does runtime-only validation). Create `lib/env.ts`:

```ts
// lib/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Database — doc 02
    DATABASE_URL: z.string().url(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),

    // Clerk — doc 03
    CLERK_SECRET_KEY: z.string().startsWith("sk_"),
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().startsWith("whsec_"),

    // Stripe — doc 06
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

    // AI — doc 05
    ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
    OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

    // Email — doc 07
    RESEND_API_KEY: z.string().startsWith("re_").optional(),
    EMAIL_FROM: z.string().email().optional(),

    // Upstash — doc 09
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

    // Sentry — doc 08
    SENTRY_AUTH_TOKEN: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_").optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },

  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

### 3. Add build-time validation

In `next.config.mjs`, import the env file at the top so Next evaluates it during `next build`:

```js
// next.config.mjs
import "./lib/env.js"; // validates env at build time; fails the build on missing vars

/** @type {import('next').NextConfig} */
const nextConfig = {
  // …existing config
};

export default nextConfig;
```

If you prefer TS-only, use the `jiti` approach per the t3-env docs.

### 4. Write `.env.example`

```bash
# .env.example — copy to .env.local and fill in

# Core
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Neon — doc 02)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@host-direct/db?sslmode=require

# Auth — Clerk (doc 03)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXX
CLERK_SECRET_KEY=sk_test_XXX
CLERK_WEBHOOK_SIGNING_SECRET=whsec_XXX

# AI — Anthropic primary (doc 05)
ANTHROPIC_API_KEY=sk-ant-XXX
# OPENAI_API_KEY=sk-XXX  # optional fallback

# Payments — Stripe (doc 06)
# STRIPE_SECRET_KEY=sk_test_XXX
# STRIPE_WEBHOOK_SECRET=whsec_XXX

# Email — Resend (doc 07)
# RESEND_API_KEY=re_XXX
# EMAIL_FROM=hello@yourdomain.com

# Observability — Sentry + PostHog (doc 08)
# NEXT_PUBLIC_SENTRY_DSN=https://XXX@sentry.io/XXX
# SENTRY_AUTH_TOKEN=sntrys_XXX
# NEXT_PUBLIC_POSTHOG_KEY=phc_XXX
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Upstash (doc 09)
# UPSTASH_REDIS_REST_URL=https://XXX.upstash.io
# UPSTASH_REDIS_REST_TOKEN=XXX
# QSTASH_TOKEN=XXX
# QSTASH_CURRENT_SIGNING_KEY=XXX
# QSTASH_NEXT_SIGNING_KEY=XXX
```

Commit `.env.example`; `.env*` (except `.example`) is already in `.gitignore` — verify.

### 5. Replace all `process.env.X` usages

```bash
# Find leftover direct usage
rg "process\.env\." --type ts --type tsx -g '!lib/env.ts' -g '!next.config.mjs'
```

Every hit must be migrated to `import { env } from "@/lib/env"` + `env.X`.

### 6. Secrets management (recommended, optional)

For real deployments, use **[Doppler](https://www.doppler.com/)** or **[Infisical](https://infisical.com/)** to inject env vars into CI and preview deployments. The scaffold CLI (doc 12) should prompt for a Doppler project name and init it.

Locally, `.env.local` is fine — just never commit it.

## Verification checklist

- [ ] `pnpm build` fails with a clear error message if `DATABASE_URL` is missing.
- [ ] `rg "process\.env\."` (excluding `lib/env.ts` and `next.config.mjs`) returns zero results.
- [ ] `import { env } from "@/lib/env"` gives full IntelliSense autocomplete for every var.
- [ ] `.env.example` exists and is committed; `.env.local` is gitignored.
- [ ] Setting `SKIP_ENV_VALIDATION=1 pnpm build` succeeds (escape hatch for Docker builds).

## Gotchas

- **Client vars must be prefixed `NEXT_PUBLIC_`.** The t3-env config will error if a client var is missing the prefix.
- **`runtimeEnv` is mandatory for Next.js** because bundlers inline `process.env.X` — you must list every key explicitly.
- **Don't add `SKIP_ENV_VALIDATION` to CI** — only Docker builds (where env is injected at runtime, not build time) should use it.
