"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  callbackUrl = "/dashboard",
  label = "Continue with Google",
}: {
  callbackUrl?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        signIn("google", { callbackUrl });
      }}
    >
      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.35 11.1H12v2.98h5.38c-.23 1.4-1.68 4.1-5.38 4.1-3.24 0-5.87-2.67-5.87-5.98s2.63-5.98 5.87-5.98c1.84 0 3.08.78 3.79 1.45l2.58-2.5C16.9 3.86 14.7 3 12 3 7.03 3 3 7 3 12s4.03 9 9 9c5.2 0 8.64-3.63 8.64-8.75 0-.59-.07-1.04-.15-1.44z"
        />
      </svg>
      {label}
    </Button>
  );
}
