"use client";

import { ErrorBoundaryUI } from "@/components/error-boundary-ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryUI
      error={error}
      reset={reset}
      scope="dashboard"
      backHref="/dashboard"
      backLabel="Dashboard home"
    />
  );
}
