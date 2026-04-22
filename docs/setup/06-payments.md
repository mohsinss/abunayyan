# 06 — Payments (Stripe)

**Phase:** 2 · **Depends on:** 02, 03 · **P1**

Keeps Stripe but rewires it against the new Postgres `subscriptions` table and Clerk user IDs. Every Stripe event is idempotent, verified, and normalized into a single `subscriptions` row per user.

## Goal

- Stripe Checkout for new subscriptions.
- Stripe Billing Portal for self-service management.
- Webhook handler that normalizes all relevant events into the `subscriptions` table.
- One source of truth for "does this user have access?" — the `subscriptions.has_access` column.
- Clerk publicMetadata synced with subscription tier so client-side gating is instant.

## Stack

- **`stripe`** (already installed, latest v17+).
- Webhook signing via Stripe's built-in signature verification.

## Decision: Clerk Billing vs raw Stripe

Clerk now ships a billing product built on Stripe. For most SaaS apps we're building, **use raw Stripe** because:
- You own the code; swapping Clerk out later is trivial.
- Clerk Billing is young (2025); fewer edge-case docs.
- Metered/usage billing isn't yet first-class in Clerk Billing.

Revisit if you ship a B2B app with orgs and want seat-based billing — Clerk Billing saves time there.

## Steps

### 1. Plans config

Keep `config.ts` as the plan catalog, but simplify to a flat list keyed by tier:

```ts
// config.ts (excerpt)
export const plans = [
  {
    tier: "starter",
    name: "Starter",
    priceId: {
      dev: "price_XXX_dev_starter",
      prod: "price_XXX_prod_starter",
    },
    price: 29,
    features: ["Up to 5 projects", "Email support"],
  },
  {
    tier: "pro",
    name: "Pro",
    priceId: {
      dev: "price_XXX_dev_pro",
      prod: "price_XXX_prod_pro",
    },
    price: 99,
    isFeatured: true,
    features: ["Unlimited projects", "Priority support", "AI credits"],
  },
] as const;

export type PlanTier = typeof plans[number]["tier"];
```

### 2. Stripe client

```ts
// lib/payments/stripe.ts
import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY required for payments");

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
  appInfo: { name: process.env.NEXT_PUBLIC_APP_URL ?? "boilerplate", version: "1.0.0" },
});
```

### 3. Checkout route

```ts
// app/api/v1/stripe/create-checkout/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/payments/stripe";
import { env } from "@/lib/env";
import { getUserByClerkId } from "@/lib/db/queries/users";

const schema = z.object({
  priceId: z.string().startsWith("price_"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await getUserByClerkId(userId);
  const clerk = await currentUser();
  const email = user?.email ?? clerk?.emailAddresses[0]?.emailAddress;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: parsed.data.priceId, quantity: 1 }],
    customer_email: email,
    client_reference_id: userId,
    metadata: { clerkUserId: userId },
    subscription_data: { metadata: { clerkUserId: userId } },
    success_url: parsed.data.successUrl ?? `${env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: parsed.data.cancelUrl ?? `${env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
  });

  return NextResponse.json({ url: session.url });
}
```

### 4. Billing portal

```ts
// app/api/v1/stripe/create-portal/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/payments/stripe";
import { env } from "@/lib/env";
import { db, subscriptions, users } from "@/db";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!row?.customerId) return NextResponse.json({ error: "No customer" }, { status: 400 });

  const session = await stripe.billingPortal.sessions.create({
    customer: row.customerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
```

### 5. Webhook handler

Normalize every relevant event into the `subscriptions` table. Four events matter: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

```ts
// app/api/v1/webhook/stripe/route.ts
import { headers } from "next/headers";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { stripe } from "@/lib/payments/stripe";
import { env } from "@/lib/env";
import { db, subscriptions, users } from "@/db";
import { clerkClient } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";
import { sendReceiptEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) return new Response("Missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err }, "Stripe signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = (session.metadata?.clerkUserId ?? session.client_reference_id)!;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
        await upsertSubscription(clerkUserId, sub);
        await syncClerkMetadata(clerkUserId, sub);

        if (session.customer_email) {
          await sendReceiptEmail({
            to: session.customer_email,
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency ?? "usd",
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerkUserId;
        if (!clerkUserId) break;
        await upsertSubscription(clerkUserId, sub);
        await syncClerkMetadata(clerkUserId, sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        logger.warn({ customer: inv.customer, attempt: inv.attempt_count }, "Payment failed");
        // TODO: email the user, maybe revoke access after N attempts
        break;
      }
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Webhook handler error");
    return new Response("Handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}

async function upsertSubscription(clerkUserId: string, sub: Stripe.Subscription) {
  const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
  if (!userRow) return;

  const priceId = sub.items.data[0]?.price.id;
  const isActive = sub.status === "active" || sub.status === "trialing";

  await db.insert(subscriptions).values({
    userId: userRow.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    hasAccess: isActive,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  }).onConflictDoUpdate({
    target: subscriptions.stripeSubscriptionId,
    set: {
      stripePriceId: priceId,
      status: sub.status,
      hasAccess: isActive,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      updatedAt: new Date(),
    },
  });
}

async function syncClerkMetadata(clerkUserId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  const isActive = sub.status === "active" || sub.status === "trialing";
  const client = await clerkClient();
  await client.users.updateUser(clerkUserId, {
    publicMetadata: {
      hasAccess: isActive,
      priceId,
      status: sub.status,
    },
  });
}
```

### 6. Register webhook in Stripe

- Stripe dashboard → **Developers** → **Webhooks** → **Add endpoint**
- URL: `https://your-app.com/api/v1/webhook/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET`

For local dev:

```bash
pnpm dlx stripe listen --forward-to localhost:3000/api/v1/webhook/stripe
```

### 7. Client-side access gate

Instant gating using Clerk metadata (no DB round-trip):

```tsx
// components/paywall.tsx
"use client";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Paywall({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  const hasAccess = user?.publicMetadata?.hasAccess === true;
  if (hasAccess) return <>{children}</>;
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="mb-4 text-muted-foreground">Upgrade to unlock.</p>
      <Button asChild><Link href="/pricing">See plans</Link></Button>
    </div>
  );
}
```

Server-side, query `subscriptions.has_access` directly — Clerk metadata is the fast path, Postgres is the source of truth.

### 8. Checkout button

```tsx
// components/marketing/checkout-button.tsx
"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CheckoutButton({ priceId, children }: { priceId: string; children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (!isSignedIn) { window.location.href = "/sign-up"; return; }
    setLoading(true);
    const res = await fetch("/api/v1/stripe/create-checkout", {
      method: "POST",
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { toast.error("Checkout failed"); setLoading(false); }
  }

  return <Button onClick={onClick} disabled={loading}>{children}</Button>;
}
```

### 9. Delete legacy duplicates

```bash
rm -rf app/api/stripe/ app/api/webhook/stripe/   # unversioned duplicates
```

Update `MIGRATION_GUIDE.md` to mark the split resolved.

## Verification checklist

- [ ] `pnpm dlx stripe listen` + a test checkout writes a row to `subscriptions` with `has_access = true`.
- [ ] Clerk `publicMetadata.hasAccess` reflects the subscription state within ~1 s of checkout.
- [ ] Cancelling from the portal flips `has_access` to `false` on the next webhook.
- [ ] Signature verification rejects a hand-crafted request (returns 400).
- [ ] No duplicate `app/api/stripe` or `app/api/webhook` folders remain.
- [ ] `<Paywall>` wraps a test page and hides content for users without access.

## Gotchas

- **Always use `clerkUserId` from metadata**, not from `customer_email` lookup — users can change email in Clerk.
- **Idempotency.** Stripe retries webhooks. The `onConflictDoUpdate` handles this for us; do not add "has this event been processed" logic unless you're issuing side effects beyond the DB (e.g., emails — use an `events_processed` table keyed on `event.id`).
- **Local webhook signing secret differs from prod.** The `stripe listen` CLI gives a `whsec_XXX` unique to that session. Copy it per-session into `.env.local`.
- **Test clocks.** Use Stripe test clocks to simulate renewals and expirations without waiting a month.
- **Clerk Billing.** If you later switch to Clerk Billing for a B2B app, the abstractions in `lib/payments/stripe.ts` make the swap local to that file.
