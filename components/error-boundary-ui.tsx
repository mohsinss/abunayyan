"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export type ErrorBoundaryUIProps = {
  error: Error & { digest?: string };
  reset: () => void;
  scope: "global" | "dashboard" | "admin" | "chat";
  /** Optional extra link rendered underneath "Try again". */
  backHref?: string;
  backLabel?: string;
};

/**
 * Shared client-side error UI used by every per-route error.tsx boundary.
 * Captures to Sentry once on mount with a scope tag + error digest, then
 * renders a friendly "Try again" control.
 */
export function ErrorBoundaryUI({
  error,
  reset,
  scope,
  backHref,
  backLabel,
}: ErrorBoundaryUIProps) {
  useEffect(() => {
    Sentry.withScope((s) => {
      s.setTag("error_boundary", scope);
      if (error.digest) s.setTag("digest", error.digest);
      Sentry.captureException(error);
    });
  }, [error, scope]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-neutral-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-neutral-600">
        We&rsquo;ve been notified. Try again, and if it happens twice, reach out to support.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-neutral-400">digest: {error.digest}</p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset}>Try again</Button>
        {backHref && backLabel && (
          <Button variant="outline" asChild>
            <a href={backHref}>{backLabel}</a>
          </Button>
        )}
      </div>
    </div>
  );
}
