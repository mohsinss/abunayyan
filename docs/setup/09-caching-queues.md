# 09 — Caching, Rate Limiting, Queues (Upstash)

**Phase:** 1 · **Depends on:** 01 · **P0**

Replaces the in-memory `Map`-based rate limiter with Upstash Redis and adds QStash for background jobs / durable webhook delivery.

## Goal

- Distributed rate limiting that works across serverless instances.
- Tiered rate-limit buckets (`api`, `ai`, `auth`).
- Upstash KV for cache helpers.
- QStash for async work: slow emails, AI batch jobs, webhook retry.

## Stack

- **[Upstash Redis](https://upstash.com/redis)** — serverless Redis, REST API, free tier generous.
- **[@upstash/ratelimit](https://github.com/upstash/ratelimit-js)** — sliding window / token bucket.
- **[Upstash QStash](https://upstash.com/qstash)** — HTTP-based job queue with retries + scheduling.

## Steps — Redis + Rate limit

### 1. Create Upstash Redis database

1. Sign up at https://upstash.com.
2. Create a Redis database (region: same as Vercel deployment).
3. Copy REST URL + token → env.

### 2. Install

```bash
pnpm add @upstash/redis @upstash/ratelimit
rm -f lib/middleware/rateLimit.ts   # delete the in-memory version
```

### 3. Redis client

```ts
// lib/ratelimit/redis.ts
import "server-only";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  : null;
```

### 4. Rate-limit buckets

```ts
// lib/ratelimit/index.ts
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

function makeLimiter(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) {
    // Graceful no-op in envs without Redis (local dev without Upstash creds)
    return { limit: async () => ({ success: true, remaining: tokens, reset: Date.now() + 60_000, limit: tokens }) };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix,
  });
}

export const ratelimit = {
  // General API — 100 req / min per identifier
  api: makeLimiter(100, "1 m", "rl:api"),
  // AI routes — 20 req / hour (expensive)
  ai: makeLimiter(20, "1 h", "rl:ai"),
  // Auth-adjacent (forgot-password, magic-link) — 5 per 15 min
  auth: makeLimiter(5, "15 m", "rl:auth"),
  // Public / unauthed endpoints — 30 / min per IP
  public: makeLimiter(30, "1 m", "rl:public"),
};
```

### 5. Use in route handlers

```ts
import { ratelimit } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  const id = userId ?? (await headers()).get("x-forwarded-for") ?? "anon";

  const { success, limit, remaining, reset } = await ratelimit.ai.limit(id);
  if (!success) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(reset),
      },
    });
  }

  // …handler
}
```

### 6. Cache helper

```ts
// lib/cache/index.ts
import "server-only";
import { redis } from "@/lib/ratelimit/redis";

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  if (!redis) return loader();
  const hit = await redis.get<T>(key);
  if (hit) return hit;
  const value = await loader();
  await redis.set(key, value, { ex: ttlSeconds });
  return value;
}
```

Use it to cache anything expensive + deterministic:

```ts
const user = await cached(`user:${clerkId}`, 60, () => getUserByClerkId(clerkId));
```

Invalidate manually on writes (`redis?.del(\`user:${clerkId}\`)`).

## Steps — QStash (background jobs)

### 1. Create QStash token

1. Upstash dashboard → **QStash** → Create.
2. Copy token → `QSTASH_TOKEN`.
3. Copy current + next signing keys → `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.

### 2. Install

```bash
pnpm add @upstash/qstash
```

### 3. Publisher

```ts
// lib/queue/index.ts
import "server-only";
import { Client } from "@upstash/qstash";
import { env } from "@/lib/env";

const qstash = env.QSTASH_TOKEN ? new Client({ token: env.QSTASH_TOKEN }) : null;

export async function enqueue<TPayload>(opts: {
  job: string;          // used only for logs
  url: string;          // public URL of the handler route
  body: TPayload;
  delaySeconds?: number;
  retries?: number;     // default 3
}) {
  if (!qstash) {
    // Local fallback: fire-and-forget fetch
    await fetch(opts.url, { method: "POST", body: JSON.stringify(opts.body), headers: { "content-type": "application/json" } });
    return { messageId: "local-noop" };
  }
  return qstash.publishJSON({
    url: opts.url,
    body: opts.body as object,
    delay: opts.delaySeconds,
    retries: opts.retries ?? 3,
  });
}
```

### 4. Job handler pattern

```ts
// app/api/v1/webhook/qstash/route.ts
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

export const runtime = "nodejs";

async function handler(req: Request) {
  const { job, payload } = await req.json() as { job: string; payload: unknown };

  switch (job) {
    case "send-welcome-email":
      await import("@/lib/email/resend").then((m) => m.sendWelcomeEmail(payload as { to: string; name: string }));
      break;
    case "embed-document":
      await import("@/lib/ai/jobs/embed-document").then((m) => m.run(payload as { documentId: string }));
      break;
    default:
      return new Response(`Unknown job: ${job}`, { status: 400 });
  }

  return new Response(null, { status: 200 });
}

export const POST = verifySignatureAppRouter(handler);
```

### 5. Use from anywhere

```ts
import { enqueue } from "@/lib/queue";
import { env } from "@/lib/env";

await enqueue({
  job: "send-welcome-email",
  url: `${env.NEXT_PUBLIC_APP_URL}/api/v1/webhook/qstash`,
  body: { job: "send-welcome-email", payload: { to: email, name } },
});
```

### 6. Scheduled jobs (cron)

QStash supports cron schedules. Use for periodic cleanup, digest emails, eval runs:

```ts
// one-time setup script
await qstash.schedules.create({
  destination: `${env.NEXT_PUBLIC_APP_URL}/api/v1/webhook/qstash`,
  cron: "0 8 * * *", // daily 8am UTC
  body: JSON.stringify({ job: "daily-digest", payload: {} }),
});
```

## What goes on the queue vs inline

| On queue (QStash) | Inline (direct call) |
|-------------------|----------------------|
| Email sends triggered from webhooks | Email sends from explicit user action (immediate feedback) |
| Document embedding / long AI jobs | Streaming chat |
| Retried webhook delivery | Stripe/Clerk webhook receipt itself |
| Scheduled digests, cleanup | API route handlers |

Rule of thumb: **if it takes >500ms or calls a flaky external service, queue it.**

## Verification checklist

- [ ] First 20 requests in an hour to `/api/v1/ai/chat` succeed; the 21st returns 429.
- [ ] Rate-limit analytics appear in the Upstash console.
- [ ] `cached("test", 60, () => Date.now())` returns the same value twice within 60 s.
- [ ] `enqueue({ job: "send-welcome-email", … })` fires and the handler runs within a few seconds.
- [ ] QStash signature verification rejects a hand-crafted unsigned POST (returns 401).
- [ ] `lib/middleware/rateLimit.ts` is deleted; no imports reference it.

## Gotchas

- **Upstash Redis is eventually consistent across regions.** For rate-limiting that's fine; for counters-of-record, use Postgres.
- **QStash jobs must be HTTP-reachable** — localhost won't work. Use `ngrok` or `vercel dev` + a tunnel for local QStash testing, or rely on the local fallback in `enqueue`.
- **Signing keys rotate.** Upstash publishes `current` and `next`. Using `verifySignatureAppRouter` handles both transparently.
- **QStash at-least-once.** Your handler must be **idempotent** — dedupe by a message key in Redis or Postgres.
- **Cost.** Rate-limit and cache hits are cheap. Don't `redis.set()` on every request without a TTL.
