import { Check } from "lucide-react";
import { CheckoutButton } from "@/components/marketing/checkout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import config from "@/config";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="container py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Pricing</h1>
        <p className="mt-3 text-muted-foreground">Simple plans. Cancel anytime.</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {config.stripe.plans.map((plan) => (
          <Card key={plan.tier} className={cn(plan.isFeatured && "border-primary shadow-lg")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.isFeatured && <Badge>Most popular</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <div className="flex items-baseline gap-2 pt-4">
                {plan.priceAnchor && (
                  <span className="text-muted-foreground line-through">
                    {formatCurrency(plan.priceAnchor)}
                  </span>
                )}
                <span className="text-4xl font-bold">{formatCurrency(plan.price)}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f.name} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{f.name}</span>
                  </li>
                ))}
              </ul>
              <CheckoutButton priceId={isDev ? plan.priceId.dev : plan.priceId.prod}>
                {plan.isFeatured ? "Start free trial" : `Choose ${plan.name}`}
              </CheckoutButton>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
