"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/stripe/create-portal", { method: "POST" });
      const data = await res.json();
      if (data?.data?.url) window.location.href = data.data.url;
      else toast.error(data?.error?.message ?? "Could not open portal");
    } finally {
      setLoading(false);
    }
  }

  if (!hasSubscription) {
    return (
      <Button asChild>
        <Link href="/pricing">See plans</Link>
      </Button>
    );
  }

  return (
    <Button onClick={openPortal} disabled={loading}>
      Manage subscription
    </Button>
  );
}
