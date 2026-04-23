import Link from "next/link";
import { Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";

// Navy for light mode; dark mode inverts to near-white so text/icons remain legible
// against the dark navy background.
const brandText = "text-[#0a1f44] dark:text-slate-100";
const brandIcon = "text-[#0a1f44] dark:text-slate-200";

export default function LandingPage() {
  return (
    <div>
      <section className="container py-24 text-center">
        <h1 className={`mx-auto max-w-3xl text-5xl font-bold tracking-tight ${brandText}`}>
          {config.appName}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          {config.appDescription}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button
            size="lg"
            asChild
            className="bg-[#0a1f44] text-white hover:opacity-90 dark:bg-slate-100 dark:text-[#0a1f44] dark:hover:bg-white"
          >
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="border-[#0a1f44] text-[#0a1f44] hover:bg-[#0a1f44]/5 dark:border-slate-300 dark:text-slate-100 dark:hover:bg-slate-100/10"
          >
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Sparkles className={`h-6 w-6 ${brandIcon}`} />
            <CardTitle className={`mt-3 ${brandText}`}>Streaming AI</CardTitle>
            <CardDescription>Claude Sonnet 4.6 with tool-use and prompt caching.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the Vercel AI SDK to stream tokens, call tools, and get structured outputs.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Zap className={`h-6 w-6 ${brandIcon}`} />
            <CardTitle className={`mt-3 ${brandText}`}>Typed data layer</CardTitle>
            <CardDescription>Postgres + Drizzle + pgvector, RAG-ready.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Zero-cost serverless DB on Neon with vector search for document retrieval.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Shield className={`h-6 w-6 ${brandIcon}`} />
            <CardTitle className={`mt-3 ${brandText}`}>Batteries included</CardTitle>
            <CardDescription>Clerk, Stripe, Resend, PostHog, Sentry.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Auth, billing, email, analytics, and error tracking wired from day one.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
