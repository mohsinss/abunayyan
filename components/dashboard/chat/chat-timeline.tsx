"use client";

import { useMemo } from "react";
import type { TimelineArgs } from "@/lib/chatbots/tools/render-timeline";

export type { TimelineArgs };

const TONE_COLOURS = {
  info: "#418cc0",
  good: "#0e8a5f",
  bad: "#c8463a",
  warn: "#c98a2b",
} as const;

const W = 360;
const LANE_H = 28;
const PAD = { top: 16, right: 12, bottom: 22, left: 8 };

function parseAt(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function formatTick(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

export function ChatTimeline({ args }: { args: TimelineArgs }) {
  const events = useMemo(
    () => args.events.map((e) => ({ ...e, ts: parseAt(e.at) })),
    [args.events],
  );

  const lanes = useMemo(() => {
    const seen = new Map<string, number>();
    let next = 0;
    for (const e of events) {
      const g = e.group ?? "_default";
      if (!seen.has(g)) seen.set(g, next++);
    }
    return seen;
  }, [events]);

  const fromMs = parseAt(args.range?.from ?? "") || Math.min(...events.map((e) => e.ts));
  const toMs = parseAt(args.range?.to ?? "") || Math.max(...events.map((e) => e.ts));
  const span = Math.max(1, toMs - fromMs);

  const plotW = W - PAD.left - PAD.right;
  const totalH = PAD.top + lanes.size * LANE_H + PAD.bottom;

  function toX(ms: number): number {
    return PAD.left + ((ms - fromMs) / span) * plotW;
  }

  return (
    <div className="my-3 rounded-md border border-atlas-line bg-atlas-bg-2 px-3 py-2.5">
      <div className="mb-1">
        <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[1.2px] text-atlas-ink">
          {args.title}
        </h4>
        {args.description ? (
          <p className="mt-0.5 text-[11px] text-atlas-ink-3">{args.description}</p>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${totalH}`} className="w-full" aria-label={args.title}>
        {/* Lane separators */}
        {Array.from(lanes).map(([groupName, lane]) => {
          const y = PAD.top + lane * LANE_H + LANE_H / 2;
          return (
            <g key={`lane-${groupName}`}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="#e3e8f1"
                strokeWidth={1}
              />
              {groupName !== "_default" ? (
                <text
                  x={PAD.left}
                  y={y - 4}
                  fontSize={9}
                  fill="#7f7f7f"
                  fontFamily="monospace"
                >
                  {groupName.toUpperCase()}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Range ticks: from / to */}
        <text
          x={PAD.left}
          y={totalH - 6}
          fontSize={9}
          fill="#7f7f7f"
          fontFamily="monospace"
        >
          {formatTick(fromMs)}
        </text>
        <text
          x={W - PAD.right}
          y={totalH - 6}
          fontSize={9}
          fill="#7f7f7f"
          fontFamily="monospace"
          textAnchor="end"
        >
          {formatTick(toMs)}
        </text>

        {/* Events */}
        {events.map((e, i) => {
          const lane = lanes.get(e.group ?? "_default") ?? 0;
          const cx = toX(e.ts);
          const cy = PAD.top + lane * LANE_H + LANE_H / 2;
          const colour = TONE_COLOURS[e.tone ?? "info"];
          const titleText = `${e.label}\n${formatTick(e.ts)}${e.detail ? `\n${e.detail}` : ""}`;
          return (
            <g key={`e-${i}`}>
              <title>{titleText}</title>
              <circle cx={cx} cy={cy} r={4} fill={colour} stroke="#fff" strokeWidth={1.5} />
              <text
                x={cx + 6}
                y={cy - 6}
                fontSize={9.5}
                fill="#1a2233"
                fontFamily="sans-serif"
              >
                {e.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
