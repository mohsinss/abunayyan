"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  priceId,
  children,
}: {
  priceId: string;
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (status !== "authenticated") {
      window.location.href = `/sign-up?callbackUrl=${encodeURIComponent("/pricing")}`;
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/stripe/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data?.data?.url) {
        window.location.href = data.data.url;
      } else {
        toast.error(data?.error?.message ?? "Checkout failed");
        setLoading(false);
      }
    } catch (err) {
      toast.error("Checkout failed");
      setLoading(false);
    }
  }

  return (
    <Button onClick={onClick} disabled={loading} className="w-full">
      {children}
    </Button>
  );
}
