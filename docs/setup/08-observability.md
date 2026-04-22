# 08 — Observability (Sentry + PostHog)

**Phase:** 1 · **Depends on:** 01 · **P0**

Two tools, zero overlap:

- **Sentry** — errors, performance tracing, release health.
- **PostHog** — product analytics, feature flags, session replay, A/B tests.

Together they answer: *"what broke?"* (Sentry) and *"what are users doing and should we ship this?"* (PostHog).

## Goal

- Every uncaught error in browser + server → Sentry with source maps and user context.
- Every significant user action → PostHog event with consistent naming.
- Feature flags drive-able from the PostHog UI.
- Session replay on by default (with masking for sensitive elements).

## Stack

- **`@sentry/nextjs`**
- **`posthog-js`** (browser) + **`posthog-node`** (server)

## Steps — Sentry

### 1. Create a Sentry project

1. Sign up at https://sentry.io, create a Next.js project.
2. Copy DSN → `NEXT_PUBLIC_SENTRY_DSN`.
3. Generate auth token (Settings → Auth Tokens, scope: `project:releases`, `project:write`) → `SENTRY_AUTH_TOKEN`.

### 2. Install

```bash
pnpm add @sentry/nextjs
pnpm dlx @sentry/wizard@latest -i nextjs
```

The wizard creates:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`
- modifies `next.config.mjs` to wrap with `withSentryConfig`

### 3. Tune configs

```ts
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      maskAllInputs: true,
      blockAllMedia: false,
    }),
  ],
  beforeSend(event) {
    // Don't send events from localhost unless explicitly enabled
    if (env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SENTRY_DEV) return null;
    return event;
  },
});
```

```ts
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  spotlight: env.NODE_ENV === "development",
});
```

### 4. User context

Wire Clerk `userId` into Sentry scope. Create a client-side provider:

```tsx
// components/sentry-user.tsx
"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";

export function SentryUser() {
  const { user } = useUser();
  useEffect(() => {
    if (user) Sentry.setUser({ id: user.id, email: user.emailAddresses[0]?.emailAddress });
    else Sentry.setUser(null);
  }, [user]);
  return null;
}
```

Mount `<SentryUser />` in `components/providers.tsx`.

### 5. Server-side error capture

Replace `console.error` with Sentry + pino logger:

```ts
// lib/logger.ts
import "server-only";
import pino from "pino";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Re-export a "captureError" that logs + sends to Sentry
export function captureError(err: unknown, context?: Record<string, unknown>) {
  logger.error({ err, ...context }, err instanceof Error ? err.message : "Unknown error");
  Sentry.captureException(err, { extra: context });
}
```

Install pino: `pnpm add pino`.

Delete `lib/infrastructure/logger.ts`.

### 6. Release health

CI should upload source maps + tag releases:

```yaml
# .github/workflows/ci.yml (excerpt — see doc 11)
- name: Build
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: your-project
  run: pnpm build
```

`@sentry/nextjs` handles source-map upload automatically when `SENTRY_AUTH_TOKEN` is set at build time.

## Steps — PostHog

### 1. Create a PostHog project

1. Sign up at https://posthog.com (cloud) or self-host.
2. Copy project API key → `NEXT_PUBLIC_POSTHOG_KEY=phc_XXX`.
3. Set host → `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`.

### 2. Install

```bash
pnpm add posthog-js posthog-node
pnpm remove next-plausible crisp-sdk-web   # replacing both
```

### 3. Client SDK

```tsx
// components/posthog-provider.tsx
"use client";
import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useUser } from "@clerk/nextjs";
import { env } from "@/lib/env";

if (typeof window !== "undefined" && env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: "history_change",
    capture_pageleave: true,
    session_recording: { maskAllInputs: true, maskTextSelector: "[data-sensitive]" },
    persistence: "localStorage+cookie",
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.firstName,
      });
    } else {
      posthog.reset();
    }
  }, [user]);
  return <Provider client={posthog}>{children}</Provider>;
}
```

Mount `<PostHogProvider>` in `components/providers.tsx`, inside `ThemeProvider`.

### 4. Server SDK + event helpers

```ts
// lib/analytics/posthog.ts
import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

const client = env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, { host: env.NEXT_PUBLIC_POSTHOG_HOST, flushAt: 1, flushInterval: 0 })
  : null;

// Event name constants — reuse these, don't invent strings ad-hoc
export const EVENTS = {
  user_signed_up: "user_signed_up",
  project_created: "project_created",
  checkout_started: "checkout_started",
  checkout_succeeded: "checkout_succeeded",
  subscription_cancelled: "subscription_cancelled",
  ai_completion: "ai_completion",
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];

export async function capture({ distinctId, event, properties }: { distinctId: string; event: EventName; properties?: Record<string, unknown> }) {
  if (!client) return;
  client.capture({ distinctId, event, properties });
  await client.flush();
}

export async function shutdownPostHog() {
  await client?.shutdown();
}
```

### 5. Feature flags

```ts
// lib/flags/index.ts
import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

const client = env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, { host: env.NEXT_PUBLIC_POSTHOG_HOST })
  : null;

export async function isFeatureEnabled(flagKey: string, distinctId: string): Promise<boolean> {
  if (!client) return false;
  return (await client.isFeatureEnabled(flagKey, distinctId)) ?? false;
}

export async function getFeaturePayload<T = unknown>(flagKey: string, distinctId: string): Promise<T | null> {
  if (!client) return null;
  return (await client.getFeatureFlagPayload(flagKey, distinctId)) as T | null;
}
```

Client-side, use `posthog.isFeatureEnabled("new-chat-ui")` inside components.

### 6. Standard events to emit

Wire these from the start — they compose into every product dashboard you'll ever want:

| When | Event | Props |
|------|-------|-------|
| Clerk `user.created` webhook | `user_signed_up` | email, signup_method |
| Project created | `project_created` | project_id |
| Checkout session started | `checkout_started` | price_id, plan_tier |
| `checkout.session.completed` | `checkout_succeeded` | amount, plan_tier |
| `customer.subscription.deleted` | `subscription_cancelled` | reason (if known) |
| AI completion finishes | `ai_completion` | model, input_tokens, output_tokens, tool_calls, duration_ms |

### 7. Session replay masking

Mark sensitive elements so replays don't leak:

```tsx
<Input data-sensitive {...field} />
<div data-sensitive>{user.ssn}</div>
```

## Tooling you're deliberately **not** installing

| Skipped | Why |
|---------|-----|
| DataDog | Enterprise-priced, overkill for weekly-ship apps |
| New Relic | Same |
| LogRocket | PostHog replay replaces it |
| Mixpanel / Amplitude | PostHog analytics replaces them |
| LaunchDarkly | PostHog feature flags replace it |
| Plausible | PostHog captures pageviews too |
| Crisp | Add Intercom / Plain per-project only if needed |

## Verification checklist

- [ ] `throw new Error("Test")` in a route handler appears in Sentry within ~30 s.
- [ ] A production build uploads source maps to Sentry (check release artifacts).
- [ ] Sentry shows the correct Clerk `user.id` on captured events.
- [ ] PostHog shows a `$pageview` for every navigation.
- [ ] `capture({ event: EVENTS.project_created, … })` lands in PostHog in dev.
- [ ] Creating a feature flag `new-chat-ui` and toggling it flips behavior in the app.
- [ ] Session replay records a session; masked inputs show `***`.

## Gotchas

- **Sentry + Next.js 15 App Router**: make sure `instrumentation.ts` is at the repo root and `experimental.instrumentationHook` is enabled if required by your Next version.
- **PostHog sampling**: `tracesSampleRate: 1.0` on Sentry + 100% PostHog events can blow the free tier. Drop production sampling to 0.1.
- **Ad blockers** drop both SDKs on ~30% of sessions. For critical events (signup, checkout) emit **server-side** too.
- **PII leaks via replay.** Default `maskAllInputs: true` is essential. Audit replay videos monthly.
- **Don't double-init.** PostHog inits once per page load; don't put it inside a `useEffect` that reruns.
