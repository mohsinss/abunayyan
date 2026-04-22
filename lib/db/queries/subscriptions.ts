import "server-only";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/db";

export async function getSubscriptionByUserId(userId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSubscription(input: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  status: string;
  hasAccess: boolean;
  currentPeriodEnd: Date | null;
}) {
  const [row] = await db
    .insert(subscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        stripePriceId: input.stripePriceId,
        status: input.status,
        hasAccess: input.hasAccess,
        currentPeriodEnd: input.currentPeriodEnd,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
