import Link from "next/link";
import { ShareButton } from "@/components/dashboard/share-button";

// Gradient app header used on the Working Capital & CCC dashboard and on
// the public /share/<slug> route. Replaces the default white app header
// for these routes and merges the Share action with the existing nav /
// theme / profile controls supplied via `rightSlot`.
export function BrandedHeader({
  shareSlug,
  rightSlot,
}: {
  shareSlug?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header
      className="text-white shadow-[0_6px_20px_rgba(11,51,120,0.18)]"
      style={{
        background:
          "linear-gradient(120deg,#06224f 0%,#0B3378 38%,#2964A9 78%,#418CC0 100%)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1520px] items-center justify-between gap-6 px-6 lg:px-9">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/25 bg-white/15 backdrop-blur"
              aria-hidden
            >
              <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
                <path
                  d="M4 26 L12 6 L20 22 L28 6"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="28" cy="26" r="2" fill="#fff" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold tracking-wide">
                Abunayyan Holding
              </span>
              <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-white/75">
                Group Finance · Working Capital Office
              </span>
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
