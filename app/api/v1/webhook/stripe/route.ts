import { headers } from "next/headers";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { requireStripe } from "@/lib/payments/stripe";
import { env } from "@/lib/env";
import { db, users } from "@/db";
import { upsertSubscription } from "@/lib/db/queries/subscriptions";
import { captureError, logger } from "@/lib/logger";
import { sendReceiptEmail, sendSubscriptionCancelledEmail } from "@/lib/email/resend";
import { capture, EVENTS } from "@/lib/analytics/posthog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Stripe not configured", { status: 500 });

  const sig = (await headers()).get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const raw = await req.text();
  const stripe = requireStripe();

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
        const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
        if (!userId) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
        await syncSubscription(userId, sub);

        if (session.customer_email && env.RESEND_API_KEY) {
          await sendReceiptEmail({
            to: session.customer_email,
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency ?? "usd",
          }).catch((err) => captureError(err, { flow: "receipt-email" }));
        }

        await capture({
          distinctId: userId,
          event: EVENTS.checkout_succeeded,
          properties: {
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency,
          },
        }).catch(() => {});
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await syncSubscription(userId, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await syncSubscription(userId, sub);

        const userRow = (
          await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
        )[0];
        if (userRow?.email && env.RESEND_API_KEY) {
          await sendSubscriptionCancelledEmail({ to: userRow.email }).catch((err) =>
            captureError(err, { flow: "cancel-email" }),
          );
        }
        await capture({
          distinctId: userId,
          event: EVENTS.subscription_cancelled,
        }).catch(() => {});
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        logger.warn({ customer: inv.customer, attempt: inv.attempt_count }, "Payment failed");
        break;
      }
    }
  } catch (err) {
    captureError(err, { type: event.type, flow: "stripe-webhook" });
    return new Response("Handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}

async function syncSubscription(userId: string, sub: Stripe.Subscription) {
  const userRow = (
    await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!userRow) return;

  const priceId = sub.items.data[0]?.price.id ?? null;
  const isActive = sub.status === "active" || sub.status === "trialing";

  await upsertSubscription({
    userId: userRow.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    hasAccess: isActive,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
  });
}
