"use client";
import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/share/${slug}`;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        ok = true;
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      ok = false;
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } else {
      window.prompt("Copy this share link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy public share link"
      className={
        "inline-flex items-center gap-2 rounded-full border font-semibold uppercase tracking-[0.14em] transition " +
        (compact ? "px-3 py-1 text-[10px] " : "px-4 py-2 text-[11px] ") +
        (copied
          ? "border-emerald-400 bg-emerald-500 text-white"
          : "border-white/30 bg-white/15 text-white backdrop-blur hover:-translate-y-px hover:border-white/50 hover:bg-white/25 hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)]")
      }
    >
      {copied ? (
        <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      ) : (
        <Share2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      <span>{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
