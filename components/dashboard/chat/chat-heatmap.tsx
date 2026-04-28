"use client";

import { useMemo } from "react";
import type { HeatmapArgs } from "@/lib/chatbots/tools/render-heatmap";

export type { HeatmapArgs };

// Two brand-aligned palettes. `navy` is a 5-stop light-to-dark ramp
// of the dashboard's brand blues — used for any non-negative metric.
// `diverging` (red ↔ white ↔ green) only kicks in when values cross
// zero. The previous off-brand `warm` palette is gone; the heatmap
// tool's schema no longer accepts it.
const PALETTES = {
  navy: ["#f0f6fd", "#cfe0f3", "#7fb0d4", "#418cc0", "#0b3378"],
  diverging: ["#c8463a", "#e89e8b", "#fafafa", "#9bcdb6", "#0e8a5f"],
} as const;

function lerpColour(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 0xff;
  const ag = (pa >> 8) & 0xff;
  const ab = pa & 0xff;
  const br = (pb >> 16) & 0xff;
  const bg = (pb >> 8) & 0xff;
  const bb = pb & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function colourAt(palette: readonly string[], t: number): string {
  if (t <= 0) return palette[0]!;
  if (t >= 1) return palette[palette.length - 1]!;
  const segs = palette.length - 1;
  const idx = Math.floor(t * segs);
  const localT = t * segs - idx;
  return lerpColour(palette[idx]!, palette[idx + 1]!, localT);
}

export function ChatHeatmap({ args }: { args: HeatmapArgs }) {
  const palette = PALETTES[args.scale?.palette ?? "navy"];
  const diverging = (args.scale?.palette ?? "navy") === "diverging";

  const { domainMin, domainMax } = useMemo(() => {
    const values = args.cells.map((c) => c.value);
    const computedMin = Math.min(...values);
    const computedMax = Math.max(...values);
    return {
      domainMin: args.scale?.min ?? computedMin,
      domainMax: args.scale?.max ?? computedMax,
    };
  }, [args.cells, args.scale?.min, args.scale?.max]);

  const cellByXY = useMemo(() => {
    const m = new Map<string, { value: number; label?: string }>();
    for (const c of args.cells) m.set(`${c.x}:${c.y}`, { value: c.value, label: c.label });
    return m;
  }, [args.cells]);

  function normalise(v: number): number {
    if (diverging) {
      // Spread -|max|..+|max| across [0,1] with 0 at 0.5.
      const span = Math.max(Math.abs(domainMin), Math.abs(domainMax));
      if (span === 0) return 0.5;
      return 0.5 + v / (2 * span);
    }
    if (domainMax === domainMin) return 0.5;
    return (v - domainMin) / (domainMax - domainMin);
  }

  return (
    <div className="my-3 rounded-md border border-atlas-line bg-atlas-bg-2 px-3 py-2.5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[1.2px] text-atlas-ink">
          {args.title}
        </h4>
        {args.unit ? (
          <span className="font-mono text-[10px] text-atlas-ink-3">{args.unit}</span>
        ) : null}
      </div>
      {args.description ? (
        <p className="mb-2 text-[11px] text-atlas-ink-3">{args.description}</p>
      ) : null}
      <div className="overflow-x-auto">
        <div
          className="grid w-fit gap-px bg-atlas-line"
          style={{
            gridTemplateColumns: `auto repeat(${args.xLabels.length}, minmax(28px, 1fr))`,
          }}
        >
          {/* Top-left empty corner */}
          <div className="bg-atlas-bg-2" />
          {/* x-axis labels */}
          {args.xLabels.map((x) => (
            <div
              key={`x-${x}`}
              className="truncate bg-atlas-bg-2 px-1 py-1 text-center font-mono text-[9.5px] text-atlas-ink-3"
              title={x}
            >
              {x}
            </div>
          ))}
          {/* rows */}
          {args.yLabels.map((y, yi) => (
            <RowFragment
              key={`y-${y}`}
              y={y}
              yIndex={yi}
              xLabels={args.xLabels}
              cellByXY={cellByXY}
              palette={palette}
              normalise={normalise}
              unit={args.unit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RowFragment({
  y,
  yIndex,
  xLabels,
  cellByXY,
  palette,
  normalise,
  unit,
}: {
  y: string;
  yIndex: number;
  xLabels: string[];
  cellByXY: Map<string, { value: number; label?: string }>;
  palette: readonly string[];
  normalise: (_v: number) => number;
  unit?: string;
}) {
  return (
    <>
      <div
        className="truncate bg-atlas-bg-2 px-1.5 py-1 font-mono text-[9.5px] text-atlas-ink-3"
        title={y}
      >
        {y}
      </div>
      {xLabels.map((_, xi) => {
        const cell = cellByXY.get(`${xi}:${yIndex}`);
        if (!cell) {
          return <div key={`c-${yIndex}-${xi}`} className="bg-atlas-bg-3 px-1 py-1.5" />;
        }
        const t = normalise(cell.value);
        const bg = colourAt(palette, t);
        const titleText = cell.label
          ? `${cell.label}\n${cell.value}${unit ? ` ${unit}` : ""}`
          : `${y} × ${xLabels[xi]}: ${cell.value}${unit ? ` ${unit}` : ""}`;
        return (
          <div
            key={`c-${yIndex}-${xi}`}
            className="px-1 py-1.5 text-center font-mono text-[9.5px] tabular-nums"
            style={{ background: bg, color: t > 0.6 ? "#fff" : "#1a2233" }}
            title={titleText}
          >
            {Math.round(cell.value)}
          </div>
        );
      })}
    </>
  );
}
