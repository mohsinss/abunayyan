import type { Tier } from "@/lib/dashboard/types";
import { tierMeta } from "@/lib/dashboard/tokens";

export function TierBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  const meta = tierMeta[tier];
  return (
    <span
      className={`inline-block rounded-sm px-2.5 py-[3px] font-mono text-[9px] font-medium uppercase tracking-[1.3px] ${className}`}
      style={{ backgroundColor: meta.soft, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}
