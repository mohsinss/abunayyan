"use client";

import { ErrorBoundaryUI } from "@/components/error-boundary-ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI error={error} reset={reset} scope="global" backHref="/" backLabel="Home" />;
}
