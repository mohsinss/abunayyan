"use client";

import { ErrorBoundaryUI } from "@/components/error-boundary-ui";

export default function ChatError({
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
      scope="chat"
      backHref="/chat"
      backLabel="All chats"
    />
  );
}
