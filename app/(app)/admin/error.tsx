"use client";

import { ErrorBoundaryUI } from "@/components/error-boundary-ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryUI error={error} reset={reset} scope="admin" backHref="/admin" backLabel="Admin home" />
  );
}
