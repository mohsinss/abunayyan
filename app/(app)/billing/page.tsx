import { requireUser } from "@/lib/auth/session";
import { getSubscriptionByUserId } from "@/lib/db/queries/subscriptions";
import { BillingActions } from "@/components/billing-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await requireUser();
  const sub = user.id ? await getSubscriptionByUserId(user.id) : null;

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-3xl font-bold">Billing</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Subscription
            {sub ? (
              <Badge variant={sub.hasAccess ? "default" : "secondary"}>{sub.status}</Badge>
            ) : (
              <Badge variant="secondary">none</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {sub?.hasAccess
              ? "You have active access."
              : "Subscribe to unlock premium features."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingActions hasSubscription={!!sub} />
        </CardContent>
      </Card>
    </div>
  );
}
