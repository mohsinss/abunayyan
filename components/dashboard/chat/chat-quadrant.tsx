"use client";

import { useMemo } from "react";
import type { QuadrantArgs } from "@/lib/chatbots/tools/render-quadrant";

export type { QuadrantArgs };

const W = 360;
const H = 240;
const PAD = { top: 16, right: 14, bottom: 28, left: 36 };

const TONE_COLOURS = {
  good: "#0e8a5f",
  bad: "#c8463a",
  warn: "#c98a2b",
  neutral: "#418cc0",
} as const;

export function ChatQuadrant({ args }: { args: QuadrantArgs }) {
  const { domainX, domainY } = useMemo(() => {
    const xs = args.points.map((p) => p.x);
    const ys = args.points.map((p) => p.y);
    const xMin = Math.min(args.xAxis.threshold, ...xs);
    const xMax = Math.max(args.xAxis.threshold, ...xs);
    const yMin = Math.min(args.yAxis.threshold, ...ys);
    const yMax = Math.max(args.yAxis.threshold, ...ys);
    // Add 8% margin on both sides so points don't sit on the frame.
    const xPad = (xMax - xMin || 1) * 0.08;
    const yPad = (yMax - yMin || 1) * 0.08;
    return {
      domainX: [xMin - xPad, xMax + xPad] as const,
      domainY: [yMin - yPad, yMax + yPad] as const,
    };
  }, [args.points, args.xAxis.threshold, args.yAxis.threshold]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  function toX(v: number) {
    return PAD.left + ((v - domainX[0]) / (domainX[1] - domainX[0])) * plotW;
  }
  function toY(v: number) {
    // SVG y grows downward; we want higher value = higher on screen.
    return PAD.top + plotH - ((v - domainY[0]) / (domainY[1] - domainY[0])) * plotH;
  }

  const xThr = toX(args.xAxis.threshold);
  const yThr = toY(args.yAxis.threshold);

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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={args.title}>
        {/* Quadrant fills (very faint) */}
        <rect x={PAD.left} y={PAD.top} width={xThr - PAD.left} height={yThr - PAD.top}
              fill="rgba(11,51,120,0.03)" />
        <rect x={xThr} y={PAD.top} width={W - PAD.right - xThr} height={yThr - PAD.top}
              fill="rgba(11,51,120,0.06)" />
        <rect x={PAD.left} y={yThr} width={xThr - PAD.left} height={H - PAD.bottom - yThr}
              fill="rgba(11,51,120,0.06)" />
        <rect x={xThr} y={yThr} width={W - PAD.right - xThr} height={H - PAD.bottom - yThr}
              fill="rgba(11,51,120,0.03)" />

        {/* Frame */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
              fill="none" stroke="#e3e8f1" strokeWidth={1} />

        {/* Threshold lines */}
        <line x1={xThr} y1={PAD.top} x2={xThr} y2={H - PAD.bottom}
              stroke="#7f7f7f" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={PAD.left} y1={yThr} x2={W - PAD.right} y2={yThr}
              stroke="#7f7f7f" strokeWidth={1} strokeDasharray="3 3" />

        {/* Quadrant labels */}
        {args.quadrants?.tl ? (
          <text x={PAD.left + 6} y={PAD.top + 12} fontSize={9} fill="#7f7f7f"
                fontFamily="monospace" textAnchor="start">
            {args.quadrants.tl.toUpperCase()}
          </text>
        ) : null}
        {args.quadrants?.tr ? (
          <text x={W - PAD.right - 6} y={PAD.top + 12} fontSize={9} fill="#7f7f7f"
                fontFamily="monospace" textAnchor="end">
            {args.quadrants.tr.toUpperCase()}
          </text>
        ) : null}
        {args.quadrants?.bl ? (
          <text x={PAD.left + 6} y={H - PAD.bottom - 4} fontSize={9} fill="#7f7f7f"
                fontFamily="monospace" textAnchor="start">
            {args.quadrants.bl.toUpperCase()}
          </text>
        ) : null}
        {args.quadrants?.br ? (
          <text x={W - PAD.right - 6} y={H - PAD.bottom - 4} fontSize={9} fill="#7f7f7f"
                fontFamily="monospace" textAnchor="end">
            {args.quadrants.br.toUpperCase()}
          </text>
        ) : null}

        {/* Points */}
        {args.points.map((p, i) => {
          const colour = TONE_COLOURS[p.tone ?? "neutral"];
          const r = p.size ?? 4;
          return (
            <g key={`${p.label}-${i}`}>
              <circle cx={toX(p.x)} cy={toY(p.y)} r={r} fill={colour} stroke="#fff" strokeWidth={1.5} />
              <text x={toX(p.x) + r + 3} y={toY(p.y) + 3} fontSize={9.5}
                    fill="#1a2233" fontFamily="sans-serif">
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={W / 2} y={H - 6} fontSize={10} fill="#7f7f7f" textAnchor="middle"
              fontFamily="sans-serif">
          {args.xAxis.label}{args.xAxis.unit ? ` (${args.xAxis.unit})` : ""}
        </text>
        <text
          x={-(H / 2)} y={12} fontSize={10} fill="#7f7f7f" textAnchor="middle"
          fontFamily="sans-serif" transform="rotate(-90)"
        >
          {args.yAxis.label}{args.yAxis.unit ? ` (${args.yAxis.unit})` : ""}
        </text>
      </svg>
    </div>
  );
}
