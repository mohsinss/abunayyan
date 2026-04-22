import type { ConfigProps } from "@/types/config";

const config = {
  appName: "Abunayyan",
  appDescription:
    "A 2026 AI-SaaS boilerplate: Next.js 15, React 19, Auth.js v5, Drizzle + Postgres + pgvector, Vercel AI SDK, Stripe, Resend.",
  domainName: "abunayyan.com",
  stripe: {
    plans: [
      {
        tier: "hobby",
        priceId: {
          dev: "price_1SLMZRRrDsnlCBCJXitSQ5mp",
          prod: "price_1SLMZRRrDsnlCBCJXitSQ5mp",
        },
        name: "Hobby",
        description: "Perfect to try things out",
        price: 19,
        priceAnchor: 29,
        features: [
          { name: "5 projects" },
          { name: "AI chat" },
          { name: "Email support" },
        ],
      },
      {
        tier: "standard",
        priceId: {
          dev: "price_1SLMZ8RrDsnlCBCJWxgaTkxk",
          prod: "price_1SLMZ8RrDsnlCBCJWxgaTkxk",
        },
        isFeatured: true,
        name: "Standard",
        description: "For growing teams",
        price: 49,
        priceAnchor: 79,
        features: [
          { name: "Unlimited projects" },
          { name: "AI chat with tool use" },
          { name: "Priority support" },
          { name: "RAG over your documents" },
        ],
      },
      {
        tier: "unlimited",
        priceId: {
          dev: "price_1SLMYURrDsnlCBCJ90WgXWwG",
          prod: "price_1SLMYURrDsnlCBCJ90WgXWwG",
        },
        name: "Unlimited",
        description: "For scaling businesses",
        price: 199,
        priceAnchor: 299,
        features: [
          { name: "Everything in Standard" },
          { name: "Dedicated support" },
          { name: "Custom integrations" },
          { name: "Usage-based limits removed" },
        ],
      },
    ],
  },
  email: {
    from: "Magic Create <onboarding@resend.dev>",
    supportEmail: "mohsinb.alshammari@gmail.com",
  },
  auth: {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    afterSignInUrl: "/dashboard",
    afterSignUpUrl: "/dashboard",
  },
} satisfies ConfigProps;

export default config;
export type Plan = (typeof config.stripe.plans)[number];
export type PlanTier = Plan["tier"];
