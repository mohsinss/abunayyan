import Link from "next/link";
import { Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import config from "@/config";

export default function LandingPage() {
  return (
    <div>
      <section className="container py-24 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight">
          {config.appName}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          {config.appDescription}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Sparkles className="h-6 w-6" />
            <CardTitle className="mt-3">Streaming AI</CardTitle>
            <CardDescription>Claude Sonnet 4.6 with tool-use and prompt caching.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the Vercel AI SDK to stream tokens, call tools, and get structured outputs.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Zap className="h-6 w-6" />
            <CardTitle className="mt-3">Typed data layer</CardTitle>
            <CardDescription>Postgres + Drizzle + pgvector, RAG-ready.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Zero-cost serverless DB on Neon with vector search for document retrieval.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Shield className="h-6 w-6" />
            <CardTitle className="mt-3">Batteries included</CardTitle>
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
