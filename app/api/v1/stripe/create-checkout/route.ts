import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireStripe } from "@/lib/payments/stripe";
import { env } from "@/lib/env";
import { createCheckoutSchema } from "@/lib/validation/schemas";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { normalizeError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = createCheckoutSchema.parse(body);

    const stripe = requireStripe();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: parsed.priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      success_url:
        parsed.successUrl ?? `${env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url:
        parsed.cancelUrl ?? `${env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    await capture({
      distinctId: user.id,
      event: EVENTS.checkout_started,
      properties: { priceId: parsed.priceId },
    }).catch(() => {});

    return NextResponse.json({ data: { url: checkout.url } });
  } catch (err) {
    const n = normalizeError(err);
    return NextResponse.json(
      { error: { code: n.code, message: n.message, details: n.details } },
      { status: n.status },
    );
  }
}
