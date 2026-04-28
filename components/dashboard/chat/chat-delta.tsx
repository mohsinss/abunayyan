"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { DeltaArgs } from "@/lib/chatbots/tools/render-delta";

export type { DeltaArgs };

function fmt(n: number, precision: number, unit?: string) {
  const s = n.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return unit ? `${s} ${unit}` : s;
}

function resolveTone(args: DeltaArgs): "good" | "bad" | "neutral" {
  if (args.tone && args.tone !== "auto") return args.tone;
  const change = args.after - args.before;
  if (Math.abs(change) < 1e-9) return "neutral";
  const dir = args.direction ?? "higher-is-better";
  if (dir === "higher-is-better") return change > 0 ? "good" : "bad";
  return change < 0 ? "good" : "bad";
}

export function ChatDelta({ args }: { args: DeltaArgs }) {
  const precision = args.precision ?? 0;
  const change = args.after - args.before;
  const tone = resolveTone(args);
  const Icon =
    Math.abs(change) < 1e-9 ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight;
  const toneCls =
    tone === "good"
      ? "text-[#0e8a5f]"
      : tone === "bad"
        ? "text-[#c8463a]"
        : "text-atlas-ink-3";

  const beforeStr = fmt(args.before, precision, args.unit);
  const afterStr = fmt(args.after, precision, args.unit);
  const changeStr = (change > 0 ? "+" : "") + fmt(change, precision, args.unit);

  return (
    <div className="my-3 rounded-md border border-atlas-line bg-atlas-bg-2 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3">
        {args.label}
      </div>
      <div className="mt-1 flex items-baseline gap-3 font-sans tabular-nums">
        <span className="text-[18px] font-medium text-atlas-ink-3">{beforeStr}</span>
        <span className="text-[14px] text-atlas-ink-3">→</span>
        <span className="text-[26px] font-semibold leading-none text-atlas-ink">
          {afterStr}
        </span>
      </div>
      <div className={`mt-1.5 flex items-center gap-1 text-[12px] font-medium ${toneCls}`}>
        <Icon className="size-3.5" />
        <span className="tabular-nums">{changeStr}</span>
        {args.hint ? (
          <span className="ml-2 text-atlas-ink-3">· {args.hint}</span>
        ) : null}
      </div>
    </div>
  );
}
