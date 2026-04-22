import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

if (!env.STRIPE_SECRET_KEY) {
  // Don't throw at import time — some routes won't need Stripe. Callers check stripe == null.
}

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) throw new Error("Stripe not configured (missing STRIPE_SECRET_KEY)");
  return stripe;
}
