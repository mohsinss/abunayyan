"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareButton } from "@/components/dashboard/share-button";

// Gradient app header used on the Working Capital & CCC dashboard and on
// the public /share/<slug> route. Replaces the default white app header
// for these routes and merges the Share action with the existing nav /
// theme / profile controls supplied via `rightSlot`.
//
// On scroll inside the embedded dashboard iframe (which posts
// `{type:"dashboard-scroll", y}` messages), the header collapses to a
// compact height so the iframe's sticky metrics ticker has more room.
export function BrandedHeader({
  shareSlug,
  rightSlot,
}: {
  shareSlug?: string;
  rightSlot?: React.ReactNode;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    function update(y: number) {
      setCompact(y > 24);
    }
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; y?: number } | undefined;
      if (data?.type === "dashboard-scroll" && typeof data.y === "number") update(data.y);
    }
    function onWindowScroll() {
      update(window.scrollY);
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    onWindowScroll();
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  // Publish the current header height as a CSS variable so iframe pages
  // can size themselves with `calc(100dvh - var(--app-header-h))`.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-header-h",
      compact ? "3rem" : "4rem",
    );
    return () => {
      document.documentElement.style.removeProperty("--app-header-h");
    };
  }, [compact]);

  return (
    <header
      className="sticky top-0 z-40 text-white shadow-[0_6px_20px_rgba(11,51,120,0.18)] transition-[height] duration-200 ease-out"
      style={{
        background:
          "linear-gradient(120deg,#06224f 0%,#0B3378 38%,#2964A9 78%,#418CC0 100%)",
        height: compact ? "3rem" : "4rem",
      }}
    >
      <div className="mx-auto flex h-full max-w-[1520px] items-center justify-between gap-6 px-6 lg:px-9">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/dashboard" className="min-w-0">
            <span
              className={
                "block truncate font-semibold tracking-wide transition-[font-size] duration-200 " +
                (compact ? "text-[13px]" : "text-[15px]")
              }
            >
              Abunayyan Holding
            </span>
            <span
              className={
                "block truncate uppercase tracking-[0.18em] text-white/75 transition-all duration-200 " +
                (compact
                  ? "max-h-0 text-[0px] opacity-0"
                  : "max-h-4 text-[10px] opacity-100")
              }
            >
              Group Finance · Working Capital Office
            </span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <Link
              href="/dashboard"
              className="text-white/75 transition hover:text-white"
            >
              Dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {shareSlug ? <ShareButton slug={shareSlug} /> : null}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
