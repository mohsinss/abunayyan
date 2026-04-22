"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode, useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { SessionProvider, useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";

if (typeof window !== "undefined" && env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: "history_change",
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-sensitive]",
    },
  });
}

function UserIdentity() {
  const { data: session } = useSession();
  const user = session?.user;
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, { email: user.email ?? undefined, name: user.name ?? undefined });
      Sentry.setUser({ id: user.id, email: user.email ?? undefined });
    } else {
      posthog.reset();
      Sentry.setUser(null);
    }
  }, [user?.id, user?.email, user?.name]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const content = (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <UserIdentity />
      {children}
      <Toaster richColors position="top-right" />
    </NextThemesProvider>
  );

  const themed = env.NEXT_PUBLIC_POSTHOG_KEY ? (
    <PHProvider client={posthog}>{content}</PHProvider>
  ) : (
    content
  );

  return <SessionProvider>{themed}</SessionProvider>;
}
