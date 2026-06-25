"use client";

import type { TurnActivity } from "./use-turn-activity";

// Same navy palette as the WC Intelligence bubble (kept inline so the
// indicator renders identically wherever it's mounted).
const NAVY_3 = "#418cc0";
const INK_SOFT = "#4a5568";
const LINE = "#e3e8f1";

// Rotating ring of fading dots — the iOS/Claude-style activity spinner. Built
// from positioned dots so it reads crisp at small sizes.
function DotRing({ size = 18, color = NAVY_3 }: { size?: number; color?: string }) {
  const dots = 8;
  const dot = Math.max(2, Math.round(size * 0.15));
  const radius = size * 0.42;
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0"
      style={{ width: size, height: size, animation: "wcxSpin 0.9s linear infinite" }}
    >
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            width: dot,
            height: dot,
            left: "50%",
            top: "50%",
            background: color,
            opacity: (i + 1) / dots,
            transform: `rotate(${i * (360 / dots)}deg) translateY(-${radius}px)`,
            transformOrigin: `${dot / 2}px ${dot / 2}px`,
            marginLeft: -dot / 2,
            marginTop: -dot / 2,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Live "working" indicator. The label and elapsed seconds come straight from
 * the runtime's stream state (see useTurnActivity), so it names the real
 * current action — a tool that's executing, or the quiet gap between beats —
 * and steps aside while prose streams.
 */
export function ChatActivity({ activity }: { activity: TurnActivity }) {
  return (
    <div className="flex items-center gap-2.5" role="status" aria-live="polite">
      <style jsx global>{`
        @keyframes wcxSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <DotRing />
      <span
        className="font-mono text-[10.5px] tracking-[0.3px]"
        style={{ color: INK_SOFT }}
      >
        {activity.label}…
        {activity.seconds >= 2 && (
          <span style={{ opacity: 0.55 }}>{`  ·  ${activity.seconds}s`}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Subtle terminator placed after the last assistant turn so the thread reads
 * as finished instead of stopping abruptly on a chart. Thin rule + caption.
 */
export function ChatDone() {
  return (
    <div className="flex select-none items-center gap-2 pt-0.5">
      <div
        className="h-px flex-1"
        style={{ background: `linear-gradient(90deg, transparent, ${LINE})` }}
      />
      <span
        className="font-mono text-[9px] uppercase tracking-[1.5px]"
        style={{ color: INK_SOFT, opacity: 0.8 }}
      >
        end of analysis · from the active workbook
      </span>
      <div
        className="h-px flex-1"
        style={{ background: `linear-gradient(90deg, ${LINE}, transparent)` }}
      />
    </div>
  );
}
