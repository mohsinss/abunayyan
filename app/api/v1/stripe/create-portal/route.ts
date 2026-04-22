import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireStripe } from "@/lib/payments/stripe";
import { env } from "@/lib/env";
import { getSubscriptionByUserId } from "@/lib/db/queries/subscriptions";
import { normalizeError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const sub = await getSubscriptionByUserId(user.id);
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: { code: "NO_CUSTOMER", message: "No Stripe customer for this user" } },
        { status: 400 },
      );
    }

    const stripe = requireStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return NextResponse.json({ data: { url: portal.url } });
  } catch (err) {
    const n = normalizeError(err);
    return NextResponse.json(
      { error: { code: n.code, message: n.message, details: n.details } },
      { status: n.status },
    );
  }
}
