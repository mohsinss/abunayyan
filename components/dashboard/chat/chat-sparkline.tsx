"use client";

import type { SparklineArgs } from "@/lib/chatbots/tools/render-sparkline";

export type { SparklineArgs };

const W = 120;
const H = 30;
const PAD = 2;

function buildPath(values: number[]): { path: string; min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  return { path, min, max };
}

function colourFor(args: SparklineArgs): string {
  if (args.tone === "neutral" || !args.tone) return "#1a2233";
  const first = args.values[0]!;
  const last = args.values[args.values.length - 1]!;
  const rising = last >= first;
  if (args.tone === "up-good") return rising ? "#0e8a5f" : "#c8463a";
  return rising ? "#c8463a" : "#0e8a5f"; // up-bad
}

export function ChatSparkline({ args }: { args: SparklineArgs }) {
  const stroke = colourFor(args);
  const { path, min, max } = buildPath(args.values);
  const last = args.values[args.values.length - 1]!;
  const lastX = W - PAD;
  const lastY = H - PAD - ((last - min) / Math.max(max - min, 1)) * (H - PAD * 2);

  const headline =
    args.current ?? args.values[args.values.length - 1] ?? 0;
  const headlineStr = headline.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });

  return (
    <div className="my-2 flex items-center gap-3 rounded-md border border-atlas-line bg-atlas-bg-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3">
          {args.label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[18px] font-semibold leading-none tabular-nums text-atlas-ink">
            {headlineStr}
          </span>
          {args.unit ? (
            <span className="text-[10.5px] text-atlas-ink-3">{args.unit}</span>
          ) : null}
        </div>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="shrink-0"
        aria-hidden
      >
        <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r={2.5} fill={stroke} />
      </svg>
    </div>
  );
}
