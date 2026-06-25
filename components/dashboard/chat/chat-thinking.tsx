"use client";

import { useEffect, useState } from "react";

// Same navy palette as the WC Intelligence bubble (kept inline so the
// indicator renders identically wherever it's mounted).
const NAVY_2 = "#2964a9";
const NAVY_3 = "#418cc0";
const INK_SOFT = "#4a5568";
const LINE = "#e3e8f1";

// Rotating status lines. With one tool call per turn each chart is its own
// server round-trip, so between beats there's a real pause; cycling a label
// (the way ChatGPT rotates "Thinking… / Searching…") makes the wait read as
// progress rather than a hang.
const PHASES = [
  "Reading the workbook",
  "Crunching the figures",
  "Shaping the view",
  "Composing the answer",
];

/**
 * Live "working" indicator shown at the bottom of the thread whenever a turn
 * is in flight — including the quiet gaps between beats while the model runs
 * the next step. A light bar sweeps across a small tile and the label shimmers
 * and rotates, so the user always has motion to watch.
 */
export function ChatThinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % PHASES.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      <style jsx global>{`
        @keyframes wcxThinkSweep {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(320%);
          }
        }
        @keyframes wcxThinkShimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      <div
        className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md"
        style={{ border: `1px solid ${LINE}`, background: "#fff" }}
        aria-hidden
      >
        <div
          className="absolute inset-y-0 w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent, ${NAVY_3}, transparent)`,
            animation: "wcxThinkSweep 1.15s ease-in-out infinite",
          }}
        />
      </div>
      <span
        className="font-mono text-[10px] uppercase tracking-[1.4px]"
        style={{
          backgroundImage: `linear-gradient(90deg, ${INK_SOFT}, ${INK_SOFT} 35%, ${NAVY_2} 50%, ${INK_SOFT} 65%, ${INK_SOFT})`,
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "wcxThinkShimmer 1.6s linear infinite",
        }}
      >
        {PHASES[i]}…
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
